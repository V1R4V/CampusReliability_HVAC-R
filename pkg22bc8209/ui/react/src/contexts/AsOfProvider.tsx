/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchEvents } from '@/shared/api/shell';
import type { FailureEventRow } from '@/Interfaces';

/** Replay window (docs/CONTRACT.md conventions) and the demo's default landing date. */
export const REPLAY_START = '2026-01-01';
export const REPLAY_END = '2026-08-31';
export const DEFAULT_AS_OF = '2026-06-09';

const DAY_MS = 86_400_000;

/** Whole days from {@link REPLAY_START} to an ISO date (UTC, so DST never shifts a day). */
export function dayIndex(iso: string): number {
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${REPLAY_START}T00:00:00Z`)) / DAY_MS);
}

/** ISO date `days` after {@link REPLAY_START}. */
export function dateAtIndex(days: number): string {
  return new Date(Date.parse(`${REPLAY_START}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function shiftDate(iso: string, days: number): string {
  return dateAtIndex(dayIndex(iso) + days);
}

export function clampToReplay(iso: string): string {
  if (iso < REPLAY_START) return REPLAY_START;
  if (iso > REPLAY_END) return REPLAY_END;
  return iso;
}

/** "Jun 9, 2026" */
export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

interface AsOfContextValue {
  asOf: string;
  setAsOf: (next: string) => void;
  /** Failure / decoy / real-reference events for scrubber markers and charts (empty until loaded). */
  events: FailureEventRow[];
}

const AsOfContext = createContext<AsOfContextValue | null>(null);

/**
 * The one global "as of" date (docs/FRONTEND.md §3). It lives in the URL as `?asOf=` so every page —
 * including those that read `useSearchParams()` directly — sees the same date, links stay shareable,
 * and navigation that drops the query (the side nav) gets the current date written back.
 */
export function AsOfProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const urlAsOf = new URLSearchParams(location.search).get('asOf');
  const [asOf, setAsOfState] = useState<string>(clampToReplay(urlAsOf ?? DEFAULT_AS_OF));
  const [events, setEvents] = useState<FailureEventRow[]>([]);

  // URL → state: a page or a pasted link changed `?asOf=`.
  useEffect(() => {
    if (urlAsOf && urlAsOf !== asOf) setAsOfState(clampToReplay(urlAsOf));
  }, [urlAsOf, asOf]);

  // State → URL: a route was entered without `?asOf=` (side nav, bare links).
  useEffect(() => {
    if (urlAsOf) return;
    const params = new URLSearchParams(location.search);
    params.set('asOf', asOf);
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true });
  }, [urlAsOf, asOf, location.pathname, location.search, navigate]);

  useEffect(() => {
    let cancelled = false;
    fetchEvents()
      .then((rows) => {
        if (!cancelled) setEvents(rows);
      })
      .catch(() => {
        // Markers are decoration; the scrubber still works without them.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setAsOf = useCallback(
    (next: string) => {
      const clamped = clampToReplay(next);
      setAsOfState(clamped);
      const params = new URLSearchParams(location.search);
      params.set('asOf', clamped);
      navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true });
    },
    [location.pathname, location.search, navigate]
  );

  const value = useMemo(() => ({ asOf, setAsOf, events }), [asOf, setAsOf, events]);
  return <AsOfContext.Provider value={value}>{children}</AsOfContext.Provider>;
}

export function useAsOfContext(): AsOfContextValue {
  const ctx = useContext(AsOfContext);
  if (!ctx) throw new Error('useAsOfContext must be used inside <AsOfProvider>');
  return ctx;
}
