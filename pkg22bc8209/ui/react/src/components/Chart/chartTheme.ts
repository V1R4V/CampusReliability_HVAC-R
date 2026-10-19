/*
 * Shared Recharts styling so every chart in the app reads as one system: recessive
 * grid and axes in the token greys, 13px tick labels, and the series/method colours
 * resolved from the CSS tokens in styles/before-it-breaks.css (Recharts accepts
 * `var(--x)` strings for stroke/fill because they land on SVG attributes).
 */

export const AXIS_TICK = { fontSize: 13, fill: 'var(--bib-ink-muted)' } as const;
export const GRID_STROKE = 'var(--bib-grid)';
export const AXIS_STROKE = 'var(--bib-axis)';
export const CURSOR_STROKE = 'var(--bib-axis)';

/** Categorical series slots — identity only, assigned in fixed order, never cycled. */
export const SERIES_COLORS = [
  'var(--bib-series-1)',
  'var(--bib-series-2)',
  'var(--bib-series-3)',
  'var(--bib-series-4)',
  'var(--bib-series-5)',
] as const;

/** The risk line itself — the one accent, not a status colour. */
export const RISK_STROKE = 'var(--bib-accent)';
export const INK = 'var(--bib-ink)';
export const INK_MUTED = 'var(--bib-ink-muted)';
export const SURFACE = 'var(--bib-surface)';

export const STATUS_STROKE = {
  HEALTHY: 'var(--bib-status-healthy)',
  WATCH: 'var(--bib-status-watch)',
  INSPECTION_DUE: 'var(--bib-status-due)',
  FAILED: 'var(--bib-status-failed)',
} as const;

/** Parses an ISO `yyyy-mm-dd` as UTC so axis labels never shift a day. */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
