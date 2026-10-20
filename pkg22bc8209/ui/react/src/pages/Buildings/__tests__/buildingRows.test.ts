/*
 * Per-building system status derived from the ranked queue: a loop-level asset (no building)
 * serves every building on its segment; the worst status wins; untracked systems stay null.
 */

import type { QueueItem, SnapshotBuilding, SnapshotPlant, SnapshotSegment } from '@/shared/api/contract';
import { buildRows, compareRows, countByStatus, displayStatus, matchesQuery, nextSort, sortRows } from '../buildingRows';

const item = (partial: Partial<QueueItem> & Pick<QueueItem, 'asset_id' | 'system' | 'status' | 'risk'>): QueueItem => ({
  name: partial.asset_id,
  type: 'chiller',
  segment_id: 'S3',
  building_id: null,
  days_in_status: 1,
  driver: 'energy',
  driver_label: 'energy +1%',
  energy_over_expected_pct: 1,
  impact: 1,
  rank_score: 1,
  buildings_served: 1,
  cost_per_day_usd: null,
  work_order_status: null,
  ...partial,
});

const buildings: SnapshotBuilding[] = [
  { building_id: 'chemistry_building', name: 'Chemistry Building', segment_id: 'S3', criticality: 'research_lab', worst_status: 'INSPECTION_DUE' },
  { building_id: 'vilas_hall', name: 'Vilas Hall', segment_id: 'S6', criticality: 'instruction', worst_status: 'HEALTHY' },
];
const segments = new Map<string, SnapshotSegment>([
  ['S3', { segment_id: 'S3', plant_id: 'CHARTER', name: 'Bascom Hill loop', worst_status: 'INSPECTION_DUE' }],
  ['S6', { segment_id: 'S6', plant_id: 'WCCF', name: 'Southeast loop', worst_status: 'HEALTHY' }],
]);
const plants = new Map<string, SnapshotPlant>([
  ['CHARTER', { plant_id: 'CHARTER', name: 'Charter Street Heating Plant' }],
  ['WCCF', { plant_id: 'WCCF', name: 'West Campus Cogeneration Facility' }],
]);
const queue: QueueItem[] = [
  item({ asset_id: 'S3-PIPE', system: 'cooling', status: 'INSPECTION_DUE', risk: 4.7, type: 'chw_main', work_order_status: 'PENDING_APPROVAL' }),
  item({ asset_id: 'CHA-CHL-2', system: 'cooling', status: 'HEALTHY', risk: 1.5 }),
  item({ asset_id: 'CHM-AHU-1', system: 'air', status: 'HEALTHY', risk: 0.8, building_id: 'chemistry_building', type: 'ahu' }),
  item({ asset_id: 'VIL-UH-2', system: 'heating', status: 'WATCH', risk: 2.4, building_id: 'vilas_hall', segment_id: 'S6', type: 'unit_heater' }),
];

describe('buildRows', () => {
  const rows = buildRows({ queue, buildings }, segments, plants);
  const chemistry = rows[0];
  const vilas = rows[1];

  it('gives a building the loop-level cooling asset and its own air handler', () => {
    expect(chemistry.systems.cooling).toMatchObject({ status: 'INSPECTION_DUE', risk: 4.7, viaAssetId: 'S3-PIPE', assetCount: 2 });
    expect(chemistry.systems.air).toMatchObject({ status: 'HEALTHY', viaAssetId: 'CHM-AHU-1' });
    expect(chemistry.systems.heating).toBeNull();
    expect(chemistry.trackedSystems).toEqual(['cooling', 'air']);
    expect(chemistry.peakAssetId).toBe('S3-PIPE');
    expect(chemistry.pendingWorkOrders).toBe(1);
    expect(chemistry.plant?.name).toBe('Charter Street Heating Plant');
  });

  it('does not leak another loop’s assets into a building', () => {
    expect(vilas.systems.cooling).toBeNull();
    expect(vilas.systems.heating).toMatchObject({ status: 'WATCH', viaAssetId: 'VIL-UH-2' });
  });

  it('filters, counts, searches and sorts consistently', () => {
    expect(displayStatus(chemistry, 'all')).toBe('INSPECTION_DUE');
    expect(displayStatus(chemistry, 'heating')).toBeNull();
    expect(countByStatus(rows, 'all')).toEqual({ FAILED: 0, INSPECTION_DUE: 1, WATCH: 0, HEALTHY: 1 });
    expect(countByStatus(rows, 'heating')).toEqual({ FAILED: 0, INSPECTION_DUE: 0, WATCH: 1, HEALTHY: 0 });
    expect(matchesQuery(chemistry, 'lab')).toBe(true);
    expect(matchesQuery(vilas, 'bascom')).toBe(false);
    expect([...rows].sort(compareRows('all')).map((r) => r.building.building_id)).toEqual(['chemistry_building', 'vilas_hall']);
    expect(sortRows(rows, { key: 'name', direction: 'desc' }, 'all').map((r) => r.building.name)).toEqual(['Vilas Hall', 'Chemistry Building']);
    expect(nextSort({ key: 'name', direction: 'asc' }, 'name')).toEqual({ key: 'name', direction: 'desc' });
    expect(nextSort({ key: 'name', direction: 'asc' }, 'risk')).toEqual({ key: 'risk', direction: 'asc' });
  });
});
