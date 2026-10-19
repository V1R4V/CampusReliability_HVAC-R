/*
 * AlertTimeline — alerts vs. actual failures on one Jan–Aug 2026 calendar (FRONTEND §5.7,
 * the Backtest's story chart). One row per planted failure: a grey span from the planted
 * onset to the first "inspection due" day (degrading, not yet flagged), a red span from
 * that flag to the failure (the warning we had), a black ✕ on the failure day and the lead
 * time written beside it. Decoys sit on their own row with a ✓ where the pipeline ignored
 * them; the real June 17 break is the black reference row, as on the scrubber; the dashed
 * line is the app's global as-of date, so landing on Jun 9 puts the cursor on the flag.
 *
 * Colour means status only: red = INSPECTION_DUE, black = FAILED, grey = not a status.
 * Positioned by day index in HTML/CSS (no measuring, crisp on a projector). Every key mark
 * is a focusable link with a tooltip; the failures table under the chart is its table view.
 */

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Check, TriangleAlert, X } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipSubtitle,
  TooltipText,
  TooltipTitle,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import ProvenanceChip from '@/components/ProvenanceChip/ProvenanceChip';
import SystemIcon, { systemLabel } from '@/components/SystemIcon/SystemIcon';
import {
  MONTH_TICKS,
  REPLAY_DAYS,
  clampDate,
  dayIndexOf,
  daysBetween,
  formatDate,
  formatThreshold,
  withAsOf,
  type BacktestDecoy,
  type BacktestFailure,
  type FailureEvent,
} from '@/shared/api';
import { REAL_OUTAGE, formatRealUsd } from './realOutage';

/** Labels and tracks share one row height so the two columns stay aligned. */
const ROW = 'h-11';
const LABEL_COL = 'w-[272px]';
const ONE_DAY_PCT = 100 / (REPLAY_DAYS - 1);

/** Where a date sits on the Jan 1 → Aug 31 track, in percent. */
function pct(iso: string): number {
  return (dayIndexOf(clampDate(iso)) / (REPLAY_DAYS - 1)) * 100;
}

/** A bar between two dates — at least a day wide so a one-day span is still visible. */
function span(from: string, to: string): React.CSSProperties {
  const a = pct(from);
  const b = pct(to);
  return { left: `${Math.min(a, b)}%`, width: `${Math.max(Math.abs(b - a), ONE_DAY_PCT)}%` };
}

function at(iso: string): React.CSSProperties {
  return { left: `${pct(iso)}%` };
}

/** Keep a centred label inside the track near either edge. */
function anchorClass(position: number): string {
  if (position < 6) return 'translate-x-0';
  if (position > 94) return '-translate-x-full';
  return '-translate-x-1/2';
}

interface FailureRow {
  failure: BacktestFailure;
  event: FailureEvent | null;
  highlighted: boolean;
}

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] leading-4 text-[var(--bib-ink-muted)]">
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden className="inline-block h-1.5 w-5 rounded-full bg-[var(--bib-axis)]/50" />
        Planted degradation, not yet flagged
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden className="inline-block h-2.5 w-5 rounded-full bg-[var(--bib-status-due)]" />
        Inspection due → warning time
      </li>
      <li className="inline-flex items-center gap-1.5">
        <X aria-hidden className="size-3.5 text-[var(--bib-status-failed)]" strokeWidth={3} />
        Failure
      </li>
      <li className="inline-flex items-center gap-1.5">
        <Check aria-hidden className="size-3.5" strokeWidth={3} />
        Decoy ignored
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden className="inline-block h-1.5 w-5 rounded-full bg-[var(--bib-status-failed)]/70" />
        Real outage
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden className="inline-block h-4 w-px border-l border-dashed border-[var(--bib-ink)]" />
        As-of date
      </li>
    </ul>
  );
}

