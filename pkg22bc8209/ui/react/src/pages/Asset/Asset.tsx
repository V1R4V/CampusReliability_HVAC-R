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
import { Activity, ArrowRight, Building2, Check, Sparkles } from 'lucide-react';
import { Line, LineChart, ReferenceArea, ResponsiveContainer, YAxis } from 'recharts';

import { useErrorReporter } from '@/components/ErrorBoundary/ErrorBoundary';
import { RISK_STROKE } from '@/components/Chart/chartTheme';
import ForecastPanel from '@/components/ForecastPanel/ForecastPanel';
import PageHeader from '@/components/PageHeader/PageHeader';
import { Panel, PanelState } from '@/components/Panel/Panel';
import RiskChart from '@/components/RiskChart/RiskChart';
import SignalBars from '@/components/SignalBars/SignalBars';
import CriticalityBadge from '@/components/StatusPill/CriticalityBadge';
import StatusPill from '@/components/StatusPill/StatusPill';
import SystemIcon, { systemLabel } from '@/components/SystemIcon/SystemIcon';
import WorkOrderCard from '@/components/WorkOrderCard/WorkOrderCard';
import { useAsOf } from '@/contexts/AsOfProvider';
import { formatDate, formatNumber, formatPct, formatRisk, formatUsd } from '@/shared/api';
import { approveWorkOrder, dismissWorkOrder, fetchAssetHistory, fetchBriefing } from '@/shared/api/anuva';
import type { AssetHistory, Briefing, RiskSeriesPoint, SensorMap } from '@/Interfaces';

const SENSORS: { key: keyof SensorMap; label: string; unit: string }[] = [
  { key: 'pressure_psi', label: 'Pressure', unit: 'psi' },
  { key: 'flow_imbalance_pct', label: 'Flow imbalance', unit: '%' },
  { key: 'delta_t_f', label: 'ΔT', unit: '°F' },
  { key: 'vibration_mm_s', label: 'Vibration', unit: 'mm/s' },
  { key: 'energy_kwh', label: 'Energy', unit: 'kWh' },
];

/** Days of sensor history drawn in each small multiple. */
const SENSOR_WINDOW_DAYS = 90;

/** Readable names for the contract's asset types; anything new falls back to "snake_case" → "Snake case". */
const TYPE_LABEL: Record<string, string> = {
  chw_main: 'Chilled-water main',
  chiller: 'Chiller',
  ahu: 'Air handler',
  unit_heater: 'Unit heater',
  heat_exchanger: 'Heat exchanger',
  hx: 'Heat exchanger',
  pump: 'Pump',
  boiler: 'Boiler',
  cooling_tower: 'Cooling tower',
};

