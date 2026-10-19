/*
 * The real June 2026 outage as the Backtest page quotes it beside the planted
 * reenactment. Same values and shape as CONTRACT §1 `REAL_OUTAGE` and the Plan B
 * `reference` object (contract/fixtures/plan_b_S3.json), so Plan B and Backtest can
 * never disagree on a number. Everything here is reported (Cap Times Oct 8 2026; WPR
 * Jun 30 2026; UW News) except `usd_per_day`, which is our estimate:
 * $10M of rentals ÷ ~30 chillers ÷ ~90 days.
 */

import type { PlanBReference } from '@/shared/api';

export const REAL_OUTAGE: PlanBReference = {
  label: 'Real June 2026 outage',
  total_usd: 15_800_000,
  rental_usd: 10_000_000,
  deterioration_usd: 4_000_000,
  repair_usd: 1_800_000,
  chillers: 30,
  usd_per_day: 111_000,
  buildings_closed: 23,
  buildings_partial: 11,
  start_date: '2026-06-17',
  reopen_date: '2026-08-10',
  source: 'Cap Times Oct 8 2026; WPR Jun 30 2026; UW News. $/day is our estimate.',
};

/** Share of the real bill that went to renting chillers — the price of being caught unprepared. */
export const REAL_RENTAL_SHARE_PCT = Math.round((REAL_OUTAGE.rental_usd / REAL_OUTAGE.total_usd) * 100);

/**
 * `$15.8M` · `$10M` · `$1.8M`. The shared `formatUsd` rounds amounts ≥ $10M to whole
 * millions, which would print the reported $15.8M as "$16M" — a reported figure is quoted
 * as reported (FRONTEND §2).
 */
export function formatRealUsd(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 10_000) return `$${Math.round(abs / 1000)}K`;
  return `$${Math.round(abs).toLocaleString('en-US')}`;
}
