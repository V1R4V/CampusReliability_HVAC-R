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
  Area,
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
} from 'recharts';

import ChartTooltip from '@/components/Chart/ChartTooltip';
import { AXIS_STROKE, AXIS_TICK, GRID_STROKE, INK, INK_MUTED, RISK_STROKE, STATUS_STROKE, shortDate } from '@/components/Chart/chartTheme';
import { STATUS_LABEL, formatRisk } from '@/shared/api';
import type { AssetEvent, AssetStatus, RiskSeriesPoint } from '@/Interfaces';

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
  driver: string;
  riskKnown: number | null;
  riskFuture: number | null;
}

function CrossMark({ cx, cy, label }: { cx?: number; cy?: number; label?: string }) {
  if (cx == null || cy == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={9} fill="var(--bib-surface)" stroke={STATUS_STROKE.FAILED} strokeWidth={1.5} />
      <line x1={cx - 4} y1={cy - 4} x2={cx + 4} y2={cy + 4} stroke={STATUS_STROKE.FAILED} strokeWidth={2} />
      <line x1={cx - 4} y1={cy + 4} x2={cx + 4} y2={cy - 4} stroke={STATUS_STROKE.FAILED} strokeWidth={2} />
      {label ? (
        <text x={cx + 12} y={cy - 10} fontSize={12} fontWeight={600} fill={INK} stroke="var(--bib-surface)" strokeWidth={3} paintOrder="stroke">
          {label}
        </text>
      ) : null}
    </g>
  );
}

/** Decoy annotation: hollow dot + the short form of its label ("Heat wave … · ignored"), haloed so it stays legible over lines. */
function DecoyMark({ cx, cy, label }: { cx?: number; cy?: number; label?: string }) {
  if (cx == null || cy == null) return null;
  const short = label ? `${label.split(/[:(—]/)[0].trim()} · ignored` : '';
  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill="var(--bib-surface)" stroke={INK_MUTED} strokeWidth={1.5} />
      {short ? (
        <text
          x={cx}
          y={cy - 12}
          fontSize={11}
          fill={INK_MUTED}
          textAnchor="middle"
          stroke="var(--bib-surface)"
          strokeWidth={3}
          paintOrder="stroke"
        >
          {short}
        </text>
      ) : null}
    </g>
  );
}

interface RiskTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: ChartPoint }>;
  label?: unknown;
}

function RiskTooltip({ active, payload, label }: RiskTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <ChartTooltip
      title={shortDate(String(label))}
      rows={[
        { key: 'risk', name: 'Risk', value: formatRisk(point.risk), color: RISK_STROKE },
        { key: 'status', name: 'Status', value: STATUS_LABEL[point.status] ?? point.status, color: STATUS_STROKE[point.status] },
      ]}
      footer={point.driver ? `Driving signal: ${point.driver.replace(/_/g, ' ')}` : undefined}
    />
  );
}

/**
 * Risk-over-time chart — the heart of the Asset detail page (FRONTEND §5.4).
 * Threshold line, shaded INSPECTION_DUE spans, ✕ failure markers, decoy
 * annotations, an as-of cursor, and data after `asOf` rendered grey/dashed
 * (we only "know" up to as-of).
 */
export default function RiskChart({ series, threshold, events, asOf, height = 300 }: RiskChartProps) {
  const chartData = useMemo<ChartPoint[]>(
    () =>
      (series ?? []).map((p) => ({
        date: p.date,
        risk: p.risk,
        status: p.status,
        driver: p.driver,
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
      <ComposedChart data={chartData} margin={{ top: 28, right: 24, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="bib-risk-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--bib-accent)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--bib-accent)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          minTickGap={48}
          tick={AXIS_TICK}
          axisLine={{ stroke: AXIS_STROKE }}
          tickLine={false}
        />
        <YAxis domain={[0, yMax]} tick={AXIS_TICK} width={28} axisLine={false} tickLine={false} />
        <Tooltip content={<RiskTooltip />} cursor={{ stroke: AXIS_STROKE }} />

        {inspectionDueSpans.map((span) => (
          <ReferenceArea
            key={`${span.x1}-${span.x2}`}
            x1={span.x1}
            x2={span.x2}
            y1={0}
            y2={yMax}
            fill={STATUS_STROKE.INSPECTION_DUE}
            fillOpacity={0.08}
            stroke="none"
          />
        ))}

        <ReferenceLine
          y={threshold}
          stroke={STATUS_STROKE.INSPECTION_DUE}
          strokeDasharray="4 4"
          strokeWidth={1.5}
          label={{ value: `Inspection threshold ${formatRisk(threshold)}`, position: 'insideTopRight', fill: STATUS_STROKE.INSPECTION_DUE, fontSize: 12 }}
        />
        <ReferenceLine
          x={asOf}
          stroke={INK}
          strokeDasharray="2 3"
          label={{ value: `As of ${shortDate(asOf)}`, position: 'top', fill: INK, fontSize: 12, fontWeight: 600 }}
        />

        {decoyEvents.map((e) => (
          <ReferenceDot
            key={e.event_id}
            x={e.date}
            y={riskByDate.get(e.date) ?? 0}
            r={4}
            shape={(p: { cx?: number; cy?: number }) => <DecoyMark cx={p.cx} cy={p.cy} label={e.label} />}
          />
        ))}

        {realRefEvents.map((e) => (
          <ReferenceLine
            key={e.event_id}
            x={e.date}
            stroke={INK}
            strokeWidth={1}
            label={{ value: 'Real break', position: 'insideBottomLeft', fill: INK, fontSize: 12 }}
          />
        ))}

        <Area
          type="monotone"
          dataKey="riskKnown"
          stroke="none"
          fill="url(#bib-risk-fill)"
          isAnimationActive={false}
          connectNulls
          legendType="none"
          tooltipType="none"
        />
        <Line
          type="monotone"
          dataKey="riskKnown"
          stroke={RISK_STROKE}
          strokeWidth={2.25}
          dot={false}
          activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--bib-surface)' }}
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
          activeDot={false}
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
