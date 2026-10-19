/*
 * Before It Breaks — date and number formatting (FRONTEND §2): `$67K/day`, `$15.8M`,
 * `+8.5%`, `3.4`, `Jun 9, 2026`, plus the UTC day arithmetic the scrubber, charts and
 * timelines share (ISO `yyyy-mm-dd` in, ISO out, never a local-time shift).
 *
 * Pure module (no network, no `import.meta`) so Jest can import it directly; re-exported
 * by `shared/api/index.ts`.
 */

import { REPLAY_END, REPLAY_START } from './contract';

/* ───────────────────────────── Dates (UTC, ISO YYYY-MM-DD) ───────────────────── */

const DAY_MS = 86_400_000;

function utcMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Number of days in the replay window (Jan 1 → Aug 31 2026 inclusive). */
export const REPLAY_DAYS = Math.round((utcMs(REPLAY_END) - utcMs(REPLAY_START)) / DAY_MS) + 1;

/** 0 for the first replay day, REPLAY_DAYS − 1 for the last. */
export function dayIndexOf(iso: string): number {
  return Math.round((utcMs(iso) - utcMs(REPLAY_START)) / DAY_MS);
}

/** Inverse of {@link dayIndexOf}, clamped to the replay window. */
export function isoFromDayIndex(index: number): string {
  const clamped = Math.max(0, Math.min(REPLAY_DAYS - 1, Math.round(index)));
  return new Date(utcMs(REPLAY_START) + clamped * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return new Date(utcMs(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((utcMs(toIso) - utcMs(fromIso)) / DAY_MS);
}

export function clampDate(iso: string): string {
  if (iso < REPLAY_START) return REPLAY_START;
  if (iso > REPLAY_END) return REPLAY_END;
  return iso;
}

/**
 * Anuva's and Vibhrav's pages read the as-of date from `?asOf=` until they adopt
 * AsOfProvider — every link into them carries the global date so it never resets.
 */
export function withAsOf(path: string, asOf: string): string {
  return `${path}?asOf=${encodeURIComponent(asOf)}`;
}

/** `Jun 9, 2026` (or `Jun 9` with `{ year: false }`). */
export function formatDate(iso: string | null | undefined, opts: { year?: boolean } = {}): string {
  if (!iso) return '—';
  return new Date(utcMs(iso)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: opts.year === false ? undefined : 'numeric',
    timeZone: 'UTC',
  });
}

/** First day of each month in the replay window — scrubber axis ticks. */
export const MONTH_TICKS: { iso: string; label: string; index: number }[] = Array.from({ length: 8 }, (_, i) => {
  const iso = `2026-${String(i + 1).padStart(2, '0')}-01`;
  return {
    iso,
    label: new Date(utcMs(iso)).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
    index: dayIndexOf(iso),
  };
});

/* ───────────────────────────── Number formatting (FRONTEND §2) ───────────────── */

/**
 * `$1,840` · `$67K` · `$15.8M` · `$250M`; `{ perDay }` appends `/day`, `{ approx }` prefixes `~`.
 * Millions keep one decimal below $100M so a reported figure ($15.8M) is quoted as reported.
 */
export function formatUsd(
  value: number | null | undefined,
  opts: { perDay?: boolean; approx?: boolean } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  let text: string;
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    text = `$${millions >= 100 ? millions.toFixed(0) : millions.toFixed(1).replace(/\.0$/, '')}M`;
  } else if (abs >= 10_000) {
    text = `$${Math.round(abs / 1000)}K`;
  } else {
    text = `$${Math.round(abs).toLocaleString('en-US')}`;
  }
  if (value < 0) text = `−${text}`;
  if (opts.approx) text = `~${text}`;
  return opts.perDay ? `${text}/day` : text;
}

/** `+8.5%` (signed by default). */
export function formatPct(value: number | null | undefined, opts: { signed?: boolean; digits?: number } = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const digits = opts.digits ?? 1;
  const sign = opts.signed === false ? '' : value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(digits)}%`;
}

/** Backtest threshold: `3.0`, `2.75` (the slider steps by 0.25). */
export function formatThreshold(value: number): string {
  const fixed = value.toFixed(2);
  return fixed.endsWith('0') ? fixed.slice(0, -1) : fixed;
}

/** Risk score, one decimal. */
export function formatRisk(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toFixed(1);
}

/** `12,345` with thousands separators. */
export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

/** `350K` · `1.2M` — for square footage and similar large counts. */
export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 1_000) return `${Math.round(abs / 1000)}K`;
  return Math.round(abs).toLocaleString('en-US');
}
