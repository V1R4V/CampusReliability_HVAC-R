/*
 * SweepCharts — how the threshold trades warning for false alarms (FRONTEND §5.7).
 * Two small charts on one axis each (never a dual axis): lead days vs threshold, and
 * false-alarm asset-days vs threshold, both marked at the current threshold.
 */

import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
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

import ChartTooltip from '@/components/Chart/ChartTooltip';
import { AXIS_STROKE, AXIS_TICK, GRID_STROKE, INK, SERIES_COLORS } from '@/components/Chart/chartTheme';
import { Panel } from '@/components/Panel/Panel';
import { formatThreshold, type BacktestSweepPoint } from '@/shared/api';

const TICKS = [2, 2.5, 3, 3.5, 4];

interface SweepTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ name?: unknown; value?: unknown; color?: string; fill?: string }>;
  label?: unknown;
  unit: string;
}

function SweepTooltip({ active, payload, label, unit }: SweepTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <ChartTooltip
      title={`Threshold ${formatThreshold(Number(label))}`}
      rows={payload.map((item, index) => ({
        key: `${String(item.name)}-${index}`,
        name: String(item.name),
        value: `${String(item.value)} ${unit}`,
        color: item.color ?? item.fill,
      }))}
    />
  );
}

export interface SweepChartsProps {
  sweep: BacktestSweepPoint[];
  threshold: number;
}

export default function SweepCharts({ sweep, threshold }: SweepChartsProps) {
  const data = useMemo(() => [...sweep].sort((a, b) => a.threshold - b.threshold), [sweep]);
  if (data.length === 0) return null;

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Warning vs threshold" subtitle="Days between the first ‘inspection due’ and the failure" chip="SYNTHETIC">
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis
                dataKey="threshold"
                type="number"
                domain={[2, 4]}
                ticks={TICKS}
                tickFormatter={(value: number) => formatThreshold(value)}
                tick={AXIS_TICK}
                axisLine={{ stroke: AXIS_STROKE }}
                tickLine={false}
              />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
              <RechartsTooltip content={<SweepTooltip unit="days" />} cursor={{ stroke: AXIS_STROKE }} />
              <Legend verticalAlign="top" align="left" iconType="plainline" wrapperStyle={{ fontSize: 13, paddingBottom: 8 }} />
              <ReferenceLine x={threshold} stroke={INK} strokeWidth={1} strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="mean_lead_days"
                name="Mean lead days"
                stroke={SERIES_COLORS[0]}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--bib-surface)' }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="min_lead_days"
                name="Minimum lead days"
                stroke={SERIES_COLORS[1]}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--bib-surface)' }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="False alarms vs threshold" subtitle="Asset-days flagged with no failure in the next 21 days" chip="SYNTHETIC">
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }} barCategoryGap="30%">
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis
                dataKey="threshold"
                tickFormatter={(value: number) => formatThreshold(value)}
                tick={AXIS_TICK}
                axisLine={{ stroke: AXIS_STROKE }}
                tickLine={false}
              />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
              <RechartsTooltip content={<SweepTooltip unit="asset-days" />} cursor={{ fill: 'var(--c3-style-basic-bg-hover)' }} />
              <ReferenceLine x={threshold} stroke={INK} strokeWidth={1} strokeDasharray="3 3" />
              <Bar
                dataKey="false_alarm_days"
                name="False-alarm days"
                fill={SERIES_COLORS[0]}
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}
