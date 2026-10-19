/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Flame, Snowflake, Wind } from 'lucide-react';
import { Line, LineChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useErrorReporter } from '@/components/ErrorBoundary/ErrorBoundary';
import { approveWorkOrder, dismissWorkOrder, fetchBuildingDashboard } from '@/shared/api/anuva';
import type { BuildingDashboard, SystemCard as SystemCardData, SystemType } from '@/Interfaces';
import { ProvenanceTag, StatusTag } from '@/components/RiskChart/Tags';
import Sparkline from '@/components/Sparkline/Sparkline';
import WorkOrderCard from '@/components/WorkOrderCard/WorkOrderCard';
import AgentDrawer from '@/components/AgentDrawer/AgentDrawer';
// Vibhrav's per-system failure probability (RiskForecast.compare, ML.md §8) — embedded by owner request.
import ForecastBadge from '@/components/ForecastPanel/ForecastBadge';

// TEMPORARY until Arnav's global asOf scrubber (contexts/AsOfProvider) lands — see pages/Asset/Asset.tsx.
const DEFAULT_AS_OF = '2026-06-09';
const DEFAULT_THRESHOLD = 3.0;

function useAsOf(): [string, (next: string) => void] {
  const [params, setParams] = useSearchParams();
  const asOf = params.get('asOf') ?? DEFAULT_AS_OF;
  const setAsOf = (next: string) => {
    const nextParams = new URLSearchParams(params);
    nextParams.set('asOf', next);
    setParams(nextParams, { replace: true });
  };
  return [asOf, setAsOf];
}

const SYSTEM_LABEL: Record<SystemType, string> = {
  cooling: 'Cooling',
  heating: 'Heating',
  air: 'Air handling',
};

const SYSTEM_ICON: Record<SystemType, React.ComponentType<{ className?: string }>> = {
  cooling: Snowflake,
  heating: Flame,
  air: Wind,
};

