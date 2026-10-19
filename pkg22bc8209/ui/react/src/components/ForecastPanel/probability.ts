/*
 * Failure-probability helpers shared by the ForecastPanel, the ForecastBadge and the
 * Predictions page (docs/ML.md §8). Pure module (no React, no network) so Jest can import
 * it directly; `useRiskForecast.ts` re-exports everything here.
 */

import type { ForecastMethod } from '@/Interfaces';

/**
 * Colours per forecasting method — identity only, from the validated categorical slots in
 * styles/before-it-breaks.css. The age baseline is reference-only, so it wears the axis
 * grey; the consensus wears ink.
 */
export const METHOD_COLOR: Record<ForecastMethod | 'consensus', string> = {
  heuristic: 'var(--bib-series-1)',
  classifier: 'var(--bib-series-3)',
  monte_carlo: 'var(--bib-series-2)',
  weibull: 'var(--bib-axis)',
  consensus: 'var(--bib-ink)',
};

export const METHOD_SHORT: Record<ForecastMethod | 'consensus', string> = {
  heuristic: 'Calibrated risk',
  classifier: 'Classifier',
  monte_carlo: 'Monte Carlo',
  weibull: 'Age baseline',
  consensus: 'Consensus',
};

export type ProbabilityStatus = 'HEALTHY' | 'WATCH' | 'INSPECTION_DUE' | 'OFFLINE';

/** A probability read as a status band (≥50% due, ≥20% watch) so it can drive data-status. */
export function probabilityStatus(p: number | null | undefined): ProbabilityStatus {
  if (p == null) return 'OFFLINE';
  if (p >= 0.5) return 'INSPECTION_DUE';
  if (p >= 0.2) return 'WATCH';
  return 'HEALTHY';
}

/** Status colour token for a probability (status meaning, not decoration). */
export function probabilityColor(p: number | null | undefined): string {
  switch (probabilityStatus(p)) {
    case 'INSPECTION_DUE':
      return 'var(--bib-status-due)';
    case 'WATCH':
      return 'var(--bib-status-watch)';
    case 'HEALTHY':
      return 'var(--bib-status-healthy)';
    default:
      return 'var(--bib-ink-faint)';
  }
}

/** `46%`, `<1%` for tiny non-zero values, `—` when unknown. */
export function formatProbability(p: number | null | undefined): string {
  if (p == null) return '—';
  const pct = p * 100;
  if (pct > 0 && pct < 1) return '<1%';
  return `${Math.round(pct)}%`;
}

/** Agreement label from the max−min spread of `p_fail_14d` across the condition-based methods. */
export function agreementLabel(spread: number | null | undefined): 'strong' | 'moderate' | 'weak' | null {
  if (spread == null) return null;
  if (spread < 0.15) return 'strong';
  if (spread < 0.35) return 'moderate';
  return 'weak';
}
