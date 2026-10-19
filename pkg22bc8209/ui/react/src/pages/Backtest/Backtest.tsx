/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useErrorReporter } from '@/components/ErrorBoundary/ErrorBoundary';
import { ProvenanceTag } from '@/components/RiskChart/Tags';
import { formatDate, shiftDate } from '@/contexts/AsOfProvider';
import { runBacktest } from '@/shared/api/shell';
import type { BacktestResult } from '@/Interfaces';

const MIN_T = 2.0;
const MAX_T = 4.0;
const STEP_T = 0.25;
const DEFAULT_T = 3.0;
const QUERY_DELAY_MS = 350;
/** Neutral series colors — red/amber/green stay reserved for status (FRONTEND §2). */
const CURVE_COLORS = ['#2563EB', '#7C3AED', '#0891B2', '#DB2777', '#4B5563', '#65A30D'];
const SYSTEM_LABEL: Record<string, string> = { cooling: 'Cooling', heating: 'Heating', air: 'Air handling' };

/** "Jan 28" — the replay is all 2026, so the year is noise in a table. */
function shortDate(iso: string): string {
  return formatDate(iso).replace(/, \d{4}$/, '');
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg border border-[#E5E7EB] bg-white px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{label}</span>
      <span className="text-[40px] font-semibold leading-none tabular-nums text-[#111827]">{value}</span>
      {sub ? <span className="text-sm text-[#6B7280]">{sub}</span> : null}
    </div>
  );
}

