/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import { useEffect, useState } from 'react';
import { useErrorReporter } from '@/components/ErrorBoundary/ErrorBoundary';
import { fetchRiskForecast } from '@/shared/api/forecast';
import type { ForecastMethod, RiskForecastCompare } from '@/Interfaces';

/**
 * Colours per forecasting method — identity only, from the validated categorical slots in
 * styles/before-it-breaks.css; shared by the asset panel, the system badge and Predictions.
 * The age baseline is reference-only, so it wears the axis grey; the consensus wears ink.
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

export interface RiskForecastState {
  data: RiskForecastCompare | null;
  loading: boolean;
  error: string | null;
}

/** Loads `RiskForecast.compare(assetId, asOf)`; cancels on unmount / argument change. */
export function useRiskForecast(assetId: string | undefined, asOf: string): RiskForecastState {
  const { reportError } = useErrorReporter();
  const [state, setState] = useState<RiskForecastState>({ data: null, loading: true, error: null });

  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    fetchRiskForecast(assetId, asOf)
      .then((result) => {
        if (!cancelled) setState({ data: result, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          reportError(err);
          setState({ data: null, loading: false, error: 'Could not load failure probabilities.' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [assetId, asOf, reportError]);

  return state;
}
