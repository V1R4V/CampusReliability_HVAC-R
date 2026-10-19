/*
 * Backtest — "how we know" (FRONTEND §5.7).
 *
 * `backtest(threshold)` replays five planted failures and four decoys through the same
 * pipeline the Overview uses. The slider (2.0–4.0, step 0.25) sets the global threshold
 * and re-queries; it stays pinned to the top while the page scrolls so the demo's
 * "move the slider for 10 seconds" works from anywhere on the page.
 *
 * Top to bottom: the June 17 reenactment's lead time beside the real bill (hero), the
 * headline numbers from `sweep`, alerts vs. actual failures on the Jan–Aug calendar, the
 * warning / false-alarm trade with one-notch comparisons, the decoys the pipeline ignored,
 * the sweep charts, the aligned risk curves, the failures table, and a plain statement of
 * what is real and what is synthetic.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, RotateCcw, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useErrorReporter } from '@/components/ErrorBoundary/ErrorBoundary';
import KpiTile from '@/components/KpiTile/KpiTile';
import { Panel, PanelState } from '@/components/Panel/Panel';
import ProvenanceChip from '@/components/ProvenanceChip/ProvenanceChip';
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
import AlertTimeline from './AlertTimeline';
import AlignedCurvesChart from './AlignedCurvesChart';
import EarlyWarningHero from './EarlyWarningHero';
import SweepCharts from './SweepCharts';
import TradeoffCard from './TradeoffCard';
import { REAL_OUTAGE } from './realOutage';

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
          <TableHead>Event</TableHead>
          <TableHead>Asset</TableHead>
          <TableHead>System</TableHead>
          <TableHead>Failed on</TableHead>
          <TableHead>First “inspection due”</TableHead>
          <TableHead className="text-right">Lead days</TableHead>
          <TableHead className="text-right">Energy over normal at flag</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {failures.map((failure) => {
          const missed = failure.lead_days == null || failure.first_due_date == null;
          return (
            <TableRow key={failure.event_id}>
              <TableCell className="font-semibold text-[var(--bib-ink)]">{failure.event_id}</TableCell>
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
                {missed ? <span className="text-[var(--bib-status-due)]">Missed</span> : formatDate(failure.first_due_date)}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums text-[var(--bib-ink)]">
                {missed ? '—' : failure.lead_days}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {failure.energy_over_expected_pct_at_flag == null ? '—' : formatPct(failure.energy_over_expected_pct_at_flag)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function ProvenancePanel() {
  return (
    <Panel title="What is real and what is synthetic" subtitle="Say it before the judges ask">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <ProvenanceChip kind="REAL" className="self-start" />
          <ul className="list-disc space-y-1 pl-5 text-[15px] leading-6 text-[var(--bib-ink)]">
            <li>Daily weather — NOAA GHCN-Daily, Madison Dane County Regional Airport</li>
            <li>Buildings and plants — UW–Madison campus, public records</li>
            <li>Outage costs and closures — Cap Times, WPR, UW News (June–October 2026)</li>
            <li>Work-order format and asset categories — FP&amp;M Physical Plant operations report</li>
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <ProvenanceChip kind="SYNTHETIC" className="self-start" />
          <ul className="list-disc space-y-1 pl-5 text-[15px] leading-6 text-[var(--bib-ink)]">
            <li>Sensor readings — UW does not publish them</li>
            <li>Chilled-water loop layout and which buildings each loop serves</li>
            <li>The five planted failures and four decoys, including the June 17 reenactment</li>
          </ul>
        </div>
      </div>
      <p className="mt-4 text-[16px] leading-6 text-[var(--bib-ink)]">
        The failures were planted; this proves the pipeline, not that the real break was predictable.
      </p>
    </Panel>
  );
}

export default function Backtest() {
  const { asOf, threshold, setThreshold, events } = useAsOf();
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

  // The real reference event (R1) names the asset the reenactment is planted on; fall back
  // to the failure dated on the real break if the events call has not landed.
  const realBreak = useMemo(() => events.find((e) => e.kind === 'real_reference') ?? null, [events]);
  const reenactment = useMemo<BacktestFailure | null>(() => {
    if (!result) return null;
    const byAsset = realBreak?.asset_id ? result.failures.find((f) => f.asset_id === realBreak.asset_id) : undefined;
    return byAsset ?? result.failures.find((f) => f.failure_date === REAL_OUTAGE.start_date) ?? null;
  }, [result, realBreak]);
  const reenactmentEvent = useMemo(
    () => (reenactment ? events.find((e) => e.event_id === reenactment.event_id) ?? null : null),
    [events, reenactment],
  );
  const highlightAssetId = reenactment?.asset_id ?? realBreak?.asset_id ?? null;

  const firstLoad = loading && !result;

  return (
    <div className="flex min-h-full flex-col gap-4 p-6">
      <header>
        <h1 className="text-[22px] font-semibold leading-7 text-[var(--bib-ink)]">Backtest — how we know</h1>
        <p className="text-[15px] leading-5 text-[var(--bib-ink-muted)]">
          Five planted failures and four decoys replayed through the same pipeline. Move the threshold: more warning
          costs more false alarms.
        </p>
      </header>

      {/* Pinned while the page scrolls so the slider is always within reach. */}
      <div className="sticky top-0 z-10 -mx-6 bg-[var(--c3-style-basic-bg-page)] px-6 pb-3 pt-1">
        <Card variant="outlined" size="md" className="gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <label
              htmlFor="bib-threshold"
              className="text-[13px] font-semibold uppercase leading-4 tracking-[0.06em] text-[var(--bib-ink-muted)]"
            >
              Inspection threshold
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
              className="bib-range min-w-[240px] flex-1"
            />
            <span className="w-[72px] text-[28px] font-semibold leading-8 tabular-nums text-[var(--bib-ink)]">
              {formatThreshold(pending)}
            </span>
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
              Inspection due = risk ≥ threshold on 2 consecutive days · watch from {formatThreshold(WATCH_THRESHOLD)}
              {loading && result ? ' · recomputing…' : ''}
            </span>
          </div>
        </Card>
      </div>

      {error && !result ? (
        <PanelState state="error" title="Couldn’t run the backtest" message={error} onRetry={() => load(threshold)} />
      ) : null}

      {/* Hidden (not unmounted) while the only state is an error, so the Retry above is the one message. */}
      <div
        className={cn('flex flex-col gap-4 transition-opacity', loading && result ? 'opacity-70' : 'opacity-100')}
        hidden={Boolean(error) && !result}
      >
        <EarlyWarningHero
          reenactment={reenactment}
          reenactmentEvent={reenactmentEvent}
          threshold={threshold}
          asOf={asOf}
          loading={firstLoad}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            label="Minimum warning"
            value={stats?.min ?? '—'}
            unit="days"
            sub="Shortest lead time across the planted failures"
            chip="SYNTHETIC"
            loading={firstLoad}
          />
          <KpiTile
            label="Mean warning"
            value={stats && stats.mean != null ? stats.mean.toFixed(1) : '—'}
            unit="days"
            sub="Average days from first ‘inspection due’ to failure"
            chip="SYNTHETIC"
            loading={firstLoad}
          />
          <KpiTile
            label="False-alarm days"
            value={stats?.falseAlarms ?? '—'}
            sub={result ? `${result.healthy_assets} assets never flagged` : undefined}
            chip="SYNTHETIC"
            loading={firstLoad}
          />
          <KpiTile
            label="Missed failures"
            value={stats?.missed ?? '—'}
            sub={result ? `of ${result.failures.length} planted` : undefined}
            chip="SYNTHETIC"
            loading={firstLoad}
          />
        </div>

        <Panel
          title="Alerts vs. actual failures, January–August 2026"
          subtitle="When each failure was first flagged “inspection due”, when it actually failed, and what the pipeline chose to ignore"
          chip="SYNTHETIC"
          chipTitle="Planted failures and decoys on synthetic sensor data. The real break row is the reported June 17 outage."
        >
          {result ? (
            <AlertTimeline
              failures={result.failures}
              decoys={result.decoys}
              events={events}
              threshold={threshold}
              asOf={asOf}
              highlightAssetId={highlightAssetId}
            />
          ) : (
            <PanelState state="loading" lines={7} />
          )}
        </Panel>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          {result ? (
            <TradeoffCard result={result} threshold={threshold} onPick={setPending} />
          ) : (
            <Panel title="Warning vs false alarms" chip="SYNTHETIC">
              <PanelState state="loading" lines={5} />
            </Panel>
          )}

          <Panel title="Decoys ignored" subtitle="What a plain threshold alarm would have flagged" chip="SYNTHETIC">
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
                      <Icon
                        className={cn(
                          'mt-0.5 size-5 shrink-0',
                          decoy.ignored ? 'text-[var(--bib-status-healthy)]' : 'text-[var(--bib-status-due)]',
                        )}
                        role="img"
                        aria-label={decoy.ignored ? 'Ignored' : 'Flagged'}
                      />
                      <div className="min-w-0">
                        <div className="text-[16px] font-medium leading-6 text-[var(--bib-ink)]">
                          {decoy.label}{' '}
                          <span className="text-[13px] font-normal text-[var(--bib-ink-muted)]">{decoy.event_id}</span>
                        </div>
                        <div className="text-[14px] leading-5 text-[var(--bib-ink-muted)]">
                          {decoy.ignored ? 'Ignored — ' : 'Flagged — '}
                          {decoy.reason}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        {result ? <SweepCharts sweep={result.sweep} threshold={threshold} /> : null}

        <Panel
          title="Risk in the 21 days before each failure"
          subtitle="All failures aligned on their failure day; the red line is the current threshold"
          chip="SYNTHETIC"
        >
          {result ? (
            <AlignedCurvesChart curves={result.aligned_curves} threshold={threshold} height={280} />
          ) : (
            <PanelState state="loading" lines={6} />
          )}
        </Panel>

        <Panel title="Planted failures" subtitle={`At threshold ${formatThreshold(threshold)}`} chip="SYNTHETIC">
          {result ? <FailuresTable failures={result.failures} asOf={asOf} /> : <PanelState state="loading" lines={5} />}
        </Panel>

        <ProvenancePanel />
      </div>
    </div>
  );
}
