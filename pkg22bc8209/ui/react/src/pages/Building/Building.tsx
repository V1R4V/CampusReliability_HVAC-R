/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

/*
 * Building dashboard (FRONTEND §5.3, owner: Anuva) · `building(id, asOf)`.
 *
 * Header (worst system status, use, facts) → three system cards (status, risk, sparkline,
 * energy vs expected, click → the asset) → energy actual vs weather-expected with the waste
 * gap shaded → assets serving the building (worst first, row → asset) + work orders →
 * "If cooling fails" (Plan B estimate → simulate). Reads the global as-of date and inspection
 * threshold from AsOfProvider; keeps the previous dashboard dimmed while a new date loads.
 * Built entirely from the shared components (StatusPill, CriticalityBadge, SystemIcon,
 * KpiTile, Panel, ProvenanceChip, Sparkline, WorkOrderCard, ForecastBadge). The agent is
 * the one global drawer in App.tsx, opened from the TopNav button — this page renders none.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useErrorReporter } from '@/components/ErrorBoundary/ErrorBoundary';
// Vibhrav's per-system failure probability (RiskForecast.compare, ML.md §8) — embedded by owner request.
import ForecastBadge from '@/components/ForecastPanel/ForecastBadge';
import KpiTile from '@/components/KpiTile/KpiTile';
import { Panel, PanelState } from '@/components/Panel/Panel';
import ProvenanceChip from '@/components/ProvenanceChip/ProvenanceChip';
import Sparkline from '@/components/Sparkline/Sparkline';
import CriticalityBadge from '@/components/StatusPill/CriticalityBadge';
import StatusPill from '@/components/StatusPill/StatusPill';
import SystemIcon from '@/components/SystemIcon/SystemIcon';
import WorkOrderCard from '@/components/WorkOrderCard/WorkOrderCard';
// Global as-of date from the TopNav scrubber (FRONTEND §3) — no per-page date control.
import { useAsOf } from '@/contexts/AsOfProvider';
import {
  CHILLER_RENTAL_USD_PER_DAY,
  ENERGY_USD_PER_KWH,
  STATUS_RANK,
  TONS_PER_RENTAL_CHILLER,
  WO_STATUS_LABEL,
  errorMessage,
  formatCompact,
  formatDate,
  formatNumber,
  formatPct,
  formatRisk,
  formatThreshold,
  formatUsd,
  worstStatus,
  type Provenance,
} from '@/shared/api';
import { approveWorkOrder, dismissWorkOrder, fetchBuildingDashboard } from '@/shared/api/anuva';
import type { BuildingDashboard, EnergyPoint, SystemCard as SystemCardData, SystemType } from '@/Interfaces';

const SYSTEMS: SystemType[] = ['cooling', 'heating', 'air'];
/** Hard caps so a large payload can never flood the DOM (preview safety). */
const MAX_ASSET_ROWS = 100;
const MAX_WORK_ORDERS = 50;
const APPROVER = 'Facilities manager';

const ASSET_TYPE_LABEL: Record<string, string> = {
  chw_main: 'Chilled water main',
  chiller: 'Chiller',
  ahu: 'Air handler',
  heat_exchanger: 'Heat exchanger',
  pump: 'Pump',
  boiler: 'Boiler',
  cooling_tower: 'Cooling tower',
  steam_main: 'Steam main',
};

function assetTypeLabel(type: string): string {
  return ASSET_TYPE_LABEL[type] ?? type.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * RULES §4: the honesty chip follows the payload's `source`. Building facts are REAL only
 * once they cite a source; placeholder/fixture-derived facts are labelled SYNTHETIC — so the
 * chip flips to REAL by itself when cited facts land, with no page change.
 */
function factsProvenance(source: string | null | undefined): Provenance {
  const text = (source ?? '').toLowerCase();
  if (!text || /placeholder|synthetic|fixture/.test(text)) return 'SYNTHETIC';
  return 'REAL';
}

/** True when the click started on something that navigates by itself (asset link, forecast badge). */
function clickedInteractive(event: React.MouseEvent<HTMLElement>): boolean {
  return (event.target as HTMLElement).closest('a, button') !== null;
}

interface EnergyChartPoint extends EnergyPoint {
  /** `[expected, max(actual, expected)]` — the range Area shades only energy above the baseline. */
  gap: [number, number];
}

function EnergyTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload as EnergyChartPoint | undefined;
  if (!point) return null;
  const over = point.actual_kwh - point.expected_kwh;
  return (
    <div className="rounded-[6px] border border-[var(--bib-border)] bg-[var(--bib-surface)] px-2.5 py-2 text-[13px] leading-5 text-[var(--bib-ink)] shadow-sm">
      <div className="font-semibold">{formatDate(String(label))}</div>
      <div>Actual {formatNumber(point.actual_kwh)} kWh</div>
      <div className="text-[var(--bib-ink-muted)]">Expected {formatNumber(point.expected_kwh)} kWh</div>
      <div className={over > 0 ? 'font-medium' : 'text-[var(--bib-ink-muted)]'}>
        {over > 0 ? '+' : ''}
        {formatNumber(over)} kWh vs expected
      </div>
    </div>
  );
}

