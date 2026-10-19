/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import React, { useMemo } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import type { AssetEvent, AssetStatus, RiskSeriesPoint } from '@/Interfaces';
import { STATUS_LABEL, formatDate, formatRisk } from '@/shared/api';
import { AXIS, GRID, INK, INK_MUTED, STATUS_COLOR } from './statusColors';

export interface RiskChartProps {
  series: RiskSeriesPoint[];
  threshold: number;
  events: AssetEvent[];
  /** ISO date (yyyy-mm-dd). Data at/before is "known"; after is greyed (we only "know" up to asOf). */
  asOf: string;
  height?: number;
}

interface ChartPoint {
  date: string;
  risk: number;
  status: AssetStatus;
  riskKnown: number | null;
  riskFuture: number | null;
}

function CrossMark({ cx, cy, label }: { cx?: number; cy?: number; label?: string }) {
  if (cx == null || cy == null) return null;
  return (
    <g>
      <line x1={cx - 5} y1={cy - 5} x2={cx + 5} y2={cy + 5} stroke={STATUS_COLOR.FAILED} strokeWidth={2} />
      <line x1={cx - 5} y1={cy + 5} x2={cx + 5} y2={cy - 5} stroke={STATUS_COLOR.FAILED} strokeWidth={2} />
      {label ? (
        <text x={cx + 8} y={cy - 8} fontSize={13} fontWeight={500} fill={INK}>
          {label}
        </text>
      ) : null}
    </g>
  );
}

function DecoyMark({ cx, cy, label }: { cx?: number; cy?: number; label?: string }) {
  if (cx == null || cy == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill="none" stroke={INK_MUTED} strokeWidth={1.5} />
      {label ? (
        <text x={cx} y={cy - 10} fontSize={13} fill={INK_MUTED} textAnchor="middle">
          {`▲ ${label}`}
        </text>
      ) : null}
    </g>
  );
}

function RiskTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload as ChartPoint | undefined;
  if (!point) return null;
  return (
    <div className="rounded-[6px] border border-[var(--bib-border)] bg-[var(--bib-surface)] px-2.5 py-2 text-[13px] leading-5 text-[var(--bib-ink)] shadow-sm">
      <div className="font-semibold">{formatDate(String(label))}</div>
      <div>Risk {formatRisk(point.risk)}</div>
      <div className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[point.status] }} aria-hidden />
        {STATUS_LABEL[point.status]}
      </div>
    </div>
  );
}

/**
 * Risk-over-time chart — the heart of the Asset detail page (FRONTEND §5.4).
 * Threshold line, shaded INSPECTION_DUE spans, ✕ failure markers, decoy
 * annotations, an as-of cursor, and data after `asOf` rendered grey/dashed
 * (we only "know" up to as-of). Colours are the `--bib-*` tokens, so the chart
 * follows light / night mode; the risk line is ink (a single series needs no hue).
 */
export default function RiskChart({ series, threshold, events, asOf, height = 280 }: RiskChartProps) {
  const chartData = useMemo<ChartPoint[]>(
    () =>
      (series ?? []).map((p) => ({
        date: p.date,
        risk: p.risk,
        status: p.status,
        riskKnown: p.date <= asOf ? p.risk : null,
        riskFuture: p.date >= asOf ? p.risk : null,
      })),
    [series, asOf],
  );

  const riskByDate = useMemo(() => new Map(chartData.map((d) => [d.date, d.risk])), [chartData]);

  const inspectionDueSpans = useMemo(() => {
    const spans: { x1: string; x2: string }[] = [];
    let start: string | null = null;
    chartData.forEach((d, i) => {
      const due = d.status === 'INSPECTION_DUE' || d.status === 'FAILED';
      if (due && start === null) start = d.date;
      const next = chartData[i + 1];
      const nextDue = next ? next.status === 'INSPECTION_DUE' || next.status === 'FAILED' : false;
      if (due && !nextDue && start !== null) {
        spans.push({ x1: start, x2: d.date });
        start = null;
      }
    });
    return spans;
  }, [chartData]);

  const yMax = useMemo(() => {
    const maxRisk = chartData.reduce((m, d) => Math.max(m, d.risk), 0);
    return Math.max(5, Math.ceil(Math.max(maxRisk, threshold) + 0.5));
  }, [chartData, threshold]);

  const failureEvents = (events ?? []).filter((e) => e.kind === 'failure');
  const realRefEvents = (events ?? []).filter((e) => e.kind === 'real_reference');
  const decoyEvents = (events ?? []).filter((e) => e.kind === 'decoy');

  if (chartData.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-[15px] text-[var(--bib-ink-muted)]">
        No risk history available for this asset.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData} margin={{ top: 24, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(value: string | number) => formatDate(String(value), { year: false })}
          minTickGap={48}
          tick={{ fontSize: 13, fill: INK_MUTED }}
          axisLine={{ stroke: AXIS }}
          tickLine={false}
        />
        <YAxis
          domain={[0, yMax]}
          tick={{ fontSize: 13, fill: INK_MUTED }}
          width={28}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<RiskTooltip />} cursor={{ stroke: AXIS, strokeDasharray: '3 3' }} />

        {inspectionDueSpans.map((span) => (
          <ReferenceArea
            key={`${span.x1}-${span.x2}`}
            x1={span.x1}
            x2={span.x2}
            y1={0}
            y2={yMax}
            fill={STATUS_COLOR.INSPECTION_DUE}
            fillOpacity={0.1}
            stroke="none"
          />
        ))}

        <ReferenceLine
          y={threshold}
          stroke={STATUS_COLOR.INSPECTION_DUE}
          strokeDasharray="4 4"
          label={{ value: 'threshold', position: 'insideTopRight', fill: STATUS_COLOR.INSPECTION_DUE, fontSize: 13 }}
        />
        <ReferenceLine
          x={asOf}
          stroke={AXIS}
          strokeDasharray="2 2"
          label={{ value: 'as-of', position: 'top', fill: INK, fontSize: 13 }}
        />

        {decoyEvents.map((e) => (
          <ReferenceDot
            key={e.event_id}
            x={e.date}
            y={riskByDate.get(e.date) ?? 0}
            r={4}
            shape={(p: { cx?: number; cy?: number }) => <DecoyMark cx={p.cx} cy={p.cy} label={`${e.label}: ignored`} />}
          />
        ))}

        {realRefEvents.map((e) => (
          <ReferenceLine
            key={e.event_id}
            x={e.date}
            stroke={INK_MUTED}
            strokeDasharray="6 3"
            label={{ value: 'Real break', position: 'insideBottomLeft', fill: INK_MUTED, fontSize: 13 }}
          />
        ))}

        <Line
          type="monotone"
          dataKey="riskKnown"
          stroke={INK}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          connectNulls
          name="Risk"
        />
        <Line
          type="monotone"
          dataKey="riskFuture"
          stroke={INK_MUTED}
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={false}
          isAnimationActive={false}
          connectNulls
          name="Risk (future)"
          legendType="none"
        />

        {failureEvents.map((e) => (
          <ReferenceDot
            key={e.event_id}
            x={e.date}
            y={riskByDate.get(e.date) ?? 0}
            r={0}
            shape={(p: { cx?: number; cy?: number }) => <CrossMark cx={p.cx} cy={p.cy} label={e.label} />}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
