/*
 * Buildings index — pure derivations from one `campusSnapshot(asOf)` (FRONTEND §5.2).
 *
 * The snapshot gives each building its worst status; the per-system picture comes from
 * `queue[]`, which lists every asset with its status and risk. An asset serves the
 * building it is attached to, or — when it has no building (a chilled-water main, a plant
 * chiller) — every building on its loop segment: the same rule `CampusSnapshot.compute`
 * uses for `worst_status`, so the dots here always agree with the pill. Nothing is
 * invented: a system with no tracked asset is `null` ("not tracked"), never "healthy".
 *
 * Pure module (imports only the contract) so Jest can test it directly.
 */

import {
  CRITICALITY_LABEL,
  CRITICALITY_WEIGHT,
  STATUS_RANK,
  SYSTEMS,
  type CampusSnapshot,
  type QueueItem,
  type SnapshotBuilding,
  type SnapshotPlant,
  type SnapshotSegment,
  type Status,
  type System,
} from '@/shared/api/contract';

export type SystemFilterValue = 'all' | System;
export type ViewMode = 'cards' | 'table' | 'map';

export interface BuildingSystemSummary {
  system: System;
  /** Worst status among the assets of this system serving the building. */
  status: Status;
  /** Highest risk among those assets. */
  risk: number;
  /** The asset carrying the worst status (highest risk on a tie). */
  viaAssetId: string;
  assetCount: number;
}

export interface BuildingRow {
  building: SnapshotBuilding;
  segment: SnapshotSegment | null;
  plant: SnapshotPlant | null;
  systems: Record<System, BuildingSystemSummary | null>;
  trackedSystems: System[];
  peakRisk: number | null;
  peakAssetId: string | null;
  assetCount: number;
  pendingWorkOrders: number;
}

function knownStatus(status: string | null | undefined): Status {
  return status != null && status in STATUS_RANK ? (status as Status) : 'HEALTHY';
}

function rank(status: Status | null): number {
  return status == null ? Number.POSITIVE_INFINITY : STATUS_RANK[status];
}

function summarise(system: System, assets: QueueItem[]): BuildingSystemSummary | null {
  if (assets.length === 0) return null;
  let worst = assets[0];
  let risk = 0;
  for (const asset of assets) {
    const assetRisk = asset.risk ?? 0;
    risk = Math.max(risk, assetRisk);
    const worse =
      rank(knownStatus(asset.status)) < rank(knownStatus(worst.status)) ||
      (knownStatus(asset.status) === knownStatus(worst.status) && assetRisk > (worst.risk ?? 0));
    if (worse) worst = asset;
  }
  return { system, status: knownStatus(worst.status), risk, viaAssetId: worst.asset_id, assetCount: assets.length };
}

function push<K>(map: Map<K, QueueItem[]>, key: K, item: QueueItem) {
  const list = map.get(key);
  if (list) list.push(item);
  else map.set(key, [item]);
}

/** One row per snapshot building with its three system summaries (see the module comment). */
export function buildRows(
  snapshot: Pick<CampusSnapshot, 'queue' | 'buildings'>,
  segmentsById: Map<string, SnapshotSegment>,
  plantsById: Map<string, SnapshotPlant>,
): BuildingRow[] {
  const byBuilding = new Map<string, QueueItem[]>();
  const bySegment = new Map<string, QueueItem[]>();
  for (const item of snapshot.queue ?? []) {
    if (item.building_id) push(byBuilding, item.building_id, item);
    else if (item.segment_id) push(bySegment, item.segment_id, item);
  }

  return (snapshot.buildings ?? []).map((building) => {
    const assets = [...(byBuilding.get(building.building_id) ?? []), ...(bySegment.get(building.segment_id) ?? [])];
    const systems: Record<System, BuildingSystemSummary | null> = {
      cooling: summarise('cooling', assets.filter((a) => a.system === 'cooling')),
      heating: summarise('heating', assets.filter((a) => a.system === 'heating')),
      air: summarise('air', assets.filter((a) => a.system === 'air')),
    };
    const peak = assets.reduce<QueueItem | null>(
      (best, asset) => (best == null || (asset.risk ?? 0) > (best.risk ?? 0) ? asset : best),
      null,
    );
    const segment = segmentsById.get(building.segment_id) ?? null;
    return {
      building,
      segment,
      plant: segment ? plantsById.get(segment.plant_id) ?? null : null,
      systems,
      trackedSystems: SYSTEMS.filter((system) => systems[system] != null),
      peakRisk: peak ? peak.risk ?? 0 : null,
      peakAssetId: peak ? peak.asset_id : null,
      assetCount: assets.length,
      pendingWorkOrders: assets.filter((a) => a.work_order_status === 'PENDING_APPROVAL').length,
    };
  });
}

