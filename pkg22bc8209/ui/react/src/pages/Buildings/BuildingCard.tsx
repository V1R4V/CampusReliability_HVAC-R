/*
 * BuildingCard — one campus building (FRONTEND §5.2): name, worst status pill (or the
 * filtered system's status), what it is for, its loop and plant, the three system dots,
 * the peak asset risk against the inspection threshold, and any work order awaiting
 * approval. Year built / GSF appear only if the snapshot ever carries them — never
 * invented. The whole card is one link to the building dashboard.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardList } from 'lucide-react';

import { Card } from '@/components/ui/card';
import ProvenanceChip from '@/components/ProvenanceChip/ProvenanceChip';
import CriticalityBadge from '@/components/StatusPill/CriticalityBadge';
import StatusPill from '@/components/StatusPill/StatusPill';
import RiskBar from '@/pages/Overview/RiskBar';
import { formatCompact, withAsOf } from '@/shared/api';
import { displayRisk, displayStatus, displayViaAsset, eraLabel, type BuildingRow, type SystemFilterValue } from './buildingRows';
import SystemDots from './SystemDots';

export interface BuildingCardProps {
  row: BuildingRow;
  system: SystemFilterValue;
  threshold: number;
  asOf: string;
}

export default function BuildingCard({ row, system, threshold, asOf }: BuildingCardProps) {
  const { building, segment, plant } = row;
  const status = displayStatus(row, system) ?? building.worst_status;
  const risk = displayRisk(row, system);
  const via = displayViaAsset(row, system);
  const hasFacts = building.year_built != null || building.gsf != null;

  return (
    <Link
      to={withAsOf(`/building/${building.building_id}`, asOf)}
      className="group block h-full rounded-[var(--c3-style-border-radius-6)] outline-none focus-visible:shadow-[0_0_0_2px_var(--c3-style-shadow-ring-accent)]"
    >
      <Card
        data-status={status}
        variant="outlined"
        size="md"
        className="h-full gap-3 transition-colors group-hover:border-[var(--bib-ink-muted)]"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[18px] font-semibold leading-6 text-[var(--bib-ink)]">{building.name}</h2>
          <StatusPill status={status} size="sm" />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[14px] leading-5 text-[var(--bib-ink-muted)]">
          <CriticalityBadge criticality={building.criticality} />
          <span>
            {building.segment_id}
            {segment ? ` · ${segment.name}` : ''}
          </span>
          {plant ? <span>· {plant.name}</span> : null}
        </div>

        {hasFacts ? (
          <div className="flex flex-wrap items-center gap-2 text-[14px] leading-5 text-[var(--bib-ink)]">
            {building.year_built != null ? (
              <span>
                Built {building.year_built} · {eraLabel(building.year_built)}
              </span>
            ) : null}
            {building.gsf != null ? <span>· {formatCompact(building.gsf)} GSF</span> : null}
            <ProvenanceChip kind="REAL" size="sm" title={building.source} />
          </div>
        ) : null}

        <SystemDots row={row} emphasis={system === 'all' ? null : system} />

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[14px] leading-5 text-[var(--bib-ink-muted)]">
          {risk != null ? (
            <RiskBar risk={risk} threshold={threshold} status={status} />
          ) : (
            <span>No tracked assets</span>
          )}
          {via ? <span className="truncate">via {via}</span> : null}
        </div>

        {row.pendingWorkOrders > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium leading-4 text-[var(--bib-wo)]">
            <ClipboardList className="size-3.5" aria-hidden />
            {row.pendingWorkOrders} work {row.pendingWorkOrders === 1 ? 'order' : 'orders'} pending approval
          </span>
        ) : null}

        <span className="mt-auto inline-flex items-center gap-1 text-[14px] font-medium leading-5 text-[var(--bib-ink-muted)] group-hover:text-[var(--bib-ink)]">
          Open dashboard <ArrowRight className="size-4" aria-hidden />
        </span>
      </Card>
    </Link>
  );
}
