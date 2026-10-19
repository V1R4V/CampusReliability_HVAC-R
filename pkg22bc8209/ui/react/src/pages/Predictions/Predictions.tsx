/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Snowflake, Wind } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useErrorReporter } from '@/components/ErrorBoundary/ErrorBoundary';
import StatusPill from '@/components/StatusPill/StatusPill';
import ProvenanceChip from '@/components/ProvenanceChip/ProvenanceChip';
import { fetchRiskForecastCampus } from '@/shared/api/forecast';
import type { ForecastCampusAsset, RiskForecastCampus, SystemType } from '@/Interfaces';
import { METHOD_COLOR, METHOD_SHORT, agreementLabel, formatProbability, probabilityColor } from '@/components/ForecastPanel/useRiskForecast';
// Global as-of date from the TopNav scrubber (FRONTEND §3) — no per-page date control.
import { useAsOf } from '@/contexts/AsOfProvider';
import { formatDate } from '@/shared/api';

const MAX_ROWS = 100;

type SystemFilter = 'all' | SystemType;
const SYSTEMS: SystemType[] = ['cooling', 'heating', 'air'];
const SYSTEM_LABEL: Record<SystemType, string> = { cooling: 'Cooling', heating: 'Heating', air: 'Air handling' };
const SYSTEM_ICON: Record<SystemType, React.ComponentType<{ className?: string }>> = {
  cooling: Snowflake,
  heating: Flame,
  air: Wind,
};

function Pct({ value, bold = false }: { value: number | null; bold?: boolean }) {
  return (
    <span className={`tabular-nums ${bold ? 'font-semibold' : ''}`} style={{ color: probabilityColor(value) }}>
      {formatProbability(value)}
    </span>
  );
}