function FailureLabel({ row, asOf }: { row: FailureRow; asOf: string }) {
  const { failure, event, highlighted } = row;
  return (
    <div className={cn(ROW, 'flex min-w-0 flex-col justify-center pr-3')}>
      <div className="flex min-w-0 items-center gap-1.5 text-[15px] leading-5">
        <SystemIcon system={failure.system} size="sm" />
        <Link
          to={withAsOf(`/asset/${failure.asset_id}`, asOf)}
          className="truncate font-semibold text-[var(--bib-ink)] underline-offset-2 hover:underline"
        >
          {failure.asset_id}
        </Link>
        <span className="shrink-0 text-[13px] text-[var(--bib-ink-muted)]">{failure.event_id}</span>
      </div>
      <div
        className={cn(
          'truncate text-[13px] leading-4',
          highlighted ? 'font-medium text-[var(--bib-ink)]' : 'text-[var(--bib-ink-muted)]',
        )}
      >
        {event?.label ?? `${systemLabel(failure.system)} failure`}
      </div>
    </div>
  );
}

function FailureTrack({ row, threshold, asOf }: { row: FailureRow; threshold: number; asOf: string }) {
  const { failure, event, highlighted } = row;
  const flagged = failure.first_due_date != null && failure.lead_days != null;
  const onset = event?.onset_date ?? null;
  const flagOrFail = flagged ? failure.first_due_date : failure.failure_date;
  const warning = flagged
    ? `${failure.asset_id} flagged inspection due on ${formatDate(failure.first_due_date)}, ${failure.lead_days} days before it failed on ${formatDate(failure.failure_date)}`
    : `${failure.asset_id} failed on ${formatDate(failure.failure_date)} with no inspection-due warning at threshold ${formatThreshold(threshold)}`;

  return (
    <div className={cn(ROW, 'relative', highlighted && 'rounded-md bg-[var(--bib-status-due-soft)]/60')}>
      {onset ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              aria-hidden
              className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--bib-axis)]/50"
              style={span(onset, flagOrFail)}
            />
          </TooltipTrigger>
          <TooltipContent side="top">
            <TooltipText>
              <TooltipTitle>Planted degradation begins</TooltipTitle>
              <TooltipSubtitle>
                {formatDate(onset)} → {flagged ? `flagged ${formatDate(failure.first_due_date)}` : `failed ${formatDate(failure.failure_date)}`}
                {' · '}
                {daysBetween(onset, flagOrFail)} days drifting
              </TooltipSubtitle>
            </TooltipText>
          </TooltipContent>
        </Tooltip>
      ) : null}

      {flagged ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to={withAsOf(`/asset/${failure.asset_id}`, asOf)}
              className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full bg-[var(--bib-status-due)] outline-none hover:brightness-95 focus-visible:shadow-[0_0_0_2px_var(--c3-style-shadow-ring-accent)]"
              style={span(failure.first_due_date, failure.failure_date)}
            >
              <span className="sr-only">{warning}</span>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="top">
            <TooltipText>
              <TooltipTitle>
                {failure.asset_id} · {failure.lead_days} days of warning
              </TooltipTitle>
              <TooltipSubtitle>
                Inspection due {formatDate(failure.first_due_date)} → failed {formatDate(failure.failure_date)} · threshold{' '}
                {formatThreshold(threshold)}
                {failure.energy_over_expected_pct_at_flag != null
                  ? ` · energy +${failure.energy_over_expected_pct_at_flag.toFixed(1)}% over normal at the flag`
                  : ''}
              </TooltipSubtitle>
            </TooltipText>
          </TooltipContent>
        </Tooltip>
      ) : null}

      <span aria-hidden className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={at(failure.failure_date)}>
        <X className="size-4 text-[var(--bib-status-failed)]" strokeWidth={3} />
      </span>

      <span
        aria-hidden
        className={cn(
          'absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[13px] font-semibold leading-4 tabular-nums',
          flagged ? 'text-[var(--bib-ink)]' : 'text-[var(--bib-status-due)]',
        )}
        style={{ left: `calc(${pct(failure.failure_date)}% + 12px)` }}
      >
        {flagged ? `${failure.lead_days} d` : `Missed at ${formatThreshold(threshold)}`}
      </span>
    </div>
  );
}

interface DecoyMark {
  decoy: BacktestDecoy;
  event: FailureEvent;
}

