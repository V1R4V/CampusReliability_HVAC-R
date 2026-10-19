/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import React from 'react';
import { Line, LineChart, ReferenceLine, ResponsiveContainer, YAxis } from 'recharts';

import { RISK_STROKE, STATUS_STROKE } from '@/components/Chart/chartTheme';
import type { RiskPoint } from '@/Interfaces';

export interface SparklineProps {
  points: RiskPoint[];
  threshold: number;
  height?: number;
}

/**
 * Tiny trend line for a building's system card — no axes, just shape + threshold. The line
 * wears the accent; it turns the status red only once the latest point is over the threshold.
 */
export default function Sparkline({ points, threshold, height = 40 }: SparklineProps) {
  if (!points || points.length === 0) {
    return <div className="text-[13px] text-[var(--bib-ink-muted)]">No trend data.</div>;
  }
  const last = points[points.length - 1];
  const stroke = last.risk >= threshold ? STATUS_STROKE.INSPECTION_DUE : RISK_STROKE;
  const yMax = Math.max(threshold + 0.5, ...points.map((p) => p.risk));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 4, right: 2, left: 2, bottom: 2 }}>
        <YAxis hide domain={[0, yMax]} />
        <ReferenceLine y={threshold} stroke={STATUS_STROKE.INSPECTION_DUE} strokeDasharray="3 3" strokeOpacity={0.6} />
        <Line type="monotone" dataKey="risk" stroke={stroke} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
