/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Flame, Snowflake, Sparkles, Wind } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useErrorReporter } from '@/components/ErrorBoundary/ErrorBoundary';
import { ProvenanceTag, StatusTag, WorkOrderStatusTag } from '@/components/RiskChart/Tags';
import { STATUS_COLOR } from '@/components/RiskChart/statusColors';
import { formatProbability, probabilityColor } from '@/components/ForecastPanel/useRiskForecast';
import KpiTile from '@/components/KpiTile/KpiTile';
import Schematic from '@/components/Schematic/Schematic';
import AgentDrawer from '@/components/AgentDrawer/AgentDrawer';
import { formatDate, useAsOfContext } from '@/contexts/AsOfProvider';
import { fetchCampusSnapshot } from '@/shared/api/shell';
import { fetchRiskForecastCampus } from '@/shared/api/forecast';
import type { BuildingDashboardAsset, CampusSnapshot, ForecastCampusAsset, SystemType } from '@/Interfaces';

type SystemFilter = 'all' | SystemType;

const SYSTEM_ICON: Record<SystemType, React.ComponentType<{ className?: string }>> = {
  cooling: Snowflake,
  heating: Flame,
  air: Wind,
};

const THRESHOLD = 3.0;
const RISK_SCALE_MAX = 5;
const QUEUE_PREVIEW = 6;

function usd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/** Risk 0–5 bar with the inspection threshold tick. */
function RiskBar({ risk, color }: { risk: number; color: string }) {
  const pct = Math.min(100, (risk / RISK_SCALE_MAX) * 100);
  return (
    <div className="relative h-2 w-28 rounded-full bg-[#F3F4F6]" aria-hidden>
      <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      <div className="absolute -top-1 h-4 w-px bg-[#111827]" style={{ left: `${(THRESHOLD / RISK_SCALE_MAX) * 100}%` }} />
    </div>
  );
}