function DecoyMarker({ mark, asOf }: { mark: DecoyMark; asOf: string }) {
  const { decoy, event } = mark;
  const glyph = (
    <span
      className={cn(
        'inline-flex size-5 items-center justify-center rounded-full border bg-[var(--bib-surface)]',
        decoy.ignored
          ? 'border-[var(--bib-axis)] text-[var(--bib-ink-muted)]'
          : 'border-[var(--bib-status-due)] text-[var(--bib-status-due)]',
      )}
    >
      {decoy.ignored ? <Check className="size-3" strokeWidth={3} aria-hidden /> : <TriangleAlert className="size-3" aria-hidden />}
    </span>
  );
  const text = `${decoy.label} (${decoy.event_id}) on ${formatDate(event.date)} — ${decoy.ignored ? 'ignored' : 'flagged'}: ${decoy.reason}`;
  const positioned = 'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 outline-none focus-visible:shadow-[0_0_0_2px_var(--c3-style-shadow-ring-accent)] rounded-full';

  return (
    <>
      {event.onset_date ? (
        <span
          aria-hidden
          className="absolute top-1/2 border-t-2 border-dotted border-[var(--bib-axis)]"
          style={span(event.onset_date, event.date)}
        />
      ) : null}
      <Tooltip>
        <TooltipTrigger asChild>
          {event.asset_id ? (
            <Link to={withAsOf(`/asset/${event.asset_id}`, asOf)} className={positioned} style={at(event.date)}>
              {glyph}
              <span className="sr-only">{text}</span>
            </Link>
          ) : (
            <span aria-hidden className={positioned} style={at(event.date)}>
              {glyph}
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent side="top">
          <TooltipText>
            <TooltipTitle>
              {decoy.label} · {decoy.ignored ? 'ignored' : 'flagged'}
            </TooltipTitle>
            <TooltipSubtitle>
              {event.onset_date ? `${formatDate(event.onset_date)} → ` : ''}
              {formatDate(event.date)}
              {event.asset_id ? ` · ${event.asset_id}` : ' · every cooling asset'} · {decoy.reason}
            </TooltipSubtitle>
          </TooltipText>
        </TooltipContent>
      </Tooltip>
    </>
  );
}

export interface AlertTimelineProps {
  failures: BacktestFailure[];
  decoys: BacktestDecoy[];
  /** `events()` — onset dates, decoy dates and the real reference. May still be loading. */
  events: FailureEvent[];
  threshold: number;
  asOf: string;
  /** Asset behind the real reference event (R1); its row is emphasised. */
  highlightAssetId: string | null;
}

export default function AlertTimeline({ failures, decoys, events, threshold, asOf, highlightAssetId }: AlertTimelineProps) {
  const eventsById = useMemo(() => new Map(events.map((e) => [e.event_id, e] as const)), [events]);

  const rows = useMemo<FailureRow[]>(
    () =>
      [...failures]
        .sort((a, b) => a.failure_date.localeCompare(b.failure_date))
        .map((failure) => ({
          failure,
          event: eventsById.get(failure.event_id) ?? null,
          highlighted: highlightAssetId != null && failure.asset_id === highlightAssetId,
        })),
    [failures, eventsById, highlightAssetId],
  );

  const decoyMarks = useMemo<DecoyMark[]>(
    () =>
      decoys
        .map((decoy) => ({ decoy, event: eventsById.get(decoy.event_id) }))
        .filter((mark): mark is DecoyMark => mark.event != null && mark.event.kind === 'decoy')
        .sort((a, b) => a.event.date.localeCompare(b.event.date)),
    [decoys, eventsById],
  );
  const ignoredCount = decoys.filter((d) => d.ignored).length;

  const realBreak = useMemo(() => events.find((e) => e.kind === 'real_reference') ?? null, [events]);
  const realStart = realBreak?.date ?? REAL_OUTAGE.start_date;
  const realEnd = realBreak?.end_date ?? REAL_OUTAGE.reopen_date;
  const asOfPosition = pct(asOf);

  if (rows.length === 0) {
    return <p className="text-[15px] text-[var(--bib-ink-muted)]">No planted failures in this run.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <Legend />

      <div className="flex gap-3">
        {/* Labels column — row heights mirror the tracks exactly. */}
        <div className={cn(LABEL_COL, 'flex shrink-0 flex-col')}>
          <div className="h-4" aria-hidden />
          {rows.map((row) => (
            <FailureLabel key={row.failure.event_id} row={row} asOf={asOf} />
          ))}
          <div className={cn(ROW, 'flex flex-col justify-center pr-3')}>
            <div className="text-[15px] font-semibold leading-5 text-[var(--bib-ink)]">Decoys</div>
            <div className="text-[13px] leading-4 text-[var(--bib-ink-muted)]">
              {decoys.length === 0 ? 'None in this run' : `${ignoredCount} of ${decoys.length} ignored by design`}
            </div>
          </div>
          <div className={cn(ROW, 'flex flex-col justify-center pr-3')}>
            <div className="flex items-center gap-2 text-[15px] font-semibold leading-5 text-[var(--bib-ink)]">
              Real break
              <ProvenanceChip kind="REAL" size="sm" title={REAL_OUTAGE.source} />
            </div>
            <div className="truncate text-[13px] leading-4 text-[var(--bib-ink-muted)]">
              {formatRealUsd(REAL_OUTAGE.total_usd)} · {REAL_OUTAGE.buildings_closed} closed · {REAL_OUTAGE.buildings_partial} partly ·{' '}
              {daysBetween(realStart, realEnd)} days
            </div>
          </div>
          <div className="h-5" aria-hidden />
        </div>

        {/* Tracks column */}
        <div className="relative min-w-0 flex-1">
          <div aria-hidden className="relative h-4">
            <span
              className={cn(
                'absolute whitespace-nowrap text-[12px] font-semibold leading-4 text-[var(--bib-ink)]',
                anchorClass(asOfPosition),
              )}
              style={at(asOf)}
            >
              as of {formatDate(asOf, { year: false })}
            </span>
          </div>

          <div className="relative">
            <div aria-hidden className="pointer-events-none absolute inset-0">
              {MONTH_TICKS.map((tick) => (
                <span key={tick.iso} className="absolute inset-y-0 w-px bg-[var(--bib-grid)]" style={at(tick.iso)} />
              ))}
              <span className="absolute inset-y-0 w-px border-l border-dashed border-[var(--bib-ink)]" style={at(asOf)} />
            </div>

            {rows.map((row) => (
              <FailureTrack key={row.failure.event_id} row={row} threshold={threshold} asOf={asOf} />
            ))}

            <div className={cn(ROW, 'relative')}>
              {decoyMarks.length === 0 ? (
                <span className="absolute inset-y-0 left-0 flex items-center text-[13px] text-[var(--bib-ink-muted)]">
                  {decoys.length === 0 ? '' : 'Decoy dates unavailable — see the list beside this chart.'}
                </span>
              ) : (
                decoyMarks.map((mark) => <DecoyMarker key={mark.decoy.event_id} mark={mark} asOf={asOf} />)
              )}
            </div>

            <div className={cn(ROW, 'relative')}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    aria-hidden
                    className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--bib-status-failed)]/70"
                    style={span(realStart, realEnd)}
                  />
                </TooltipTrigger>
                <TooltipContent side="top">
                  <TooltipText>
                    <TooltipTitle>{realBreak?.label ?? REAL_OUTAGE.label}</TooltipTitle>
                    <TooltipSubtitle>
                      {formatDate(realStart)} → reopened {formatDate(realEnd)} ({daysBetween(realStart, realEnd)} days) ·{' '}
                      {REAL_OUTAGE.buildings_closed} buildings closed, {REAL_OUTAGE.buildings_partial} partly ·{' '}
                      {formatRealUsd(REAL_OUTAGE.total_usd)}
                    </TooltipSubtitle>
                  </TooltipText>
                </TooltipContent>
              </Tooltip>
              <span
                aria-hidden
                className="absolute top-1/2 h-6 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-sm bg-[var(--bib-status-failed)]"
                style={at(realStart)}
              />
            </div>
          </div>

          <div aria-hidden className="relative h-5">
            {MONTH_TICKS.map((tick, index) => (
              <span
                key={tick.iso}
                className={cn('absolute text-[13px] leading-5 text-[var(--bib-ink-muted)]', index === 0 ? '' : '-translate-x-1/2')}
                style={at(tick.iso)}
              >
                {tick.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
