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

const BAR_COLOR = '#2563EB';

interface Row {
  key: keyof DriverMap;
  value: number;
  zValue: number | null | undefined;
}

/** "What's driving it" — contribution bars sorted desc, with direction vs. 30-day normal band. */
export default function SignalBars({ contrib, z, driverLabel }: SignalBarsProps) {
  const rows: Row[] = (Object.keys(DRIVER_LABEL) as (keyof DriverMap)[])
    .map((key) => ({ key, value: contrib?.[key], zValue: z?.[key] }))
    .filter((r): r is Row => typeof r.value === 'number')
    .sort((a, b) => b.value - a.value);

  if (rows.length === 0) {
    return <div className="text-sm text-[#6B7280]">No driver signal available.</div>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {driverLabel ? <div className="text-xs text-[#6B7280]">Driving signal: {driverLabel}</div> : null}
      {rows.map((row) => {
        const pct = Math.round(row.value * 100);
        const arrow = row.zValue == null ? '' : row.zValue > 0.05 ? '↑' : row.zValue < -0.05 ? '↓' : '→';
        return (
          <div key={row.key} className="flex items-center gap-2">
            <div className="w-28 shrink-0 text-xs text-[#111827]">{DRIVER_LABEL[row.key]}</div>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#F7F7F5]">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: BAR_COLOR }}
              />
            </div>
            <div className="w-14 shrink-0 text-right text-xs text-[#111827]">
              {pct}% {arrow}
            </div>
          </div>
        );
      })}
    </div>
  );
}
