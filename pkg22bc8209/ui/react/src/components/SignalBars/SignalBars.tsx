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

interface Row {
  key: keyof DriverMap;
  value: number;
  zValue: number | null | undefined;
}

/**
 * "What's driving it" — each signal's share of today's risk, sorted largest first, with the
 * direction of its move against the 30-day normal band. The largest contributor is drawn in
 * ink; the rest in the accent so the eye lands on the driver.
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
      {driverLabel ? (
        <div className="flex items-baseline gap-2">
          <span className="bib-eyebrow">Driving signal</span>
          <span className="text-[15px] font-semibold text-[var(--bib-ink)]">{driverLabel.replace(/_/g, ' ')}</span>
        </div>
      ) : null}
      <ul className="flex flex-col gap-2.5">
        {rows.map((row, index) => {
          const pct = Math.round(row.value * 100);
          const direction = row.zValue == null ? null : row.zValue > 0.05 ? 'up' : row.zValue < -0.05 ? 'down' : 'flat';
          const Arrow = direction === 'up' ? ArrowUp : direction === 'down' ? ArrowDown : ArrowRight;
          return (
            <li key={row.key} className="grid grid-cols-[132px_minmax(0,1fr)_76px] items-center gap-3">
              <span className={cn('text-[15px] leading-5', index === 0 ? 'font-semibold text-[var(--bib-ink)]' : 'text-[var(--bib-ink-soft)]')}>
                {DRIVER_LABEL[row.key]}
              </span>
              <div className="h-2.5 overflow-hidden rounded-full bg-[var(--bib-canvas-deep)]" role="img" aria-label={`${DRIVER_LABEL[row.key]} ${pct}% of risk`}>
                <div
                  className={cn('h-full rounded-full', index === 0 ? 'bg-[var(--bib-ink)]' : 'bg-[var(--bib-accent)] opacity-70')}
                  style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                />
              </div>
              <span className="bib-num inline-flex items-center justify-end gap-1 text-[15px] font-semibold text-[var(--bib-ink)]">
                {pct}%
                {direction ? (
                  <Arrow
                    className="size-4 text-[var(--bib-ink-muted)]"
                    role="img"
                    aria-label={direction === 'up' ? 'rising vs normal' : direction === 'down' ? 'falling vs normal' : 'within normal'}
                  />
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
