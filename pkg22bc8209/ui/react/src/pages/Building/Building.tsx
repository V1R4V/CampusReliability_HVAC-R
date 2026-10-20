/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Building2, ClipboardList, Cpu, ShieldAlert, Zap } from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useErrorReporter } from '@/components/ErrorBoundary/ErrorBoundary';
import ChartTooltip from '@/components/Chart/ChartTooltip';
import { AXIS_STROKE, AXIS_TICK, GRID_STROKE, INK_MUTED, RISK_STROKE, shortDate } from '@/components/Chart/chartTheme';
import ForecastBadge from '@/components/ForecastPanel/ForecastBadge';
import PageHeader from '@/components/PageHeader/PageHeader';
import { Panel, PanelState } from '@/components/Panel/Panel';
import Sparkline from '@/components/Sparkline/Sparkline';
import CriticalityBadge from '@/components/StatusPill/CriticalityBadge';
import StatusPill from '@/components/StatusPill/StatusPill';
import SystemIcon, { systemLabel } from '@/components/SystemIcon/SystemIcon';
import WorkOrderCard from '@/components/WorkOrderCard/WorkOrderCard';
import { useAsOf } from '@/contexts/AsOfProvider';
import {
  ENERGY_USD_PER_KWH,
  formatCompact,
  formatNumber,
  formatPct,
  formatRisk,
  formatUsd,
  worstStatus,
  type Status,
} from '@/shared/api';
import { approveWorkOrder, dismissWorkOrder, editWorkOrder, fetchBuildingDashboard } from '@/shared/api/anuva';
import type { BuildingDashboard, SystemCard as SystemCardData, SystemType } from '@/Interfaces';
import { dedupe } from '@/pages/WorkOrders/dedupe';

const SYSTEMS: SystemType[] = ['cooling', 'heating', 'air'];
/** Energy more than this over weather-expected is called out as a finding (matches the Overview KPI's ">5%"). */
const ENERGY_FINDING_PCT = 5;
/** Days of energy history the dashboard returns; the footer needs it for a denominator. */
const ENERGY_WINDOW_DAYS = 90;

function SystemCard({ system, card, asOf, threshold }: { system: SystemType; card: SystemCardData | null; asOf: string; threshold: number }) {
  return (
    <article data-status={card?.status ?? 'OFFLINE'} className="bib-card relative flex flex-col gap-3 overflow-hidden p-4 pt-5">
      <span aria-hidden className={cn('absolute inset-x-0 top-0 h-[4px] bg-[var(--bib-status-color)]', !card && 'opacity-40')} />
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-[16px] font-semibold text-[var(--bib-ink)]">
          <SystemIcon system={system} size="md" />
          {systemLabel(system)}
        </span>
        {card ? <StatusPill status={card.status} size="sm" /> : <span className="text-[14px] text-[var(--bib-ink-muted)]">Not tracked</span>}
      </div>
      {card ? (
        <>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="bib-eyebrow">Risk</div>
              <div className="bib-num text-[32px] font-semibold leading-9 text-[var(--bib-ink)]">{formatRisk(card.risk)}</div>
            </div>
            <div className="text-right text-[13px] leading-4 text-[var(--bib-ink-muted)]">
              <div className="bib-num text-[18px] font-semibold leading-6 text-[var(--bib-ink)]">{formatPct(card.energy_over_expected_pct)}</div>
              energy vs weather-expected
            </div>
          </div>
          {card.energy_over_expected_pct > ENERGY_FINDING_PCT ? (
            <p className="inline-flex items-start gap-1.5 rounded-[6px] bg-[var(--bib-canvas)] px-2.5 py-1.5 text-[13px] leading-4 text-[var(--bib-ink-soft)]">
              <Zap className="mt-px size-3.5 shrink-0 text-[var(--bib-ink-muted)]" aria-hidden />
              <span>
                Energy finding: {formatPct(card.energy_over_expected_pct)} over weather-expected. Worth a look even though it is not a failure
                signal.
              </span>
            </p>
          ) : null}
          <Sparkline points={card.sparkline} threshold={threshold} height={44} />
          <ForecastBadge assetId={card.via_asset_id} asOf={asOf} />
          <Link
            to={`/asset/${card.via_asset_id}`}
            className="group mt-auto inline-flex items-center gap-1 text-[14px] font-medium leading-5 text-[var(--bib-ink-muted)] hover:text-[var(--bib-ink)]"
          >
            Open <span className="bib-num">{card.via_asset_id}</span>
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </>
      ) : (
        <p className="text-[15px] leading-6 text-[var(--bib-ink-muted)]">No asset of this system serves the building.</p>
      )}
    </article>
  );
}

interface EnergyTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: { date: string; actual: number; expected: number; excess: number } }>;
  label?: unknown;
}

