/*
 * BuildingsTable — the Buildings index as a scannable, sortable table (FRONTEND §5.2): one
 * row per building with use, loop and plant, a status cell per system, the risk bar and the
 * status pill. Headers are buttons (aria-sort follows the active column); the building name
 * is a real link and the row itself navigates on click, so keyboard and pointer users both
 * get one click to the dashboard. Ported from Arnav's Buildings pass and given sorting.
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, ClipboardList } from 'lucide-react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import CriticalityBadge from '@/components/StatusPill/CriticalityBadge';
import StatusPill, { statusLabel } from '@/components/StatusPill/StatusPill';
import SystemIcon, { systemLabel } from '@/components/SystemIcon/SystemIcon';
import RiskBar from '@/pages/Overview/RiskBar';
import { SYSTEMS, formatRisk } from '@/shared/api';
import {
  displayRisk,
  displayStatus,
  nextSort,
  type BuildingRow,
  type BuildingSystemSummary,
  type SortKey,
  type SortState,
  type SystemFilterValue,
} from './buildingRows';

/** Hard cap on rendered rows — campus is ~16 buildings, but never render unbounded lists. */
const MAX_ROWS = 100;

/** True when the click started on something that navigates by itself (the name link). */
function clickedInteractive(event: React.MouseEvent<HTMLElement>): boolean {
  return (event.target as HTMLElement).closest('a, button') !== null;
}

function SystemCell({ summary, emphasised }: { summary: BuildingSystemSummary | null; emphasised: boolean }) {
  if (!summary) {
    return (
      <span data-status="OFFLINE" className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] leading-4 text-[var(--bib-ink-muted)]">
        <span aria-hidden className="size-2.5 shrink-0 rounded-full border border-dashed border-[var(--bib-status-offline)]" />
        Not tracked
      </span>
    );
  }
  return (
    <span
      data-status={summary.status}
      title={`via ${summary.viaAssetId} · ${summary.assetCount} ${summary.assetCount === 1 ? 'asset' : 'assets'}`}
      className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-[14px] leading-5', emphasised && 'font-semibold')}
    >
      <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-[var(--bib-status-color)]" />
      {statusLabel(summary.status)}
      <span className="bib-num text-[13px] text-[var(--bib-ink-muted)]">{formatRisk(summary.risk)}</span>
    </span>
  );
}

interface SortHeaderProps {
  label: React.ReactNode;
  /** Plain-text name for the sort button's accessible label. */
  name: string;
  columnKey: SortKey;
  sort: SortState;
  onSort: (sort: SortState) => void;
  className?: string;
}

function SortHeader({ label, name, columnKey, sort, onSort, className }: SortHeaderProps) {
  const active = sort.key === columnKey;
  const ariaSort: 'ascending' | 'descending' | 'none' = active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none';
  const Icon = active ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead aria-sort={ariaSort} className={className}>
      <button
        type="button"
        onClick={() => onSort(nextSort(sort, columnKey))}
        aria-label={`Sort by ${name}${active ? `, currently ${ariaSort}` : ''}`}
        className={cn(
          'inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm outline-none hover:text-[var(--bib-ink)] focus-visible:shadow-[0_0_0_2px_var(--c3-style-shadow-ring-accent)]',
          active ? 'text-[var(--bib-ink)]' : 'text-[var(--bib-ink-soft)]',
        )}
      >
        {label}
        <Icon className={cn('size-3.5', !active && 'opacity-40')} aria-hidden />
      </button>
    </TableHead>
  );
}

export interface BuildingsTableProps {
  /** Already filtered and sorted by the page. */
  rows: BuildingRow[];
  system: SystemFilterValue;
  threshold: number;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
}

export default function BuildingsTable({ rows, system, threshold, sort, onSortChange }: BuildingsTableProps) {
  const navigate = useNavigate();
  const visible = rows.slice(0, MAX_ROWS);
  const riskLabel = system === 'all' ? 'Peak risk' : `${systemLabel(system)} risk`;

  return (
    <div className="flex flex-col gap-2">
      <Table size="sm" hover>
        <caption className="sr-only">Campus buildings with the status of each system. Click a column header to sort.</caption>
        <TableHeader>
          <TableRow>
            <SortHeader label="Building" name="building name" columnKey="name" sort={sort} onSort={onSortChange} className="pl-4" />
            <SortHeader label="Use" name="use" columnKey="criticality" sort={sort} onSort={onSortChange} />
            <SortHeader label="Loop · plant" name="loop" columnKey="loop" sort={sort} onSort={onSortChange} />
            {SYSTEMS.map((s) => (
              <SortHeader
                key={s}
                columnKey={s}
                name={`${systemLabel(s).toLowerCase()} status`}
                sort={sort}
                onSort={onSortChange}
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <SystemIcon system={s} size="sm" />
                    {systemLabel(s)}
                  </span>
                }
              />
            ))}
            <SortHeader label={riskLabel} name={riskLabel.toLowerCase()} columnKey="risk" sort={sort} onSort={onSortChange} />
            <SortHeader label="Status" name="status" columnKey="status" sort={sort} onSort={onSortChange} className="pr-4" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((row) => {
            const { building, segment, plant } = row;
            const status = displayStatus(row, system) ?? building.worst_status;
            const risk = displayRisk(row, system);
            const href = `/building/${building.building_id}`;
            return (
              <TableRow
                key={building.building_id}
                data-status={status}
                className="cursor-pointer"
                onClick={(event) => {
                  if (!clickedInteractive(event)) navigate(href);
                }}
              >
                <TableCell className="pl-4">
                  <Link
                    to={href}
                    className="text-[15px] font-semibold text-[var(--bib-ink)] underline-offset-2 outline-none hover:underline focus-visible:underline focus-visible:shadow-[0_0_0_2px_var(--c3-style-shadow-ring-accent)]"
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
                      <span className="sr-only"> work orders pending approval</span>
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <CriticalityBadge criticality={building.criticality} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-[13px] leading-4 text-[var(--bib-ink-muted)]">
                  <span className="text-[14px] font-medium text-[var(--bib-ink)]">{building.segment_id}</span>
                  {segment ? ` · ${segment.name}` : ''}
                  {plant ? <div className="mt-0.5">{plant.name}</div> : null}
                </TableCell>
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
                <TableCell className="pr-4">
                  <StatusPill status={status} size="sm" />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {rows.length > MAX_ROWS ? (
        <p className="text-[13px] leading-4 text-[var(--bib-ink-muted)]">{rows.length - MAX_ROWS} more. Narrow the search or filters.</p>
      ) : null}
    </div>
  );
}
