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
import { Line, LineChart, ReferenceArea, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useErrorReporter } from '@/components/ErrorBoundary/ErrorBoundary';
import { approveWorkOrder, dismissWorkOrder, fetchAssetHistory, fetchBriefing } from '@/shared/api/anuva';
import type { AssetHistory, Briefing, RiskSeriesPoint, SensorMap, SystemType } from '@/Interfaces';
import RiskChart from '@/components/RiskChart/RiskChart';
import { ProvenanceTag, StatusTag } from '@/components/RiskChart/Tags';
import SignalBars from '@/components/SignalBars/SignalBars';
import WorkOrderCard from '@/components/WorkOrderCard/WorkOrderCard';
import AgentDrawer from '@/components/AgentDrawer/AgentDrawer';
// Vibhrav's forecast panel (RiskForecast.compare, ML.md §8) — embedded here by owner request.
import ForecastPanel from '@/components/ForecastPanel/ForecastPanel';

// TEMPORARY: Arnav owns the global `asOf` scrubber (contexts/AsOfProvider).
// Until that lands, this page keeps its own asOf in the URL so it's still
// shareable/demoable standalone. Swap for his context in one line later.
const DEFAULT_AS_OF = '2026-06-09';
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

const SYSTEM_ICON: Record<SystemType, React.ComponentType<{ className?: string }>> = {
  cooling: Snowflake,
  heating: Flame,
  air: Wind,
};

const SENSOR_LABEL: Partial<Record<keyof SensorMap, string>> = {
  pressure_psi: 'Pressure (psi)',
  flow_imbalance_pct: 'Flow imbalance (%)',
  delta_t_f: 'ΔT (°F)',
  vibration_mm_s: 'Vibration (mm/s)',
  energy_kwh: 'Energy (kWh)',
};

function SensorMultiple({
  label,
  sensorKey,
  series,
  band,
}: {
  label: string;
  sensorKey: keyof SensorMap;
  series: RiskSeriesPoint[];
  band: [number, number] | null | undefined;
}) {
  const data = series.map((p) => ({ date: p.date, value: p.sensors?.[sensorKey] ?? null })).filter((d) => d.value != null);
  if (data.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-medium text-[#111827]">{label}</div>
      <ResponsiveContainer width="100%" height={56}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
          {band ? <ReferenceArea y1={band[0]} y2={band[1]} fill="#2563EB" fillOpacity={0.08} stroke="none" /> : null}
          <Line type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Asset detail — the heart of the demo (FRONTEND §5.4). */
export default function Asset() {
  const { assetId } = useParams<{ assetId: string }>();
  const [asOf, setAsOf] = useAsOf();
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
          setBriefingError('Agent briefing unavailable — the ranked queue is still current.');
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
    return <div className="p-6 text-sm text-[#DC2626]">No asset selected.</div>;
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner label="Loading asset" size="lg" />
      </div>
    );
  }

  if (!history) {
    return (
      <div className="p-6 text-sm text-[#DC2626]">{historyError ?? 'This asset could not be loaded.'}</div>
    );
  }

  const SystemIcon = SYSTEM_ICON[history.asset.system];

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <SystemIcon className="size-6 text-[#6B7280]" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-[#111827]">{history.asset.name}</h1>
              {pointAtAsOf ? <StatusTag status={pointAtAsOf.status} /> : null}
            </div>
            <div className="text-sm text-[#6B7280]">
              {history.asset.asset_id} · {history.asset.age_years} yrs · Segment {history.asset.segment_id}
            </div>
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

      <Card variant="outlined">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Risk over time</CardTitle>
            <ProvenanceTag kind="SYNTHETIC" />
          </div>
        </CardHeader>
        <CardContent>
          <RiskChart series={history.series} threshold={history.threshold} events={history.events} asOf={asOf} />
        </CardContent>
      </Card>

      <ForecastPanel assetId={assetId} asOf={asOf} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card variant="outlined">
          <CardHeader>
            <CardTitle>What&apos;s driving it</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {pointAtAsOf ? (
              <SignalBars contrib={pointAtAsOf.contrib} z={pointAtAsOf.z} driverLabel={pointAtAsOf.driver} />
            ) : (
              <div className="text-sm text-[#6B7280]">No signal data for this date.</div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {pointAtAsOf &&
                (Object.keys(SENSOR_LABEL) as (keyof SensorMap)[])
                  .filter((key) => pointAtAsOf.sensors?.[key] != null)
                  .map((key) => (
                    <SensorMultiple
                      key={key}
                      label={SENSOR_LABEL[key] as string}
                      sensorKey={key}
                      series={history.series}
                      band={pointAtAsOf.band?.[key]}
                    />
                  ))}
            </div>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardHeader>
            <CardTitle>Agent briefing</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {briefingError ? (
              <div className="text-sm text-[#DC2626]">{briefingError}</div>
            ) : briefing ? (
              <>
                <div className="text-sm font-medium text-[#111827]">{briefing.headline}</div>
                <div className="text-sm text-[#111827]">{briefing.text}</div>
                <ul className="list-disc pl-5 text-sm text-[#111827]">
                  {briefing.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <div className="text-xs text-[#6B7280]">Generated by agent ({briefing.generated_by})</div>
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
              </>
            ) : (
              <div className="text-sm text-[#6B7280]">No briefing available.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card variant="outlined">
        <CardHeader>
          <CardTitle>Buildings served</CardTitle>
        </CardHeader>
        <CardContent>
          {history.asset.buildings_served.length === 0 ? (
            <div className="text-sm text-[#6B7280]">No buildings linked to this asset.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {history.asset.buildings_served.map((b) => (
                <Link key={b.building_id} to={`/building/${b.building_id}`}>
                  <Badge variant="outline" appearance="secondary">
                    {b.name} · {b.criticality}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-[#6B7280]">As of {formatDate(asOf)}</div>

      <AgentDrawer asOf={asOf} />
    </div>
  );
}
