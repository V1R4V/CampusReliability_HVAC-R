/*
 * AlignedCurvesChart — every planted failure's risk over the 21 days before it broke,
 * aligned on the failure day, against the current threshold (FRONTEND §5.7).
 * Series identity uses the validated categorical slots (styles/before-it-breaks.css);
 * the threshold line wears the status colour because it *means* "inspection due".
 */

import React, { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { AXIS_STROKE, AXIS_TICK, GRID_STROKE, SERIES_COLORS } from '@/components/Chart/chartTheme';
import { formatRisk, formatThreshold, type AlignedCurve } from '@/shared/api';

export { SERIES_COLORS };

interface TooltipPayloadItem {
  name?: unknown;
  value?: unknown;
  color?: string;
}

interface CurveTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<TooltipPayloadItem>;
  label?: unknown;
}

function CurveTooltip({ active, payload, label }: CurveTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const day = Number(label);
  return (
    <div className="bib-card px-3 py-2 text-[13px] shadow-[var(--bib-shadow-raised)]">
      <div className="mb-1 font-semibold leading-5 text-[var(--bib-ink)]">
        {day === 0 ? 'Day of failure' : `${Math.abs(day)} days before failure`}
      </div>
      {payload.map((item, index) => (
        <div key={index} className="flex items-center justify-between gap-4 leading-5">
          <span className="inline-flex items-center gap-2 text-[var(--bib-ink-muted)]">
            <span className="inline-block h-[2px] w-4 rounded-full" style={{ background: item.color }} aria-hidden />
            {String(item.name)}
          </span>
          <span className="font-semibold tabular-nums text-[var(--bib-ink)]">{formatRisk(Number(item.value))}</span>
        </div>
      ))}
    </div>
  );
}

export interface AlignedCurvesChartProps {
  curves: AlignedCurve[];
  threshold: number;
  height?: number;
}

export default function AlignedCurvesChart({ curves, threshold, height = 300 }: AlignedCurvesChartProps) {
  // One row per days_before with a column per event — what Recharts' multi-line wants.
  const data = useMemo(() => {
    const byDay = new Map<number, Record<string, number>>();
    curves.forEach((curve) => {
      curve.points.forEach((point) => {
        const row = byDay.get(point.days_before) ?? { days_before: point.days_before };
        row[curve.event_id] = point.risk;
        byDay.set(point.days_before, row);
      });
    });
    return Array.from(byDay.values()).sort((a, b) => a.days_before - b.days_before);
  }, [curves]);

  const yMax = useMemo(
    () => Math.ceil(Math.max(5, threshold + 0.5, ...curves.flatMap((c) => c.points.map((p) => p.risk)))),
    [curves, threshold],
  );

  if (curves.length === 0) {
    return <p className="text-[15px] text-[var(--bib-ink-muted)]">No aligned curves in this run.</p>;
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 24, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={GRID_STROKE} vertical={false} />
          <XAxis
            dataKey="days_before"
            type="number"
            domain={[-21, 0]}
            ticks={[-21, -14, -7, 0]}
            tickFormatter={(value: number) => (value === 0 ? 'failure' : `${value} d`)}
            tick={AXIS_TICK}
            axisLine={{ stroke: AXIS_STROKE }}
            tickLine={false}
          />
          <YAxis domain={[0, yMax]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} />
          <RechartsTooltip content={<CurveTooltip />} cursor={{ stroke: AXIS_STROKE }} />
          <Legend verticalAlign="top" align="left" iconType="plainline" wrapperStyle={{ fontSize: 13, paddingBottom: 8 }} />
          <ReferenceLine
            y={threshold}
            stroke="var(--bib-status-due)"
            strokeWidth={1.5}
            ifOverflow="extendDomain"
            label={{
              value: `Inspection due ≥ ${formatThreshold(threshold)}`,
              position: 'insideTopLeft',
              fill: 'var(--bib-status-due)',
              fontSize: 13,
            }}
          />
          {curves.map((curve, index) => (
            <Line
              key={curve.event_id}
              type="monotone"
              dataKey={curve.event_id}
              name={`${curve.event_id} · ${curve.asset_id}`}
              stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--bib-surface)' }}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
