/*
 * OutageComparison — the Plan B punchline (FRONTEND §5.5): this scenario's rental
 * bill (counting up as buildings are dispatched) beside what the real June 2026 outage
 * actually cost ($15.8M, ~30 chillers, 23 closed + 11 partial; the ~$111K/day burn rate
 * is our estimate). The real event sits on the dark hero surface so the comparison
 * reads left-to-right: "this is what we'd stage" → "this is what it cost to be surprised".
 */

import React from 'react';
import { CalendarClock, Sparkles } from 'lucide-react';

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

function Big({
  value,
  unit,
  label,
  chip,
  hero = false,
}: {
  value: React.ReactNode;
  /** Small suffix after the number, e.g. "/day" — kept off the number so it never wraps mid-word. */
  unit?: string;
  label: React.ReactNode;
  chip?: Provenance;
  hero?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className={cn('bib-num flex flex-wrap items-baseline gap-x-1 text-[34px] font-semibold leading-10', hero ? 'text-white' : 'text-[var(--bib-ink)]')}>
        <span>{value}</span>
        {unit ? <span className={cn('text-[16px] font-medium', hero ? 'text-white/70' : 'text-[var(--bib-ink-muted)]')}>{unit}</span> : null}
      </div>
      <div className={cn('mt-1 flex flex-wrap items-center gap-1.5 text-[14px] leading-5', hero ? 'bib-hero-muted' : 'text-[var(--bib-ink-muted)]')}>
        {label}
        {chip ? <ProvenanceChip kind={chip} size="sm" /> : null}
      </div>
    </div>
  );
}

function CostBreakdown({ total, parts }: { total: number; parts: { label: string; value: number; className: string }[] }) {
  if (total <= 0) return null;
  return (
    <div className="flex flex-col gap-2">
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
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] leading-4 text-white/70">
        {parts.map((part) => (
          <span key={part.label} className="inline-flex items-center gap-1.5">
            <span className={cn('inline-block size-2.5 rounded-[2px]', part.className)} aria-hidden />
            {part.label} <span className="bib-num text-white">{formatUsd(part.value)}</span> · {Math.round((part.value / total) * 100)}%
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
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="bib-card flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="bib-icon-tile size-9 [&_svg]:size-5">
              <Sparkles aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="bib-eyebrow">This scenario</div>
              <p className="mt-0.5 text-[15px] leading-5 text-[var(--bib-ink)]">
                {segmentLabel} fails on a {tempF}°F day · rental chillers staged for{' '}
                {priorityOnly ? 'priority buildings only' : 'every building'}
                {!complete ? ' · dispatching…' : ''}
              </p>
            </div>
          </div>
          <ProvenanceChip kind="ESTIMATE" />
        </div>
        {loading ? (
          <Skeleton className="h-[44px] w-full" />
        ) : (
          <div className="grid grid-cols-3 gap-5">
            <Big
              value={running.chillers}
              label={`rental chillers · ${running.buildings} ${running.buildings === 1 ? 'building' : 'buildings'}`}
            />
            <Big value={formatUsd(running.cost_per_day_usd)} unit="/day" label="rental burn rate" />
            <Big value={formatUsd(weekly)} label="saved by one week of warning" />
          </div>
        )}
        <p className="mt-auto border-t border-[var(--bib-border)] pt-3 text-[13px] leading-4 text-[var(--bib-ink-muted)]">
          ${formatNumber(CHILLER_RENTAL_USD_PER_DAY)} per {TONS_PER_RENTAL_CHILLER}-ton rental chiller per day
          {result ? ` · load factor ${result.load_factor.toFixed(2)} at ${result.temp_f}°F` : ''}
        </p>
      </section>

      <section className="bib-hero flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="bib-hero-tile size-9 [&_svg]:size-5">
              <CalendarClock aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="bib-eyebrow text-white/70">What actually happened</div>
              <p className="mt-0.5 text-[15px] leading-5 text-white">
                {reference
                  ? `${reference.label} · ${formatDate(reference.start_date)} until buildings reopened ${formatDate(reference.reopen_date)}${
                      outageDays != null ? ` (${outageDays} days)` : ''
                    }`
                  : 'Real June 2026 outage'}
              </p>
            </div>
          </div>
          <ProvenanceChip kind="REAL" />
        </div>
        {!reference ? (
          <Skeleton className="h-[44px] w-full opacity-30" />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-5">
              <Big hero value={formatUsd(reference.total_usd)} label="total cost" chip="REAL" />
              <Big hero value={`~${reference.chillers}`} label="rental chillers" chip="REAL" />
              <Big
                hero
                value={formatUsd(reference.usd_per_day, { approx: true })}
                unit="/day"
                label="rental burn rate (estimate)"
                chip="ESTIMATE"
              />
            </div>
            <CostBreakdown
              total={reference.total_usd}
              parts={[
                { label: 'Rentals', value: reference.rental_usd, className: 'bg-white' },
                { label: 'Deterioration found', value: reference.deterioration_usd, className: 'bg-white/55' },
                { label: 'Line repair', value: reference.repair_usd, className: 'bg-white/25' },
              ]}
            />
            <div className="mt-auto flex flex-wrap items-end justify-between gap-2 border-t border-white/10 pt-3">
              <p className="text-[15px] leading-5 text-white">
                {reference.buildings_closed} buildings closed · {reference.buildings_partial} partly closed
              </p>
              <p className="text-[12px] leading-4 text-white/55">Source: {reference.source}</p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
