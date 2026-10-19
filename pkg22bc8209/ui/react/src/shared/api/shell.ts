/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import { c3Action } from '@/c3Action';
import type { BacktestResult, CampusSnapshot, FailureEventRow, PlanBResult, WeatherDay } from '@/Interfaces';

/**
 * Shell / Overview / Plan B / Backtest data-access functions (docs/CONTRACT.md §5.2).
 * Pages and components import from here and never call `c3Action` directly.
 */

/** `CampusSnapshot.compute(as_of)`. */
export async function fetchCampusSnapshot(asOf: string): Promise<CampusSnapshot> {
  return c3Action('CampusSnapshot', 'compute', [asOf]);
}

/** `PlanB.simulate(segment_id, temp_f, priority_only)`. */
export async function simulatePlanB(segmentId: string, tempF: number, priorityOnly: boolean): Promise<PlanBResult> {
  return c3Action('PlanB', 'simulate', [segmentId, tempF, priorityOnly]);
}

/** `Backtest.run(threshold)`. */
export async function runBacktest(threshold: number): Promise<BacktestResult> {
  return c3Action('Backtest', 'run', [threshold]);
}

/** Raw shape of a built-in `FailureEvent.fetch` row — platform id/ref, not the contract's flat keys. */
interface RawFailureEventRow {
  id: string;
  kind: string;
  asset?: { id: string } | null;
  onset_date?: string | null;
  date: string;
  end_date?: string | null;
  label?: string | null;
  synthetic?: boolean | null;
}

/** Built-in `FailureEvent.fetch`, remapped (CONTRACT §5.2: `id` → `event_id`, `asset.id` → `asset_id`). */
export async function fetchEvents(): Promise<FailureEventRow[]> {
  const response = await c3Action('FailureEvent', 'fetch', [{ include: 'this, asset.id', limit: -1 }]);
  const rows: RawFailureEventRow[] = response?.objs ?? [];
  return rows
    .map((row) => ({
      event_id: row.id,
      kind: row.kind,
      asset_id: row.asset?.id ?? null,
      onset_date: row.onset_date ?? null,
      date: row.date,
      end_date: row.end_date ?? null,
      label: row.label ?? row.id,
      synthetic: Boolean(row.synthetic),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Built-in `WeatherDay.fetch` for one date (id = date). `null` when that day has no row. */
export async function fetchWeather(date: string): Promise<WeatherDay | null> {
  const response = await c3Action('WeatherDay', 'fetch', [{ filter: `id == '${date}'`, limit: 1 }]);
  const row = response?.objs?.[0];
  if (!row) return null;
  return {
    tmax_f: row.tmax_f ?? null,
    tmin_f: row.tmin_f ?? null,
    tavg_f: row.tavg_f ?? null,
    label: row.label ?? null,
    source: row.source ?? null,
  };
}
