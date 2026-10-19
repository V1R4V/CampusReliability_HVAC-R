/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import React from 'react';
import { Line, LineChart, ReferenceLine, ResponsiveContainer } from 'recharts';
import type { RiskPoint } from '@/Interfaces';
import { INK, STATUS_COLOR } from '../RiskChart/statusColors';

export interface SparklineProps {
  points: RiskPoint[];
  threshold: number;
  height?: number;
}

/**
 * Tiny trend line for a building's system card — no axes, just shape + threshold tick.
 * Ink while under the threshold; the status-due colour once the latest point crosses it
 * (colour means status, FRONTEND §2). Tokens, so it follows light / night mode.
 */
export default function Sparkline({ points, threshold, height = 36 }: SparklineProps) {
  if (!points || points.length === 0) {
    return <div className="text-[13px] leading-4 text-[var(--bib-ink-muted)]">No trend data.</div>;
  }
  const last = points[points.length - 1];
  const stroke = last.risk >= threshold ? STATUS_COLOR.INSPECTION_DUE : INK;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <ReferenceLine y={threshold} stroke={STATUS_COLOR.INSPECTION_DUE} strokeDasharray="2 2" strokeOpacity={0.6} />
        <Line type="monotone" dataKey="risk" stroke={stroke} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
