/*
 * TradeoffCard — what the current threshold buys and costs (FRONTEND §5.7). Reads the
 * `sweep` rows either side of the slider so the marginal trade is explicit ("one notch
 * lower: +2 days of warning, +4 false-alarm days") and lets the presenter jump there.
 *
 * Alert precision is an ESTIMATE and says so: the backtest reports lead days per failure
 * and false-alarm asset-days, not a labelled confusion matrix, so precision here is
 * Σ lead days ÷ (Σ lead days + false-alarm days) — due-days that preceded a failure over
 * all due-days. Honesty chips name what is planted and what is real.
 */

import React, { useMemo } from 'react';
import { Check, Minus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Panel } from '@/components/Panel/Panel';
import ProvenanceChip from '@/components/ProvenanceChip/ProvenanceChip';
import { formatThreshold, type BacktestResult, type BacktestSweepPoint, type Provenance } from '@/shared/api';
import { REAL_OUTAGE, formatRealUsd } from './realOutage';

const EPSILON = 1e-6;

interface StatProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  chip?: Provenance;
  chipTitle?: string;
}

function Stat({ label, value, sub, chip, chipTitle }: StatProps) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold uppercase leading-4 tracking-[0.06em] text-[var(--bib-ink-muted)]">
        {label}
        {chip ? <ProvenanceChip kind={chip} size="sm" title={chipTitle} /> : null}
      </div>
      <div className="mt-1 text-[28px] font-semibold leading-8 tabular-nums text-[var(--bib-ink)]">{value}</div>
      {sub ? <div className="mt-0.5 text-[13px] leading-4 text-[var(--bib-ink-muted)]">{sub}</div> : null}
    </div>
  );
}

/** Signed difference for the neighbour rows, e.g. "+2.0" / "−4"; empty when nothing changes. */
function delta(next: number | null | undefined, current: number | null | undefined, digits = 0): string {
  if (next == null || current == null) return '';
  const diff = next - current;
  if (Math.abs(diff) < EPSILON) return '';
  return `${diff > 0 ? '+' : '−'}${Math.abs(diff).toFixed(digits)}`;
}

function fmt(value: number | null | undefined, digits = 0): string {
  return value == null ? '—' : value.toFixed(digits);
}

function Delta({ text }: { text: string }) {
  if (!text) return null;
  return <span className="ml-1.5 text-[13px] font-normal tabular-nums text-[var(--bib-ink-muted)]">{text}</span>;
}

export interface TradeoffCardProps {
  result: BacktestResult;
  threshold: number;
  /** Move the slider to a neighbouring threshold. */
  onPick: (threshold: number) => void;
}

