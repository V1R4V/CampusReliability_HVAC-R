/*
 * Buildings index (FRONTEND §5.2) — every campus building from `campusSnapshot(asOf)`
 * (shared through AsOfProvider, so the scrubber drives it): name, what it is for, loop and
 * plant, cooling / heating / air status, peak asset risk and the worst status. Worst first.
 * Filter by equipment system or status tier, search, switch between cards and a table;
 * every card and row opens the building dashboard. Year built / GSF render only if the
 * snapshot ever carries them — the contract does not today, and nothing here is invented.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PanelState } from '@/components/Panel/Panel';
import SnapshotBanner from '@/components/Panel/SnapshotBanner';
import { useAsOf } from '@/contexts/AsOfProvider';
import { STATUS_LABEL, formatDate, type Status } from '@/shared/api';
import BuildingCard from './BuildingCard';
import BuildingFilters from './BuildingFilters';
import BuildingsTable from './BuildingsTable';
import {
  STATUS_ORDER,
  buildRows,
  compareRows,
  countByStatus,
  displayStatus,
  matchesQuery,
  type SystemFilterValue,
  type ViewMode,
} from './buildingRows';

const VIEW_STORAGE_KEY = 'bib.buildings.view';

function readStoredView(): ViewMode {
  try {
    const stored = window.sessionStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === 'cards' || stored === 'table') return stored;
  } catch {
    // sessionStorage can be unavailable (private mode, blocked storage) — fall back to cards.
  }
  return 'cards';
}

export default function Buildings() {
  const { asOf, threshold, snapshot, snapshotLoading, snapshotError, refreshSnapshot, segmentsById, plantsById } = useAsOf();

  const [query, setQuery] = useState('');
  const [system, setSystem] = useState<SystemFilterValue>('all');
  const [statuses, setStatuses] = useState<ReadonlySet<Status>>(() => new Set<Status>());
  const [view, setView] = useState<ViewMode>(readStoredView);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      // Not worth surfacing — the view still works for this session.
    }
  }, [view]);

  const toggleStatus = useCallback((status: Status) => {
    setStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setQuery('');
    setSystem('all');
    setStatuses(new Set<Status>());
  }, []);

  const rows = useMemo(
    () => (snapshot ? buildRows(snapshot, segmentsById, plantsById) : []),
    [snapshot, segmentsById, plantsById],
  );

  // System filter first: it decides which status each building is judged by, so the
  // status chips count against it.
  const bySystem = useMemo(
    () => (system === 'all' ? rows : rows.filter((row) => row.systems[system] != null)),
    [rows, system],
  );
  const counts = useMemo(() => countByStatus(bySystem, system), [bySystem, system]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return bySystem
      .filter((row) => {
        const status = displayStatus(row, system);
        if (statuses.size > 0 && (status == null || !statuses.has(status))) return false;
        return needle ? matchesQuery(row, needle) : true;
      })
      .sort(compareRows(system));
  }, [bySystem, system, statuses, query]);

  const summary = useMemo(
    () =>
      STATUS_ORDER.map((status) => ({ status, count: rows.filter((row) => row.building.worst_status === status).length }))
        .filter((entry) => entry.count > 0)
        .map((entry) => `${entry.count} ${STATUS_LABEL[entry.status].toLowerCase()}`)
        .join(' · '),
    [rows],
  );

  const filtersActive = query.trim() !== '' || system !== 'all' || statuses.size > 0;
  const firstLoad = snapshotLoading && !snapshot;

  return (
    <div className="flex min-h-full flex-col gap-4 p-6">
      <header>
        <h1 className="text-[22px] font-semibold leading-7 text-[var(--bib-ink)]">Buildings</h1>
        <p className="text-[15px] leading-5 text-[var(--bib-ink-muted)]">
          {snapshot ? `${rows.length} buildings` : 'Campus buildings'} as of{' '}
          <span className="font-semibold text-[var(--bib-ink)]">{formatDate(asOf)}</span>
          {summary ? ` · ${summary}` : ''}
          {snapshot && filtersActive ? ` · showing ${filtered.length}` : ''}
        </p>
      </header>

      <BuildingFilters
        query={query}
        onQueryChange={setQuery}
        system={system}
        onSystemChange={setSystem}
        statuses={statuses}
        onToggleStatus={toggleStatus}
        counts={counts}
        view={view}
        onViewChange={setView}
      />

      <SnapshotBanner />

      {firstLoad ? (
        <PanelState state="loading" lines={6} />
      ) : !snapshot ? (
        <PanelState state="error" message={snapshotError ?? undefined} onRetry={refreshSnapshot} />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <PanelState
            state="empty"
            className="w-full"
            message={
              filtersActive
                ? `No buildings match these filters as of ${formatDate(asOf)}.`
                : `No buildings in the snapshot for ${formatDate(asOf)}.`
            }
          />
          {filtersActive ? (
            <Button variant="outline" appearance="secondary" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : (
        <div className={cn('transition-opacity', snapshotLoading ? 'opacity-70' : 'opacity-100')}>
          {view === 'table' ? (
            <BuildingsTable rows={filtered} system={system} threshold={threshold} asOf={asOf} />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((row) => (
                <li key={row.building.building_id} className="min-w-0">
                  <BuildingCard row={row} system={system} threshold={threshold} asOf={asOf} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
