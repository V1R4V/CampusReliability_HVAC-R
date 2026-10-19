/*
 * Buildings index (FRONTEND §5.2) — every campus building as a card: name, use
 * (criticality), loop + plant, worst system status. Worst-first, searchable; click →
 * the building dashboard. Facts like year built / GSF render only if the snapshot
 * ever carries them (not in the contract today) — never invented.
 */

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { InputSearch } from '@/components/ui/input-search';
import { cn } from '@/lib/utils';
import { PanelState } from '@/components/Panel/Panel';
import SnapshotBanner from '@/components/Panel/SnapshotBanner';
import ProvenanceChip from '@/components/ProvenanceChip/ProvenanceChip';
import CriticalityBadge from '@/components/StatusPill/CriticalityBadge';
import StatusPill from '@/components/StatusPill/StatusPill';
import { useAsOf } from '@/contexts/AsOfProvider';
import {
  CRITICALITY_WEIGHT,
  STATUS_LABEL,
  STATUS_RANK,
  formatCompact,
  formatDate,
  withAsOf,
  type SnapshotBuilding,
  type Status,
} from '@/shared/api';

const STATUS_ORDER: Status[] = ['FAILED', 'INSPECTION_DUE', 'WATCH', 'HEALTHY'];

function BuildingCard({
  building,
  segmentName,
  plantName,
  asOf,
}: {
  building: SnapshotBuilding;
  segmentName: string | null;
  plantName: string | null;
  asOf: string;
}) {
  const hasFacts = building.year_built != null || building.gsf != null;
  return (
    <Link
      to={withAsOf(`/building/${building.building_id}`, asOf)}
      className="group block h-full rounded-[var(--c3-style-border-radius-6)] outline-none focus-visible:shadow-[0_0_0_2px_var(--c3-style-shadow-ring-accent)]"
    >
      <Card
        data-status={building.worst_status}
        variant="outlined"
        size="md"
        className="h-full gap-3 transition-colors group-hover:border-[var(--bib-ink-muted)]"
      >
        <div className="flex items-start justify-between gap-3">
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
        {hasFacts ? (
          <div className="flex flex-wrap items-center gap-2 text-[14px] leading-5 text-[var(--bib-ink)]">
            {building.year_built != null ? <span>Built {building.year_built}</span> : null}
            {building.gsf != null ? <span>· {formatCompact(building.gsf)} GSF</span> : null}
            <ProvenanceChip kind="REAL" size="sm" title={building.source} />
          </div>
        ) : null}
        <span className="mt-auto inline-flex items-center gap-1 text-[14px] font-medium leading-5 text-[var(--bib-ink-muted)] group-hover:text-[var(--bib-ink)]">
          Open dashboard <ArrowRight className="size-4" aria-hidden />
        </span>
      </Card>
    </Link>
  );
}

export default function Buildings() {
  const { asOf, snapshot, snapshotLoading, snapshotError, refreshSnapshot, segmentsById, plantsById } = useAsOf();
  const [query, setQuery] = useState('');

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
        <div className="w-full max-w-[360px]">
          <InputSearch
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onClear={() => setQuery('')}
            placeholder="Search buildings or loops"
            aria-label="Search buildings"
          />
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
      ) : (
        <ul
          className={cn(
            'grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3',
            snapshotLoading ? 'opacity-70' : 'opacity-100',
          )}
        >
          {filtered.map((building) => {
            const segment = segmentsById.get(building.segment_id) ?? null;
            const plant = segment ? plantsById.get(segment.plant_id) ?? null : null;
            return (
              <li key={building.building_id} className="min-w-0">
                <BuildingCard
                  building={building}
                  segmentName={segment?.name ?? null}
                  plantName={plant?.name ?? null}
                  asOf={asOf}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
