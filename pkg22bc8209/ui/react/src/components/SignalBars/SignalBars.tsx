/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import React from 'react';
import type { DriverMap } from '@/Interfaces';
import { SERIES_1 } from '../RiskChart/statusColors';

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

/** `z +1.6` — direction-adjusted distance from the 30-day normal band (positive = bad). */
function formatZ(z: number): string {
  return `z ${z > 0 ? '+' : z < 0 ? '−' : ''}${Math.abs(z).toFixed(1)}`;
}

/**
 * "What's driving it" (FRONTEND §5.4) — each signal's share of the risk score as a
 * single-hue bar, sorted desc, with its direction vs the 30-day normal band
 * (↑ above · ↓ below · → inside) and the raw z-score. Tokens, so it follows night mode.
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
    <div className="flex flex-col gap-2.5">
      {driverLabel ? (
        <div className="text-[13px] leading-4 text-[var(--bib-ink-muted)]">
          Driving signal: <span className="font-medium text-[var(--bib-ink)]">{driverLabel}</span>
        </div>
      ) : null}
      {rows.map((row) => {
        const pct = Math.round(row.value * 100);
        const arrow = row.zValue == null ? '' : row.zValue > 0.05 ? '↑' : row.zValue < -0.05 ? '↓' : '→';
        const leading = row.key === rows[0].key;
        return (
          <div key={row.key} className="flex items-center gap-3">
            <div className={`w-28 shrink-0 text-[14px] leading-5 ${leading ? 'font-medium' : ''} text-[var(--bib-ink)]`}>
              {DRIVER_LABEL[row.key]}
            </div>
            <div
              className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bib-canvas)]"
              role="meter"
              aria-label={`${DRIVER_LABEL[row.key]} contribution`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, Math.max(0, pct))}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: SERIES_1 }}
              />
            </div>
            <div className="w-16 shrink-0 text-right text-[14px] leading-5 tabular-nums text-[var(--bib-ink)]">
              {pct}% {arrow}
            </div>
            <div className="w-14 shrink-0 text-right text-[13px] leading-4 tabular-nums text-[var(--bib-ink-muted)]">
              {row.zValue == null ? '' : formatZ(row.zValue)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
