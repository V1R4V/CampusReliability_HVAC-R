/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import React from 'react';
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { DriverMap } from '@/Interfaces';

export interface SignalBarsProps {
  contrib: DriverMap;
  z: DriverMap;
  driverLabel?: string;
}

const DRIVER_LABEL: Record<keyof DriverMap, string> = {
  pressure: 'Pressure',
  flow_imbalance: 'Flow imbalance',
  delta_t: 'ΔT',
  vibration: 'Vibration',
  energy: 'Energy',
};

/** |z| below this reads as "within the normal band". */
const FLAT_Z = 0.05;

interface Row {
  key: keyof DriverMap;
  value: number;
  zValue: number | null | undefined;
}

/** `z +1.6` / `z −0.4` — direction-adjusted distance from the 30-day normal band (positive = worse). */
export function formatZ(z: number): string {
  const sign = z > 0 ? '+' : z < 0 ? '−' : '';
  return `z ${sign}${Math.abs(z).toFixed(1)}`;
}

/**
 * "What's driving it" — each signal's share of today's risk, sorted largest first, with the
 * direction of its move against the 30-day normal band and the raw z-score behind the arrow.
 * The largest contributor is drawn in ink; the rest in the accent so the eye lands on the driver.
 */
export default function SignalBars({ contrib, z, driverLabel }: SignalBarsProps) {
  const rows: Row[] = (Object.keys(DRIVER_LABEL) as (keyof DriverMap)[])
    .map((key) => ({ key, value: contrib?.[key], zValue: z?.[key] }))
    .filter((r): r is Row => typeof r.value === 'number')
    .sort((a, b) => b.value - a.value);

  if (rows.length === 0) {
    return <div className="text-[15px] text-[var(--bib-ink-muted)]">No driver signal available.</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        {driverLabel ? (
          <div className="flex items-baseline gap-2">
            <span className="bib-eyebrow">Driving signal</span>
            <span className="text-[15px] font-semibold text-[var(--bib-ink)]">{driverLabel.replace(/_/g, ' ')}</span>
          </div>
        ) : (
          <span />
        )}
        <span className="text-[13px] leading-4 text-[var(--bib-ink-muted)]">share of risk · z vs 30-day normal</span>
      </div>
      <ul className="flex flex-col gap-2.5">
        {rows.map((row, index) => {
          const pct = Math.round(row.value * 100);
          const direction = row.zValue == null ? null : row.zValue > FLAT_Z ? 'up' : row.zValue < -FLAT_Z ? 'down' : 'flat';
          const Arrow = direction === 'up' ? ArrowUp : direction === 'down' ? ArrowDown : ArrowRight;
          const directionText = direction === 'up' ? 'above normal' : direction === 'down' ? 'below normal' : 'within normal';
          return (
            <li key={row.key} className="grid grid-cols-[minmax(96px,132px)_minmax(0,1fr)_56px_76px] items-center gap-3">
              <span className={cn('text-[15px] leading-5', index === 0 ? 'font-semibold text-[var(--bib-ink)]' : 'text-[var(--bib-ink-soft)]')}>
                {DRIVER_LABEL[row.key]}
              </span>
              <div
                className="h-2.5 overflow-hidden rounded-full bg-[var(--bib-canvas-deep)]"
                role="meter"
                aria-label={`${DRIVER_LABEL[row.key]} share of risk`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, Math.max(0, pct))}
                aria-valuetext={`${pct}% of risk${row.zValue != null ? `, ${formatZ(row.zValue)} ${directionText}` : ''}`}
              >
                <div
                  className={cn('h-full rounded-full', index === 0 ? 'bg-[var(--bib-ink)]' : 'bg-[var(--bib-accent)] opacity-70')}
                  style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                />
              </div>
              <span className="bib-num text-right text-[15px] font-semibold text-[var(--bib-ink)]">{pct}%</span>
              <span
                className="bib-num inline-flex items-center justify-end gap-1 text-[13px] leading-4 text-[var(--bib-ink-muted)]"
                title={
                  row.zValue == null
                    ? undefined
                    : `Standard deviations from the 30-day normal band, sign-adjusted so positive means worse: ${directionText}`
                }
              >
                {row.zValue != null ? formatZ(row.zValue) : ''}
                {direction ? <Arrow className="size-3.5" role="img" aria-label={directionText} /> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
