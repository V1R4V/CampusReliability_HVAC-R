/*
 * EarlyWarningHero — the Backtest's headline (FRONTEND §5.7, PLAN §7 step 6): how many
 * days before the June 17 reenactment the pipeline said "inspection due", beside what the
 * real June 17 break cost. The lead time is read from `backtest(threshold).failures` for
 * the asset behind the real reference event — never typed in — so it moves with the slider
 * and with the model. SYNTHETIC on the replay, REAL on the bill, ESTIMATE on $/day.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import ProvenanceChip from '@/components/ProvenanceChip/ProvenanceChip';
import { Skeleton } from '@/components/Panel/Panel';
import {
  daysBetween,
  formatDate,
  formatThreshold,
  formatUsd,
  withAsOf,
  type BacktestFailure,
  type FailureEvent,
} from '@/shared/api';
import { REAL_OUTAGE, REAL_RENTAL_SHARE_PCT, formatRealUsd } from './realOutage';

const LABEL = 'text-[13px] font-semibold uppercase leading-4 tracking-[0.06em] text-[var(--bib-ink-muted)]';
const HERO = 'text-[48px] font-semibold leading-[52px] tracking-[-0.01em] tabular-nums';

export interface EarlyWarningHeroProps {
  /** The planted failure that reenacts the real break — null while loading or if absent. */
  reenactment: BacktestFailure | null;
  /** Its event row, for the label ("Reenactment of the real June 17 event"). */
  reenactmentEvent: FailureEvent | null;
  threshold: number;
  asOf: string;
  loading: boolean;
}

export default function EarlyWarningHero({ reenactment, reenactmentEvent, threshold, asOf, loading }: EarlyWarningHeroProps) {
  const missed = reenactment != null && (reenactment.lead_days == null || reenactment.first_due_date == null);
  const outageDays = daysBetween(REAL_OUTAGE.start_date, REAL_OUTAGE.reopen_date);

  let warning: React.ReactNode;
  if (loading && !reenactment) {
    warning = <Skeleton className="h-[52px] w-2/3" />;
  } else if (!reenactment) {
    warning = (
      <p className="text-[16px] leading-6 text-[var(--bib-ink-muted)]">
        No planted reenactment of the June 17 break in this run.
      </p>
    );
  } else if (missed) {
    warning = (
      <>
        <div className={cn(HERO, 'text-[var(--bib-status-due)]')}>Missed</div>
        <p className="text-[16px] leading-6 text-[var(--bib-ink)]">
          At threshold {formatThreshold(threshold)},{' '}
          <Link to={withAsOf(`/asset/${reenactment.asset_id}`, asOf)} className="font-semibold underline-offset-2 hover:underline">
            {reenactment.asset_id}
          </Link>{' '}
          never reached “inspection due” before it failed on {formatDate(reenactment.failure_date)}. Lower the threshold and
          the warning comes back — at the price of more false alarms.
        </p>
      </>
    );
  } else {
    warning = (
      <>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className={cn(HERO, 'text-[var(--bib-ink)]')}>{reenactment.lead_days}</span>
          <span className="text-[22px] font-medium leading-7 text-[var(--bib-ink-muted)]">days of warning</span>
        </div>
        <p className="text-[16px] leading-6 text-[var(--bib-ink)]">
          <Link to={withAsOf(`/asset/${reenactment.asset_id}`, asOf)} className="font-semibold underline-offset-2 hover:underline">
            {reenactment.asset_id}
          </Link>{' '}
          was flagged <span className="font-semibold">inspection due</span> on {formatDate(reenactment.first_due_date)} —{' '}
          {reenactment.lead_days} days before the reenacted break on {formatDate(reenactment.failure_date)}, at threshold{' '}
          {formatThreshold(threshold)}.
        </p>
      </>
    );
  }

  return (
    <Card variant="outlined" size="lg" className="gap-4 border-[var(--bib-ink)]">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={LABEL}>Early warning · June 17 reenactment</span>
            <ProvenanceChip
              kind="SYNTHETIC"
              size="sm"
              title="A planted failure on synthetic sensor data. It proves the pipeline, not that the real break was predictable."
            />
          </div>
          {warning}
          {reenactment ? (
            <Link
              to={withAsOf(`/asset/${reenactment.asset_id}`, asOf)}
              className="inline-flex items-center gap-1 text-[14px] font-medium leading-5 text-[var(--bib-ink-muted)] underline-offset-2 hover:text-[var(--bib-ink)] hover:underline"
            >
              {reenactmentEvent?.label ?? `Open ${reenactment.asset_id}`} <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-2 border-t border-[var(--bib-border)] pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={LABEL}>What the real break cost</span>
            <ProvenanceChip kind="REAL" size="sm" title={REAL_OUTAGE.source} />
          </div>
          <div className={cn(HERO, 'text-[var(--bib-ink)]')}>{formatRealUsd(REAL_OUTAGE.total_usd)}</div>
          <p className="text-[15px] leading-5 text-[var(--bib-ink)]">
            {REAL_OUTAGE.buildings_closed} buildings closed · {REAL_OUTAGE.buildings_partial} partly closed ·{' '}
            {formatDate(REAL_OUTAGE.start_date)} → reopened {formatDate(REAL_OUTAGE.reopen_date)} ({outageDays} days)
          </p>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[14px] leading-5 text-[var(--bib-ink-muted)]">
            ~{REAL_OUTAGE.chillers} rental chillers · {formatUsd(REAL_OUTAGE.usd_per_day, { perDay: true, approx: true })}
            <ProvenanceChip kind="ESTIMATE" size="sm" />
          </p>
        </div>
      </div>

      <p className="border-t border-[var(--bib-border)] pt-3 text-[15px] leading-5 text-[var(--bib-ink)]">
        Warning time is what June lacked: {REAL_RENTAL_SHARE_PCT}% of the real bill went to renting chillers after the break.
        A week’s notice buys an inspection crew, chillers staged for the labs first, and a repair before the heat wave.
      </p>
    </Card>
  );
}