function SystemPanel({ system, card, asOf }: { system: SystemType; card: SystemCardData | null; asOf: string }) {
  const Icon = SYSTEM_ICON[system];
  return (
    <Card variant="outlined" size="sm" className="flex-1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="size-4 text-[#6B7280]" /> {SYSTEM_LABEL[system]}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {!card ? (
          <div className="text-sm text-[#6B7280]">Not tracked</div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <StatusTag status={card.status} size="sm" />
              <Link to={`/asset/${card.via_asset_id}`} className="text-xs text-[#2563EB] hover:underline">
                risk {card.risk.toFixed(1)}
              </Link>
            </div>
            <Sparkline points={card.sparkline} threshold={DEFAULT_THRESHOLD} />
            <div className="text-xs text-[#6B7280]">
              energy {card.energy_over_expected_pct >= 0 ? '+' : ''}
              {card.energy_over_expected_pct}%
            </div>
            <ForecastBadge assetId={card.via_asset_id} asOf={asOf} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Building dashboard (FRONTEND §5.3). */
export default function Building() {
  const { buildingId } = useParams<{ buildingId: string }>();
  const [asOf, setAsOf] = useAsOf();
  const { reportError } = useErrorReporter();

  const [dashboard, setDashboard] = useState<BuildingDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!buildingId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchBuildingDashboard(buildingId, asOf)
      .then((result) => {
        if (!cancelled) setDashboard(result);
      })
      .catch((err) => {
        if (!cancelled) {
          reportError(err);
          setError('Could not load this building.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [buildingId, asOf, refreshKey, reportError]);

  const excessKwh = useMemo(() => {
    if (!dashboard) return 0;
    return dashboard.energy_series.reduce((sum, p) => sum + (p.actual_kwh - p.expected_kwh), 0);
  }, [dashboard]);

  if (!buildingId) {
    return <div className="p-6 text-sm text-[#DC2626]">No building selected.</div>;
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner label="Loading building" size="lg" />
      </div>
    );
  }

  if (!dashboard) {
    return <div className="p-6 text-sm text-[#DC2626]">{error ?? 'This building could not be loaded.'}</div>;
  }

  const { building, served_by, systems, assets, work_orders, plan_b } = dashboard;

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-[#111827]">{building.name}</h1>
            <Badge variant="outline" appearance="secondary" size="sm">
              {building.criticality}
            </Badge>
            <ProvenanceTag kind="REAL" />
          </div>
          <div className="text-sm text-[#6B7280]">
            Built {building.year_built} · {building.gsf.toLocaleString()} GSF · Served by {served_by.plant_name} →
            Segment {served_by.segment_id}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-[#6B7280]">
          As of
          <input
            type="date"
            value={asOf}
            onChange={(e) => e.target.value && setAsOf(e.target.value)}
            className="rounded border border-[#E5E7EB] px-2 py-1 text-sm"
          />
        </label>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <SystemPanel system="cooling" card={systems.cooling} asOf={asOf} />
        <SystemPanel system="heating" card={systems.heating} asOf={asOf} />
        <SystemPanel system="air" card={systems.air} asOf={asOf} />
      </div>

      <Card variant="outlined">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Energy: actual vs. weather-expected</CardTitle>
            <ProvenanceTag kind="SYNTHETIC" />
          </div>
        </CardHeader>
        <CardContent>
          {dashboard.energy_series.length === 0 ? (
            <div className="text-sm text-[#6B7280]">No energy data available.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dashboard.energy_series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} width={48} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="actual_kwh" name="Actual" stroke="#DC2626" dot={false} strokeWidth={2} />
                  <Line
                    type="monotone"
                    dataKey="expected_kwh"
                    name="Expected"
                    stroke="#6B7280"
                    strokeDasharray="4 3"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="text-xs text-[#6B7280]">
                Excess over shown period ≈ {Math.round(excessKwh).toLocaleString()} kWh
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <Card variant="outlined">
          <CardHeader>
            <CardTitle>Assets serving this building</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {assets.length === 0 ? (
              <div className="p-4 text-sm text-[#6B7280]">No assets found.</div>
            ) : (
              <Table size="sm" hover>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Driver</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.slice(0, 100).map((a) => (
                    <TableRow key={a.asset_id}>
                      <TableCell>
                        <Link to={`/asset/${a.asset_id}`} className="text-[#2563EB] hover:underline">
                          {a.name}
                        </Link>
                      </TableCell>
                      <TableCell>{a.type}</TableCell>
                      <TableCell>
                        <StatusTag status={a.status} size="sm" />
                      </TableCell>
                      <TableCell>{a.driver_label}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {plan_b ? (
          <Card variant="outlined">
            <CardHeader>
              <CardTitle>If cooling fails</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="text-sm text-[#111827]">
                Priority #{plan_b.priority_rank} on {plan_b.segment_id}
              </div>
              <div className="text-sm text-[#6B7280]">
                {plan_b.chillers_needed} chillers · ${plan_b.cost_per_day_usd.toLocaleString()}/day
              </div>
              <Link to={`/planb/${plan_b.segment_id}`}>
                <Button size="sm" className="w-full">
                  Simulate {plan_b.segment_id} failure →
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card variant="outlined">
        <CardHeader>
          <CardTitle>Work orders</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {work_orders.length === 0 ? (
            <div className="text-sm text-[#6B7280]">No work orders pending.</div>
          ) : (
            work_orders.map((wo) => (
              <WorkOrderCard
                key={wo.wo_id}
                workOrder={wo}
                onApprove={async () => {
                  await approveWorkOrder(wo.wo_id, 'Facilities manager');
                  setRefreshKey((k) => k + 1);
                }}
                onDismiss={async (reason) => {
                  await dismissWorkOrder(wo.wo_id, reason);
                  setRefreshKey((k) => k + 1);
                }}
              />
            ))
          )}
        </CardContent>
      </Card>

      <AgentDrawer asOf={asOf} />
    </div>
  );
}
