/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, Thermometer } from 'lucide-react';
import {
  REPLAY_END,
  REPLAY_START,
  dateAtIndex,
  dayIndex,
  formatDate,
  shiftDate,
  useAsOfContext,
} from '@/contexts/AsOfProvider';
import { ProvenanceTag } from '@/components/RiskChart/Tags';
import { fetchWeather } from '@/shared/api/shell';
import type { FailureEventRow, WeatherDay } from '@/Interfaces';

const LAST_INDEX = dayIndex(REPLAY_END);
/** Clicking a marker lands this many days before it, so the demo opens on the warning, not the failure. */
const MARKER_LEAD_DAYS = 8;
const PLAY_STEP_MS = 350;
const COMMIT_DELAY_MS = 180;

function weatherLabel(w: WeatherDay): string {
  if (w.label) return w.label;
  if (w.tmax_f != null && w.tmax_f >= 85) return 'heat';
  if (w.tmin_f != null && w.tmin_f <= 0) return 'cold snap';
  return 'normal';
}

function markerColor(e: FailureEventRow): string {
  return e.kind === 'real_reference' ? '#111827' : '#DC2626';
}

/** Failures and the real June 17 break get a tick on the track; decoys stay on the Backtest page. */
function isMarker(e: FailureEventRow): boolean {
  return e.kind === 'failure' || e.kind === 'real_reference';
}

/**
 * Global "as of" scrubber (docs/FRONTEND.md §4): replay Jan 1 → Aug 31 2026 one day at a time,
 * with clickable event markers and the real NOAA temperature for the selected day.
 */
export default function AsOfScrubber() {
  const { asOf, setAsOf, events } = useAsOfContext();
  const [draft, setDraft] = useState(dayIndex(asOf));
  const [playing, setPlaying] = useState(false);
  const [weather, setWeather] = useState<WeatherDay | null>(null);
  const commitTimer = useRef<number | undefined>(undefined);

  // Keep the thumb in sync when the date changes elsewhere (a page's date input, a marker click).
  useEffect(() => setDraft(dayIndex(asOf)), [asOf]);

  useEffect(() => {
    let cancelled = false;
    fetchWeather(asOf)
      .then((w) => {
        if (!cancelled) setWeather(w);
      })
      .catch(() => {
        if (!cancelled) setWeather(null);
      });
    return () => {
      cancelled = true;
    };
  }, [asOf]);

  useEffect(() => {
    if (!playing) return undefined;
    if (asOf >= REPLAY_END) {
      setPlaying(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setAsOf(shiftDate(asOf, 1)), PLAY_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [playing, asOf, setAsOf]);

  const onSlide = (index: number) => {
    setDraft(index);
    window.clearTimeout(commitTimer.current);
    commitTimer.current = window.setTimeout(() => setAsOf(dateAtIndex(index)), COMMIT_DELAY_MS);
  };

  const markers = events.filter(isMarker);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#E5E7EB] bg-white px-4 py-2">
      <div className="flex items-center gap-1">
        <span className="mr-1 text-xs font-medium uppercase tracking-wide text-[#6B7280]">As of</span>
        <button
          type="button"
          className="rounded p-1 text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-40"
          onClick={() => setAsOf(shiftDate(asOf, -1))}
          disabled={asOf <= REPLAY_START}
          aria-label="Previous day"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-[104px] text-center text-base font-semibold tabular-nums text-[#111827]">
          {formatDate(dateAtIndex(draft))}
        </span>
        <button
          type="button"
          className="rounded p-1 text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-40"
          onClick={() => setAsOf(shiftDate(asOf, 1))}
          disabled={asOf >= REPLAY_END}
          aria-label="Next day"
        >
          <ChevronRight className="size-4" />
        </button>
        <button
          type="button"
          className="ml-1 rounded p-1 text-[#374151] hover:bg-[#F3F4F6]"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? 'Pause replay' : 'Play replay'}
          title={playing ? 'Pause' : 'Replay one day at a time'}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
      </div>

      <div className="relative min-w-[280px] flex-1 pt-3">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-3">
          {markers.map((e) => {
            const left = (dayIndex(e.date) / LAST_INDEX) * 100;
            if (left < 0 || left > 100) return null;
            return (
              <button
                key={e.event_id}
                type="button"
                className="pointer-events-auto absolute -translate-x-1/2 rounded-sm"
                style={{ left: `${left}%`, width: 4, height: 12, backgroundColor: markerColor(e) }}
                title={`${formatDate(e.date)} · ${e.label}${e.synthetic ? ' (synthetic)' : ''} — click to jump ${MARKER_LEAD_DAYS} days earlier`}
                aria-label={`Jump to ${MARKER_LEAD_DAYS} days before ${e.label}`}
                onClick={() => {
                  setPlaying(false);
                  setAsOf(shiftDate(e.date, -MARKER_LEAD_DAYS));
                }}
              />
            );
          })}
        </div>
        <input
          type="range"
          min={0}
          max={LAST_INDEX}
          step={1}
          value={draft}
          onChange={(ev) => onSlide(Number(ev.target.value))}
          className="w-full accent-[#111827]"
          aria-label="As-of date"
        />
        <div className="flex justify-between text-[11px] text-[#9CA3AF]">
          <span>Jan</span>
          <span>Mar</span>
          <span>May</span>
          <span>Jul</span>
          <span>Aug 31</span>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-[#374151]" title={weather?.source ?? undefined}>
        <Thermometer className="size-4 text-[#6B7280]" />
        {weather && weather.tmax_f != null ? (
          <>
            <span className="font-semibold tabular-nums">{Math.round(weather.tmax_f)}°F</span>
            <span className="text-[#6B7280]">
              high · {weatherLabel(weather)}
              {weather.tmin_f != null ? ` · low ${Math.round(weather.tmin_f)}°F` : ''}
            </span>
            <ProvenanceTag kind="REAL" />
          </>
        ) : (
          <span className="text-[#6B7280]">No weather for this day</span>
        )}
      </div>
    </div>
  );
}
