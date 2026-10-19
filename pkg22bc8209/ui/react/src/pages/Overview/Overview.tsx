/*
 * Overview — Campus health (FRONTEND §5.1): "what needs attention today?"
 *
 * One call — `campusSnapshot(asOf)` via AsOfProvider — feeds the morning brief, the
 * KPI tiles, the network schematic and the ranked queue. Scrubbing the date re-reads
 * everything; while a new date loads the previous frame is held at reduced opacity.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';

import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { Panel, PanelState } from '@/components/Panel/Panel';
import SnapshotBanner from '@/components/Panel/SnapshotBanner';
import Schematic from '@/components/Schematic/Schematic';
import { useAsOf } from '@/contexts/AsOfProvider';
import { formatDate, withAsOf } from '@/shared/api';
import KpiRow from './KpiRow';
import MorningBrief from './MorningBrief';
import RankedQueue from './RankedQueue';

export default function Overview() {
  const navigate = useNavigate();
  const {
    asOf,
    snapshot,
    snapshotLoading,
    snapshotError,
    refreshSnapshot,
    threshold,
    systemFilter,
    setSystemFilter,
    pendingWorkOrders,
  } = useAsOf();

  const firstLoad = snapshotLoading && !snapshot;
  const hardError = !snapshot && !snapshotLoading ? snapshotError : null;

  return (
    <div className="flex min-h-full flex-col gap-4 p-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[22px] font-semibold leading-7 text-[var(--bib-ink)]">Campus health</h1>
          <p className="text-[15px] leading-5 text-[var(--bib-ink-muted)]">
            What needs attention as of <span className="font-semibold text-[var(--bib-ink)]">{formatDate(asOf)}</span>
            {snapshot
              ? ` · ${snapshot.buildings.length} buildings · ${snapshot.segments.length} loops · ${snapshot.plants.length} plants`
              : ''}
          </p>
        </div>
        {snapshotLoading && snapshot ? (
          <span className="inline-flex items-center gap-2 text-[13px] leading-4 text-[var(--bib-ink-muted)]">
            <Spinner size="sm" label="Updating" /> Updating…
          </span>
        ) : null}
      </header>

      <SnapshotBanner />

      <div className={cn('flex flex-col gap-4 transition-opacity', snapshotLoading && snapshot ? 'opacity-70' : 'opacity-100')}>
        <MorningBrief brief={snapshot?.morning_brief ?? null} asOf={asOf} loading={firstLoad} />

        <KpiRow kpis={snapshot?.kpis ?? null} pendingWorkOrders={pendingWorkOrders} loading={firstLoad} error={hardError} />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <Panel
            title="Campus network"
            subtitle="Plants feed chilled-water loops that serve buildings. Click a loop for its outage plan, a building for its dashboard."
            chip="SYNTHETIC"
            chipTitle="Loop topology is synthetic; plants and buildings are real."
          >
            {firstLoad ? (
              <PanelState state="loading" lines={6} />
            ) : !snapshot ? (
              <PanelState state="error" message={hardError ?? undefined} onRetry={refreshSnapshot} />
            ) : (
              <Schematic
                plants={snapshot.plants}
                segments={snapshot.segments}
                buildings={snapshot.buildings}
                onBuildingClick={(buildingId) => navigate(withAsOf(`/building/${buildingId}`, asOf))}
                onSegmentClick={(segmentId) => navigate(`/planb/${segmentId}`)}
              />
            )}
          </Panel>

          <RankedQueue
            queue={snapshot?.queue ?? []}
            asOf={asOf}
            threshold={threshold}
            filter={systemFilter}
            onFilterChange={setSystemFilter}
            loading={firstLoad}
            error={hardError}
            onRetry={refreshSnapshot}
          />
        </div>
      </div>
    </div>
  );
}
