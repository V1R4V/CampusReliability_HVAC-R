/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import React from 'react';
import { Link } from 'react-router-dom';

import { Skeleton } from '@/components/Panel/Panel';
import { METHOD_COLOR, METHOD_SHORT, agreementLabel, formatProbability, probabilityColor, useRiskForecast } from './useRiskForecast';

interface ForecastBadgeProps {
  assetId: string;
  asOf: string;
}

/**
 * Compact failure-probability line for a building system card: the consensus 14-day probability
 * for the asset that carries the system, a dot per method, and how much the methods agree.
 */
export default function ForecastBadge({ assetId, asOf }: ForecastBadgeProps) {
  const { data, loading, error } = useRiskForecast(assetId, asOf);

  if (loading) return <Skeleton className="h-10 w-full" />;
  if (error) return <div className="text-[13px] text-[var(--bib-status-due)]">{error}</div>;
  if (!data || data.methods.length === 0) return <div className="text-[13px] text-[var(--bib-ink-muted)]">No forecast for this date.</div>;

  const p14 = data.consensus.p_fail_14d;
  const agreement = agreementLabel(data.consensus.spread_14d);

  return (
    <div className="flex flex-col gap-1.5 border-t border-[var(--bib-border)] pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-[var(--bib-ink-muted)]">Fails within 14 days</span>
        <Link
          to={`/asset/${assetId}`}
          className="bib-num text-[20px] font-semibold leading-6 hover:underline"
          style={{ color: probabilityColor(p14) }}
          title="Consensus of the condition-based methods. Open the asset for the full breakdown."
        >
          {formatProbability(p14)}
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {data.methods.map((m) => (
          <span key={m.method} className="flex items-center gap-1 text-[13px] text-[var(--bib-ink-soft)]" title={m.label}>
            <span className="inline-block size-2 rounded-full" style={{ backgroundColor: METHOD_COLOR[m.method] }} aria-hidden />
            {METHOD_SHORT[m.method]} <span className="bib-num font-medium">{formatProbability(m.p_fail_14d)}</span>
          </span>
        ))}
      </div>
      {agreement ? <div className="text-[13px] text-[var(--bib-ink-muted)]">{agreement} agreement between methods</div> : null}
    </div>
  );
}
