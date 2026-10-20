/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import ChartTooltip from '@/components/Chart/ChartTooltip';
import { AXIS_STROKE, AXIS_TICK, GRID_STROKE, shortDate } from '@/components/Chart/chartTheme';
import { Panel, PanelState } from '@/components/Panel/Panel';
import { formatDate } from '@/shared/api';
import type { ForecastMethodRow } from '@/Interfaces';
import {
  METHOD_COLOR,
  METHOD_SHORT,
  agreementLabel,
  formatProbability,
  probabilityColor,
  probabilityStatus,
  useRiskForecast,
} from './useRiskForecast';

interface ForecastPanelProps {
  assetId: string;
  asOf: string;
}

const HORIZONS: { key: 'p_fail_7d' | 'p_fail_14d' | 'p_fail_30d'; label: string }[] = [
  { key: 'p_fail_7d', label: '7 d' },
  { key: 'p_fail_14d', label: '14 d' },
  { key: 'p_fail_30d', label: '30 d' },
];

function ProbabilityBar({ value, label }: { value: number | null; label: string }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value * 100));
  return (
    <div className="flex items-center gap-2" data-status={probabilityStatus(value)}>
      <span className="w-9 shrink-0 text-[13px] text-[var(--bib-ink-muted)]">{label}</span>
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bib-canvas-deep)]"
        role="meter"
        aria-label={`Probability of failure within ${label}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div className="h-full rounded-full bg-[var(--bib-status-color)]" style={{ width: `${pct}%` }} />
      </div>
      <span className="bib-num w-11 shrink-0 text-right text-[14px] font-semibold text-[var(--bib-ink)]">{formatProbability(value)}</span>
    </div>
  );
}

function formatDays(d: number | null): string {
  if (d == null) return '—';
  return d >= 365 ? `${(d / 365).toFixed(1)} y` : `${Math.round(d)} d`;
}

function MethodRow({ row }: { row: ForecastMethodRow }) {
  const dtf = row.days_to_failure;
  return (
    <div className="flex flex-col gap-2.5 rounded-[6px] border border-[var(--bib-border)] bg-[var(--bib-surface)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: METHOD_COLOR[row.method] }} aria-hidden />
          <span className="text-[15px] font-semibold text-[var(--bib-ink)]">{row.label}</span>
          {row.method === 'weibull' ? <span className="text-[13px] text-[var(--bib-ink-muted)]">reference only</span> : null}
        </div>
        <div className="flex items-center gap-2">
          {row.confidence ? (
            <Badge variant="outline" appearance="secondary" size="sm">
              {row.confidence} confidence
            </Badge>
          ) : null}
          {dtf && dtf.p50 != null ? (
            <span className="text-[13px] text-[var(--bib-ink-muted)]" title="Median and 10th–90th percentile of the simulated time to failure, if the trend holds">
              median <span className="bib-num font-semibold text-[var(--bib-ink)]">~{formatDays(dtf.p50)}</span> · p10–p90{' '}
              <span className="bib-num">
                {formatDays(dtf.p10)}–{formatDays(dtf.p90)}
              </span>
              {row.method === 'monte_carlo' ? ' (Monte Carlo)' : ''}
            </span>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 sm:gap-4">
        {HORIZONS.map((h) => (
          <ProbabilityBar key={h.key} value={row[h.key]} label={h.label} />
        ))}
      </div>
      {row.basis ? <div className="text-[13px] leading-5 text-[var(--bib-ink-soft)]">{row.basis}</div> : null}
      {row.trained_on ? <div className="text-[13px] leading-5 text-[var(--bib-ink-muted)]">Trained on: {row.trained_on}</div> : null}
    </div>
  );
}

interface HistoryTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ name?: unknown; value?: unknown; color?: string; dataKey?: unknown }>;
  label?: unknown;
}

function HistoryTooltip({ active, payload, label }: HistoryTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <ChartTooltip
      title={shortDate(String(label))}
      rows={payload.map((item, index) => ({
        key: `${String(item.dataKey ?? item.name)}-${index}`,
        name: String(item.name),
        value: `${String(item.value)}%`,
        color: item.color,
        dashed: item.dataKey === 'weibull',
      }))}
    />
  );
}

/**
 * Failure probability for one asset, four methods side by side (ML.md §8): consensus headline,
 * one row per method with 7/14/30-day bars, days-to-failure where a method produces one, and the
 * trailing 30-day history of each method's 14-day probability.
 */
export default function ForecastPanel({ assetId, asOf }: ForecastPanelProps) {
  const { data, loading, error } = useRiskForecast(assetId, asOf);

  const historyData = useMemo(
    () =>
      (data?.history ?? []).map((p) => ({
        date: p.date,
        heuristic: p.heuristic == null ? null : Math.round(p.heuristic * 1000) / 10,
        classifier: p.classifier == null ? null : Math.round(p.classifier * 1000) / 10,
        monte_carlo: p.monte_carlo == null ? null : Math.round(p.monte_carlo * 1000) / 10,
        weibull: p.weibull == null ? null : Math.round(p.weibull * 1000) / 10,
        consensus: p.consensus == null ? null : Math.round(p.consensus * 1000) / 10,
      })),
    [data],
  );

  const agreement = agreementLabel(data?.consensus.spread_14d);
  const consensus = data?.consensus.p_fail_14d ?? null;

  return (
    <Panel
      title="Chance of failure"
      subtitle={`Four independent methods, as of ${formatDate(asOf)}. The consensus averages the three condition-based ones.`}
      icon={<TrendingUp />}
      chip="SYNTHETIC"
    >
      {loading ? (
        <PanelState state="loading" lines={5} />
      ) : error || !data ? (
        <PanelState state="error" message={error ?? 'No forecast available for this asset.'} />
      ) : data.methods.length === 0 ? (
        <PanelState state="empty" message="No forecast exists for this date." />
      ) : (
        <div className="flex flex-col gap-4">
          <div
            data-status={probabilityStatus(consensus)}
            className="relative flex flex-wrap items-end justify-between gap-4 overflow-hidden rounded-[6px] border border-[var(--bib-border)] bg-[var(--bib-canvas)] p-4 pl-5"
          >
            <span aria-hidden className="absolute inset-y-0 left-0 w-[4px] bg-[var(--bib-status-color)]" />
            <div>
              <div className="bib-eyebrow">Consensus · fails within 14 days</div>
              <div className="mt-1 flex flex-wrap items-baseline gap-3">
                <span className="bib-kpi" style={{ color: probabilityColor(consensus) }}>
                  {formatProbability(consensus)}
                </span>
                <span className="bib-num text-[15px] text-[var(--bib-ink-muted)]">
                  7 d <span className="font-semibold text-[var(--bib-ink)]">{formatProbability(data.consensus.p_fail_7d)}</span> · 30 d{' '}
                  <span className="font-semibold text-[var(--bib-ink)]">{formatProbability(data.consensus.p_fail_30d)}</span>
                </span>
              </div>
              <div className="mt-1 text-[13px] leading-5 text-[var(--bib-ink-muted)]">{data.consensus.note}</div>
            </div>
            <div className="flex flex-col items-end gap-1.5 text-right">
              {agreement ? (
                <Badge variant="outline" appearance="secondary" size="md">
                  {agreement} agreement · spread {formatProbability(data.consensus.spread_14d)}
                </Badge>
              ) : null}
              {data.next_failure ? (
                <div className="text-[13px] leading-5 text-[var(--bib-ink-muted)]">
                  Planted failure {data.next_failure.event_id} in{' '}
                  <span className="bib-num font-semibold text-[var(--bib-ink)]">{data.next_failure.days_from_as_of} days</span>
                  {data.next_failure.synthetic ? ' (synthetic)' : ''}
                </div>
              ) : null}
              {data.as_of_used && data.as_of_used !== data.as_of ? (
                <div className="text-[13px] leading-5 text-[var(--bib-status-watch)]">Showing latest available day: {formatDate(data.as_of_used)}</div>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {data.methods.map((row) => (
              <MethodRow key={row.method} row={row} />
            ))}
          </div>

          {historyData.length > 1 ? (
            <div className="flex flex-col gap-1">
              <div className="text-[14px] font-semibold leading-5 text-[var(--bib-ink)]">14-day failure probability, trailing 30 days</div>
              <div className={cn('h-[220px] w-full')}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={40} tick={AXIS_TICK} axisLine={{ stroke: AXIS_STROKE }} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} unit="%" />
                    <RechartsTooltip content={<HistoryTooltip />} cursor={{ stroke: AXIS_STROKE }} />
                    <Legend verticalAlign="top" align="left" iconType="plainline" wrapperStyle={{ fontSize: 13, paddingBottom: 8 }} />
                    <ReferenceLine y={50} stroke="var(--bib-status-due)" strokeDasharray="4 3" />
                    <Line type="monotone" dataKey="consensus" name={METHOD_SHORT.consensus} stroke={METHOD_COLOR.consensus} strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls />
                    <Line type="monotone" dataKey="heuristic" name={METHOD_SHORT.heuristic} stroke={METHOD_COLOR.heuristic} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
                    <Line type="monotone" dataKey="classifier" name={METHOD_SHORT.classifier} stroke={METHOD_COLOR.classifier} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
                    <Line type="monotone" dataKey="monte_carlo" name={METHOD_SHORT.monte_carlo} stroke={METHOD_COLOR.monte_carlo} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
                    <Line type="monotone" dataKey="weibull" name={METHOD_SHORT.weibull} stroke={METHOD_COLOR.weibull} strokeWidth={1.5} strokeDasharray="3 3" dot={false} isAnimationActive={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Panel>
  );
}