interface SystemPanelProps {
  system: SystemType;
  card: SystemCardData | null;
  asOf: string;
  threshold: number;
}

/** One system card: status, risk vs threshold, 7-day sparkline, energy vs expected, forecast. Click → the asset. */
function SystemPanel({ system, card, asOf, threshold }: SystemPanelProps) {
  const navigate = useNavigate();

  if (!card) {
    return (
      <Card variant="outlined" size="md" data-status="OFFLINE" className="min-w-0 gap-3">
        <SystemIcon system={system} size="md" withLabel />
        <p className="text-[15px] leading-5 text-[var(--bib-ink-muted)]">Not tracked</p>
      </Card>
    );
  }

  const href = `/asset/${card.via_asset_id}`;
  return (
    <Card
      variant="outlined"
      size="md"
      data-status={card.status}
      onClick={(event) => {
        if (!clickedInteractive(event)) navigate(href);
      }}
      className="min-w-0 cursor-pointer gap-3 transition-colors hover:border-[var(--bib-ink-muted)]"
    >
      <div className="flex items-center justify-between gap-2">
        <SystemIcon system={system} size="md" withLabel />
        <StatusPill status={card.status} size="sm" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-[32px] font-semibold leading-9 tracking-[-0.01em] text-[var(--bib-ink)]">
          {formatRisk(card.risk)}
        </span>
        <span className="text-[13px] leading-4 text-[var(--bib-ink-muted)]">risk · due at {formatThreshold(threshold)}</span>
      </div>
      <Sparkline points={card.sparkline} threshold={threshold} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-[14px] leading-5">
        <span className="text-[var(--bib-ink-muted)]">
          Energy <span className="font-medium text-[var(--bib-ink)]">{formatPct(card.energy_over_expected_pct)}</span> vs
          expected
        </span>
        <ForecastBadge assetId={card.via_asset_id} asOf={asOf} />
      </div>
      <Link
        to={href}
        className="mt-auto inline-flex items-center gap-1 text-[14px] font-medium leading-5 text-[var(--bib-ink-muted)] hover:text-[var(--bib-ink)]"
      >
        via {card.via_asset_id} <ArrowRight className="size-4" aria-hidden />
      </Link>
    </Card>
  );
}

