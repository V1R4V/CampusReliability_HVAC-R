/*
 * RiskBar — a risk meter with the inspection threshold as a tick. The fill wears the
 * asset's status colour (status meaning, not decoration). Risk is unbounded (the planted
 * failures peak above 7), so the scale stretches to the larger of 5 and the value shown.
 */

import React from 'react';

import { cn } from '@/lib/utils';
import { RISK_SCALE_MAX, WATCH_THRESHOLD, formatRisk, type Status } from '@/shared/api';

export interface RiskBarProps {
  risk: number;
  threshold: number;
  status: Status;
  className?: string;
}

export default function RiskBar({ risk, threshold, status, className }: RiskBarProps) {
  const scaleMax = Math.max(RISK_SCALE_MAX, Math.ceil(risk), Math.ceil(threshold));
  const fill = Math.max(0, Math.min(100, (risk / scaleMax) * 100));
  const tick = Math.max(0, Math.min(100, (threshold / scaleMax) * 100));
  return (
    <span
      data-status={status}
      className={cn('inline-flex items-center gap-2', className)}
      title={`Risk ${formatRisk(risk)} · inspection due from ${formatRisk(threshold)} · watch from ${formatRisk(WATCH_THRESHOLD)}`}
    >
      <span
        role="img"
        aria-label={`Risk ${formatRisk(risk)}, inspection threshold ${formatRisk(threshold)}`}
        className="relative block h-2 w-[120px] rounded-full bg-[var(--bib-canvas-deep)]"
      >
        <span className="block h-full rounded-full bg-[var(--bib-status-color)]" style={{ width: `${fill}%` }} />
        <span aria-hidden className="absolute -top-[3px] h-[14px] w-[2px] rounded-full bg-[var(--bib-ink)]" style={{ left: `${tick}%` }} />
      </span>
      <span className="bib-num text-[14px] font-semibold leading-5 text-[var(--bib-ink)]">{formatRisk(risk)}</span>
    </span>
  );
}
