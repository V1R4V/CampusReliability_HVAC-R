/*
 * DateScrubber — the global as-of control in the top bar (FRONTEND §4).
 *
 * A day-step slider over the replay window (Jan 1 → Aug 31 2026) with ◀ ▶ steppers,
 * Play, and event markers from `events()`: planted failures as red ticks, the real
 * June 17 break as a black tick labelled "Real break". Clicking a marker lands
 * MARKER_LEAD_DAYS before the event, so the demo shows the warning, not the failure.
 */

import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipSubtitle,
  TooltipText,
  TooltipTitle,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAsOf } from '@/contexts/AsOfProvider';
import {
  MARKER_LEAD_DAYS,
  MONTH_TICKS,
  REPLAY_DAYS,
  REPLAY_END,
  REPLAY_START,
  addDays,
  dayIndexOf,
  formatDate,
  isoFromDayIndex,
  type FailureEvent,
} from '@/shared/api';

interface Marker {
  date: string;
  index: number;
  kind: 'failure' | 'real_reference';
  events: FailureEvent[];
}

/** Horizontal position inside the track's thumb-travel band (the 10px insets). */
const positionOf = (index: number) => `${(index / (REPLAY_DAYS - 1)) * 100}%`;

export default function DateScrubber() {
  const { asOf, setAsOf, stepDay, events, eventsError, jumpToEvent, playing, togglePlay } = useAsOf();
  const index = dayIndexOf(asOf);
  const atStart = index <= 0;
  const atEnd = index >= REPLAY_DAYS - 1;

  // Failures and the real reference share a date (F4 + R1 on Jun 17) — merge per day.
  const markers = useMemo<Marker[]>(() => {
    const byDate = new Map<string, Marker>();
    events.forEach((event) => {
      if (event.kind !== 'failure' && event.kind !== 'real_reference') return;
      if (event.date < REPLAY_START || event.date > REPLAY_END) return;
      const marker = byDate.get(event.date) ?? {
        date: event.date,
        index: dayIndexOf(event.date),
        kind: 'failure' as const,
        events: [],
      };
      marker.events.push(event);
      if (event.kind === 'real_reference') marker.kind = 'real_reference';
      byDate.set(event.date, marker);
    });
    return Array.from(byDate.values()).sort((a, b) => a.index - b.index);
  }, [events]);

  return (
    <div className="flex w-full max-w-[980px] items-center gap-2">
      <Button
        variant="ghost"
        appearance="secondary"
        size="icon-md"
        aria-label="Previous day"
        onClick={() => stepDay(-1)}
        disabled={atStart}
      >
        <ChevronLeft />
      </Button>

      <div className="relative min-w-0 flex-1 pb-4 pt-7">
        {/* Event markers: a quiet tick per planted failure, a labelled flag for the real break. */}
        <div className="absolute inset-x-[10px] top-0 h-7">
          {eventsError && markers.length === 0 ? (
            <span className="absolute left-0 top-2 text-[12px] leading-5 text-[var(--bib-ink-muted)]">
              Event markers unavailable
            </span>
          ) : null}
          {markers.map((marker) => {
            const real = marker.kind === 'real_reference';
            const landing = addDays(marker.date, -MARKER_LEAD_DAYS);
            return (
              <Tooltip key={marker.date}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => jumpToEvent(marker.events[0])}
                    style={{ left: positionOf(marker.index) }}
                    aria-label={`${marker.events.map((e) => e.label).join('; ')}, ${formatDate(marker.date)}. Jump to ${formatDate(landing)}`}
                    className="absolute top-0 flex h-7 w-6 -translate-x-1/2 flex-col items-center justify-end rounded-sm outline-none hover:bg-[var(--c3-style-basic-bg-hover)] focus-visible:shadow-[0_0_0_2px_var(--c3-style-shadow-ring-accent)]"
                  >
                    {real ? (
                      <span
                        aria-hidden
                        className="mb-0.5 whitespace-nowrap rounded-[3px] bg-[var(--bib-ink)] px-1.5 text-[10px] font-semibold uppercase leading-4 tracking-[0.06em] text-white"
                      >
                        Real break
                      </span>
                    ) : null}
                    <span
                      aria-hidden
                      className={cn(
                        'block w-[2px] rounded-t-sm',
                        real ? 'h-2.5 bg-[var(--bib-ink)]' : 'h-2.5 bg-[var(--bib-status-due)] opacity-80',
                      )}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <TooltipText>
                    {marker.events.map((event) => (
                      <TooltipTitle key={event.event_id}>{event.label}</TooltipTitle>
                    ))}
                    <TooltipSubtitle>
                      {formatDate(marker.date)} · click to land on {formatDate(landing)} ({MARKER_LEAD_DAYS} days earlier)
                    </TooltipSubtitle>
                  </TooltipText>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <label htmlFor="bib-asof-range" className="sr-only">
          As-of date
        </label>
        <input
          id="bib-asof-range"
          type="range"
          min={0}
          max={REPLAY_DAYS - 1}
          step={1}
          value={index}
          onChange={(event) => setAsOf(isoFromDayIndex(Number(event.target.value)))}
          aria-valuetext={formatDate(asOf)}
          className="bib-range relative z-10 block"
        />

        <div aria-hidden className="pointer-events-none absolute inset-x-[10px] bottom-0 h-4">
          {MONTH_TICKS.map((tick) => (
            <span
              key={tick.iso}
              style={{ left: positionOf(tick.index) }}
              className="absolute -translate-x-1/2 whitespace-nowrap text-[12px] leading-4 text-[var(--bib-ink-muted)] max-xl:even:hidden"
            >
              {tick.label}
            </span>
          ))}
        </div>
      </div>

      <Button variant="ghost" appearance="secondary" size="icon-md" aria-label="Next day" onClick={() => stepDay(1)} disabled={atEnd}>
        <ChevronRight />
      </Button>

      <div className="min-w-[128px] text-right">
        <div className="text-[12px] font-semibold uppercase leading-4 tracking-[0.06em] text-[var(--bib-ink-muted)]">As of</div>
        <div className="text-[18px] font-semibold leading-6 text-[var(--bib-ink)]">{formatDate(asOf)}</div>
      </div>

      <Button
        variant="outline"
        appearance="secondary"
        size="md"
        leadingIcon={playing ? <Pause /> : <Play />}
        onClick={togglePlay}
        disabled={!playing && atEnd}
        aria-pressed={playing}
      >
        {playing ? 'Pause' : 'Play'}
      </Button>
    </div>
  );
}