export default function Building() {
  const { buildingId } = useParams<{ buildingId: string }>();
  const { asOf, threshold } = useAsOf();
  const { reportError } = useErrorReporter();
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState<BuildingDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const reload = useCallback(() => setRefreshKey((key) => key + 1), []);

  useEffect(() => {
    if (!buildingId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    // Scrubbing the date keeps the current building on screen (dimmed); switching building does not.
    setDashboard((previous) => (previous && previous.building.building_id === buildingId ? previous : null));
    fetchBuildingDashboard(buildingId, asOf)
      .then((result) => {
        if (!cancelled) setDashboard(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        reportError(err);
        setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [buildingId, asOf, refreshKey, reportError]);

  const energyData = useMemo<EnergyChartPoint[]>(
    () =>
      (dashboard?.energy_series ?? []).map((point) => ({
        ...point,
        gap: [point.expected_kwh, Math.max(point.actual_kwh, point.expected_kwh)],
      })),
    [dashboard],
  );
  /** Net kWh above the weather-expected baseline over the series shown (negative = under). */
  const excessKwh = useMemo(
    () => energyData.reduce((sum, point) => sum + (point.actual_kwh - point.expected_kwh), 0),
    [energyData],
  );
  const sortedAssets = useMemo(
    () =>
      [...(dashboard?.assets ?? [])]
        .sort(
          (a, b) =>
            STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.risk - a.risk || a.name.localeCompare(b.name),
        )
        .slice(0, MAX_ASSET_ROWS),
    [dashboard],
  );

  if (!buildingId) {
    return (
      <div className="p-6">
        <PanelState state="error" title="No building selected" message="Pick a building from the Buildings page." />
      </div>
    );
  }
  if (loading && !dashboard) {
    return (
      <div className="p-6">
        <PanelState state="loading" lines={8} />
      </div>
    );
  }
  if (!dashboard) {
    return (
      <div className="p-6">
        <PanelState state="error" title="Couldn’t load this building" message={error ?? undefined} onRetry={reload} />
      </div>
    );
  }

  const { building, served_by, systems, assets, work_orders, plan_b } = dashboard;
  const trackedCards = SYSTEMS.map((system) => systems[system]).filter((card): card is SystemCardData => card !== null);
  const overallStatus = worstStatus(trackedCards.map((card) => card.status));
  const factsChip = factsProvenance(building.source);
  const energyFirst = energyData[0]?.date;
  const energyLast = energyData[energyData.length - 1]?.date;
  const excessUsd = excessKwh * ENERGY_USD_PER_KWH;
  const refreshWorkOrders = () => reload();

  return (
    <div className="flex min-h-full flex-col gap-4 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Link
            to="/buildings"
            className="inline-flex items-center gap-1 text-[14px] leading-5 text-[var(--bib-ink-muted)] hover:text-[var(--bib-ink)]"
          >
            <ChevronLeft className="size-4" aria-hidden /> Buildings
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-semibold leading-7 text-[var(--bib-ink)]">{building.name}</h1>
            <StatusPill status={overallStatus} />
            <CriticalityBadge criticality={building.criticality} size="md" />
          </div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] leading-5 text-[var(--bib-ink-muted)]">
            <span>Built {building.year_built}</span>
            <span aria-hidden>·</span>
            <span>{formatCompact(building.gsf)} GSF</span>
            <ProvenanceChip kind={factsChip} size="sm" title={building.source} />
          </p>
          <p className="text-[15px] leading-5 text-[var(--bib-ink-muted)]">
            Served by {served_by.plant_name} →{' '}
            <Link
              to={`/planb/${served_by.segment_id}`}
              className="font-medium text-[var(--bib-ink)] underline-offset-2 hover:underline"
            >
              {served_by.segment_name} ({served_by.segment_id})
            </Link>
          </p>
        </div>
        <p className="text-[15px] leading-5 text-[var(--bib-ink-muted)]">
          As of <span className="font-semibold text-[var(--bib-ink)]">{formatDate(asOf)}</span>
        </p>
      </header>

      {error ? (
        <PanelState
          state="error"
          title={`Couldn’t refresh for ${formatDate(asOf)} — showing ${formatDate(dashboard.as_of)}`}
          message={error}
          onRetry={reload}
        />
      ) : null}

      <div className={cn('flex flex-col gap-4 transition-opacity', loading ? 'opacity-70' : 'opacity-100')}>
        <section aria-label="Systems" className="grid gap-4 sm:grid-cols-3">
          {SYSTEMS.map((system) => (
            <SystemPanel key={system} system={system} card={systems[system]} asOf={asOf} threshold={threshold} />
          ))}
        </section>

        <section aria-label="Energy" className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Panel
            title="Energy: actual vs. weather-expected"
            subtitle={
              energyFirst && energyLast
                ? `${formatDate(energyFirst, { year: false })} – ${formatDate(energyLast)} · shaded gap = energy above the weather-expected baseline`
                : undefined
            }
            chip="SYNTHETIC"
            chipTitle="Meter readings are synthetic; the expected baseline is weather-normalized from real NOAA temperatures."
          >
            {energyData.length === 0 ? (
              <PanelState state="empty" message="No energy data for this building." />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={energyData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--bib-grid)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value: string | number) => formatDate(String(value), { year: false })}
                    tick={{ fontSize: 13, fill: 'var(--bib-ink-muted)' }}
                    axisLine={{ stroke: 'var(--bib-axis)' }}
                    tickLine={false}
                    minTickGap={32}
                  />
                  <YAxis
                    domain={[(min: number) => Math.floor(min * 0.98), (max: number) => Math.ceil(max * 1.01)]}
                    tickFormatter={(value: number) => formatNumber(value)}
                    tick={{ fontSize: 13, fill: 'var(--bib-ink-muted)' }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                    unit=""
                  />
                  <RechartsTooltip
                    content={<EnergyTooltip />}
                    cursor={{ stroke: 'var(--bib-axis)', strokeDasharray: '3 3' }}
                  />
                  <Legend verticalAlign="top" align="left" wrapperStyle={{ fontSize: 13, paddingBottom: 8 }} />
                  <Area
                    type="monotone"
                    dataKey="gap"
                    name="Over expected"
                    stroke="none"
                    fill="var(--bib-series-1)"
                    fillOpacity={0.2}
                    legendType="rect"
                    activeDot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="actual_kwh"
                    name="Actual"
                    stroke="var(--bib-ink)"
                    strokeWidth={2}
                    dot={false}
                    legendType="plainline"
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="expected_kwh"
                    name="Weather-expected"
                    stroke="var(--bib-ink-muted)"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    dot={false}
                    legendType="plainline"
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <KpiTile
            label={excessKwh >= 0 ? 'Energy over expected' : 'Energy under expected'}
            value={formatNumber(Math.round(Math.abs(excessKwh)))}
            unit="kWh"
            chip="ESTIMATE"
            chipTitle={`kWh from synthetic meter data; dollars at the $${ENERGY_USD_PER_KWH.toFixed(2)}/kWh assumption (CONTRACT §1).`}
            sub={
              energyData.length > 0
                ? `≈ ${formatUsd(Math.abs(excessUsd))} at $${ENERGY_USD_PER_KWH.toFixed(2)}/kWh · ${energyData.length} days to ${formatDate(energyLast, { year: false })}`
                : 'No energy data for this building.'
            }
          />
        </section>

        <section aria-label="Assets and work orders" className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="flex min-w-0 flex-col gap-4">
            <Panel
              title="Assets serving this building"
              subtitle={
                assets.length > 0
                  ? `${assets.length} ${assets.length === 1 ? 'asset' : 'assets'}, worst first · segment-level assets included`
                  : undefined
              }
            >
              {sortedAssets.length === 0 ? (
                <PanelState state="empty" message="No assets serve this building." />
              ) : (
                <>
                  <Table size="sm" hover>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Asset</TableHead>
                        <TableHead>System</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Risk</TableHead>
                        <TableHead>Driver</TableHead>
                        <TableHead>Work order</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedAssets.map((asset) => (
                        <TableRow
                          key={asset.asset_id}
                          data-status={asset.status}
                          className="cursor-pointer"
                          onClick={(event) => {
                            if (!clickedInteractive(event)) navigate(`/asset/${asset.asset_id}`);
                          }}
                        >
                          <TableCell>
                            <Link
                              to={`/asset/${asset.asset_id}`}
                              className="font-medium text-[var(--bib-ink)] underline-offset-2 hover:underline"
                            >
                              {asset.name}
                            </Link>
                            <div className="text-[13px] leading-4 text-[var(--bib-ink-muted)]">
                              {asset.asset_id} · {assetTypeLabel(asset.type)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <SystemIcon system={asset.system} size="sm" withLabel />
                          </TableCell>
                          <TableCell>
                            <StatusPill status={asset.status} size="sm" />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatRisk(asset.risk)}</TableCell>
                          <TableCell className="text-[var(--bib-ink-muted)]">{asset.driver_label || '—'}</TableCell>
                          <TableCell>{asset.work_order_status ? WO_STATUS_LABEL[asset.work_order_status] : '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {assets.length > MAX_ASSET_ROWS ? (
                    <p className="pt-2 text-[13px] text-[var(--bib-ink-muted)]">
                      Showing the {MAX_ASSET_ROWS} highest-risk of {assets.length} assets.
                    </p>
                  ) : null}
                </>
              )}
            </Panel>

            <Panel
              title="Work orders"
              subtitle={
                work_orders.length > 0
                  ? `${work_orders.length} for ${work_orders.length === 1 ? 'an asset' : 'assets'} serving this building`
                  : undefined
              }
            >
              {work_orders.length === 0 ? (
                <PanelState state="empty" message="No work orders for this building’s assets." />
              ) : (
                <div className="flex flex-col gap-3">
                  {work_orders.slice(0, MAX_WORK_ORDERS).map((workOrder) => (
                    <WorkOrderCard
                      key={workOrder.wo_id}
                      workOrder={workOrder}
                      onApprove={async () => {
                        await approveWorkOrder(workOrder.wo_id, APPROVER);
                        refreshWorkOrders();
                      }}
                      onDismiss={async (reason) => {
                        await dismissWorkOrder(workOrder.wo_id, reason);
                        refreshWorkOrders();
                      }}
                    />
                  ))}
                </div>
              )}
            </Panel>
          </div>

          {plan_b ? (
            <div className="flex flex-col gap-3">
              <KpiTile
                label="If cooling fails"
                value={formatUsd(plan_b.cost_per_day_usd)}
                unit="/day"
                chip="ESTIMATE"
                chipTitle={`Rental chillers at ${formatUsd(CHILLER_RENTAL_USD_PER_DAY)}/day each (estimate: $10M ÷ ~30 chillers ÷ ~90 days); ${TONS_PER_RENTAL_CHILLER} tons per chiller (assumption).`}
                sub={
                  <>
                    Priority <strong className="text-[var(--bib-ink)]">#{plan_b.priority_rank}</strong> on{' '}
                    {plan_b.segment_id} · {plan_b.chillers_needed} rental {plan_b.chillers_needed === 1 ? 'chiller' : 'chillers'}{' '}
                    for a {formatNumber(building.peak_load_tons)}-ton peak load
                  </>
                }
              />
              <Button asChild variant="outline" appearance="secondary" className="w-full">
                <Link to={`/planb/${plan_b.segment_id}`}>
                  Simulate {plan_b.segment_id} failure <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </div>
          ) : (
            <Panel title="If cooling fails">
              <PanelState state="empty" message="Not on a chilled-water loop — no Plan B needed." />
            </Panel>
          )}
        </section>
      </div>
    </div>
  );
}
