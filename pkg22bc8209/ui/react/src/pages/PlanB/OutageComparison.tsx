/*
 * OutageComparison — the Plan B punchline (FRONTEND §5.5): this scenario's rental
 * bill (ESTIMATE, counting up as buildings are dispatched) beside what the real
 * June 2026 outage actually cost (REAL: $15.8M, ~30 chillers, 23 closed + 11 partial;
 * the ~$111K/day burn rate is our estimate and says so).
 */

import React from 'react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import ProvenanceChip from '@/components/ProvenanceChip/ProvenanceChip';
import { Skeleton } from '@/components/Panel/Panel';
import {
  CHILLER_RENTAL_USD_PER_DAY,
  TONS_PER_RENTAL_CHILLER,
  daysBetween,
  formatDate,
  formatNumber,
  formatUsd,
  type PlanBResult,
  type Provenance,
} from '@/shared/api';

export interface RunningTotals {
  buildings: number;
  chillers: number;
  cost_per_day_usd: number;
}

export interface OutageComparisonProps {
  result: PlanBResult | null;
  loading: boolean;
  /** Totals over the buildings dispatched so far (equals result.totals when complete). */
  running: RunningTotals;
  tempF: number;
  segmentLabel: string;
  priorityOnly: boolean;
  complete: boolean;
}

function Big({ value, label, chip }: { value: React.ReactNode; label: React.ReactNode; chip?: Provenance }) {
  return (
    <div className="min-w-0">
      <div className="text-[40px] font-semibold leading-[44px] tracking-[-0.01em] text-[var(--bib-ink)]">{value}</div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[14px] leading-5 text-[var(--bib-ink-muted)]">
        {label}
        {chip ? <ProvenanceChip kind={chip} size="sm" /> : null}
      </div>
    </div>
  );
}

function CostBreakdown({ total, parts }: { total: number; parts: { label: string; value: number; className: string }[] }) {
  if (total <= 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" aria-hidden>
        {parts.map((part) => (
          <span
            key={part.label}
            className={cn('block h-full', part.className)}
            style={{ width: `${(part.value / total) * 100}%` }}
            title={`${part.label}: ${formatUsd(part.value)}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] leading-4 text-[var(--bib-ink-muted)]">
        {parts.map((part) => (
          <span key={part.label} className="inline-flex items-center gap-1.5">
            <span className={cn('inline-block size-2.5 rounded-[2px]', part.className)} aria-hidden />
            {part.label} {formatUsd(part.value)} · {Math.round((part.value / total) * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

export default function OutageComparison({
  result,
  loading,
  running,
  tempF,
  segmentLabel,
  priorityOnly,
  complete,
}: OutageComparisonProps) {
  const reference = result?.reference ?? null;
  const outageDays = reference ? daysBetween(reference.start_date, reference.reopen_date) : null;
  const weekly = running.cost_per_day_usd * 7;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card variant="outlined" size="md" className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold uppercase leading-4 tracking-[0.06em] text-[var(--bib-ink-muted)]">
              This scenario
            </div>
            <p className="mt-0.5 text-[15px] leading-5 text-[var(--bib-ink)]">
              {segmentLabel} fails on a {tempF}°F day · rental chillers staged for{' '}
              {priorityOnly ? 'priority buildings only' : 'every building'}
              {!complete ? ' · dispatching…' : ''}
            </p>
          </div>
          <ProvenanceChip kind="ESTIMATE" />
        </div>
        {loading ? (
          <Skeleton className="h-[44px] w-full" />
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <Big
              value={running.chillers}
              label={`rental chillers · ${running.buildings} ${running.buildings === 1 ? 'building' : 'buildings'}`}
            />
            <Big value={formatUsd(running.cost_per_day_usd, { perDay: true })} label="rental burn rate" />
            <Big value={formatUsd(weekly)} label="saved by one week of warning" />
          </div>
        )}
        <p className="text-[13px] leading-4 text-[var(--bib-ink-muted)]">
          ${formatNumber(CHILLER_RENTAL_USD_PER_DAY)} per {TONS_PER_RENTAL_CHILLER}-ton rental chiller per day
          {result ? ` · load factor ${result.load_factor.toFixed(2)} at ${result.temp_f}°F` : ''}
        </p>
      </Card>

      <Card variant="outlined" size="md" className="gap-3 border-[var(--bib-ink)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold uppercase leading-4 tracking-[0.06em] text-[var(--bib-ink-muted)]">
              What actually happened
            </div>
            <p className="mt-0.5 text-[15px] leading-5 text-[var(--bib-ink)]">
              {reference
                ? `${reference.label} · ${formatDate(reference.start_date)} until buildings reopened ${formatDate(reference.reopen_date)}${
                    outageDays != null ? ` (${outageDays} days)` : ''
                  }`
                : 'Real June 2026 outage'}
            </p>
          </div>
          <ProvenanceChip kind="REAL" />
        </div>
        {!reference ? (
          <Skeleton className="h-[44px] w-full" />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              <Big value={formatUsd(reference.total_usd)} label="total cost" chip="REAL" />
              <Big value={`~${reference.chillers}`} label="rental chillers" chip="REAL" />
              <Big
                value={formatUsd(reference.usd_per_day, { perDay: true, approx: true })}
                label="rental burn rate"
                chip="ESTIMATE"
              />
            </div>
            <CostBreakdown
              total={reference.total_usd}
              parts={[
                { label: 'Rentals', value: reference.rental_usd, className: 'bg-[var(--bib-ink)]' },
                { label: 'Deterioration found', value: reference.deterioration_usd, className: 'bg-[var(--bib-ink)]/60' },
                { label: 'Line repair', value: reference.repair_usd, className: 'bg-[var(--bib-ink)]/30' },
              ]}
            />
            <p className="text-[15px] leading-5 text-[var(--bib-ink)]">
              {reference.buildings_closed} buildings closed · {reference.buildings_partial} partly closed
            </p>
            <p className="text-[12px] leading-4 text-[var(--bib-ink-muted)]">Source: {reference.source}</p>
          </>
        )}
      </Card>
    </div>
  );
}
