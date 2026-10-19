/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

/*
 * Asset detail — the heart of the demo (FRONTEND §5.4, owner: Anuva) ·
 * `assetHistory(id)` + `briefing(id, asOf)`.
 *
 * The risk history is fetched once per asset (it does not depend on the date), so
 * scrubbing the as-of cursor only re-renders the chart; the briefing (which also drafts
 * the work order server-side) is fetched per date, debounced so Play / dragging never
 * fires a compute per tick. Built from the shared components (StatusPill, SystemIcon,
 * CriticalityBadge, Panel, ProvenanceChip, RiskChart, SignalBars, WorkOrderCard).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import { Line, LineChart, ReferenceArea, ResponsiveContainer } from 'recharts';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useErrorReporter } from '@/components/ErrorBoundary/ErrorBoundary';
import AgentDrawer from '@/components/AgentDrawer/AgentDrawer';
// Vibhrav's forecast panel (RiskForecast.compare, ML.md §8) — embedded here by owner request.
import ForecastPanel from '@/components/ForecastPanel/ForecastPanel';
import { Panel, PanelState } from '@/components/Panel/Panel';
import RiskChart from '@/components/RiskChart/RiskChart';
import { INK, SERIES_1 } from '@/components/RiskChart/statusColors';
import SignalBars from '@/components/SignalBars/SignalBars';
import CriticalityBadge from '@/components/StatusPill/CriticalityBadge';
import StatusPill from '@/components/StatusPill/StatusPill';
import SystemIcon, { systemLabel } from '@/components/SystemIcon/SystemIcon';
import WorkOrderCard from '@/components/WorkOrderCard/WorkOrderCard';
import { useAsOf } from '@/contexts/AsOfProvider';
import { errorMessage, formatDate, formatRisk, formatThreshold } from '@/shared/api';
import { approveWorkOrder, dismissWorkOrder, fetchAssetHistory, fetchBriefing } from '@/shared/api/anuva';
import type { AssetHistory, Briefing, RiskSeriesPoint, SensorMap } from '@/Interfaces';

const APPROVER = 'Facilities manager';
/** Scrubbing / Play changes the date every few hundred ms; only brief the date the user settles on. */
const BRIEFING_DEBOUNCE_MS = 400;

const SENSOR_LABEL: Partial<Record<keyof SensorMap, string>> = {
  pressure_psi: 'Pressure (psi)',
  flow_imbalance_pct: 'Flow imbalance (%)',
  delta_t_f: 'ΔT (°F)',
  vibration_mm_s: 'Vibration (mm/s)',
  energy_kwh: 'Energy (kWh)',
};

interface SensorMultipleProps {
  label: string;
  sensorKey: keyof SensorMap;
  /** Only readings known as of the cursor — the future is not shown here either. */
  series: RiskSeriesPoint[];
  band: [number, number] | null | undefined;
}

