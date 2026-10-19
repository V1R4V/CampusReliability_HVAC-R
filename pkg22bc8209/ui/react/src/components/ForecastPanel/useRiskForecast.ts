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

/** Colours per forecasting method — shared by the asset panel, the system badge and the Predictions page. */
export const METHOD_COLOR: Record<ForecastMethod | 'consensus', string> = {
  heuristic: '#2563EB',
  classifier: '#7C3AED',
  monte_carlo: '#EA580C',
  weibull: '#6B7280',
  consensus: '#111827',
};

export const METHOD_SHORT: Record<ForecastMethod | 'consensus', string> = {
  heuristic: 'Calibrated risk',
  classifier: 'Classifier',
  monte_carlo: 'Monte Carlo',
  weibull: 'Age baseline',
  consensus: 'Consensus',
};

/** Traffic-light colour for a probability (same hex values as the status tokens in RiskChart/statusColors). */
export function probabilityColor(p: number | null | undefined): string {
  if (p == null) return '#9CA3AF';
  if (p >= 0.5) return '#DC2626';
  if (p >= 0.2) return '#F59E0B';
  return '#2E7D32';
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
