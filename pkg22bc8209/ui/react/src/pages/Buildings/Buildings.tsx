/*
 * Buildings (FRONTEND §5.2): every campus building as cards (worst-first, drag to reorder),
 * as a sortable table, or on the real campus map, with one status-coloured dot per building.
 * Each building also shows its three systems (cooling · heating · air) as icon + status dot,
 * derived from the snapshot's ranked queue (pages/Buildings/buildingRows.ts). Filter by
 * system (the same filter the Overview queue uses), by status, or by search; click a card,
 * a row or a dot to open the building dashboard.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, ClipboardList, LayoutGrid, List, Map as MapIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { InputSearch } from '@/components/ui/input-search';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useErrorReporter } from '@/components/ErrorBoundary/ErrorBoundary';
import CampusMap, { type MapBuilding } from '@/components/CampusMap/CampusMap';
import PageHeader from '@/components/PageHeader/PageHeader';
import { PanelState } from '@/components/Panel/Panel';
import SnapshotBanner from '@/components/Panel/SnapshotBanner';
import Reorderable from '@/components/Reorderable/Reorderable';
import CriticalityBadge from '@/components/StatusPill/CriticalityBadge';
import StatusPill from '@/components/StatusPill/StatusPill';
import SystemIcon from '@/components/SystemIcon/SystemIcon';
import { useAsOf, type SystemFilter } from '@/contexts/AsOfProvider';
import { STATUS_LABEL, STATUS_ORDER, errorMessage, formatDate, formatRisk, type Status } from '@/shared/api';
import { fetchBuildingGeo, fetchPlantGeo, type BuildingGeo, type PlantGeo } from '@/shared/api/geo';
import BuildingsTable from './BuildingsTable';
import {
  DEFAULT_SORT,
  buildRows,
  compareRows,
  countByStatus,
  displayRisk,
  displayStatus,
  matchesQuery,
  sortRows,
  type BuildingRow,
  type SortState,
  type ViewMode,
} from './buildingRows';
import SystemDots from './SystemDots';

const VIEW_KEY = 'bib.buildings.view';

const SYSTEM_TABS: { value: SystemFilter; label: string }[] = [
  { value: 'all', label: 'All systems' },
  { value: 'cooling', label: 'Cooling' },
  { value: 'heating', label: 'Heating' },
  { value: 'air', label: 'Air' },
];

const VIEWS: { value: ViewMode; label: string; icon: React.ReactNode }[] = [
  { value: 'cards', label: 'Cards', icon: <LayoutGrid /> },
  { value: 'table', label: 'Table', icon: <List /> },
  { value: 'map', label: 'Map', icon: <MapIcon /> },
];

function readView(): ViewMode {
  try {
    const stored = window.localStorage.getItem(VIEW_KEY);
    return stored === 'table' || stored === 'map' ? stored : 'cards';
  } catch {
    return 'cards';
  }
}

function BuildingCard({ row, system }: { row: BuildingRow; system: SystemFilter }) {
  const { building, segment, plant } = row;
  const status = displayStatus(row, system) ?? building.worst_status;
  const risk = displayRisk(row, system);
  const via = system === 'all' ? row.peakAssetId : row.systems[system]?.viaAssetId ?? null;
  return (
    <Link
      to={`/building/${building.building_id}`}
      className="group block h-full rounded-[var(--c3-style-border-radius-6)] outline-none focus-visible:shadow-[0_0_0_2px_var(--c3-style-shadow-ring-accent)]"
    >
      <article data-status={status} className="bib-card bib-card-interactive relative flex h-full flex-col gap-3 overflow-hidden p-4 pt-5">
        <span aria-hidden className="absolute inset-x-0 top-0 h-[4px] bg-[var(--bib-status-color)]" />
        <div className="flex items-start justify-between gap-3 pr-7">
          <CriticalityBadge criticality={building.criticality} />
          <StatusPill status={status} size="sm" />
        </div>
        <h2 className="text-[18px] font-semibold leading-6 text-[var(--bib-ink)]">{building.name}</h2>
        <SystemDots row={row} emphasis={system === 'all' ? null : system} />
        <dl className="flex flex-col gap-0.5 text-[14px] leading-5 text-[var(--bib-ink-muted)]">
          <div className="flex gap-2">
            <dt className="w-10 shrink-0">Loop</dt>
            <dd className="text-[var(--bib-ink-soft)]">
              {building.segment_id}
              {segment ? ` · ${segment.name}` : ''}
            </dd>
          </div>
          {plant ? (
            <div className="flex gap-2">
              <dt className="w-10 shrink-0">Plant</dt>
              <dd className="text-[var(--bib-ink-soft)]">{plant.name}</dd>
            </div>
          ) : null}
          {risk != null ? (
            <div className="flex gap-2">
              <dt className="w-10 shrink-0">Risk</dt>
              <dd className="text-[var(--bib-ink-soft)]">
                <span className="bib-num font-semibold text-[var(--bib-ink)]">{formatRisk(risk)}</span>
                {via ? <span className="bib-num"> via {via}</span> : null}
              </dd>
            </div>
          ) : null}
        </dl>
        <div className="mt-auto flex items-center justify-between gap-2 text-[14px] font-medium leading-5 text-[var(--bib-ink-muted)]">
          <span className="inline-flex items-center gap-1 transition-colors group-hover:text-[var(--bib-ink)]">
            Open dashboard <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
          {row.pendingWorkOrders > 0 ? (
            <span className="inline-flex items-center gap-1 text-[13px] text-[var(--bib-wo)]">
              <ClipboardList className="size-3.5" aria-hidden />
              {row.pendingWorkOrders} pending
            </span>
          ) : null}
        </div>
      </article>
    </Link>
  );
}

export default function Buildings() {
  const navigate = useNavigate();
  const { reportError } = useErrorReporter();
  const { asOf, threshold, snapshot, snapshotLoading, snapshotError, refreshSnapshot, segmentsById, plantsById, systemFilter, setSystemFilter } =
    useAsOf();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | null>(null);
  const [view, setView] = useState<ViewMode>(readView);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [geo, setGeo] = useState<{ buildings: BuildingGeo[]; plants: PlantGeo[] } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_KEY, view);
    } catch {
      // Storage unavailable: the choice still holds for this session.
    }
  }, [view]);

  // Coordinates don't change with the date; load once, only when the map is shown.
  useEffect(() => {
    if (view !== 'map' || geo) return;
    let cancelled = false;
    Promise.all([fetchBuildingGeo(), fetchPlantGeo()])
      .then(([buildings, plants]) => {
        if (!cancelled) setGeo({ buildings, plants });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        reportError(err);
        setGeoError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [view, geo, reportError]);

  const rows = useMemo(() => (snapshot ? buildRows(snapshot, segmentsById, plantsById) : []), [snapshot, segmentsById, plantsById]);

  // Search first, so the status chips count what the search left.
  const searched = useMemo(() => {
    const needle = query.trim();
    return needle ? rows.filter((row) => matchesQuery(row, needle)) : rows;
  }, [rows, query]);

  const counts = useMemo(() => countByStatus(searched, systemFilter), [searched, systemFilter]);

  const filtered = useMemo(
    () => (statusFilter ? searched.filter((row) => displayStatus(row, systemFilter) === statusFilter) : searched),
    [searched, statusFilter, systemFilter],
  );

  const cardRows = useMemo(() => [...filtered].sort(compareRows(systemFilter)), [filtered, systemFilter]);
  const tableRows = useMemo(() => sortRows(filtered, sort, systemFilter), [filtered, sort, systemFilter]);
  const attention = useMemo(() => rows.filter((row) => (displayStatus(row, systemFilter) ?? 'HEALTHY') !== 'HEALTHY').length, [rows, systemFilter]);

  const mapBuildings = useMemo<MapBuilding[]>(() => {
    if (!geo) return [];
    const byId = new Map(filtered.map((row) => [row.building.building_id, row] as const));
    return geo.buildings
      .map((g): MapBuilding | null => {
        const row = byId.get(g.building_id);
        if (!row) return null;
        return {
          building_id: g.building_id,
          name: row.building.name,
          lat: g.lat,
          lon: g.lon,
          status: displayStatus(row, systemFilter) ?? row.building.worst_status,
          subtitle: row.segment ? `${row.segment.segment_id} · ${row.segment.name}` : row.building.segment_id,
          plant_id: row.segment?.plant_id ?? null,
        };
      })
      .filter((b): b is MapBuilding => b !== null);
  }, [geo, filtered, systemFilter]);

  const cardItems = useMemo(
    () => cardRows.map((row) => ({ id: row.building.building_id, node: <BuildingCard row={row} system={systemFilter} /> })),
    [cardRows, systemFilter],
  );

  const firstLoad = snapshotLoading && !snapshot;
  const emptyMessage =
    query || statusFilter
      ? `No buildings match ${query ? `“${query}”` : ''}${query && statusFilter ? ' and ' : ''}${statusFilter ? STATUS_LABEL[statusFilter].toLowerCase() : ''}${
          systemFilter !== 'all' ? ` for ${SYSTEM_TABS.find((t) => t.value === systemFilter)?.label.toLowerCase()}` : ''
        }.`
      : `No buildings in the snapshot for ${formatDate(asOf)}.`;

  return (
    <div className="flex min-h-full flex-col gap-5 p-6 xl:px-8">
      <PageHeader
        eyebrow="Every building at a glance"
        title="Buildings"
        icon={<Building2 />}
        meta={[
          <>
            As of <span className="font-semibold text-[var(--bib-ink)]">{formatDate(asOf)}</span>
          </>,
          snapshot ? `${rows.length} buildings` : null,
          snapshot ? `${snapshot.segments.length} loops` : null,
          snapshot ? (
            <>
              <span className="bib-num font-semibold text-[var(--bib-ink)]">{attention}</span> need attention
            </>
          ) : null,
        ]}
        actions={
          <>
            <div className="w-[280px] max-w-full">
              <InputSearch
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onClear={() => setQuery('')}
                placeholder="Search buildings, loops, uses"
                aria-label="Search buildings"
              />
            </div>
            <div role="group" aria-label="View as" className="flex gap-1">
              {VIEWS.map((option) => (
                <Button
                  key={option.value}
                  size="md"
                  variant={view === option.value ? 'solid' : 'outline'}
                  appearance="secondary"
                  aria-pressed={view === option.value}
                  leadingIcon={option.icon}
                  onClick={() => setView(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Tabs value={systemFilter} onValueChange={(value) => setSystemFilter(value as SystemFilter)} variant="boxed" size="md">
            <TabsList aria-label="Filter by equipment system">
              {SYSTEM_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5 px-3">
                  {tab.value !== 'all' ? <SystemIcon system={tab.value} size="sm" /> : null}
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {snapshot ? (
            <div role="group" aria-label="Filter by status" className="flex flex-wrap items-center gap-2">
              {STATUS_ORDER.map((status) => {
                const count = counts[status];
                const active = statusFilter === status;
                if (count === 0 && !active) return null;
                return (
                  <button
                    key={status}
                    type="button"
                    data-status={status}
                    aria-pressed={active}
                    onClick={() => setStatusFilter(active ? null : status)}
                    className={cn(
                      'inline-flex h-9 items-center gap-2 rounded-full border bg-[var(--bib-surface)] px-3.5 text-[14px] leading-5 outline-none transition-colors focus-visible:shadow-[0_0_0_2px_var(--c3-style-shadow-ring-accent)]',
                      active
                        ? 'border-[var(--bib-ink)] text-[var(--bib-ink)] shadow-[inset_0_0_0_1px_var(--bib-ink)]'
                        : 'border-[var(--bib-border)] text-[var(--bib-ink-soft)] hover:border-[var(--bib-border-strong)]',
                    )}
                  >
                    <span aria-hidden className="size-2.5 rounded-full bg-[var(--bib-status-color)]" />
                    <span className="bib-num font-semibold text-[var(--bib-ink)]">{count}</span>
                    {STATUS_LABEL[status]}
                  </button>
                );
              })}
              {statusFilter ? (
                <Button variant="ghost" appearance="secondary" size="sm" onClick={() => setStatusFilter(null)}>
                  Clear filter
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </PageHeader>

      <SnapshotBanner />

      {firstLoad ? (
        <PanelState state="loading" lines={6} />
      ) : !snapshot ? (
        <PanelState state="error" message={snapshotError ?? undefined} onRetry={refreshSnapshot} />
      ) : filtered.length === 0 ? (
        <PanelState state="empty" message={emptyMessage} />
      ) : view === 'map' ? (
        geoError ? (
          <PanelState state="error" message={geoError} onRetry={() => setGeoError(null)} />
        ) : !geo ? (
          <PanelState state="loading" lines={8} />
        ) : (
          <div className="bib-card flex flex-col gap-3 p-3">
            <div className="flex flex-wrap items-center gap-4 px-1 text-[13px] leading-4 text-[var(--bib-ink-muted)]">
              {STATUS_ORDER.map((status) => (
                <span key={status} data-status={status} className="inline-flex items-center gap-1.5">
                  <span className="inline-block size-3 rounded-full bg-[var(--bib-status-color)] ring-2 ring-[var(--bib-surface)]" aria-hidden />
                  {STATUS_LABEL[status]}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-4 rounded-[2px] bg-[var(--bib-ink)]" aria-hidden /> Plant
              </span>
              <span className="ml-auto">Real building locations · map © OpenStreetMap contributors</span>
            </div>
            <CampusMap
              buildings={mapBuildings}
              plants={geo.plants}
              onSelect={(id) => navigate(`/building/${id}`)}
              className={cn('h-[600px] w-full overflow-hidden rounded-[6px] transition-opacity', snapshotLoading ? 'opacity-70' : 'opacity-100')}
            />
          </div>
        )
      ) : view === 'table' ? (
        <div className={cn('bib-card p-2 transition-opacity', snapshotLoading ? 'opacity-70' : 'opacity-100')}>
          <BuildingsTable rows={tableRows} system={systemFilter} threshold={threshold} sort={sort} onSortChange={setSort} />
        </div>
      ) : (
        <Reorderable
          storageKey="buildings"
          items={cardItems}
          className={cn('grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4', snapshotLoading ? 'opacity-70' : 'opacity-100')}
        />
      )}
    </div>
  );
}