function humanize(value: string | null | undefined): string {
  if (!value) return '';
  const known = TYPE_LABEL[value.toLowerCase()];
  if (known) return known;
  const text = value.replace(/_/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatSensor(value: number, unit: string): string {
  const digits = unit === 'kWh' ? 0 : Math.abs(value) >= 100 ? 0 : 1;
  return formatNumber(value, digits);
}

function SensorMultiple({
  label,
  unit,
  sensorKey,
  series,
  band,
  asOf,
}: {
  label: string;
  unit: string;
  sensorKey: keyof SensorMap;
  series: RiskSeriesPoint[];
  band: [number, number] | null | undefined;
  asOf: string;
}) {
  const data = useMemo(
    () =>
      series
        .filter((p) => p.date <= asOf)
        .map((p) => ({ date: p.date, value: p.sensors?.[sensorKey] ?? null }))
        .filter((d): d is { date: string; value: number } => d.value != null)
        .slice(-SENSOR_WINDOW_DAYS),
    [series, sensorKey, asOf],
  );
  if (data.length === 0) return null;
  const last = data[data.length - 1].value;
  const values = data.map((d) => d.value);
  const lo = Math.min(...values, band ? band[0] : Infinity);
  const hi = Math.max(...values, band ? band[1] : -Infinity);
  const pad = (hi - lo || 1) * 0.15;
  const outside = band ? last < band[0] || last > band[1] : false;

  return (
    <div className="flex flex-col gap-1 rounded-[6px] border border-[var(--bib-border)] bg-[var(--bib-canvas)]/60 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[14px] font-medium text-[var(--bib-ink)]">{label}</span>
        <span className={`bib-num text-[16px] font-semibold ${outside ? 'text-[var(--bib-status-due)]' : 'text-[var(--bib-ink)]'}`}>
          {formatSensor(last, unit)} <span className="text-[12px] font-normal text-[var(--bib-ink-muted)]">{unit}</span>
        </span>
      </div>
      <div className="h-[56px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 4 }}>
            <YAxis hide domain={[lo - pad, hi + pad]} />
            {band ? <ReferenceArea y1={band[0]} y2={band[1]} fill="var(--bib-accent)" fillOpacity={0.12} stroke="none" /> : null}
            <Line type="monotone" dataKey="value" stroke={RISK_STROKE} strokeWidth={1.75} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="text-[12px] leading-4 text-[var(--bib-ink-muted)]">
        {band ? `30-day normal ${formatSensor(band[0], unit)}–${formatSensor(band[1], unit)} ${unit}` : `Last ${SENSOR_WINDOW_DAYS} days`}
      </div>
    </div>
  );
}

function LegendSwatch({ kind, label }: { kind: 'risk' | 'threshold' | 'due' | 'future'; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] leading-4 text-[var(--bib-ink-muted)]">
      {kind === 'risk' ? <span aria-hidden className="inline-block h-[3px] w-5 rounded-full bg-[var(--bib-accent)]" /> : null}
      {kind === 'threshold' ? <span aria-hidden className="inline-block w-5 border-t-2 border-dashed border-[var(--bib-status-due)]" /> : null}
      {kind === 'due' ? <span aria-hidden className="inline-block h-3 w-5 rounded-[2px] bg-[var(--bib-status-due-soft)]" /> : null}
      {kind === 'future' ? <span aria-hidden className="inline-block w-5 border-t-2 border-dashed border-[var(--bib-ink-muted)]" /> : null}
      {label}
    </span>
  );
}

/** Asset detail — the heart of the demo (FRONTEND §5.4). */
export default function Asset() {
  const { assetId } = useParams<{ assetId: string }>();
  const { asOf } = useAsOf();
  const { reportError } = useErrorReporter();

  const [history, setHistory] = useState<AssetHistory | null>(null);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    setLoading(true);
    setHistoryError(null);
    setBriefingError(null);

    Promise.all([
      fetchAssetHistory(assetId).catch((err) => {
        if (!cancelled) {
          reportError(err);
          setHistoryError('Could not load this asset’s risk history.');
        }
        return null;
      }),
      fetchBriefing(assetId, asOf).catch((err) => {
        if (!cancelled) {
          reportError(err);
          setBriefingError('Agent briefing unavailable. The ranked queue is still current.');
        }
        return null;
      }),
    ]).then(([historyResult, briefingResult]) => {
      if (cancelled) return;
      setHistory(historyResult);
      setBriefing(briefingResult);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [assetId, asOf, refreshKey, reportError]);

  const pointAtAsOf = useMemo(() => {
    if (!history) return null;
    const known = history.series.filter((p) => p.date <= asOf);
    return known.length > 0 ? known[known.length - 1] : history.series[history.series.length - 1] ?? null;
  }, [history, asOf]);

  if (!assetId) {
    return (
      <div className="p-6">
        <PanelState state="error" title="No asset selected" message="Pick an asset from the Overview queue." />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-5 p-6 xl:px-8">
        <PanelState state="loading" lines={3} />
        <div className="bib-card p-4">
          <PanelState state="loading" lines={6} />
        </div>
      </div>
    );
  }

  if (!history) {
    return (
      <div className="p-6">
        <PanelState
          state="error"
          title="This asset could not be loaded"
          message={historyError ?? undefined}
          onRetry={() => setRefreshKey((k) => k + 1)}
        />
      </div>
    );
  }

  const { asset } = history;
  const bullets = briefing?.bullets ?? [];
  const backTo = asset.building_id
    ? { to: `/building/${asset.building_id}`, label: 'Back to building' }
    : { to: '/overview', label: 'Back to overview' };

  return (
    <div className="flex min-h-full flex-col gap-5 p-6 xl:px-8">
      <PageHeader
        backTo={backTo}
        eyebrow="Why, and what do I do?"
        icon={<SystemIcon system={asset.system} size="lg" className="text-[var(--bib-ink)]" />}
        title={asset.name}
        badges={pointAtAsOf ? <StatusPill status={pointAtAsOf.status} size="lg" /> : null}
        meta={[
          <span key="id" className="bib-num font-semibold text-[var(--bib-ink)]">
            {asset.asset_id}
          </span>,
          `${humanize(asset.type)} · ${systemLabel(asset.system)}`,
          `${asset.age_years} years old (installed ${asset.install_year})`,
          `Loop ${asset.segment_id}`,
          `${asset.buildings_served.length} ${asset.buildings_served.length === 1 ? 'building' : 'buildings'} served`,
        ]}
        actions={
          <div className="rounded-[6px] border border-[var(--bib-border)] bg-[var(--bib-canvas)] px-3 py-1.5 text-right">
            <div className="text-[11px] font-semibold uppercase leading-4 tracking-[0.08em] text-[var(--bib-ink-muted)]">Risk as of {formatDate(asOf)}</div>
            <div className="bib-num text-[22px] font-semibold leading-7 text-[var(--bib-ink)]">
              {pointAtAsOf ? formatRisk(pointAtAsOf.risk) : '—'}
              <span className="text-[13px] font-normal text-[var(--bib-ink-muted)]"> / 5 · threshold {formatRisk(history.threshold)}</span>
            </div>
          </div>
        }
      />

      <Panel
        title="Risk over time"
        subtitle="January to August 2026. Inspection is due once risk stays over the threshold for two consecutive days; anything after the as-of date is not yet known."
        icon={<Activity />}
        chip="SYNTHETIC"
        actions={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <LegendSwatch kind="risk" label="Risk" />
            <LegendSwatch kind="threshold" label={`Threshold ${formatRisk(history.threshold)}`} />
            <LegendSwatch kind="due" label="Inspection due" />
            <LegendSwatch kind="future" label="After as-of" />
          </div>
        }
      >
        <RiskChart series={history.series} threshold={history.threshold} events={history.events} asOf={asOf} />
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel
          title="What’s driving it"
          subtitle={`Each signal’s share of today’s risk and its move against the 30-day normal band, as of ${formatDate(asOf)}`}
          icon={<Activity />}
          className="h-full"
        >
          {pointAtAsOf ? (
            <div className="flex flex-col gap-5">
              <SignalBars contrib={pointAtAsOf.contrib} z={pointAtAsOf.z} driverLabel={pointAtAsOf.driver} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {SENSORS.filter((s) => pointAtAsOf.sensors?.[s.key] != null).map((s) => (
                  <SensorMultiple
                    key={s.key}
                    label={s.label}
                    unit={s.unit}
                    sensorKey={s.key}
                    series={history.series}
                    band={pointAtAsOf.band?.[s.key]}
                    asOf={asOf}
                  />
                ))}
              </div>
            </div>
          ) : (
            <PanelState state="empty" message="No signal data for this date." />
          )}
        </Panel>

        <Panel
          title="Agent briefing"
          subtitle={`Drafted for ${formatDate(asOf)}. Every number comes from the model; nothing is invented.`}
          icon={<Sparkles />}
          className="h-full"
          footer={
            briefing ? (
              <span>
                Generated by the agent · {briefing.generated_by === 'llm' ? 'LLM' : 'template'} · the work order waits for your approval
              </span>
            ) : undefined
          }
        >
          {briefingError ? (
            <PanelState state="error" title="Agent briefing unavailable" message={briefingError} onRetry={() => setRefreshKey((k) => k + 1)} />
          ) : briefing ? (
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-[20px] font-semibold leading-7 tracking-[-0.01em] text-[var(--bib-ink)]">{briefing.headline}</h3>
                <p className="mt-2 text-[16px] leading-7 text-[var(--bib-ink-soft)]">{briefing.text}</p>
              </div>
              {bullets.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-[15px] leading-6 text-[var(--bib-ink)]">
                      <Check className="mt-1 size-4 shrink-0 text-[var(--bib-status-healthy)]" aria-hidden />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <dl className="grid grid-cols-3 gap-3 rounded-[6px] border border-[var(--bib-border)] bg-[var(--bib-canvas)] p-3">
                <div>
                  <dt className="bib-eyebrow">Energy</dt>
                  <dd className="bib-num mt-1 text-[20px] font-semibold leading-6 text-[var(--bib-ink)]">{formatPct(briefing.energy_over_expected_pct)}</dd>
                  <dd className="text-[12px] leading-4 text-[var(--bib-ink-muted)]">vs weather-expected</dd>
                </div>
                <div>
                  <dt className="bib-eyebrow">Serves</dt>
                  <dd className="bib-num mt-1 text-[20px] font-semibold leading-6 text-[var(--bib-ink)]">{briefing.buildings_served.length}</dd>
                  <dd className="text-[12px] leading-4 text-[var(--bib-ink-muted)]">buildings</dd>
                </div>
                <div>
                  <dt className="bib-eyebrow">If it fails</dt>
                  <dd className="bib-num mt-1 text-[20px] font-semibold leading-6 text-[var(--bib-ink)]">
                    {briefing.cost_per_day_usd > 0 ? formatUsd(briefing.cost_per_day_usd, { perDay: true }) : '—'}
                  </dd>
                  <dd className="text-[12px] leading-4 text-[var(--bib-ink-muted)]">rental chillers (estimate)</dd>
                </div>
              </dl>
              <div>
                <div className="bib-eyebrow mb-2">Draft work order</div>
                <WorkOrderCard
                  workOrder={briefing.work_order}
                  onApprove={async () => {
                    if (briefing.work_order) await approveWorkOrder(briefing.work_order.wo_id, 'Facilities manager');
                    setRefreshKey((k) => k + 1);
                  }}
                  onDismiss={async (reason) => {
                    if (briefing.work_order) await dismissWorkOrder(briefing.work_order.wo_id, reason);
                    setRefreshKey((k) => k + 1);
                  }}
                />
              </div>
            </div>
          ) : (
            <PanelState state="empty" message="No briefing available for this date." />
          )}
        </Panel>
      </div>

      <ForecastPanel assetId={assetId} asOf={asOf} />

      <Panel
        title="Buildings served"
        subtitle={
          asset.buildings_served.length === 0
            ? 'No buildings linked to this asset.'
            : `${asset.buildings_served.length} ${asset.buildings_served.length === 1 ? 'building depends' : 'buildings depend'} on this asset`
        }
        icon={<Building2 />}
      >
        {asset.buildings_served.length === 0 ? (
          <PanelState state="empty" message="No buildings linked to this asset." />
        ) : (
          <ul className="flex flex-wrap gap-2">
            {asset.buildings_served.map((b) => (
              <li key={b.building_id}>
                <Link
                  to={`/building/${b.building_id}`}
                  className="bib-card bib-card-interactive group inline-flex items-center gap-2.5 px-3 py-2 outline-none focus-visible:shadow-[0_0_0_2px_var(--c3-style-shadow-ring-accent)]"
                >
                  <span className="text-[15px] font-medium text-[var(--bib-ink)]">{b.name}</span>
                  <CriticalityBadge criticality={b.criticality} />
                  <ArrowRight className="size-4 text-[var(--bib-ink-muted)] transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
