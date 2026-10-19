/*
 * Global as-of state for Before It Breaks (owner: Arnav).
 *
 * One `asOf` date for the whole app, set by the TopNav scrubber; every page re-reads
 * data for it (FRONTEND §3). The provider also owns the campus snapshot for that date
 * (so the shell's weather chip, the Overview and the Buildings index share one
 * `campusSnapshot(asOf)` call), the failure-event markers, the Backtest threshold,
 * the Overview system filter, and the Play loop.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useErrorReporter } from '@/components/ErrorBoundary/ErrorBoundary';
import {
  DEFAULT_AS_OF,
  DEFAULT_THRESHOLD,
  MARKER_LEAD_DAYS,
  REPLAY_END,
  addDays,
  campusSnapshot,
  clampDate,
  errorMessage,
  events as fetchEvents,
  type CampusSnapshot,
  type FailureEvent,
  type SnapshotBuilding,
  type SnapshotPlant,
  type SnapshotSegment,
  type System,
} from '@/shared/api';

export type SystemFilter = 'all' | System;

export interface AsOfContextValue {
  /** ISO date the whole app is "as of" — always inside the replay window. */
  asOf: string;
  setAsOf: (iso: string) => void;
  /** Step by ±n days (clamped to the window). */
  stepDay: (days: number) => void;
  /** Land `MARKER_LEAD_DAYS` before an event, so the demo shows the warning, not the break. */
  jumpToEvent: (event: FailureEvent) => void;
  /** Play advances one day every 300 ms until the end of the window. */
  playing: boolean;
  togglePlay: () => void;
  /** Inspection threshold; changed only on the Backtest page (default 3.0). */
  threshold: number;
  setThreshold: (threshold: number) => void;
  /** Overview queue filter — persists across navigation. */
  systemFilter: SystemFilter;
  setSystemFilter: (filter: SystemFilter) => void;
  /** `events()` — loaded once; scrubber markers + charts. */
  events: FailureEvent[];
  eventsLoading: boolean;
  eventsError: string | null;
  reloadEvents: () => void;
  /** `campusSnapshot(asOf)`. The previous snapshot is kept while a new date loads. */
  snapshot: CampusSnapshot | null;
  snapshotLoading: boolean;
  snapshotError: string | null;
  refreshSnapshot: () => void;
  buildingsById: Map<string, SnapshotBuilding>;
  segmentsById: Map<string, SnapshotSegment>;
  plantsById: Map<string, SnapshotPlant>;
  /** Queue rows whose work order is awaiting approval (side-nav badge, KPI sub-line). */
  pendingWorkOrders: number;
}

const AS_OF_STORAGE_KEY = 'bib.asOf';
const PLAY_INTERVAL_MS = 300;
const SNAPSHOT_DEBOUNCE_MS = 150;

function readStoredAsOf(): string {
  try {
    const stored = window.sessionStorage.getItem(AS_OF_STORAGE_KEY);
    if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) return clampDate(stored);
  } catch {
    // sessionStorage can be unavailable (private mode, blocked storage) — use the demo default.
  }
  return DEFAULT_AS_OF;
}

const AsOfContext = createContext<AsOfContextValue | null>(null);

