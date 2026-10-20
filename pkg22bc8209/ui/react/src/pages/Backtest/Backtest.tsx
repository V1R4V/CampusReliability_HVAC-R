/*
 * Backtest — "how we know" (FRONTEND §5.7).
 *
 * `backtest(threshold)` replays five planted failures and four decoys through the same
 * pipeline the Overview uses. The slider (2.0–4.0, step 0.25) sets the global threshold
 * and re-queries; headline numbers come from the `sweep` row for that threshold.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, CheckCircle2, EyeOff, Gauge, History, RotateCcw, ShieldCheck, Timer, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useErrorReporter } from '@/components/ErrorBoundary/ErrorBoundary';
import KpiTile from '@/components/KpiTile/KpiTile';
import PageHeader from '@/components/PageHeader/PageHeader';
import { Panel, PanelState } from '@/components/Panel/Panel';
import Reorderable from '@/components/Reorderable/Reorderable';
import SystemIcon from '@/components/SystemIcon/SystemIcon';
import { useAsOf } from '@/contexts/AsOfProvider';
import {
  DEFAULT_THRESHOLD,
  WATCH_THRESHOLD,
  backtest,
  errorMessage,
  formatDate,
  formatPct,
  formatThreshold,
  withAsOf,
  type BacktestFailure,
  type BacktestResult,
} from '@/shared/api';
import AlignedCurvesChart from './AlignedCurvesChart';
import SweepCharts from './SweepCharts';

const THRESHOLD_MIN = 2;
const THRESHOLD_MAX = 4;
const THRESHOLD_STEP = 0.25;
const SLIDER_DEBOUNCE_MS = 200;

function FailuresTable({ failures, asOf }: { failures: BacktestFailure[]; asOf: string }) {
  if (failures.length === 0) {
    return <PanelState state="empty" message="No planted failures in this run." />;
  }
  return (
    <Table size="sm">
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4">Event</TableHead>
          <TableHead>Asset</TableHead>
          <TableHead>System</TableHead>
          <TableHead>Failed on</TableHead>
          <TableHead>First inspection due</TableHead>
          <TableHead className="text-right">Lead days</TableHead>
          <TableHead className="pr-4 text-right">Energy over normal at flag</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {failures.map((failure) => {
          const missed = failure.lead_days == null || failure.first_due_date == null;
          return (
            <TableRow key={failure.event_id}>
              <TableCell className="pl-4 font-semibold text-[var(--bib-ink)]">{failure.event_id}</TableCell>
              <TableCell>
                <Link
                  to={withAsOf(`/asset/${failure.asset_id}`, asOf)}
                  className="font-medium text-[var(--bib-ink)] underline-offset-2 hover:underline"
                >
                  {failure.asset_id}
                </Link>
              </TableCell>
              <TableCell>
                <SystemIcon system={failure.system} size="sm" withLabel />
              </TableCell>
              <TableCell className="whitespace-nowrap">{formatDate(failure.failure_date)}</TableCell>
              <TableCell className="whitespace-nowrap">
                {missed ? <span className="font-medium text-[var(--bib-status-due)]">Missed</span> : formatDate(failure.first_due_date)}
              </TableCell>
              <TableCell className="bib-num text-right text-[16px] font-semibold text-[var(--bib-ink)]">
                {missed ? '—' : failure.lead_days}
              </TableCell>
              <TableCell className="bib-num pr-4 text-right">
                {failure.energy_over_expected_pct_at_flag == null ? '—' : formatPct(failure.energy_over_expected_pct_at_flag)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default function Backtest() {
  const { asOf, threshold, setThreshold } = useAsOf();
  const { reportError } = useErrorReporter();

  // The slider updates `pending` instantly; the global threshold (and the query) follow after a pause.
  const [pending, setPending] = useState<number>(threshold);
  useEffect(() => {
    if (pending === threshold) return undefined;
    const timer = window.setTimeout(() => setThreshold(pending), SLIDER_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [pending, threshold, setThreshold]);

  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(
    (value: number) => {
      requestSeq.current += 1;
      const seq = requestSeq.current;
      setLoading(true);
      backtest(value)
        .then((data) => {
          if (seq !== requestSeq.current) return;
          setResult(data);
          setError(null);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (seq !== requestSeq.current) return;
          setError(errorMessage(err));
          setLoading(false);
          reportError(err);
        });
    },
    [reportError],
  );

  useEffect(() => {
    load(threshold);
  }, [threshold, load]);

  const stats = useMemo(() => {
    if (!result) return null;
    const point = result.sweep.find((p) => Math.abs(p.threshold - threshold) < 1e-6);
    if (point) {
      return { min: point.min_lead_days, mean: point.mean_lead_days, falseAlarms: point.false_alarm_days, missed: point.missed };
    }
    const leads = result.failures.map((f) => f.lead_days).filter((d): d is number => d != null);
    return {
      min: leads.length ? Math.min(...leads) : null,
      mean: leads.length ? leads.reduce((sum, d) => sum + d, 0) / leads.length : null,
      falseAlarms: result.false_alarm_days,
      missed: result.failures.length - leads.length,
    };
  }, [result, threshold]);

  const firstLoad = loading && !result;
  const thresholdFill = ((pending - THRESHOLD_MIN) / (THRESHOLD_MAX - THRESHOLD_MIN)) * 100;

  return (
    <div className="flex min-h-full flex-col gap-5 p-6 xl:px-8">
      <PageHeader
        eyebrow="How we know"
        title="Backtest"
        icon={<History />}
        description="Five planted failures and four decoys, replayed through the same pipeline the Overview uses, on synthetic sensors over real NOAA weather. Move the threshold to trade warning time against false alarms. The failures were planted: this proves the pipeline, not that the real June 17 break was predictable."
        meta={[
          `Inspection due = risk ≥ threshold on 2 consecutive days`,
          `Watch from ${formatThreshold(WATCH_THRESHOLD)}`,
          result ? `${result.failures.length} planted failures · ${result.decoys.length} decoys` : null,
        ]}
      />

      <div className="bib-card p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-5">
          <label htmlFor="bib-threshold" className="bib-eyebrow inline-flex items-center gap-1.5">
            <Gauge className="size-3.5" aria-hidden /> Inspection threshold
          </label>
          <input
            id="bib-threshold"
            type="range"
            min={THRESHOLD_MIN}
            max={THRESHOLD_MAX}
            step={THRESHOLD_STEP}
            value={pending}
            onChange={(event) => setPending(Number(event.target.value))}
            aria-valuetext={formatThreshold(pending)}
            style={{ '--bib-range-fill': `${thresholdFill}%`, '--bib-range-fill-color': 'var(--bib-status-due)' } as React.CSSProperties}
            className="bib-range min-w-[280px] flex-1"
          />
          <span className="bib-num w-[72px] text-[32px] font-semibold leading-9 text-[var(--bib-ink)]">{formatThreshold(pending)}</span>
          <Button
            variant="ghost"
            appearance="secondary"
            size="sm"
            leadingIcon={<RotateCcw />}
            onClick={() => setPending(DEFAULT_THRESHOLD)}
            disabled={pending === DEFAULT_THRESHOLD}
          >
            Reset to {formatThreshold(DEFAULT_THRESHOLD)}
          </Button>
          <span className="text-[13px] leading-4 text-[var(--bib-ink-muted)]">
            Lower = earlier warning, more false alarms · higher = quieter, later
          </span>
        </div>
      </div>

      {error && !result ? <PanelState state="error" message={error} onRetry={() => load(threshold)} /> : null}

      <div className={cn('flex flex-col gap-5 transition-opacity', loading && result ? 'opacity-70' : 'opacity-100')}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            label="Minimum warning"
            value={stats?.min ?? '—'}
            unit="days"
            icon={<Timer />}
            sub="Shortest lead time across the planted failures"
            loading={firstLoad}
          />
          <KpiTile
            label="Mean warning"
            value={stats && stats.mean != null ? stats.mean.toFixed(1) : '—'}
            unit="days"
            icon={<ShieldCheck />}
            sub="Average days from first inspection due to failure"
            loading={firstLoad}
          />
          <KpiTile
            label="False-alarm days"
            value={stats?.falseAlarms ?? '—'}
            icon={<BellRing />}
            tone={stats && stats.falseAlarms > 0 ? 'WATCH' : 'neutral'}
            sub={result ? `${result.healthy_assets} assets never flagged` : undefined}
            loading={firstLoad}
          />
          <KpiTile
            label="Missed failures"
            value={stats?.missed ?? '—'}
            icon={<EyeOff />}
            tone={stats && stats.missed > 0 ? 'INSPECTION_DUE' : 'neutral'}
            sub={result ? `of ${result.failures.length} planted` : undefined}
            loading={firstLoad}
          />
        </div>

        <Reorderable
          storageKey="backtest"
          className="grid gap-5 xl:grid-cols-12"
          items={[
            {
              id: 'curves',
              className: 'xl:col-span-7',
              node: (
                <Panel
                  title="Risk in the 21 days before each failure"
                  subtitle="All failures aligned on their failure day. The red line is the current threshold."
                  className="h-full"
                >
                  {result ? (
                    <AlignedCurvesChart curves={result.aligned_curves} threshold={threshold} />
                  ) : (
                    <PanelState state="loading" lines={6} />
                  )}
                </Panel>
              ),
            },
            {
              id: 'decoys',
              className: 'xl:col-span-5',
              node: (
                <Panel title="Decoys ignored" subtitle="What a plain threshold alarm would have flagged" className="h-full">
                  {!result ? (
                    <PanelState state="loading" lines={4} />
                  ) : result.decoys.length === 0 ? (
                    <PanelState state="empty" message="No decoys in this run." />
                  ) : (
                    <ul className="flex flex-col divide-y divide-[var(--bib-border)]">
                      {result.decoys.map((decoy) => {
                        const Icon = decoy.ignored ? CheckCircle2 : TriangleAlert;
                        return (
                          <li key={decoy.event_id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                            <span
                              className={cn(
                                'mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full',
                                decoy.ignored
                                  ? 'bg-[var(--bib-status-healthy-soft)] text-[var(--bib-status-healthy)]'
                                  : 'bg-[var(--bib-status-due-soft)] text-[var(--bib-status-due)]',
                              )}
                            >
                              <Icon className="size-4" role="img" aria-label={decoy.ignored ? 'Ignored' : 'Flagged'} />
                            </span>
                            <div className="min-w-0">
                              <div className="text-[16px] font-medium leading-6 text-[var(--bib-ink)]">
                                {decoy.label}{' '}
                                <span className="text-[13px] font-normal text-[var(--bib-ink-muted)]">{decoy.event_id}</span>
                              </div>
                              <div className="text-[14px] leading-5 text-[var(--bib-ink-muted)]">
                                {decoy.ignored ? 'Ignored: ' : 'Flagged: '}
                                {decoy.reason}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Panel>
              ),
            },
            {
              id: 'sweep',
              className: 'xl:col-span-12',
              node: result ? (
                <SweepCharts sweep={result.sweep} threshold={threshold} />
              ) : (
                <Panel>
                  <PanelState state="loading" lines={4} />
                </Panel>
              ),
            },
            {
              id: 'failures',
              className: 'xl:col-span-12',
              node: (
                <Panel
                  title="Planted failures"
                  subtitle={`At threshold ${formatThreshold(threshold)} · synthetic sensors on real NOAA weather`}
                  contentClassName="-mx-4 -mb-4 overflow-x-auto"
                >
                  {result ? (
                    <FailuresTable failures={result.failures} asOf={asOf} />
                  ) : (
                    <div className="px-4 pb-4">
                      <PanelState state="loading" lines={5} />
                    </div>
                  )}
                </Panel>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
