/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import { c3Action } from '@/c3Action';
import type { RiskForecastCampus, RiskForecastCompare } from '@/Interfaces';

/**
 * Vibhrav's forecast data-access functions (docs/CONTRACT.md §5.2, additive rows; docs/ML.md §8).
 * Pages and components import from here and never call `c3Action` directly.
 */

/** `RiskForecast.compare(asset_id, as_of)` — four failure-probability methods side by side for one asset. */
export async function fetchRiskForecast(assetId: string, asOf: string): Promise<RiskForecastCompare> {
  return c3Action('RiskForecast', 'compare', [assetId, asOf]);
}

/** `RiskForecast.campus(as_of)` — every asset ranked by consensus 14-day failure probability. */
export async function fetchRiskForecastCampus(asOf: string): Promise<RiskForecastCampus> {
  return c3Action('RiskForecast', 'campus', [asOf]);
}