/** One system's headline: the asset most likely to fail in that system and how the methods see it. */
function SystemSummary({ system, assets, asOf }: { system: SystemType; assets: ForecastCampusAsset[]; asOf: string }) {
  const Icon = SYSTEM_ICON[system];
  const top = assets[0];
  return (
    <Card variant="outlined" size="sm" className="flex-1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="size-4 text-[#6B7280]" /> {SYSTEM_LABEL[system]}
          <span className="text-xs font-normal text-[#6B7280]">· {assets.length} assets</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {!top ? (
          <div className="text-sm text-[#6B7280]">No assets tracked</div>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <Link to={`/asset/${top.asset_id}?asOf=${asOf}`} className="truncate text-sm text-[#2563EB] hover:underline" title={top.name}>
                {top.name}
              </Link>
              <span className="text-2xl font-semibold tabular-nums" style={{ color: probabilityColor(top.consensus_14d) }}>
                {formatProbability(top.consensus_14d)}
              </span>
            </div>
            <div className="text-xs text-[#6B7280]">most likely to fail within 14 days (consensus)</div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#374151]">
              {(['heuristic', 'classifier', 'monte_carlo', 'weibull'] as const).map((m) => (
                <span key={m} className="flex items-center gap-1" title={METHOD_SHORT[m]}>
                  <span className="inline-block size-2 rounded-full" style={{ backgroundColor: METHOD_COLOR[m] }} aria-hidden />
                  {formatProbability(top[`${m}_14d`])}
                </span>
              ))}
              {top.days_to_failure_p50 != null ? <span>· ~{Math.round(top.days_to_failure_p50)} d to failure</span> : null}
            </div>
            {top.status ? <StatusPill status={top.status} size="sm" /> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Predictions — every asset's failure probability by method, ranked by consensus (ML.md §8). */
export default function Predictions() {
  const { asOf } = useAsOf();
  const { reportError } = useErrorReporter();
  const [data, setData] = useState<RiskForecastCampus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SystemFilter>('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchRiskForecastCampus(asOf)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) {
          reportError(err);
          setError('Could not load campus failure probabilities.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [asOf, reportError]);

  const bySystem = useMemo(() => {
    const out: Record<SystemType, ForecastCampusAsset[]> = { cooling: [], heating: [], air: [] };
    (data?.assets ?? []).forEach((a) => {
      if (out[a.system]) out[a.system].push(a);
    });
    return out;
  }, [data]);

  const rows = useMemo(() => {
    const all = data?.assets ?? [];
    return (filter === 'all' ? all : all.filter((a) => a.system === filter)).slice(0, MAX_ROWS);
  }, [data, filter]);

  const elevated = useMemo(() => (data?.assets ?? []).filter((a) => (a.consensus_14d ?? 0) >= 0.2).length, [data]);

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-[#111827]">Predictions</h1>
            <ProvenanceChip kind="SYNTHETIC" />
          </div>
          <div className="text-sm text-[#6B7280]">
            Probability each asset fails within 14 days — four independent methods, ranked by their consensus.
            {data ? ` ${elevated} of ${data.assets.length} assets above 20%.` : ''}
          </div>
        </div>
        <div className="text-sm text-[#6B7280]">As of {formatDate(asOf)}</div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner label="Loading predictions" size="lg" />
        </div>
      ) : error || !data ? (
        <div className="text-sm text-[#DC2626]">{error ?? 'Predictions could not be loaded.'}</div>
      ) : data.assets.length === 0 ? (
        <div className="text-sm text-[#6B7280]">
          No forecasts for {asOf}. Pick a date inside the replay window (2026-01-01 → 2026-08-31).
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row">
            {SYSTEMS.map((s) => (
              <SystemSummary key={s} system={s} assets={bySystem[s]} asOf={asOf} />
            ))}
          </div>

          <Card variant="outlined">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>All assets by consensus probability</CardTitle>
                <Tabs value={filter} onValueChange={(v) => setFilter(v as SystemFilter)} size="sm">
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="cooling">Cooling</TabsTrigger>
                    <TabsTrigger value="heating">Heating</TabsTrigger>
                    <TabsTrigger value="air">Air</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table size="sm" hover>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>System</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Risk</TableHead>
                    <TableHead className="text-right">Consensus 14 d</TableHead>
                    <TableHead className="text-right" title="Logistic calibration of the risk score">
                      {METHOD_SHORT.heuristic}
                    </TableHead>
                    <TableHead className="text-right" title="L2 logistic regression on 8 condition features">
                      {METHOD_SHORT.classifier}
                    </TableHead>
                    <TableHead className="text-right" title="1,000 simulated drift paths">
                      {METHOD_SHORT.monte_carlo}
                    </TableHead>
                    <TableHead className="text-right" title="ASHRAE age-only Weibull baseline (reference)">
                      {METHOD_SHORT.weibull}
                    </TableHead>
                    <TableHead className="text-right">Days to failure (p50)</TableHead>
                    <TableHead>Agreement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((a) => {
                    const agreement = agreementLabel(a.spread_14d);
                    return (
                      <TableRow key={a.asset_id}>
                        <TableCell>
                          <Link to={`/asset/${a.asset_id}?asOf=${asOf}`} className="text-[#2563EB] hover:underline">
                            {a.name}
                          </Link>
                          <div className="text-xs text-[#6B7280]">{a.asset_id}</div>
                        </TableCell>
                        <TableCell>{SYSTEM_LABEL[a.system] ?? a.system}</TableCell>
                        <TableCell>{a.status ? <StatusPill status={a.status} size="sm" /> : '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{a.risk == null ? '—' : a.risk.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <Pct value={a.consensus_14d} bold />
                        </TableCell>
                        <TableCell className="text-right">
                          <Pct value={a.heuristic_14d} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Pct value={a.classifier_14d} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Pct value={a.monte_carlo_14d} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Pct value={a.weibull_14d} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {a.days_to_failure_p50 == null ? '—' : `~${Math.round(a.days_to_failure_p50)} d`}
                        </TableCell>
                        <TableCell>
                          {agreement ? (
                            <Badge variant="outline" appearance="secondary" size="sm">
                              {agreement}
                              {a.confidence ? ` · ${a.confidence} conf.` : ''}
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {(data.assets.length > MAX_ROWS) ? (
                <div className="p-3 text-xs text-[#6B7280]">Showing the top {MAX_ROWS}; filter by system to see more.</div>
              ) : null}
            </CardContent>
          </Card>

          <div className="text-xs text-[#6B7280]">
            Calibrated risk and classifier are trained on the planted failures F1–F5 (synthetic, leave-one-failure-out);
            Monte Carlo extrapolates each asset&apos;s own last 14 days; the age baseline uses ASHRAE median service lives
            and is shown for reference only. This proves the pipeline, not that the real June 17 break was predictable.
          </div>
        </>
      )}
    </div>
  );
}
