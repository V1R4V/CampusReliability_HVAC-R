/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import React, { useMemo } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { ProvenanceTag } from '@/components/RiskChart/Tags';
import type { ForecastMethodRow } from '@/Interfaces';
import {
  METHOD_COLOR,
  METHOD_SHORT,
  agreementLabel,
  formatProbability,
  probabilityColor,
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
    <div className="flex items-center gap-2">
      <span className="w-8 shrink-0 text-xs text-[#6B7280]">{label}</span>
      <div
        className="h-2 flex-1 overflow-hidden rounded bg-[#E5E7EB]"
        role="meter"
        aria-label={`Probability of failure within ${label}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: probabilityColor(value) }} />
      </div>
      <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums text-[#111827]">{formatProbability(value)}</span>
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
    <div className="flex flex-col gap-2 rounded border border-[#E5E7EB] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: METHOD_COLOR[row.method] }} aria-hidden />
          <span className="text-sm font-medium text-[#111827]">{row.label}</span>
          {row.method === 'weibull' ? <span className="text-xs text-[#6B7280]">(reference only)</span> : null}
        </div>
        <div className="flex items-center gap-2">
          {row.confidence ? (
            <Badge variant="outline" appearance="secondary" size="sm">
              {row.confidence} confidence
            </Badge>
          ) : null}
          {dtf && dtf.p50 != null ? (
            <span className="text-xs text-[#6B7280]" title="Median (10th–90th percentile) days to failure">
              fails in ~{formatDays(dtf.p50)}{' '}
              <span className="tabular-nums">
                ({formatDays(dtf.p10)}–{formatDays(dtf.p90)})
              </span>
            </span>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-3 sm:gap-4">
        {HORIZONS.map((h) => (
          <ProbabilityBar key={h.key} value={row[h.key]} label={h.label} />
        ))}
      </div>
      {row.basis ? <div className="text-xs text-[#374151]">{row.basis}</div> : null}
      {row.trained_on ? <div className="text-xs italic text-[#6B7280]">Trained on: {row.trained_on}</div> : null}
    </div>
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
        date: p.date.slice(5),
        heuristic: p.heuristic == null ? null : Math.round(p.heuristic * 1000) / 10,
        classifier: p.classifier == null ? null : Math.round(p.classifier * 1000) / 10,
        monte_carlo: p.monte_carlo == null ? null : Math.round(p.monte_carlo * 1000) / 10,
        weibull: p.weibull == null ? null : Math.round(p.weibull * 1000) / 10,
        consensus: p.consensus == null ? null : Math.round(p.consensus * 1000) / 10,
      })),
    [data],
  );

  const agreement = agreementLabel(data?.consensus.spread_14d);

  return (
    <Card variant="outlined">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Failure probability — four methods</CardTitle>
          <ProvenanceTag kind="SYNTHETIC" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <div className="flex h-24 items-center justify-center">
            <Spinner label="Loading forecasts" size="md" />
          </div>
        ) : error || !data ? (
          <div className="text-sm text-[#DC2626]">{error ?? 'No forecast available for this asset.'}</div>
        ) : data.methods.length === 0 ? (
          <div className="text-sm text-[#6B7280]">
            No forecast exists for this date — run <code>RiskModel.forecast_all()</code> after scoring.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4 rounded bg-[#F9FAFB] p-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-[#6B7280]">Consensus · fails within 14 days</div>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-semibold tabular-nums" style={{ color: probabilityColor(data.consensus.p_fail_14d) }}>
                    {formatProbability(data.consensus.p_fail_14d)}
                  </span>
                  <span className="text-sm text-[#6B7280]">
                    7 d {formatProbability(data.consensus.p_fail_7d)} · 30 d {formatProbability(data.consensus.p_fail_30d)}
                  </span>
                </div>
                <div className="text-xs text-[#6B7280]">{data.consensus.note}</div>
              </div>
              <div className="flex flex-col items-end gap-1 text-right">
                {agreement ? (
                  <Badge variant="outline" appearance="secondary" size="sm">
                    {agreement} agreement · spread {formatProbability(data.consensus.spread_14d)}
                  </Badge>
                ) : null}
                {data.next_failure ? (
                  <div className="text-xs text-[#6B7280]">
                    Planted failure {data.next_failure.event_id} in {data.next_failure.days_from_as_of} days
                    {data.next_failure.synthetic ? ' (synthetic)' : ''}
                  </div>
                ) : null}
                {data.as_of_used && data.as_of_used !== data.as_of ? (
                  <div className="text-xs text-[#F59E0B]">Showing latest available day: {data.as_of_used}</div>
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
                <div className="text-xs font-medium text-[#111827]">14-day failure probability, trailing 30 days</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={historyData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6B7280' }} width={36} unit="%" />
                    <Tooltip formatter={(v: number | string) => `${v}%`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine y={50} stroke="#DC2626" strokeDasharray="4 3" />
                    <Line type="monotone" dataKey="consensus" name={METHOD_SHORT.consensus} stroke={METHOD_COLOR.consensus} strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls />
                    <Line type="monotone" dataKey="heuristic" name={METHOD_SHORT.heuristic} stroke={METHOD_COLOR.heuristic} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
                    <Line type="monotone" dataKey="classifier" name={METHOD_SHORT.classifier} stroke={METHOD_COLOR.classifier} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
                    <Line type="monotone" dataKey="monte_carlo" name={METHOD_SHORT.monte_carlo} stroke={METHOD_COLOR.monte_carlo} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
                    <Line type="monotone" dataKey="weibull" name={METHOD_SHORT.weibull} stroke={METHOD_COLOR.weibull} strokeWidth={1} strokeDasharray="3 3" dot={false} isAnimationActive={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