export default function TradeoffCard({ result, threshold, onPick }: TradeoffCardProps) {
  const total = result.failures.length;
  const leads = result.failures.map((f) => f.lead_days).filter((d): d is number => d != null);
  const caught = leads.length;
  const trueDueDays = leads.reduce((sum, d) => sum + d, 0);
  const denominator = trueDueDays + result.false_alarm_days;
  const precision = denominator > 0 ? trueDueDays / denominator : null;

  const { current, lower, higher } = useMemo(() => {
    const sorted = [...result.sweep].sort((a, b) => a.threshold - b.threshold);
    const exact = sorted.find((p) => Math.abs(p.threshold - threshold) < EPSILON) ?? null;
    const fallback: BacktestSweepPoint = {
      threshold,
      mean_lead_days: leads.length ? leads.reduce((sum, d) => sum + d, 0) / leads.length : null,
      min_lead_days: leads.length ? Math.min(...leads) : null,
      false_alarm_days: result.false_alarm_days,
      missed: total - caught,
    };
    return {
      current: exact ?? fallback,
      lower: [...sorted].reverse().find((p) => p.threshold < threshold - EPSILON) ?? null,
      higher: sorted.find((p) => p.threshold > threshold + EPSILON) ?? null,
    };
    // `leads` is derived from `result`, which is already a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, threshold, total, caught]);

  const comparison: { point: BacktestSweepPoint; role: 'lower' | 'current' | 'higher' }[] = [];
  if (lower) comparison.push({ point: lower, role: 'lower' });
  comparison.push({ point: current, role: 'current' });
  if (higher) comparison.push({ point: higher, role: 'higher' });

  return (
    <Panel
      title="Warning vs false alarms"
      subtitle={`What threshold ${formatThreshold(threshold)} trades — and what one notch either way would change`}
      chip="SYNTHETIC"
      chipTitle="Computed on planted failures and synthetic sensor data."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Failures caught"
          value={
            <span className="inline-flex items-center gap-2">
              {caught}
              <span className="text-[18px] font-medium text-[var(--bib-ink-muted)]">of {total}</span>
              {caught === total && total > 0 ? (
                <Check className="size-5 text-[var(--bib-status-healthy)]" role="img" aria-label="All planted failures caught" />
              ) : null}
            </span>
          }
          sub={current.min_lead_days != null ? `shortest warning ${fmt(current.min_lead_days)} days` : 'no warning for any failure'}
          chip="SYNTHETIC"
        />
        <Stat
          label="False-alarm days"
          value={result.false_alarm_days}
          sub={`${result.healthy_assets} assets never flagged all year`}
          chip="SYNTHETIC"
          chipTitle="An asset-day flagged “inspection due” with no failure on that asset within the next 21 days."
        />
        <Stat
          label="Alert precision"
          value={precision == null ? '—' : `${Math.round(precision * 100)}%`}
          sub="due-days before a failure ÷ all due-days"
          chip="ESTIMATE"
          chipTitle="Σ lead days ÷ (Σ lead days + false-alarm days). The pipeline reports those two counts, not a labelled confusion matrix."
        />
      </div>

      <div className="mt-4">
        <Table size="sm">
          <TableHeader>
            <TableRow>
              <TableHead>Threshold</TableHead>
              <TableHead className="text-right">Caught</TableHead>
              <TableHead className="text-right">Min warning</TableHead>
              <TableHead className="text-right">Mean warning</TableHead>
              <TableHead className="text-right">False-alarm days</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Try this threshold</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparison.map(({ point, role }) => {
              const isCurrent = role === 'current';
              const caughtAt = total - (point.missed ?? 0);
              return (
                <TableRow key={point.threshold} className={cn(isCurrent && 'bg-[var(--bib-canvas)] font-semibold')}>
                  <TableCell className="whitespace-nowrap tabular-nums text-[var(--bib-ink)]">
                    {formatThreshold(point.threshold)}
                    <span className="ml-2 text-[13px] font-normal text-[var(--bib-ink-muted)]">
                      {isCurrent ? 'current' : role === 'lower' ? 'one notch lower' : 'one notch higher'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {caughtAt}/{total}
                    {!isCurrent ? <Delta text={delta(caughtAt, caught)} /> : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmt(point.min_lead_days)}
                    {!isCurrent ? <Delta text={delta(point.min_lead_days, current.min_lead_days)} /> : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmt(point.mean_lead_days, 1)}
                    {!isCurrent ? <Delta text={delta(point.mean_lead_days, current.mean_lead_days, 1)} /> : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmt(point.false_alarm_days)}
                    {!isCurrent ? <Delta text={delta(point.false_alarm_days, current.false_alarm_days)} /> : null}
                  </TableCell>
                  <TableCell className="text-right">
                    {isCurrent ? (
                      <Minus className="ml-auto size-4 text-[var(--bib-ink-muted)]" role="img" aria-label="Current threshold" />
                    ) : (
                      <Button variant="ghost" appearance="secondary" size="sm" onClick={() => onPick(point.threshold)}>
                        Try {formatThreshold(point.threshold)}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] leading-4 text-[var(--bib-ink-muted)]">
        <ProvenanceChip kind="SYNTHETIC" size="sm" /> planted failures on synthetic sensors
        <span aria-hidden>·</span>
        <ProvenanceChip kind="REAL" size="sm" title={REAL_OUTAGE.source} /> the June 17 break and its{' '}
        {formatRealUsd(REAL_OUTAGE.total_usd)} bill
        <span aria-hidden>·</span>
        <ProvenanceChip kind="ESTIMATE" size="sm" /> the precision formula above
      </p>
    </Panel>
  );
}
