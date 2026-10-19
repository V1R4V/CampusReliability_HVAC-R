/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useErrorReporter } from '@/components/ErrorBoundary/ErrorBoundary';
import { ProvenanceTag } from '@/components/RiskChart/Tags';
import Schematic from '@/components/Schematic/Schematic';
import { formatDate, useAsOfContext } from '@/contexts/AsOfProvider';
import { fetchCampusSnapshot, simulatePlanB } from '@/shared/api/shell';
import type { CampusSnapshot, PlanBResult } from '@/Interfaces';

const DEFAULT_SEGMENT = 'S3';
const STEP_MS = 280;
const DESIGN_DAY_F = 95;

const CRITICALITY_LABEL: Record<string, string> = {
  patient_care: 'Patient care',
  research_lab: 'Research lab',
  instruction: 'Instruction',
  office: 'Office',
};

function usd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Plan B — simulate a loop failure (docs/FRONTEND.md §5.5): who loses cooling, in what order, at what cost. */
export default function PlanB() {
  const { segmentId: routeSegment } = useParams();
  const navigate = useNavigate();
  const { asOf } = useAsOfContext();
  const { reportError } = useErrorReporter();
  const segmentId = routeSegment ?? DEFAULT_SEGMENT;

  const [snapshot, setSnapshot] = useState<CampusSnapshot | null>(null);
  const [tempMode, setTempMode] = useState<'today' | 'design'>('today');
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [result, setResult] = useState<PlanBResult | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchCampusSnapshot(asOf)
      .then((s) => {
        if (!cancelled) setSnapshot(s);
      })
      .catch((err) => {
        if (!cancelled) {
          reportError(err);
          setError('Could not load the campus network.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [asOf, reportError]);

  const todayTemp = snapshot?.weather?.tmax_f ?? null;
  const tempF = tempMode === 'today' && todayTemp != null ? Math.round(todayTemp) : DESIGN_DAY_F;

  // A new segment, temperature or staging choice invalidates the last run.
  useEffect(() => {
    window.clearInterval(timer.current);
    setResult(null);
    setRevealed(0);
    setRunning(false);
  }, [segmentId, tempF, priorityOnly]);

  useEffect(() => () => window.clearInterval(timer.current), []);

  const simulate = async () => {
    window.clearInterval(timer.current);
    setRunning(true);
    setError(null);
    setRevealed(0);
    try {
      const r = await simulatePlanB(segmentId, tempF, priorityOnly);
      setResult(r);
      if (prefersReducedMotion()) {
        setRevealed(r.buildings.length);
        setRunning(false);
        return;
      }
      let n = 0;
      timer.current = window.setInterval(() => {
        n += 1;
        setRevealed(n);
        if (n >= r.buildings.length) {
          window.clearInterval(timer.current);
          setRunning(false);
        }
      }, STEP_MS);
    } catch (err) {
      reportError(err);
      setError('Simulation failed.');
      setRunning(false);
    }
  };

  const darkened = useMemo(() => (result ? result.buildings.slice(0, revealed).map((b) => b.building_id) : []), [result, revealed]);
  const done = result != null && revealed >= result.buildings.length;
  const segmentName = snapshot?.segments.find((s) => s.segment_id === segmentId)?.name;
  const ref = result?.reference;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold leading-tight text-[#111827]">Plan B — simulate a loop failure</h1>
          <div className="text-sm text-[#6B7280]">
            Who loses cooling, in what order, and what temporary chillers would cost — ready before anything breaks.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#E5E7EB] bg-white p-3">
        <label className="flex items-center gap-2 text-sm text-[#374151]">
          Loop
          <select
            className="h-9 rounded-md border border-[#D1D5DB] bg-white px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
            value={segmentId}
            onChange={(e) => navigate(`/planb/${e.target.value}?asOf=${asOf}`)}
          >
            {(snapshot?.segments ?? [{ segment_id: segmentId, name: segmentId }]).map((s) => (
              <option key={s.segment_id} value={s.segment_id}>
                {s.segment_id} · {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-[#374151]">
          Outdoor temp
          <select
            className="h-9 rounded-md border border-[#D1D5DB] bg-white px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
            value={tempMode}
            onChange={(e) => setTempMode(e.target.value as 'today' | 'design')}
          >
            <option value="today">
              {todayTemp != null ? `Real high on ${formatDate(asOf)}: ${Math.round(todayTemp)}°F` : 'Today (no weather row)'}
            </option>
            <option value="design">Design hot day: {DESIGN_DAY_F}°F</option>
          </select>
        </label>
        <label className="flex h-9 items-center gap-2 text-sm text-[#374151]">
          <input
            type="checkbox"
            className="size-4 accent-[#2563EB]"
            checked={priorityOnly}
            onChange={(e) => setPriorityOnly(e.target.checked)}
          />
          Stage chillers for labs & patient care only
        </label>
        <button
          type="button"
          onClick={simulate}
          disabled={running}
          className="ml-auto inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-md bg-[#111827] px-4 text-sm font-semibold text-white hover:bg-[#1F2937] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 disabled:opacity-60"
        >
          <Zap className="size-4" />
          {running ? 'Simulating…' : 'Simulate failure'}
        </button>
      </div>

      {error ? <div className="text-sm text-[#DC2626]">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card variant="outlined" className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span>
                {segmentId}
                {segmentName ? ` · ${segmentName}` : ''}
              </span>
              <span className="text-xs font-normal text-[#6B7280]">
                {result ? `${revealed} of ${result.buildings.length} buildings without cooling` : 'buildings on this loop are highlighted'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {snapshot ? (
              <Schematic
                plants={snapshot.plants}
                segments={snapshot.segments}
                buildings={snapshot.buildings}
                highlightSegment={segmentId}
                darkened={darkened}
                onSegmentClick={(id) => navigate(`/planb/${id}?asOf=${asOf}`)}
                onBuildingClick={(id) => navigate(`/building/${id}?asOf=${asOf}`)}
              />
            ) : (
              <div className="flex h-48 items-center justify-center">
                <Spinner label="Loading network" />
              </div>
            )}
            <div className="mt-2 text-[11px] text-[#9CA3AF]">Loop layout is synthetic; plants and buildings are real.</div>
          </CardContent>
        </Card>

        <Card variant="outlined" className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span>Who loses cooling</span>
              <ProvenanceTag kind="ESTIMATE" />
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {!result ? (
              <div className="rounded-lg bg-[#F7F7F5] p-3 text-sm text-[#374151]">
                Press <span className="font-semibold">Simulate failure</span> to see the buildings on {segmentId} lose cooling in
                priority order — labs and patient care first.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[24px_1fr_auto_auto] gap-x-3 px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
                  <span>#</span>
                  <span>Building</span>
                  <span className="text-right">Chillers</span>
                  <span className="text-right">$/day</span>
                </div>
                {result.buildings.map((b, i) => {
                  const shown = i < revealed;
                  return (
                    <div
                      key={b.building_id}
                      className="grid grid-cols-[24px_1fr_auto_auto] items-center gap-x-3 rounded-md px-1 py-1.5 text-sm transition-opacity"
                      style={{ opacity: shown ? (b.staged ? 1 : 0.45) : 0.15 }}
                    >
                      <span className="tabular-nums text-[#6B7280]">{b.order}</span>
                      <span className="min-w-0">
                        <Link to={`/building/${b.building_id}?asOf=${asOf}`} className={`block truncate text-[#111827] hover:underline ${b.staged ? '' : 'line-through'}`}>
                          {b.name}
                        </Link>
                        <span className="text-xs text-[#6B7280]">
                          {CRITICALITY_LABEL[b.criticality] ?? b.criticality} · {Math.round(b.peak_load_tons)} tons
                          {b.staged ? '' : ' · not staged'}
                        </span>
                      </span>
                      <span className="text-right tabular-nums">{b.chillers_needed}</span>
                      <span className="text-right tabular-nums">{usd(b.cost_per_day_usd)}</span>
                    </div>
                  );
                })}
                <div className="mt-2 grid grid-cols-[24px_1fr_auto_auto] gap-x-3 border-t border-[#E5E7EB] px-1 pt-2 text-sm font-semibold">
                  <span />
                  <span>
                    Total · {result.totals.buildings} staged · load ×{result.load_factor.toFixed(2)} at {Math.round(result.temp_f)}°F
                  </span>
                  <span className="text-right tabular-nums">{done ? result.totals.chillers : '…'}</span>
                  <span className="text-right tabular-nums">{done ? usd(result.totals.cost_per_day_usd) : '…'}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-lg border border-[#E5E7EB] bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">This scenario</span>
            <ProvenanceTag kind="ESTIMATE" />
          </div>
          {result && done ? (
            <>
              <div className="text-[40px] font-semibold leading-none tabular-nums text-[#111827]">
                {usd(result.totals.cost_per_day_usd)}
                <span className="text-xl font-medium text-[#6B7280]">/day</span>
              </div>
              <div className="text-sm text-[#374151]">
                {result.totals.chillers} temporary chillers for {result.totals.buildings} buildings. One week of early warning
                avoids about <span className="font-semibold">{usd(result.totals.cost_per_week_usd)}</span> of rentals.
              </div>
            </>
          ) : (
            <div className="text-sm text-[#6B7280]">Run the simulation to size this loop&apos;s Plan B.</div>
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-[#111827] bg-[#F7F7F5] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Real June 2026 outage</span>
            <ProvenanceTag kind="REAL" />
          </div>
          <div className="text-[40px] font-semibold leading-none tabular-nums text-[#111827]">
            {ref ? usd(ref.total_usd) : '$15.8M'}
          </div>
          <div className="text-sm text-[#374151]">
            {ref
              ? `~${ref.chillers} rental chillers · ~${usd(ref.usd_per_day)}/day (our estimate) · ${ref.buildings_closed} buildings closed + ${ref.buildings_partial} partly · ${usd(ref.rental_usd)} of it was chiller rentals.`
              : '~30 rental chillers · ~$111K/day (our estimate) · 23 buildings closed + 11 partly · $10M of it was chiller rentals.'}
          </div>
          <div className="text-[11px] text-[#9CA3AF]">{ref?.source ?? 'Cap Times Oct 8 2026; WPR Jun 30 2026; UW News.'}</div>
        </div>
      </div>
    </div>
  );
}
