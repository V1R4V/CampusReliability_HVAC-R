/*
 * Buildings (FRONTEND §5.2): every campus building either as cards (worst-first, drag
 * to reorder, searchable) or on the real campus map with one status-coloured dot per
 * building. Click a card or a dot to open the building dashboard.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, LayoutGrid, Map as MapIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { InputSearch } from '@/components/ui/input-search';
import { cn } from '@/lib/utils';
import { useErrorReporter } from '@/components/ErrorBoundary/ErrorBoundary';
import CampusMap, { type MapBuilding } from '@/components/CampusMap/CampusMap';
import { PanelState } from '@/components/Panel/Panel';
import SnapshotBanner from '@/components/Panel/SnapshotBanner';
import Reorderable from '@/components/Reorderable/Reorderable';
import CriticalityBadge from '@/components/StatusPill/CriticalityBadge';
import StatusPill from '@/components/StatusPill/StatusPill';
import { useAsOf } from '@/contexts/AsOfProvider';
import {
  CRITICALITY_WEIGHT,
  STATUS_LABEL,
  STATUS_RANK,
  errorMessage,
  formatDate,
  type SnapshotBuilding,
  type Status,
} from '@/shared/api';
import { fetchBuildingGeo, fetchPlantGeo, type BuildingGeo, type PlantGeo } from '@/shared/api/geo';

const STATUS_ORDER: Status[] = ['FAILED', 'INSPECTION_DUE', 'WATCH', 'HEALTHY'];
const VIEW_KEY = 'bib.buildings.view';
type View = 'cards' | 'map';

function readView(): View {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'map' ? 'map' : 'cards';
  } catch {
    return 'cards';
  }
}

function BuildingCard({
  building,
  segmentName,
  plantName,
}: {
  building: SnapshotBuilding;
  segmentName: string | null;
  plantName: string | null;
}) {
  return (
    <Link
      to={`/building/${building.building_id}`}
      className="group block h-full rounded-[var(--c3-style-border-radius-6)] outline-none focus-visible:shadow-[0_0_0_2px_var(--c3-style-shadow-ring-accent)]"
    >
      <Card
        data-status={building.worst_status}
        variant="outlined"
        size="md"
        className="h-full gap-3 transition-colors group-hover:border-[var(--bib-ink-muted)]"
      >
        <div className="flex items-start justify-between gap-3 pr-7">
          <h2 className="text-[18px] font-semibold leading-6 text-[var(--bib-ink)]">{building.name}</h2>
          <StatusPill status={building.worst_status} size="sm" />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[14px] leading-5 text-[var(--bib-ink-muted)]">
          <CriticalityBadge criticality={building.criticality} />
          <span>
            {building.segment_id}
            {segmentName ? ` · ${segmentName}` : ''}
          </span>
          {plantName ? <span>· {plantName}</span> : null}
        </div>
        <span className="mt-auto inline-flex items-center gap-1 text-[14px] font-medium leading-5 text-[var(--bib-ink-muted)] group-hover:text-[var(--bib-ink)]">
          Open dashboard <ArrowRight className="size-4" aria-hidden />
        </span>
      </Card>
    </Link>
  );
}

export default function Buildings() {
  const navigate = useNavigate();
  const { reportError } = useErrorReporter();
  const { asOf, snapshot, snapshotLoading, snapshotError, refreshSnapshot, segmentsById, plantsById } = useAsOf();
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>(readView);
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

  const buildings = useMemo(() => snapshot?.buildings ?? [], [snapshot]);

  const sorted = useMemo(
    () =>
      [...buildings].sort(
        (a, b) =>
          STATUS_RANK[a.worst_status] - STATUS_RANK[b.worst_status] ||
          (CRITICALITY_WEIGHT[b.criticality] ?? 0) - (CRITICALITY_WEIGHT[a.criticality] ?? 0) ||
          a.name.localeCompare(b.name),
      ),
    [buildings],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter((b) => {
      const segment = segmentsById.get(b.segment_id);
      return (
        b.name.toLowerCase().includes(needle) ||
        b.building_id.includes(needle) ||
        b.segment_id.toLowerCase().includes(needle) ||
        (segment?.name.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [sorted, query, segmentsById]);

  const summary = useMemo(
    () =>
      STATUS_ORDER.map((status) => ({ status, count: buildings.filter((b) => b.worst_status === status).length }))
        .filter((entry) => entry.count > 0)
        .map((entry) => `${entry.count} ${STATUS_LABEL[entry.status].toLowerCase()}`)
        .join(' · '),
    [buildings],
  );

  const mapBuildings = useMemo<MapBuilding[]>(() => {
    if (!geo) return [];
    const statusById = new Map(filtered.map((b) => [b.building_id, b] as const));
    return geo.buildings
      .map((g): MapBuilding | null => {
        const snap = statusById.get(g.building_id);
        if (!snap) return null;
        const segment = segmentsById.get(snap.segment_id);
        return {
          building_id: g.building_id,
          name: snap.name,
          lat: g.lat,
          lon: g.lon,
          status: snap.worst_status,
          subtitle: segment ? `${segment.segment_id} · ${segment.name}` : snap.segment_id,
          plant_id: segment?.plant_id ?? null,
        };
      })
      .filter((b): b is MapBuilding => b !== null);
  }, [geo, filtered, segmentsById]);

  const cardItems = useMemo(
    () =>
      filtered.map((building) => {
        const segment = segmentsById.get(building.segment_id) ?? null;
        const plant = segment ? plantsById.get(segment.plant_id) ?? null : null;
        return {
          id: building.building_id,
          node: <BuildingCard building={building} segmentName={segment?.name ?? null} plantName={plant?.name ?? null} />,
        };
      }),
    [filtered, segmentsById, plantsById],
  );

  const firstLoad = snapshotLoading && !snapshot;

  return (
    <div className="flex min-h-full flex-col gap-4 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold leading-7 text-[var(--bib-ink)]">Buildings</h1>
          <p className="text-[15px] leading-5 text-[var(--bib-ink-muted)]">
            {snapshot ? `${buildings.length} buildings` : 'Campus buildings'} as of{' '}
            <span className="font-semibold text-[var(--bib-ink)]">{formatDate(asOf)}</span>
            {summary ? ` · ${summary}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full max-w-[320px]">
            <InputSearch
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onClear={() => setQuery('')}
              placeholder="Search buildings or loops"
              aria-label="Search buildings"
            />
          </div>
          <div role="group" aria-label="View" className="flex gap-1">
            <Button
              size="md"
              variant={view === 'cards' ? 'solid' : 'outline'}
              appearance="secondary"
              aria-pressed={view === 'cards'}
              leadingIcon={<LayoutGrid />}
              onClick={() => setView('cards')}
            >
              Cards
            </Button>
            <Button
              size="md"
              variant={view === 'map' ? 'solid' : 'outline'}
              appearance="secondary"
              aria-pressed={view === 'map'}
              leadingIcon={<MapIcon />}
              onClick={() => setView('map')}
            >
              Map
            </Button>
          </div>
        </div>
      </header>

      <SnapshotBanner />

      {firstLoad ? (
        <PanelState state="loading" lines={6} />
      ) : !snapshot ? (
        <PanelState state="error" message={snapshotError ?? undefined} onRetry={refreshSnapshot} />
      ) : filtered.length === 0 ? (
        <PanelState
          state="empty"
          message={query ? `No buildings match “${query}”.` : `No buildings in the snapshot for ${formatDate(asOf)}.`}
        />
      ) : view === 'map' ? (
        geoError ? (
          <PanelState state="error" message={geoError} onRetry={() => setGeoError(null)} />
        ) : !geo ? (
          <PanelState state="loading" lines={8} />
        ) : (
          <Card variant="outlined" size="sm" className="gap-2">
            <div className="flex flex-wrap items-center gap-4 px-1 text-[13px] leading-4 text-[var(--bib-ink-muted)]">
              {STATUS_ORDER.map((status) => (
                <span key={status} className="inline-flex items-center gap-1.5">
                  <span className="inline-block size-3 rounded-full" data-status={status} style={{ backgroundColor: `var(--bib-status-${status === 'INSPECTION_DUE' ? 'due' : status.toLowerCase()})` }} aria-hidden />
                  {STATUS_LABEL[status]}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-4 rounded-[2px] bg-[var(--bib-ink-muted)]" aria-hidden /> Plant
              </span>
            </div>
            <CampusMap
              buildings={mapBuildings}
              plants={geo.plants}
              onSelect={(id) => navigate(`/building/${id}`)}
              className={cn('h-[560px] w-full transition-opacity', snapshotLoading ? 'opacity-70' : 'opacity-100')}
            />
          </Card>
        )
      ) : (
        <Reorderable
          storageKey="buildings"
          items={cardItems}
          className={cn('grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3', snapshotLoading ? 'opacity-70' : 'opacity-100')}
        />
      )}
    </div>
  );
}