/** Backtest — "How we know" (docs/FRONTEND.md §5.7): warning time vs. false alarms as the threshold moves. */
export default function Backtest() {
  const { reportError } = useErrorReporter();
  const [threshold, setThreshold] = useState(DEFAULT_T);
  const [queried, setQueried] = useState(DEFAULT_T);
  const [data, setData] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setQueried(threshold), QUERY_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [threshold]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    runBacktest(queried)
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch((err) => {
        if (!cancelled) {
          reportError(err);
          setError('Could not run the backtest.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queried, reportError]);

  const leads = (data?.failures ?? []).map((f) => f.lead_days).filter((d): d is number => d != null);
  const missed = (data?.failures ?? []).filter((f) => f.lead_days == null).length;

  // aligned_curves → one row per day-before-failure with a column per event.
  const curveRows = useMemo(() => {
    const rows = new Map<number, Record<string, number>>();
    (data?.aligned_curves ?? []).forEach((c) =>
      c.points.forEach((p) => {
        const row = rows.get(p.days_before) ?? { days_before: p.days_before };
        row[c.event_id] = p.risk;
        rows.set(p.days_before, row);
      })
    );
    return [...rows.values()].sort((a, b) => a.days_before - b.days_before);
  }, [data]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold leading-tight text-[#111827]">Backtest — how we know</h1>
            <ProvenanceTag kind="SYNTHETIC" />
          </div>
          <div className="text-sm text-[#6B7280]">
            Replay Jan–Aug 2026: how early each planted failure was flagged, and what the model correctly ignored.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-[#E5E7EB] bg-white p-4">
        <label htmlFor="threshold" className="text-sm font-medium text-[#374151]">
          Inspection threshold
        </label>
        <input
          id="threshold"
          type="range"
          min={MIN_T}
          max={MAX_T}
          step={STEP_T}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="min-w-[200px] flex-1 accent-[#111827]"
        />
        <span className="w-12 text-right text-xl font-semibold tabular-nums text-[#111827]">{threshold.toFixed(2)}</span>
        <span className="text-xs text-[#6B7280]">Lower = earlier warnings, more false alarms. Default 3.00.</span>
        {loading ? <Spinner size="sm" label="Running" /> : null}
      </div>

      {error ? <div className="text-sm text-[#DC2626]">{error}</div> : null}

      {!data ? (
        loading ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner label="Running backtest" size="lg" />
          </div>
        ) : null
      ) : (
        <>
          <div className="flex flex-col gap-3 md:flex-row">
            <Stat
              label="Earliest warning"
              value={leads.length ? `${Math.max(...leads)} d` : '—'}
              sub={leads.length ? `minimum ${Math.min(...leads)} days before failure` : undefined}
            />
            <Stat
              label="Mean warning"
              value={leads.length ? `${(leads.reduce((a, b) => a + b, 0) / leads.length).toFixed(1)} d` : '—'}
              sub={`${leads.length} of ${data.failures.length} failures flagged`}
            />
            <Stat label="False-alarm days" value={String(data.false_alarm_days)} sub={`across ${data.healthy_assets} healthy assets`} />
            <Stat label="Missed" value={String(missed)} sub="failures with no warning" />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card variant="outlined" className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Planted failures</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table size="sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Failure</TableHead>
                      <TableHead>System</TableHead>
                      <TableHead>Failed</TableHead>
                      <TableHead>Inspection due</TableHead>
                      <TableHead className="text-right">Warning</TableHead>
                      <TableHead className="text-right">Energy at flag</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.failures.map((f) => (
                      <TableRow key={f.event_id}>
                        <TableCell>
                          <Link
                            to={`/asset/${f.asset_id}?asOf=${f.first_due_date ?? shiftDate(f.failure_date, -1)}`}
                            className="text-[#2563EB] hover:underline"
                          >
                            {f.asset_id}
                          </Link>
                          <div className="text-xs text-[#6B7280]">
                            {f.event_id}
                            {f.event_id === 'F4' ? ' · reenactment of the real June 17 event' : ''}
                          </div>
                        </TableCell>
                        <TableCell>{f.system ? SYSTEM_LABEL[f.system] ?? f.system : '—'}</TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">{shortDate(f.failure_date)}</TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">{f.first_due_date ? shortDate(f.first_due_date) : 'not flagged'}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {f.lead_days != null ? `${f.lead_days} d` : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {f.energy_over_expected_pct_at_flag != null ? `+${f.energy_over_expected_pct_at_flag.toFixed(1)}%` : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card variant="outlined" className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Decoys — correctly ignored?</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {data.decoys.map((d) => (
                  <div key={d.event_id} className="flex gap-3">
                    {d.ignored ? (
                      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#2E7D32]" aria-label="Ignored" />
                    ) : (
                      <XCircle className="mt-0.5 size-5 shrink-0 text-[#DC2626]" aria-label="Fired" />
                    )}
                    <div>
                      <div className="text-sm font-medium text-[#111827]">
                        {d.label} <span className="font-normal text-[#6B7280]">· {d.ignored ? 'ignored' : 'fired'}</span>
                      </div>
                      <div className="text-xs text-[#6B7280]">{d.reason}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card variant="outlined" className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Risk in the 21 days before each failure</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={curveRows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke="#F3F4F6" />
                    <XAxis dataKey="days_before" type="number" domain={['dataMin', 0]} tickFormatter={(v) => `${v} d`} fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip labelFormatter={(v) => `${v} days before failure`} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine y={queried} stroke="#111827" strokeDasharray="4 4" label={{ value: `threshold ${queried.toFixed(2)}`, fontSize: 11, position: 'insideTopLeft' }} />
                    {(data.aligned_curves ?? []).map((c, i) => (
                      <Line
                        key={c.event_id}
                        dataKey={c.event_id}
                        name={`${c.event_id} ${c.asset_id}`}
                        stroke={CURVE_COLORS[i % CURVE_COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card variant="outlined" className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Threshold sweep</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table size="sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Threshold</TableHead>
                      <TableHead className="text-right">Mean warning</TableHead>
                      <TableHead className="text-right">False-alarm days</TableHead>
                      <TableHead className="text-right">Missed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.sweep.map((s) => {
                      const current = Math.abs(s.threshold - queried) < 1e-6;
                      return (
                        <TableRow
                          key={s.threshold}
                          className={current ? 'bg-[#F3F4F6] font-semibold' : 'cursor-pointer'}
                          onClick={() => setThreshold(s.threshold)}
                        >
                          <TableCell className="tabular-nums">{s.threshold.toFixed(2)}</TableCell>
                          <TableCell className="text-right tabular-nums">{s.mean_lead_days != null ? `${s.mean_lead_days} d` : '—'}</TableCell>
                          <TableCell className="text-right tabular-nums">{s.false_alarm_days}</TableCell>
                          <TableCell className="text-right tabular-nums">{s.missed}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-[#E5E7EB] bg-[#F7F7F5] p-4 text-sm text-[#374151]">
            <div className="flex flex-wrap items-center gap-2">
              <ProvenanceTag kind="REAL" /> NOAA weather, buildings, plants, outage costs, FP&amp;M work-order format.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ProvenanceTag kind="SYNTHETIC" /> Sensor readings, loop layout, the planted failures and decoys.
            </div>
            <div className="font-medium text-[#111827]">
              The failures were planted; this proves the pipeline, not that the real June 17 break was predictable.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
