/*
 * RiskBar — a 0–5 risk meter with the inspection threshold as a tick. The fill wears
 * the asset's status colour (status meaning, not decoration).
 */

import React from 'react';

import { cn } from '@/lib/utils';
import { RISK_SCALE_MAX, formatRisk, type Status } from '@/shared/api';

export interface RiskBarProps {
  risk: number;
  threshold: number;
  status: Status;
  className?: string;
}

export default function RiskBar({ risk, threshold, status, className }: RiskBarProps) {
  const fill = Math.max(0, Math.min(100, (risk / RISK_SCALE_MAX) * 100));
  const tick = Math.max(0, Math.min(100, (threshold / RISK_SCALE_MAX) * 100));
  return (
    <span
      data-status={status}
      className={cn('inline-flex items-center gap-2', className)}
      title={`Risk ${formatRisk(risk)} on a 0–${RISK_SCALE_MAX} scale · inspection threshold ${formatRisk(threshold)}`}
    >
      <span
        role="img"
        aria-label={`Risk ${formatRisk(risk)} of ${RISK_SCALE_MAX}`}
        className="relative block h-2 w-[112px] rounded-full bg-[var(--bib-border)]"
      >
        <span className="block h-full rounded-full bg-[var(--bib-status-color)]" style={{ width: `${fill}%` }} />
        <span aria-hidden className="absolute -top-[3px] h-[14px] w-px bg-[var(--bib-ink)]" style={{ left: `${tick}%` }} />
      </span>
      <span className="text-[14px] font-semibold tabular-nums leading-5 text-[var(--bib-ink)]">{formatRisk(risk)}</span>
    </span>
  );
}