function QueueCard({
  item,
  rank,
  forecast,
  asOf,
}: {
  item: BuildingDashboardAsset;
  rank: number;
  forecast: ForecastCampusAsset | undefined;
  asOf: string;
}) {
  const Icon = SYSTEM_ICON[item.system] ?? Snowflake;
  const color = item.status === 'HEALTHY' ? '#9CA3AF' : STATUS_COLOR[item.status];
  return (
    <Link
      to={`/asset/${item.asset_id}?asOf=${asOf}`}
      className="flex gap-3 rounded-lg border border-[#E5E7EB] bg-white p-3 transition-colors hover:border-[#9CA3AF]"
    >
      <div className="w-5 pt-0.5 text-sm font-semibold tabular-nums text-[#6B7280]">{rank}</div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Icon className="size-4 shrink-0 text-[#6B7280]" />
          <span className="truncate text-sm font-semibold text-[#111827]" title={item.name}>
            {item.name}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusTag status={item.status} size="sm" />
          {item.status !== 'HEALTHY' && item.days_in_status > 0 ? (
            <span className="text-xs text-[#6B7280]">
              {item.days_in_status} {item.days_in_status === 1 ? 'day' : 'days'}
            </span>
          ) : null}
          {item.work_order_status ? <WorkOrderStatusTag status={item.work_order_status} size="sm" /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#374151]">
          <span className="flex items-center gap-1.5">
            <RiskBar risk={item.risk} color={color} />
            <span className="tabular-nums">risk {item.risk.toFixed(1)}</span>
          </span>
          {item.driver_label ? <span className="text-[#6B7280]">{item.driver_label}</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 text-xs text-[#6B7280]">
          <span>
            {item.buildings_served} {item.buildings_served === 1 ? 'building' : 'buildings'}
          </span>
          {item.cost_per_day_usd != null ? <span>{usd(item.cost_per_day_usd)}/day if it fails</span> : null}
          {forecast?.consensus_14d != null ? (
            <span title="Consensus probability of failure within 14 days (Predictions page)">
              P(fail 14 d){' '}
              <span className="font-semibold" style={{ color: probabilityColor(forecast.consensus_14d) }}>
                {formatProbability(forecast.consensus_14d)}
              </span>
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

/** Overview — Campus Health (docs/FRONTEND.md §5.1): what needs attention today? */
export default function Overview() {
  const { asOf } = useAsOfContext();
  const navigate = useNavigate();
  const { reportError } = useErrorReporter();
  const [snapshot, setSnapshot] = useState<CampusSnapshot | null>(null);
  const [forecasts, setForecasts] = useState<Map<string, ForecastCampusAsset>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SystemFilter>('all');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCampusSnapshot(asOf)
      .then((result) => {
        if (!cancelled) setSnapshot(result);
      })
      .catch((err) => {
        if (!cancelled) {
          reportError(err);
          setError('Could not load the campus snapshot.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    // Forecasts are an extra column — the queue still renders if they fail.
    fetchRiskForecastCampus(asOf)
      .then((result) => {
        if (!cancelled) setForecasts(new Map(result.assets.map((a) => [a.asset_id, a])));
      })
      .catch(() => {
        if (!cancelled) setForecasts(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [asOf, reportError]);

  const queue = useMemo(() => {
    const all = snapshot?.queue ?? [];
    return filter === 'all' ? all : all.filter((q) => q.system === filter);
  }, [snapshot, filter]);
  const attention = queue.filter((q) => q.status !== 'HEALTHY');
  const visible = showAll ? queue : queue.slice(0, Math.max(QUEUE_PREVIEW, attention.length));

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-[#111827]">Campus health</h1>
          <div className="text-sm text-[#6B7280]">
            What needs attention on {formatDate(asOf)} — cooling, heating and air handling, ranked by risk × what&apos;s at stake.
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#6B7280]">
          Buildings, plants, weather & costs <ProvenanceTag kind="REAL" /> · sensor readings <ProvenanceTag kind="SYNTHETIC" />
        </div>
      </div>

      {loading && !snapshot ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner label="Loading campus snapshot" size="lg" />
        </div>
      ) : error || !snapshot ? (
        <div className="text-sm text-[#DC2626]">{error ?? 'Campus snapshot could not be loaded.'}</div>
      ) : (
        <>
          <div className="flex flex-col gap-3 md:flex-row">
            <KpiTile
              label="Inspection due"
              value={snapshot.kpis.inspection_due}
              color={snapshot.kpis.inspection_due > 0 ? STATUS_COLOR.INSPECTION_DUE : undefined}
              delta={snapshot.kpis.inspection_due_delta}
              sub={snapshot.kpis.failed > 0 ? <span>{snapshot.kpis.failed} failed</span> : null}
            />
            <KpiTile
              label="Watch"
              value={snapshot.kpis.watch}
              color={snapshot.kpis.watch > 0 ? STATUS_COLOR.WATCH : undefined}
              sub="drifting, not yet due"
            />
            <KpiTile
              label="Energy waste"
              value={`${usd(snapshot.kpis.energy_waste_usd_per_day)}/day`}
              sub={`${snapshot.kpis.assets_over_5pct_energy} assets >5% over normal`}
              chip="ESTIMATE"
            />
            <KpiTile
              label="Cooling exposure"
              value={`${usd(snapshot.kpis.cooling_exposure_usd_per_day)}/day`}
              sub="rental chillers if flagged cooling fails"
              chip="ESTIMATE"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card variant="outlined" className="lg:col-span-3 lg:self-start">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span>Utility network</span>
                  <span className="text-xs font-normal text-[#6B7280]">click a building for its dashboard · a loop to simulate its failure</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Schematic
                  plants={snapshot.plants}
                  segments={snapshot.segments}
                  buildings={snapshot.buildings}
                  onBuildingClick={(id) => navigate(`/building/${id}?asOf=${asOf}`)}
                  onSegmentClick={(id) => navigate(`/planb/${id}?asOf=${asOf}`)}
                />
                <div className="mt-2 text-[11px] text-[#9CA3AF]">Loop layout is synthetic; plants and buildings are real.</div>
              </CardContent>
            </Card>

            <Card variant="outlined" className="lg:col-span-2">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>Inspect next</CardTitle>
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
              <CardContent className="flex flex-col gap-2">
                {attention.length === 0 ? (
                  <div className="rounded-lg bg-[#F7F7F5] p-3 text-sm text-[#374151]">
                    All {filter === 'all' ? '' : `${filter} `}systems within normal ranges as of {formatDate(asOf)}.
                  </div>
                ) : null}
                {visible.map((item, i) => (
                  <QueueCard key={item.asset_id} item={item} rank={i + 1} forecast={forecasts.get(item.asset_id)} asOf={asOf} />
                ))}
                {queue.length > visible.length || showAll ? (
                  <button
                    type="button"
                    className="self-start text-sm text-[#2563EB] hover:underline"
                    onClick={() => setShowAll((s) => !s)}
                  >
                    {showAll ? 'Show fewer' : `Show all ${queue.length}`}
                  </button>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {snapshot.morning_brief ? (
            <div className="flex gap-3 rounded-lg border border-[#E5E7EB] bg-white p-4">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-[#2563EB]" />
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Morning brief · agent</div>
                <div className="text-base text-[#111827]">{snapshot.morning_brief}</div>
              </div>
            </div>
          ) : null}
        </>
      )}
      <AgentDrawer asOf={asOf} />
    </div>
  );
}
