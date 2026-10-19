/*
 * BuildingsTable — the Buildings index as a scannable table (FRONTEND §5.2): one row per
 * building with use, loop and plant, a status cell per system, the peak risk bar and the
 * status pill. Each row is one click to the building dashboard: the name is a real link
 * stretched over the row (no handlers on <tr>), so it is keyboard- and screen-reader-
 * accessible for free. "Built" appears only when the snapshot carries a year.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import CriticalityBadge from '@/components/StatusPill/CriticalityBadge';
import StatusPill, { statusLabel } from '@/components/StatusPill/StatusPill';
import SystemIcon, { systemLabel } from '@/components/SystemIcon/SystemIcon';
import RiskBar from '@/pages/Overview/RiskBar';
import { formatRisk, withAsOf } from '@/shared/api';
import {
  SYSTEMS,
  displayRisk,
  displayStatus,
  eraLabel,
  type BuildingRow,
  type BuildingSystemSummary,
  type SystemFilterValue,
} from './buildingRows';

/** Hard cap on rendered rows — campus is ~25 buildings, but never render unbounded lists. */
const MAX_ROWS = 100;

function SystemCell({ summary, emphasised }: { summary: BuildingSystemSummary | null; emphasised: boolean }) {
  if (!summary) {
    return <span className="text-[13px] text-[var(--bib-ink-muted)]">Not tracked</span>;
  }
  return (
    <span
      data-status={summary.status}
      title={`via ${summary.viaAssetId} · ${summary.assetCount} ${summary.assetCount === 1 ? 'asset' : 'assets'}`}
      className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] leading-4', emphasised && 'font-semibold')}
    >
      <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-[var(--bib-status-color)]" />
      {statusLabel(summary.status)}
      <span className="tabular-nums text-[var(--bib-ink-muted)]">{formatRisk(summary.risk)}</span>
    </span>
  );
}

export interface BuildingsTableProps {
  rows: BuildingRow[];
  system: SystemFilterValue;
  threshold: number;
  asOf: string;
}

export default function BuildingsTable({ rows, system, threshold, asOf }: BuildingsTableProps) {
  const showBuilt = rows.some((row) => row.building.year_built != null);
  const visible = rows.slice(0, MAX_ROWS);

  return (
    <div className="flex flex-col gap-2">
      <Table size="sm" hover>
        <TableHeader>
          <TableRow>
            <TableHead>Building</TableHead>
            <TableHead>Use</TableHead>
            <TableHead>Loop · plant</TableHead>
            {showBuilt ? <TableHead>Built</TableHead> : null}
            {SYSTEMS.map((s) => (
              <TableHead key={s}>
                <span className="inline-flex items-center gap-1.5">
                  <SystemIcon system={s} size="sm" />
                  {systemLabel(s)}
                </span>
              </TableHead>
            ))}
            <TableHead>{system === 'all' ? 'Peak risk' : `${systemLabel(system)} risk`}</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((row) => {
            const { building, segment, plant } = row;
            const status = displayStatus(row, system) ?? building.worst_status;
            const risk = displayRisk(row, system);
            return (
              <TableRow key={building.building_id} data-status={status} className="relative cursor-pointer">
                <TableCell>
                  <Link
                    to={withAsOf(`/building/${building.building_id}`, asOf)}
                    className="font-semibold text-[var(--bib-ink)] underline-offset-2 outline-none hover:underline focus-visible:underline after:absolute after:inset-0 after:content-['']"
                  >
                    {building.name}
                  </Link>
                  {row.pendingWorkOrders > 0 ? (
                    <span
                      className="ml-2 inline-flex items-center gap-1 align-middle text-[12px] font-medium text-[var(--bib-wo)]"
                      title={`${row.pendingWorkOrders} work ${row.pendingWorkOrders === 1 ? 'order' : 'orders'} pending approval`}
                    >
                      <ClipboardList className="size-3.5" aria-hidden />
                      {row.pendingWorkOrders}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <CriticalityBadge criticality={building.criticality} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-[13px] leading-4 text-[var(--bib-ink-muted)]">
                  <span className="text-[var(--bib-ink)]">{building.segment_id}</span>
                  {segment ? ` · ${segment.name}` : ''}
                  {plant ? <div>{plant.name}</div> : null}
                </TableCell>
                {showBuilt ? (
                  <TableCell className="whitespace-nowrap text-[13px] leading-4">
                    {building.year_built != null ? `${building.year_built} · ${eraLabel(building.year_built)}` : '—'}
                  </TableCell>
                ) : null}
                {SYSTEMS.map((s) => (
                  <TableCell key={s}>
                    <SystemCell summary={row.systems[s]} emphasised={system === s} />
                  </TableCell>
                ))}
                <TableCell>
                  {risk != null ? (
                    <RiskBar risk={risk} threshold={threshold} status={status} />
                  ) : (
                    <span className="text-[13px] text-[var(--bib-ink-muted)]">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusPill status={status} size="sm" />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {rows.length > MAX_ROWS ? (
        <p className="text-[13px] leading-4 text-[var(--bib-ink-muted)]">
          {rows.length - MAX_ROWS} more — narrow the search or filters.
        </p>
      ) : null}
    </div>
  );
}