function EnergyTooltip({ active, payload, label }: EnergyTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <ChartTooltip
      title={shortDate(String(label))}
      rows={[
        { key: 'actual', name: 'Actual', value: `${formatNumber(point.actual)} kWh`, color: RISK_STROKE },
        { key: 'expected', name: 'Weather-expected', value: `${formatNumber(point.expected)} kWh`, color: INK_MUTED, dashed: true },
        { key: 'excess', name: 'Excess', value: point.excess > 0 ? `+${formatNumber(point.excess)} kWh` : '—' },
      ]}
    />
  );
}

/** Building dashboard (FRONTEND §5.3). */
export default function Building() {
  const { buildingId } = useParams<{ buildingId: string }>();
  const { asOf, threshold, buildingsById } = useAsOf();
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

  const energyData = useMemo(
    () =>
      (dashboard?.energy_series ?? []).map((p) => ({
        date: p.date,
        actual: p.actual_kwh,
        expected: p.expected_kwh,
        excess: Math.max(0, p.actual_kwh - p.expected_kwh),
      })),
    [dashboard],
  );
  const excessKwh = useMemo(() => energyData.reduce((sum, p) => sum + p.excess, 0), [energyData]);
  const expectedKwh = useMemo(() => energyData.reduce((sum, p) => sum + p.expected, 0), [energyData]);
  const excessPct = expectedKwh > 0 ? (excessKwh / expectedKwh) * 100 : null;

  const worst = useMemo<Status | null>(() => {
    if (!dashboard) return null;
    const statuses = SYSTEMS.map((s) => dashboard.systems[s]?.status).filter((s): s is Status => Boolean(s));
    return statuses.length ? worstStatus(statuses) : null;
  }, [dashboard]);

  if (!buildingId) {
    return (
      <div className="p-6">
        <PanelState state="error" title="No building selected" message="Pick a building from the Buildings page." />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-5 p-6 xl:px-8">
        <PanelState state="loading" lines={3} />
        <div className="grid gap-4 md:grid-cols-3">
          {SYSTEMS.map((s) => (
            <div key={s} className="bib-card p-4">
              <PanelState state="loading" lines={4} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="p-6">
        <PanelState state="error" title="This building could not be loaded" message={error ?? undefined} onRetry={() => setRefreshKey((k) => k + 1)} />
      </div>
    );
  }

  const { building, served_by, systems, assets, work_orders, plan_b } = dashboard;

  return (
    <div className="flex min-h-full flex-col gap-5 p-6 xl:px-8">
      <PageHeader
        backTo={{ to: '/buildings', label: 'All buildings' }}
        eyebrow="Building dashboard"
        icon={<Building2 />}
        title={building.name}
        badges={
          <>
            <CriticalityBadge criticality={building.criticality} size="md" />
            {worst ? <StatusPill status={worst} size="lg" /> : null}
          </>
        }
        meta={[
          `Built ${building.year_built}`,
          `${formatCompact(building.gsf)} GSF`,
          `${formatNumber(building.peak_load_tons)} tons peak cooling load`,
          <>
            Served by <span className="font-medium text-[var(--bib-ink)]">{served_by.plant_name}</span> → loop{' '}
            <Link to={`/planb/${served_by.segment_id}`} className="font-medium text-[var(--bib-ink)] underline-offset-2 hover:underline">
              {served_by.segment_id} · {served_by.segment_name}
            </Link>
          </>,
        ]}
      />

      <div className="grid gap-4 md:grid-cols-3">
        {SYSTEMS.map((system) => (
          <SystemCard key={system} system={system} card={systems[system]} asOf={asOf} threshold={threshold} />
        ))}
      </div>

      <Panel
        title="Energy: actual vs weather-expected"
        subtitle="Daily kWh against the weather-normalised baseline. The shaded band is energy the building used beyond what the weather explains."
        icon={<Zap />}
        chip="SYNTHETIC"
        footer={
          energyData.length > 0 ? (
            <span>
              Excess ≈ <span className="bib-num font-semibold text-[var(--bib-ink)]">{formatNumber(excessKwh)} kWh</span> over{' '}
              {Math.min(energyData.length, ENERGY_WINDOW_DAYS)} days
              {excessPct != null ? ` (≈ ${formatPct(excessPct, { signed: false })} of weather-expected use)` : ''} ·{' '}
              <span className="bib-num font-semibold text-[var(--bib-ink)]">{formatUsd(excessKwh * ENERGY_USD_PER_KWH)}</span> at $
              {ENERGY_USD_PER_KWH.toFixed(2)}/kWh (estimate)
            </span>
          ) : undefined
        }
      >
        {energyData.length === 0 ? (
          <PanelState state="empty" message="No energy data available for this building." />
        ) : (
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={energyData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="bib-energy-excess" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--bib-accent)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="var(--bib-accent)" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={48} tick={AXIS_TICK} axisLine={{ stroke: AXIS_STROKE }} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} tickFormatter={(v: number) => formatCompact(v)} />
                <RechartsTooltip content={<EnergyTooltip />} cursor={{ stroke: AXIS_STROKE }} />
                <Area type="monotone" dataKey="expected" stackId="kwh" stroke="none" fill="transparent" isAnimationActive={false} legendType="none" />
                <Area type="monotone" dataKey="excess" stackId="kwh" stroke="none" fill="url(#bib-energy-excess)" isAnimationActive={false} legendType="none" />
                <Line type="monotone" dataKey="expected" name="Weather-expected" stroke={INK_MUTED} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="actual" name="Actual" stroke={RISK_STROKE} strokeWidth={2.25} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel
          title="Assets serving this building"
          subtitle="Loop-level assets (mains, chillers) are included because the building depends on them"
          icon={<Cpu />}
          contentClassName="-mx-4 -mb-4 overflow-x-auto"
        >
          {assets.length === 0 ? (
            <div className="px-4 pb-4">
              <PanelState state="empty" message="No assets found." />
            </div>
          ) : (
            <Table size="sm" hover>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Asset</TableHead>
                  <TableHead>System</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Risk</TableHead>
                  <TableHead className="pr-4">Driver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.slice(0, 100).map((a) => (
                  <TableRow key={a.asset_id}>
                    <TableCell className="pl-4">
                      <Link to={`/asset/${a.asset_id}`} className="font-medium text-[var(--bib-ink)] underline-offset-2 hover:underline">
                        {a.name}
                      </Link>
                      <div className="bib-num text-[13px] text-[var(--bib-ink-muted)]">{a.asset_id}</div>
                    </TableCell>
                    <TableCell>
                      <SystemIcon system={a.system} size="sm" withLabel />
                    </TableCell>
                    <TableCell>
                      <StatusPill status={a.status} size="sm" />
                    </TableCell>
                    <TableCell className="bib-num text-right text-[15px] font-semibold text-[var(--bib-ink)]">{formatRisk(a.risk)}</TableCell>
                    <TableCell className="pr-4 text-[var(--bib-ink-soft)]">{a.driver_label}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>

        <Panel
          title="If cooling fails"
          subtitle={
            plan_b
              ? `Where this building sits in the dispatch order for loop ${plan_b.segment_id}, sized at peak load (95°F design day)`
              : 'Outage plan'
          }
          icon={<ShieldAlert />}
          className="h-full"
        >
          {plan_b ? (
            <div className="flex h-full flex-col gap-4">
              <dl className="grid grid-cols-3 gap-3">
                <div>
                  <dt className="bib-eyebrow">Priority</dt>
                  <dd className="bib-kpi mt-1">#{plan_b.priority_rank}</dd>
                </div>
                <div>
                  <dt className="bib-eyebrow">Rental units</dt>
                  <dd className="bib-kpi mt-1">{plan_b.chillers_needed}</dd>
                  <dd className="text-[13px] leading-4 text-[var(--bib-ink-muted)]">400-ton chillers</dd>
                </div>
                <div>
                  <dt className="bib-eyebrow">Rental</dt>
                  <dd className="bib-kpi mt-1 text-[32px] leading-[44px]">{formatUsd(plan_b.cost_per_day_usd)}</dd>
                  <dd className="text-[13px] leading-4 text-[var(--bib-ink-muted)]">per day (estimate)</dd>
                </div>
              </dl>
              <Button asChild appearance="accent" size="lg" className="mt-auto w-full">
                <Link to={`/planb/${plan_b.segment_id}`}>
                  Simulate {plan_b.segment_id} failure <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </div>
          ) : (
            <PanelState state="empty" message="This building is not on a chilled-water loop." />
          )}
        </Panel>
      </div>

      <Panel
        title="Work orders"
        subtitle="Drafted by the agent for assets serving this building. Nothing is scheduled until you approve it."
        icon={<ClipboardList />}
      >
        {work_orders.length === 0 ? (
          <PanelState state="empty" message="No work orders pending for this building." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {dedupe(work_orders).map((wo) => (
              <WorkOrderCard
                key={wo.wo_id}
                workOrder={wo}
                asOf={asOf}
                buildings={(wo.building_ids ?? [])
                  .map((id) => buildingsById.get(id))
                  .filter((b): b is NonNullable<typeof b> => Boolean(b))
                  .map((b) => ({ name: b.name, criticality: b.criticality }))}
                onApprove={async () => {
                  await approveWorkOrder(wo.wo_id, 'Facilities manager', asOf);
                  setRefreshKey((k) => k + 1);
                }}
                onDismiss={async (reason) => {
                  await dismissWorkOrder(wo.wo_id, reason, asOf);
                  setRefreshKey((k) => k + 1);
                }}
                onEdit={async (fields) => {
                  await editWorkOrder(wo.wo_id, fields, asOf);
                  setRefreshKey((k) => k + 1);
                }}
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
