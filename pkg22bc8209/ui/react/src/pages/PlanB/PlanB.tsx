/*
 * Outage plan (Plan B) — simulate a chilled-water loop failure (FRONTEND §5.5).
 *
 * `simulatePlanB(segment, tempF, priorityOnly)` answers "what happens if I don't?":
 * who loses cooling, in what order, how many rental chillers, $/day — beside the real
 * June 2026 outage. "Simulate failure" replays the dispatch: buildings on the loop go
 * dark one by one (250 ms each) while the table and the scenario totals fill in step.
 * Reduced-motion users get the finished state at once.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Building2, Network, Play, RotateCcw, ShieldAlert, Thermometer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useErrorReporter } from '@/components/ErrorBoundary/ErrorBoundary';
import PageHeader from '@/components/PageHeader/PageHeader';
import { Panel, PanelState } from '@/components/Panel/Panel';
import SnapshotBanner from '@/components/Panel/SnapshotBanner';
import Reorderable from '@/components/Reorderable/Reorderable';
import Schematic from '@/components/Schematic/Schematic';
import StatusPill from '@/components/StatusPill/StatusPill';
import { useAsOf } from '@/contexts/AsOfProvider';
import { errorMessage, formatDate, simulatePlanB, withAsOf, type PlanBResult } from '@/shared/api';
import LoadShedTable from './LoadShedTable';
import OutageComparison from './OutageComparison';

const TEMP_MIN_F = 55;
const TEMP_MAX_F = 105;
const HEAT_EMERGENCY_F = 95;
const DEFAULT_SEGMENT = 'S3';
const FALLBACK_SEGMENTS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
const REVEAL_STEP_MS = 250;
const FETCH_DEBOUNCE_MS = 250;
const ALL = Number.MAX_SAFE_INTEGER;

const clampTemp = (value: number) => Math.max(TEMP_MIN_F, Math.min(TEMP_MAX_F, Math.round(value)));

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function PlanB() {
  const { segment: segmentParam } = useParams<{ segment?: string }>();
  const navigate = useNavigate();
  const { reportError } = useErrorReporter();
  const { asOf, snapshot } = useAsOf();

  const segmentIds = useMemo(
    () => (snapshot ? snapshot.segments.map((s) => s.segment_id) : FALLBACK_SEGMENTS),
    [snapshot],
  );
  const segmentId = segmentParam && segmentIds.includes(segmentParam) ? segmentParam : DEFAULT_SEGMENT;
  const segment = snapshot?.segments.find((s) => s.segment_id === segmentId) ?? null;
  const plant = segment ? snapshot?.plants.find((p) => p.plant_id === segment.plant_id) ?? null : null;
  const segmentLabel = segment ? `${segment.segment_id} · ${segment.name}` : segmentId;
  const realHigh = snapshot?.weather ? clampTemp(snapshot.weather.tmax_f) : null;

  // Default to today's real high; the 95°F preset is the heat-emergency case.
  const [tempF, setTempF] = useState<number>(HEAT_EMERGENCY_F);
  const [tempTouched, setTempTouched] = useState(false);
  useEffect(() => {
    if (!tempTouched && realHigh != null) setTempF(realHigh);
  }, [realHigh, tempTouched]);
  const pickTemp = (value: number) => {
    setTempTouched(true);
    setTempF(clampTemp(value));
  };

  const [priorityOnly, setPriorityOnly] = useState(false);

  const [result, setResult] = useState<PlanBResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(
    (seg: string, temp: number, prio: boolean) => {
      requestSeq.current += 1;
      const seq = requestSeq.current;
      setLoading(true);
      simulatePlanB(seg, temp, prio)
        .then((data) => {
          if (seq !== requestSeq.current) return;
          setResult(data);
          setError(null);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (seq !== requestSeq.current) return;
          setError(errorMessage(err));
          setLoading(false);
          reportError(err);
        });
    },
    [reportError],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => load(segmentId, tempF, priorityOnly), FETCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [segmentId, tempF, priorityOnly, load]);

  // Reveal: `revealed` counts dispatched buildings; ALL means the finished state.
  const total = result?.buildings.length ?? 0;
  const [revealed, setRevealed] = useState<number>(ALL);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (!animating) return undefined;
    if (revealed >= total) {
      setAnimating(false);
      setRevealed(ALL);
      return undefined;
    }
    const timer = window.setTimeout(() => setRevealed((prev) => prev + 1), REVEAL_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [animating, revealed, total]);

  const simulate = () => {
    if (!result) return;
    if (prefersReducedMotion()) {
      setRevealed(ALL);
      return;
    }
    setRevealed(0);
    setAnimating(true);
  };

  const shown = Math.min(revealed, total);
  const complete = !animating && shown >= total;

  const darkened = useMemo(
    () => (result ? result.buildings.slice(0, shown).map((b) => b.building_id) : []),
    [result, shown],
  );
  const running = useMemo(() => {
    const staged = result ? result.buildings.slice(0, shown).filter((b) => b.staged) : [];
    return {
      buildings: staged.length,
      chillers: staged.reduce((sum, b) => sum + b.chillers_needed, 0),
      cost_per_day_usd: staged.reduce((sum, b) => sum + b.cost_per_day_usd, 0),
    };
  }, [result, shown]);

  const tempFill = ((tempF - TEMP_MIN_F) / (TEMP_MAX_F - TEMP_MIN_F)) * 100;

  return (
    <div className="flex min-h-full flex-col gap-5 p-6 xl:px-8">
      <PageHeader
        eyebrow="What happens if I don’t?"
        title="Outage plan"
        icon={<ShieldAlert />}
        description="If a chilled-water loop fails: who loses cooling, in what order, how many rental chillers, and what it costs per day — next to what the real June 2026 outage cost."
        meta={[
          <>
            As of <span className="font-semibold text-[var(--bib-ink)]">{formatDate(asOf)}</span>
          </>,
          plant ? `${segmentLabel} fed from ${plant.name}` : segmentLabel,
        ]}
        actions={
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Loop segment">
            {segmentIds.map((id) => {
              const seg = snapshot?.segments.find((s) => s.segment_id === id);
              const active = id === segmentId;
              return (
                <Button
                  key={id}
                  variant={active ? 'solid' : 'outline'}
                  appearance="secondary"
                  size="md"
                  aria-pressed={active}
                  onClick={() => navigate(`/planb/${id}`)}
                  className="gap-2"
                >
                  {seg ? (
                    <span data-status={seg.worst_status} className="inline-block size-2 rounded-full bg-[var(--bib-status-color)]" aria-hidden />
                  ) : null}
                  {id}
                  {seg ? (
                    <span className={cn('text-[13px] font-normal', active ? 'opacity-80' : 'text-[var(--bib-ink-muted)]')}>
                      {seg.name}
                    </span>
                  ) : null}
                </Button>
              );
            })}
          </div>
        }
      />

      <SnapshotBanner />

      <div className="bib-card p-4 md:p-5">
        <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div className="flex flex-col gap-2">
            <label htmlFor="bib-temp" className="bib-eyebrow inline-flex items-center gap-1.5">
              <Thermometer className="size-3.5" aria-hidden /> Outdoor temperature
            </label>
            <div className="flex items-center gap-4">
              <input
                id="bib-temp"
                type="range"
                min={TEMP_MIN_F}
                max={TEMP_MAX_F}
                step={1}
                value={tempF}
                onChange={(event) => pickTemp(Number(event.target.value))}
                aria-valuetext={`${tempF}°F`}
                style={{ '--bib-range-fill': `${tempFill}%` } as React.CSSProperties}
                className="bib-range flex-1"
              />
              <span className="bib-num w-[92px] text-right text-[32px] font-semibold leading-9 text-[var(--bib-ink)]">{tempF}°F</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {realHigh != null ? (
                <Button
                  size="sm"
                  variant={tempF === realHigh ? 'soft' : 'outline'}
                  appearance="secondary"
                  onClick={() => pickTemp(realHigh)}
                  className="gap-1.5"
                >
                  Today&apos;s real high · {realHigh}°F
                </Button>
              ) : null}
              <Button
                size="sm"
                variant={tempF === HEAT_EMERGENCY_F ? 'soft' : 'outline'}
                appearance="secondary"
                onClick={() => pickTemp(HEAT_EMERGENCY_F)}
              >
                {HEAT_EMERGENCY_F}°F heat emergency
              </Button>
              {result ? (
                <span className="text-[13px] leading-4 text-[var(--bib-ink-muted)]">
                  load factor {result.load_factor.toFixed(2)} · one 400-ton rental chiller per 400 tons of load
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-[6px] border border-[var(--bib-border)] bg-[var(--bib-canvas)] px-4 py-3">
            <Switch id="bib-priority" size="lg" checked={priorityOnly} onCheckedChange={setPriorityOnly} />
            <label htmlFor="bib-priority" className="cursor-pointer text-[16px] leading-5 text-[var(--bib-ink)]">
              Stage priority buildings only
              <span className="block text-[13px] leading-4 text-[var(--bib-ink-muted)]">
                Labs and patient care first; instruction and office wait
              </span>
            </label>
          </div>

          <Button
            size="lg"
            variant="solid"
            appearance="accent"
            leadingIcon={animating ? <RotateCcw className="animate-spin" /> : <Play />}
            onClick={simulate}
            disabled={!result || animating}
            className="min-w-[200px]"
          >
            {animating ? 'Dispatching…' : 'Simulate failure'}
          </Button>
        </div>
      </div>

      {error && !result ? (
        <PanelState state="error" message={error} onRetry={() => load(segmentId, tempF, priorityOnly)} />
      ) : null}

      <div className={cn('transition-opacity', loading && result ? 'opacity-70' : 'opacity-100')}>
        <Reorderable
          storageKey="planb"
          className="grid gap-5 xl:grid-cols-2"
          items={[
            {
              id: 'comparison',
              className: 'xl:col-span-2',
              node: (
                <OutageComparison
                  result={result}
                  loading={loading && !result}
                  running={running}
                  tempF={tempF}
                  segmentLabel={segmentLabel}
                  priorityOnly={priorityOnly}
                  complete={complete}
                />
              ),
            },
            {
              id: 'loop',
              className: 'xl:col-span-2',
              node: (
                <Panel
                  title={segmentLabel}
                  subtitle={plant ? `Fed from ${plant.name}. Dots go dark as buildings lose cooling.` : 'Buildings lose cooling in dispatch order'}
                  icon={<Network />}
                  actions={segment ? <StatusPill status={segment.worst_status} size="sm" /> : undefined}
                  className="h-full"
                >
                  {snapshot ? (
                    <Schematic
                      plants={snapshot.plants}
                      segments={snapshot.segments}
                      buildings={snapshot.buildings}
                      focusSegment={segmentId}
                      highlightSegment={segmentId}
                      darkened={darkened}
                      onBuildingClick={(buildingId) => navigate(withAsOf(`/building/${buildingId}`, asOf))}
                      showLegend={false}
                    />
                  ) : (
                    <PanelState state="loading" lines={3} />
                  )}
                </Panel>
              ),
            },
            {
              id: 'who',
              className: 'xl:col-span-2',
              node: (
                <Panel
                  title="Who loses cooling"
                  subtitle="Dispatch order: labs and patient care first, then by peak load"
                  icon={<Building2 />}
                  className="h-full"
                  contentClassName="-mx-4 -mb-4 overflow-x-auto"
                >
                  {result ? (
                    <LoadShedTable rows={result.buildings} shown={shown} totals={result.totals} priorityOnly={result.priority_only} />
                  ) : (
                    <div className="px-4 pb-4">
                      <PanelState state="loading" lines={6} />
                    </div>
                  )}
                </Panel>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
