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
import type { RiskForecastCompare } from '@/Interfaces';

// The pure helpers (method colours/labels, probability → status band, formatting) live in
// ./probability so Jest can test them without the data layer; re-exported for existing imports.
export {
  METHOD_COLOR,
  METHOD_SHORT,
  agreementLabel,
  formatProbability,
  probabilityColor,
  probabilityStatus,
  type ProbabilityStatus,
} from './probability';

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
