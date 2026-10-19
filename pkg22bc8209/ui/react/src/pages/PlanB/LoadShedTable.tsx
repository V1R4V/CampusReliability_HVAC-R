/*
 * LoadShedTable — "Who loses cooling" (FRONTEND §5.5): the dispatch plan in priority
 * order (criticality, then peak load) with rental chillers and $/day per building.
 * Rows appear in step with the schematic reveal; non-staged rows (priority-only
 * mode) are struck and muted; the footer carries the totals once the reveal is done.
 */

import React from 'react';
import { Check, Minus } from 'lucide-react';

import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import CriticalityBadge from '@/components/StatusPill/CriticalityBadge';
import { formatNumber, formatUsd, type PlanBBuilding, type PlanBTotals } from '@/shared/api';

export interface LoadShedTableProps {
  rows: PlanBBuilding[];
  /** How many rows have been revealed so far (≥ rows.length when complete). */
  shown: number;
  totals: PlanBTotals;
  priorityOnly: boolean;
}

export default function LoadShedTable({ rows, shown, totals, priorityOnly }: LoadShedTableProps) {
  if (rows.length === 0) {
    return <p className="text-[15px] text-[var(--bib-ink-muted)]">No buildings on this loop.</p>;
  }
  const complete = shown >= rows.length;

  return (
    <Table size="sm">
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>Building</TableHead>
          <TableHead className="text-right">Peak load</TableHead>
          <TableHead className="text-right">Chillers</TableHead>
          <TableHead className="text-right">$/day</TableHead>
          <TableHead className="text-right">Staged</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => {
          const visible = index < shown;
          const muted = !row.staged;
          return (
            <TableRow
              key={row.building_id}
              className={cn(visible ? 'bib-rise' : 'invisible', muted && 'text-[var(--bib-ink-muted)]')}
              aria-hidden={!visible}
            >
              <TableCell className="tabular-nums">{row.order}</TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'text-[15px] font-medium leading-5',
                      muted ? 'line-through decoration-[var(--bib-ink-muted)]' : 'text-[var(--bib-ink)]',
                    )}
                  >
                    {row.name}
                  </span>
                  <CriticalityBadge criticality={row.criticality} />
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(row.peak_load_tons)} t</TableCell>
              <TableCell className="text-right tabular-nums">{muted ? '—' : row.chillers_needed}</TableCell>
              <TableCell className="text-right tabular-nums">{muted ? '—' : formatUsd(row.cost_per_day_usd)}</TableCell>
              <TableCell className="text-right">
                {row.staged ? (
                  <Check className="ml-auto size-4 text-[var(--bib-status-healthy)]" role="img" aria-label="Staged" />
                ) : (
                  <span className="inline-flex items-center gap-1 whitespace-nowrap text-[13px]">
                    <Minus className="size-3.5" aria-hidden />
                    not staged
                  </span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
      <TableFooter>
        <TableRow className={cn(!complete && 'invisible')} aria-hidden={!complete}>
          <TableCell />
          <TableCell className="font-semibold text-[var(--bib-ink)]">
            {totals.buildings} {totals.buildings === 1 ? 'building' : 'buildings'} staged
            {priorityOnly ? ` of ${rows.length}` : ''}
          </TableCell>
          <TableCell />
          <TableCell className="text-right font-semibold tabular-nums text-[var(--bib-ink)]">{totals.chillers}</TableCell>
          <TableCell className="text-right font-semibold tabular-nums text-[var(--bib-ink)]">
            {formatUsd(totals.cost_per_day_usd)}
          </TableCell>
          <TableCell className="whitespace-nowrap text-right text-[13px] text-[var(--bib-ink-muted)]">
            {formatUsd(totals.cost_per_week_usd)}/week
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