/** One sensor vs its 30-day normal band (shaded). */
function SensorMultiple({ label, sensorKey, series, band }: SensorMultipleProps) {
  const data = series.map((p) => ({ date: p.date, value: p.sensors?.[sensorKey] ?? null })).filter((d) => d.value != null);
  if (data.length === 0) return null;
  const latest = data[data.length - 1].value as number;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium leading-4 text-[var(--bib-ink)]">{label}</span>
        <span className="text-[13px] leading-4 tabular-nums text-[var(--bib-ink-muted)]">{latest.toFixed(1)}</span>
      </div>
      <ResponsiveContainer width="100%" height={56}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
          {band ? <ReferenceArea y1={band[0]} y2={band[1]} fill={SERIES_1} fillOpacity={0.14} stroke="none" /> : null}
          <Line type="monotone" dataKey="value" stroke={INK} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Asset() {
  const { assetId } = useParams<{ assetId: string }>();
  const { asOf } = useAsOf();
  const { reportError } = useErrorReporter();

  const [history, setHistory] = useState<AssetHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const [briefingKey, setBriefingKey] = useState(0);

  const reloadHistory = useCallback(() => setHistoryKey((key) => key + 1), []);
  const reloadBriefing = useCallback(() => setBriefingKey((key) => key + 1), []);

  // Risk history: once per asset.
  useEffect(() => {
    if (!assetId) return undefined;
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);
    setHistory((previous) => (previous && previous.asset.asset_id === assetId ? previous : null));
    fetchAssetHistory(assetId)
      .then((result) => {
        if (!cancelled) setHistory(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        reportError(err);
        setHistoryError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assetId, historyKey, reportError]);

  // Briefing (+ server-side work-order draft): per asset and date, debounced.
  useEffect(() => {
    if (!assetId) return undefined;
    let cancelled = false;
    setBriefingLoading(true);
    setBriefingError(null);
    const timer = window.setTimeout(() => {
      fetchBriefing(assetId, asOf)
        .then((result) => {
          if (!cancelled) setBriefing(result);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          reportError(err);
          setBriefingError(errorMessage(err));
        })
        .finally(() => {
          if (!cancelled) setBriefingLoading(false);
        });
    }, BRIEFING_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [assetId, asOf, briefingKey, reportError]);

  /** Latest point at or before the cursor — what we "know" as of the date. */
  const pointAtAsOf = useMemo(() => {
    if (!history) return null;
    const known = history.series.filter((p) => p.date <= asOf);
    return known.length > 0 ? known[known.length - 1] : (history.series[0] ?? null);
  }, [history, asOf]);

  const knownSeries = useMemo(() => (history ? history.series.filter((p) => p.date <= asOf) : []), [history, asOf]);

  if (!assetId) {
    return (
      <div className="p-6">
        <PanelState state="error" title="No asset selected" message="Pick an asset from the Overview queue or a building." />
      </div>
    );
  }
  if (historyLoading && !history) {
    return (
      <div className="p-6">
        <PanelState state="loading" lines={8} />
      </div>
    );
  }
  if (!history) {
    return (
      <div className="p-6">
        <PanelState
          state="error"
          title="Couldn’t load this asset"
          message={historyError ?? undefined}
          onRetry={reloadHistory}
        />
      </div>
    );
  }

  const { asset } = history;
  const sensorKeys = (Object.keys(SENSOR_LABEL) as (keyof SensorMap)[]).filter(
    (key) => pointAtAsOf?.sensors?.[key] != null,
  );
  const briefingStale = briefing !== null && briefingLoading;

  return (
    <div className="flex min-h-full flex-col gap-4 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Link
            to="/overview"
            className="inline-flex items-center gap-1 text-[14px] leading-5 text-[var(--bib-ink-muted)] hover:text-[var(--bib-ink)]"
          >
            <ChevronLeft className="size-4" aria-hidden /> Overview
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <SystemIcon system={asset.system} size="lg" />
            <h1 className="text-[22px] font-semibold leading-7 text-[var(--bib-ink)]">{asset.name}</h1>
            {pointAtAsOf ? <StatusPill status={pointAtAsOf.status} /> : null}
          </div>
          <p className="flex flex-wrap items-center gap-x-2 text-[15px] leading-5 text-[var(--bib-ink-muted)]">
            <span>{asset.asset_id}</span>
            <span aria-hidden>·</span>
            <span>{systemLabel(asset.system)}</span>
            <span aria-hidden>·</span>
            <span>{asset.age_years} yrs</span>
            <span aria-hidden>·</span>
            <span>
              Segment{' '}
              <Link
                to={`/planb/${asset.segment_id}`}
                className="font-medium text-[var(--bib-ink)] underline-offset-2 hover:underline"
              >
                {asset.segment_id}
              </Link>
            </span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-[15px] leading-5 text-[var(--bib-ink-muted)]">
          <span>
            As of <span className="font-semibold text-[var(--bib-ink)]">{formatDate(asOf)}</span>
          </span>
          {pointAtAsOf ? (
            <span>
              Risk <span className="font-semibold text-[var(--bib-ink)]">{formatRisk(pointAtAsOf.risk)}</span> · due at{' '}
              {formatThreshold(history.threshold)}
            </span>
          ) : null}
        </div>
      </header>

      <Panel
        title="Risk over time"
        subtitle={`Known to ${formatDate(asOf)}; later dates are greyed. ✕ marks the planted failure, ▲ a decoy the model ignored.`}
        chip="SYNTHETIC"
        chipTitle="Sensor readings and the planted failure are synthetic; the June 17 marker re-enacts the real outage."
      >
        <RiskChart series={history.series} threshold={history.threshold} events={history.events} asOf={asOf} />
      </Panel>

      <ForecastPanel assetId={assetId} asOf={asOf} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="What’s driving it"
          subtitle="Each signal’s share of the risk score, with its direction vs the 30-day normal band"
          chip="SYNTHETIC"
        >
          {pointAtAsOf ? (
            <div className="flex flex-col gap-5">
              <SignalBars contrib={pointAtAsOf.contrib} z={pointAtAsOf.z} driverLabel={pointAtAsOf.driver} />
              {sensorKeys.length > 0 ? (
                <div className="flex flex-col gap-2 border-t border-[var(--bib-border)] pt-4">
                  <span className="text-[13px] font-semibold uppercase leading-4 tracking-[0.06em] text-[var(--bib-ink-muted)]">
                    Sensors vs normal band
                  </span>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {sensorKeys.map((key) => (
                      <SensorMultiple
                        key={key}
                        label={SENSOR_LABEL[key] as string}
                        sensorKey={key}
                        series={knownSeries}
                        band={pointAtAsOf.band?.[key]}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <PanelState state="empty" message="No signal data for this date." />
          )}
        </Panel>

        <Panel
          title="Agent briefing"
          subtitle={briefing ? `Generated by agent (${briefing.generated_by})` : undefined}
          actions={briefingStale ? <span className="text-[13px] text-[var(--bib-ink-muted)]">Updating…</span> : undefined}
        >
          {briefingLoading && !briefing ? (
            <PanelState state="loading" lines={5} />
          ) : briefingError && !briefing ? (
            <PanelState
              state="error"
              title="Agent briefing unavailable — the ranked queue is still current"
              message={briefingError}
              onRetry={reloadBriefing}
            />
          ) : briefing ? (
            <div className={cn('flex flex-col gap-3 transition-opacity', briefingStale ? 'opacity-70' : 'opacity-100')}>
              <p className="text-[16px] font-semibold leading-6 text-[var(--bib-ink)]">{briefing.headline}</p>
              <p className="text-[15px] leading-6 text-[var(--bib-ink)]">{briefing.text}</p>
              <ul className="list-disc pl-5 text-[15px] leading-6 text-[var(--bib-ink)]">
                {briefing.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
              <div className="flex flex-col gap-2 border-t border-[var(--bib-border)] pt-3">
                <span className="text-[13px] font-semibold uppercase leading-4 tracking-[0.06em] text-[var(--bib-ink-muted)]">
                  Draft work order
                </span>
                <WorkOrderCard
                  workOrder={briefing.work_order}
                  onApprove={async () => {
                    if (briefing.work_order) await approveWorkOrder(briefing.work_order.wo_id, APPROVER);
                    reloadBriefing();
                  }}
                  onDismiss={async (reason) => {
                    if (briefing.work_order) await dismissWorkOrder(briefing.work_order.wo_id, reason);
                    reloadBriefing();
                  }}
                />
              </div>
            </div>
          ) : (
            <PanelState state="empty" message="No briefing for this date." />
          )}
        </Panel>
      </div>

      <Panel
        title="Buildings served"
        subtitle={
          asset.buildings_served.length > 0
            ? `${asset.buildings_served.length} ${asset.buildings_served.length === 1 ? 'building' : 'buildings'} depend on this asset — open one for its dashboard`
            : undefined
        }
      >
        {asset.buildings_served.length === 0 ? (
          <PanelState state="empty" message="No buildings linked to this asset." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {asset.buildings_served.map((building) => (
              <li key={building.building_id} className="min-w-0">
                <Link to={`/building/${building.building_id}`} className="group block h-full">
                  <Card
                    variant="outlined"
                    size="sm"
                    className="h-full gap-2 transition-colors group-hover:border-[var(--bib-ink-muted)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[15px] font-medium leading-5 text-[var(--bib-ink)]">{building.name}</span>
                      <ArrowRight
                        className="size-4 shrink-0 text-[var(--bib-ink-muted)] group-hover:text-[var(--bib-ink)]"
                        aria-hidden
                      />
                    </div>
                    <CriticalityBadge criticality={building.criticality} />
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <AgentDrawer asOf={asOf} />
    </div>
  );
}
