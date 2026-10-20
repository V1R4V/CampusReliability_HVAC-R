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
import type { DriverMap, SensorBandMap, SensorMap } from '@/Interfaces';

export interface SignalBarsProps {
  contrib: DriverMap;
  /** Sign-adjusted z-scores (positive = worse) from the model. */
  z: DriverMap;
  driverLabel?: string;
  /** Today's raw readings and their 30-day normal bands — enables "67.1 psi · −1.9 vs normal". */
  sensors?: SensorMap | null;
  band?: SensorBandMap | null;
}

const DRIVER_LABEL: Record<keyof DriverMap, string> = {
  pressure: 'Pressure',
  flow_imbalance: 'Flow imbalance',
  delta_t: 'ΔT',
  vibration: 'Vibration',
  energy: 'Energy',
};

/** Which physical direction is the bad one: a leak drops pressure and shrinks ΔT; the rest rise. */
const BAD_DIRECTION: Record<keyof DriverMap, 'up' | 'down'> = {
  pressure: 'down',
  flow_imbalance: 'up',
  delta_t: 'down',
  vibration: 'up',
  energy: 'up',
};

const SENSOR_FOR_DRIVER: Record<keyof DriverMap, { key: keyof SensorMap; unit: string; digits: number }> = {
  pressure: { key: 'pressure_psi', unit: 'psi', digits: 1 },
  flow_imbalance: { key: 'flow_imbalance_pct', unit: '%', digits: 1 },
  delta_t: { key: 'delta_t_f', unit: '°F', digits: 1 },
  vibration: { key: 'vibration_mm_s', unit: 'mm/s', digits: 2 },
  energy: { key: 'energy_kwh', unit: 'kWh', digits: 0 },
};

/** |z| below this reads as "within the normal band". */
const FLAT_Z = 0.05;

interface Row {
  key: keyof DriverMap;
  value: number;
  zValue: number | null | undefined;
}

/** `1.6 σ` — distance from the 30-day normal band in standard deviations. */
export function formatSigma(z: number): string {
  return `${Math.abs(z).toFixed(1)} σ`;
}

/**
 * The physical move behind a sign-adjusted z: positive z means "worse", and worse is a fall for
 * pressure and ΔT (leak signature) but a rise for flow imbalance, vibration and energy.
 */
export function physicalDirection(key: keyof DriverMap, z: number | null | undefined): 'up' | 'down' | 'flat' | null {
  if (z == null) return null;
  if (Math.abs(z) <= FLAT_Z) return 'flat';
  const worse = z > 0;
  const bad = BAD_DIRECTION[key];
  if (worse) return bad;
  return bad === 'up' ? 'down' : 'up';
}

function directionWord(key: keyof DriverMap, direction: 'up' | 'down' | 'flat'): string {
  if (direction === 'flat') return 'steady';
  if (key === 'delta_t') return direction === 'up' ? 'widening' : 'shrinking';
  return direction === 'up' ? 'rising' : 'falling';
}

/** `−1.9 psi vs normal` — today's reading against the midpoint of its 30-day normal band. */
export function formatDeviation(key: keyof DriverMap, sensors?: SensorMap | null, band?: SensorBandMap | null): string | null {
  const spec = SENSOR_FOR_DRIVER[key];
  const value = sensors?.[spec.key];
  const range = band?.[spec.key];
  if (value == null || !range) return null;
  const mid = (range[0] + range[1]) / 2;
  const delta = value - mid;
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  const unit = spec.unit === '%' ? ' pts' : ` ${spec.unit}`;
  return `${sign}${Math.abs(delta).toFixed(spec.digits)}${unit} vs normal`;
}

/**
 * "What's driving it" — each signal's share of today's risk, sorted largest first, with the
 * physical direction of its move (an arrow that points the way the reading actually went),
 * the size of the move in standard deviations, and the raw deviation from the 30-day normal.
 * The largest contributor is drawn in ink; the rest in the accent so the eye lands on the driver.
 */
export default function SignalBars({ contrib, z, driverLabel, sensors, band }: SignalBarsProps) {
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
        <span className="text-[13px] leading-4 text-[var(--bib-ink-muted)]">share of risk · move vs 30-day normal</span>
      </div>
      <ul className="flex flex-col gap-3">
        {rows.map((row, index) => {
          const pct = Math.round(row.value * 100);
          const direction = physicalDirection(row.key, row.zValue);
          const Arrow = direction === 'up' ? ArrowUp : direction === 'down' ? ArrowDown : ArrowRight;
          const word = direction ? directionWord(row.key, direction) : null;
          const worse = row.zValue != null && row.zValue > FLAT_Z;
          const deviation = formatDeviation(row.key, sensors, band);
          const detail = [word, row.zValue != null && direction !== 'flat' ? formatSigma(row.zValue) : null, deviation]
            .filter(Boolean)
            .join(' · ');
          return (
            <li key={row.key} className="grid grid-cols-[minmax(96px,132px)_minmax(0,1fr)_56px] items-center gap-x-3 gap-y-1">
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
                aria-valuetext={`${pct}% of risk${detail ? `, ${detail}` : ''}`}
              >
                <div
                  className={cn('h-full rounded-full', index === 0 ? 'bg-[var(--bib-ink)]' : 'bg-[var(--bib-accent)] opacity-70')}
                  style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                />
              </div>
              <span className="bib-num text-right text-[15px] font-semibold text-[var(--bib-ink)]">{pct}%</span>
              <span className="col-start-2 col-span-2 inline-flex items-center gap-1.5 text-[13px] leading-4 text-[var(--bib-ink-muted)]">
                {direction ? (
                  <Arrow
                    className={cn('size-3.5 shrink-0', worse ? 'text-[var(--bib-status-due)]' : 'text-[var(--bib-ink-faint)]')}
                    role="img"
                    aria-label={word ?? ''}
                  />
                ) : null}
                <span className="bib-num">{detail || 'no 30-day normal yet'}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