/** The status a row is judged by: the building's worst, or one system's when filtered. */
export function displayStatus(row: BuildingRow, system: SystemFilterValue): Status | null {
  if (system === 'all') return knownStatus(row.building.worst_status);
  return row.systems[system]?.status ?? null;
}

/** Peak risk overall, or the filtered system's peak risk. */
export function displayRisk(row: BuildingRow, system: SystemFilterValue): number | null {
  if (system === 'all') return row.peakRisk;
  return row.systems[system]?.risk ?? null;
}

/** Worst status first, then higher risk, then what the building is for, then name. */
export function compareRows(system: SystemFilterValue) {
  return (a: BuildingRow, b: BuildingRow): number =>
    rank(displayStatus(a, system)) - rank(displayStatus(b, system)) ||
    (displayRisk(b, system) ?? 0) - (displayRisk(a, system) ?? 0) ||
    (CRITICALITY_WEIGHT[b.building.criticality] ?? 0) - (CRITICALITY_WEIGHT[a.building.criticality] ?? 0) ||
    a.building.name.localeCompare(b.building.name);
}

/** Case-insensitive match on name, id, loop, plant or use (e.g. "lab"). */
export function matchesQuery(row: BuildingRow, needle: string): boolean {
  const haystack = [
    row.building.name,
    row.building.building_id,
    row.building.segment_id,
    row.segment?.name ?? '',
    row.plant?.name ?? '',
    CRITICALITY_LABEL[row.building.criticality] ?? row.building.criticality,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle.toLowerCase());
}

export function countByStatus(rows: BuildingRow[], system: SystemFilterValue): Record<Status, number> {
  const counts: Record<Status, number> = { FAILED: 0, INSPECTION_DUE: 0, WATCH: 0, HEALTHY: 0 };
  for (const row of rows) {
    const status = displayStatus(row, system);
    if (status) counts[status] += 1;
  }
  return counts;
}

/* ───────────────────────────── Table sorting ─────────────────────────────────── */

export type SortKey = 'name' | 'criticality' | 'loop' | 'cooling' | 'heating' | 'air' | 'risk' | 'status';
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

/** Default sort: worst status first (the same order the cards use). */
export const DEFAULT_SORT: SortState = { key: 'status', direction: 'asc' };

/** Ascending order of a column: "asc" is worst status first, highest risk first, A to Z. */
function compareBy(key: SortKey, system: SystemFilterValue) {
  return (a: BuildingRow, b: BuildingRow): number => {
    switch (key) {
      case 'name':
        return a.building.name.localeCompare(b.building.name);
      case 'criticality':
        return (
          (CRITICALITY_WEIGHT[b.building.criticality] ?? 0) - (CRITICALITY_WEIGHT[a.building.criticality] ?? 0) ||
          a.building.name.localeCompare(b.building.name)
        );
      case 'loop':
        return a.building.segment_id.localeCompare(b.building.segment_id) || a.building.name.localeCompare(b.building.name);
      case 'cooling':
      case 'heating':
      case 'air': {
        const sa = a.systems[key];
        const sb = b.systems[key];
        return (
          rank(sa?.status ?? null) - rank(sb?.status ?? null) ||
          (sb?.risk ?? -1) - (sa?.risk ?? -1) ||
          a.building.name.localeCompare(b.building.name)
        );
      }
      case 'risk':
        return (displayRisk(b, system) ?? -1) - (displayRisk(a, system) ?? -1) || a.building.name.localeCompare(b.building.name);
      case 'status':
      default:
        return compareRows(system)(a, b);
    }
  };
}

/** A new array sorted by `sort`; "desc" reverses the column's natural order. */
export function sortRows(rows: BuildingRow[], sort: SortState, system: SystemFilterValue): BuildingRow[] {
  const compare = compareBy(sort.key, system);
  const sorted = [...rows].sort(compare);
  return sort.direction === 'desc' ? sorted.reverse() : sorted;
}

/** Click on a header: same column flips direction, a new column starts at its natural order. */
export function nextSort(current: SortState, key: SortKey): SortState {
  if (current.key !== key) return { key, direction: 'asc' };
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}