export function AsOfProvider({ children }: { children: React.ReactNode }) {
  const { reportError } = useErrorReporter();

  const [asOf, setAsOfState] = useState<string>(readStoredAsOf);
  const [playing, setPlaying] = useState(false);
  const [threshold, setThreshold] = useState<number>(DEFAULT_THRESHOLD);
  const [systemFilter, setSystemFilter] = useState<SystemFilter>('all');

  const [events, setEvents] = useState<FailureEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [snapshot, setSnapshot] = useState<CampusSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  // Guards against setState after unmount and against out-of-order responses while scrubbing.
  const alive = useRef(true);
  const asOfRef = useRef(asOf);
  const snapshotSeq = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    asOfRef.current = asOf;
    try {
      window.sessionStorage.setItem(AS_OF_STORAGE_KEY, asOf);
    } catch {
      // Storage failures are not worth surfacing — the date still works for this session.
    }
  }, [asOf]);

  const setAsOf = useCallback((iso: string) => setAsOfState(clampDate(iso)), []);
  const stepDay = useCallback((days: number) => setAsOfState((prev) => clampDate(addDays(prev, days))), []);
  const jumpToEvent = useCallback((event: FailureEvent) => {
    setPlaying(false);
    setAsOfState(clampDate(addDays(event.date, -MARKER_LEAD_DAYS)));
  }, []);
  const togglePlay = useCallback(() => setPlaying((prev) => !prev), []);

  // Play loop: one day per tick, stops at the end of the window.
  useEffect(() => {
    if (!playing) return undefined;
    const id = window.setInterval(() => {
      const next = addDays(asOfRef.current, 1);
      if (next > REPLAY_END) {
        setPlaying(false);
        return;
      }
      setAsOfState(next);
    }, PLAY_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [playing]);

  const loadEvents = useCallback(() => {
    setEventsLoading(true);
    fetchEvents()
      .then((list) => {
        if (!alive.current) return;
        setEvents(list);
        setEventsError(null);
        setEventsLoading(false);
      })
      .catch((err: unknown) => {
        if (!alive.current) return;
        setEventsError(errorMessage(err));
        setEventsLoading(false);
        reportError(err);
      });
  }, [reportError]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const loadSnapshot = useCallback(
    (date: string) => {
      snapshotSeq.current += 1;
      const seq = snapshotSeq.current;
      setSnapshotLoading(true);
      campusSnapshot(date)
        .then((data) => {
          if (!alive.current || seq !== snapshotSeq.current) return;
          setSnapshot(data);
          setSnapshotError(null);
          setSnapshotLoading(false);
        })
        .catch((err: unknown) => {
          if (!alive.current || seq !== snapshotSeq.current) return;
          setSnapshotError(errorMessage(err));
          setSnapshotLoading(false);
          reportError(err);
        });
    },
    [reportError],
  );

  // Debounced so dragging the scrubber doesn't fire a compute per pixel.
  useEffect(() => {
    const timer = window.setTimeout(() => loadSnapshot(asOf), SNAPSHOT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [asOf, loadSnapshot]);

  const refreshSnapshot = useCallback(() => loadSnapshot(asOfRef.current), [loadSnapshot]);

  const buildingsById = useMemo(
    () => new Map((snapshot?.buildings ?? []).map((b) => [b.building_id, b] as const)),
    [snapshot],
  );
  const segmentsById = useMemo(
    () => new Map((snapshot?.segments ?? []).map((s) => [s.segment_id, s] as const)),
    [snapshot],
  );
  const plantsById = useMemo(() => new Map((snapshot?.plants ?? []).map((p) => [p.plant_id, p] as const)), [snapshot]);
  const pendingWorkOrders = useMemo(
    () => (snapshot?.queue ?? []).filter((q) => q.work_order_status === 'PENDING_APPROVAL').length,
    [snapshot],
  );

  const value = useMemo<AsOfContextValue>(
    () => ({
      asOf,
      setAsOf,
      stepDay,
      jumpToEvent,
      playing,
      togglePlay,
      threshold,
      setThreshold,
      systemFilter,
      setSystemFilter,
      events,
      eventsLoading,
      eventsError,
      reloadEvents: loadEvents,
      snapshot,
      snapshotLoading,
      snapshotError,
      refreshSnapshot,
      buildingsById,
      segmentsById,
      plantsById,
      pendingWorkOrders,
    }),
    [
      asOf,
      setAsOf,
      stepDay,
      jumpToEvent,
      playing,
      togglePlay,
      threshold,
      systemFilter,
      events,
      eventsLoading,
      eventsError,
      loadEvents,
      snapshot,
      snapshotLoading,
      snapshotError,
      refreshSnapshot,
      buildingsById,
      segmentsById,
      plantsById,
      pendingWorkOrders,
    ],
  );

  return <AsOfContext.Provider value={value}>{children}</AsOfContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAsOf(): AsOfContextValue {
  const context = useContext(AsOfContext);
  if (!context) {
    throw new Error('useAsOf must be used within an <AsOfProvider>');
  }
  return context;
}
