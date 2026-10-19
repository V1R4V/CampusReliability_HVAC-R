/*
 * Before It Breaks — shared data-access layer for the React UI (owner: Arnav).
 *
 * Every call the Overview / Plan B / Backtest / Buildings pages consume is wrapped
 * here as a one-liner from docs/CONTRACT.md §5.2. Pages never call `c3Action`
 * directly. Anuva's calls live beside this file in `anuva.ts`.
 *
 * Dual mode:
 *  - default: live backend via `c3Action(type, method, [positional args])`.
 *  - `VITE_USE_FIXTURES=true` (dev outside C3 Code only — never committed on):
 *    reads `contract/fixtures/*.json` instead. Responses are the exact fixture shapes
 *    either way, so switching modes needs no page changes.
 */

import { c3Action } from '@/c3Action';

/* ───────────────────────────── Enums (CONTRACT §1) ───────────────────────────── */

export type System = 'cooling' | 'heating' | 'air';
export type Status = 'HEALTHY' | 'WATCH' | 'INSPECTION_DUE' | 'FAILED';
export type Criticality = 'patient_care' | 'research_lab' | 'instruction' | 'office';
export type WorkOrderStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'DISMISSED';
export type EventKind = 'failure' | 'decoy' | 'real_reference';
export type Signal = 'pressure' | 'flow_imbalance' | 'delta_t' | 'vibration' | 'energy';
/** Honesty label rendered by ProvenanceChip (RULES §4). */
export type Provenance = 'REAL' | 'SYNTHETIC' | 'ESTIMATE';

/* ───────────────────────────── Constants (CONTRACT §1) ───────────────────────── */

export const REPLAY_START = '2026-01-01';
export const REPLAY_END = '2026-08-31';
/** The demo lands on the S3 warning date by default (FRONTEND §8 step 3). */
export const DEFAULT_AS_OF = '2026-06-09';
/** Clicking a failure marker lands this many days before it — on the warning, not the break. */
export const MARKER_LEAD_DAYS = 8;
export const DEFAULT_THRESHOLD = 3.0;
export const WATCH_THRESHOLD = 2.0;
export const RISK_SCALE_MAX = 5;
/** $10M ÷ ~30 chillers ÷ ~90 days — an estimate, label it. */
export const CHILLER_RENTAL_USD_PER_DAY = 3704;
export const TONS_PER_RENTAL_CHILLER = 400;
export const ENERGY_USD_PER_KWH = 0.1;

export const STATUS_LABEL: Record<Status, string> = {
  HEALTHY: 'Healthy',
  WATCH: 'Watch',
  INSPECTION_DUE: 'Inspection due',
  FAILED: 'Failed',
};
/** Lower = worse. Used for worst-first sorting. */
export const STATUS_RANK: Record<Status, number> = {
  FAILED: 0,
  INSPECTION_DUE: 1,
  WATCH: 2,
  HEALTHY: 3,
};
export const CRITICALITY_LABEL: Record<Criticality, string> = {
  patient_care: 'Patient care',
  research_lab: 'Research lab',
  instruction: 'Instruction',
  office: 'Office',
};
export const CRITICALITY_WEIGHT: Record<Criticality, number> = {
  patient_care: 4,
  research_lab: 3,
  instruction: 2,
  office: 1,
};
export const SYSTEM_LABEL: Record<System, string> = {
  cooling: 'Cooling',
  heating: 'Heating',
  air: 'Air handling',
};
export const WO_STATUS_LABEL: Record<WorkOrderStatus, string> = {
  PENDING_APPROVAL: 'Pending approval',
  APPROVED: 'Approved',
  DISMISSED: 'Dismissed',
};

/* ───────────────────────────── Shapes (CONTRACT §4) ──────────────────────────── */

/** One asset row of the ranked queue as of a date. */
export interface QueueItem {
  asset_id: string;
  name: string;
  system: System;
  type: string;
  segment_id: string;
  building_id: string | null;
  status: Status;
  risk: number;
  days_in_status: number;
  driver: Signal | string;
  driver_label: string;
  energy_over_expected_pct: number;
  impact: number;
  rank_score: number;
  buildings_served: number;
  cost_per_day_usd: number | null;
  work_order_status: WorkOrderStatus | null;
}

export interface SnapshotWeather {
  tmax_f: number;
  tmin_f: number;
  tavg_f: number;
  /** Free text from the backend, e.g. "hot", "cold", "heat", "normal". */
  label: string;
  source: string;
}

export interface SnapshotKpis {
  inspection_due: number;
  inspection_due_delta: number;
  watch: number;
  failed: number;
  energy_waste_usd_per_day: number;
  assets_over_5pct_energy: number;
  cooling_exposure_usd_per_day: number;
}

export interface SnapshotBuilding {
  building_id: string;
  name: string;
  segment_id: string;
  criticality: Criticality;
  worst_status: Status;
  /** Not in the contract today — rendered only if the payload ever carries them. */
  year_built?: number;
  gsf?: number;
  source?: string;
}

export interface SnapshotSegment {
  segment_id: string;
  plant_id: string;
  name: string;
  worst_status: Status;
}

export interface SnapshotPlant {
  plant_id: string;
  name: string;
}

/** `campusSnapshot(asOf)` → `CampusSnapshot.compute(as_of)`. */
export interface CampusSnapshot {
  as_of: string;
  weather: SnapshotWeather;
  kpis: SnapshotKpis;
  queue: QueueItem[];
  buildings: SnapshotBuilding[];
  segments: SnapshotSegment[];
  plants: SnapshotPlant[];
  morning_brief: string;
}

export interface PlanBBuilding {
  order: number;
  building_id: string;
  name: string;
  criticality: Criticality;
  peak_load_tons: number;
  chillers_needed: number;
  cost_per_day_usd: number;
  staged: boolean;
}

export interface PlanBTotals {
  buildings: number;
  chillers: number;
  cost_per_day_usd: number;
  cost_per_week_usd: number;
}

/** The real June 2026 outage (CONTRACT `REAL_OUTAGE`); `usd_per_day` is our estimate. */
export interface PlanBReference {
  label: string;
  total_usd: number;
  rental_usd: number;
  deterioration_usd: number;
  repair_usd: number;
  chillers: number;
  usd_per_day: number;
  buildings_closed: number;
  buildings_partial: number;
  start_date: string;
  reopen_date: string;
  source: string;
}

/** `simulatePlanB(segmentId, tempF, priorityOnly)` → `PlanB.simulate(...)`. */
export interface PlanBResult {
  segment_id: string;
  plant_id: string;
  temp_f: number;
  priority_only: boolean;
  load_factor: number;
  buildings: PlanBBuilding[];
  totals: PlanBTotals;
  reference: PlanBReference;
}

export interface BacktestFailure {
  event_id: string;
  asset_id: string;
  system: System;
  failure_date: string;
  /** Null when the failure was missed at this threshold. */
  first_due_date: string | null;
  lead_days: number | null;
  energy_over_expected_pct_at_flag: number | null;
}

export interface BacktestDecoy {
  event_id: string;
  label: string;
  ignored: boolean;
  reason: string;
}

export interface BacktestSweepPoint {
  threshold: number;
  mean_lead_days: number;
  min_lead_days: number;
  false_alarm_days: number;
  missed: number;
}

export interface AlignedCurvePoint {
  days_before: number;
  risk: number;
}

export interface AlignedCurve {
  event_id: string;
  asset_id: string;
  points: AlignedCurvePoint[];
}

/** `backtest(threshold)` → `Backtest.run(threshold)`. */
export interface BacktestResult {
  threshold: number;
  failures: BacktestFailure[];
  false_alarm_days: number;
  healthy_assets: number;
  decoys: BacktestDecoy[];
  sweep: BacktestSweepPoint[];
  aligned_curves: AlignedCurve[];
}

/** `events()` → `FailureEvent.fetch` rows remapped to the contract's flat keys. */
export interface FailureEvent {
  event_id: string;
  kind: EventKind;
  asset_id: string | null;
  onset_date: string | null;
  date: string;
  end_date: string | null;
  label: string;
  synthetic: boolean;
}

/* ───────────────────────────── Mode switch ───────────────────────────────────── */

const USE_FIXTURES = import.meta.env.VITE_USE_FIXTURES === 'true';
/** Surfaced in the UI footer so a fixture build can never masquerade as live. */
export const DATA_SOURCE: 'fixtures' | 'live' = USE_FIXTURES ? 'fixtures' : 'live';

// Fixtures live at the repo root (outside the Vite project). Resolved relative to this
// file: src/shared/api → … → /usr/workspace/contract/fixtures.
async function fixture<T>(load: () => Promise<unknown>): Promise<T> {
  const mod = (await load()) as { default?: unknown };
  return (mod.default ?? mod) as T;
}

/* ───────────────────────────── Calls (CONTRACT §5.2) ─────────────────────────── */

/** `CampusSnapshot.compute(as_of)` — shell, Overview, Buildings index. */
export async function campusSnapshot(asOf: string): Promise<CampusSnapshot> {
  if (USE_FIXTURES) {
    // The fixture is a single frozen day (2026-06-09); the date is ignored.
    return fixture<CampusSnapshot>(() => import('../../../../../../contract/fixtures/campus_snapshot.json'));
  }
  const result: CampusSnapshot = await c3Action('CampusSnapshot', 'compute', [asOf]);
  return result;
}

/** `PlanB.simulate(segment_id, temp_f, priority_only)` — Plan B page. */
export async function simulatePlanB(segmentId: string, tempF: number, priorityOnly: boolean): Promise<PlanBResult> {
  if (USE_FIXTURES) {
    const base = await fixture<PlanBResult>(() => import('../../../../../../contract/fixtures/plan_b_S3.json'));
    return applyScenarioToFixture(base, segmentId, tempF, priorityOnly);
  }
  const result: PlanBResult = await c3Action('PlanB', 'simulate', [segmentId, tempF, priorityOnly]);
  return result;
}

/** `Backtest.run(threshold)` — Backtest page. */
export async function backtest(threshold: number): Promise<BacktestResult> {
  if (USE_FIXTURES) {
    // Fixture failures are for threshold 3.0; the UI reads KPIs from `sweep`, which
    // covers every threshold, so the slider still responds offline.
    const base = await fixture<BacktestResult>(() => import('../../../../../../contract/fixtures/backtest.json'));
    return { ...base, threshold };
  }
  const result: BacktestResult = await c3Action('Backtest', 'run', [threshold]);
  return result;
}

/** Raw shape of a built-in `FailureEvent.fetch` row (platform `id` + `asset` ref). */
interface RawFailureEventRow {
  id: string;
  kind: EventKind;
  asset?: { id?: string } | null;
  onset_date?: string | null;
  date: string;
  end_date?: string | null;
  label?: string;
  synthetic?: boolean;
}

function toFailureEvent(row: RawFailureEventRow): FailureEvent {
  return {
    event_id: row.id,
    kind: row.kind,
    asset_id: row.asset?.id ?? null,
    onset_date: row.onset_date ?? null,
    date: row.date,
    end_date: row.end_date ?? null,
    label: row.label ?? row.id,
    // Unlabelled rows are treated as synthetic — never assume something is real.
    synthetic: row.synthetic ?? true,
  };
}

/** `FailureEvent.fetch` → `.objs`, `id`→`event_id`, `asset.id`→`asset_id`. Scrubber markers, charts. */
export async function events(): Promise<FailureEvent[]> {
  if (USE_FIXTURES) {
    const data = await fixture<{ events: FailureEvent[] }>(() => import('../../../../../../contract/fixtures/events.json'));
    return [...data.events].sort((a, b) => a.date.localeCompare(b.date));
  }
  const response = await c3Action('FailureEvent', 'fetch', [{ include: 'this, asset.id', limit: -1 }]);
  const rows: RawFailureEventRow[] = response?.objs ?? [];
  return rows.map(toFailureEvent).sort((a, b) => a.date.localeCompare(b.date));
}

/** Fixture-only: re-run the contract formula so the Plan B controls still respond offline. */
function applyScenarioToFixture(
  base: PlanBResult,
  segmentId: string,
  tempF: number,
  priorityOnly: boolean,
): PlanBResult {
  const loadFactor = Math.min(1, Math.max(0.3, (tempF - 55) / 40));
  const buildings = base.buildings.map((b) => {
    const chillers = Math.ceil((b.peak_load_tons * loadFactor) / TONS_PER_RENTAL_CHILLER);
    const staged = !priorityOnly || b.criticality === 'patient_care' || b.criticality === 'research_lab';
    return { ...b, chillers_needed: chillers, cost_per_day_usd: chillers * CHILLER_RENTAL_USD_PER_DAY, staged };
  });
  const staged = buildings.filter((b) => b.staged);
  const cost = staged.reduce((sum, b) => sum + b.cost_per_day_usd, 0);
  return {
    ...base,
    segment_id: segmentId,
    temp_f: tempF,
    priority_only: priorityOnly,
    load_factor: loadFactor,
    buildings,
    totals: {
      buildings: staged.length,
      chillers: staged.reduce((sum, b) => sum + b.chillers_needed, 0),
      cost_per_day_usd: cost,
      cost_per_week_usd: cost * 7,
    },
  };
}

/* ───────────────────────────── Errors ────────────────────────────────────────── */

/** `c3Action` rejects with a string (server message) or an Error — normalise for display. */
export function errorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Unknown error';
}

/* ───────────────────────────── Dates (UTC, ISO YYYY-MM-DD) ───────────────────── */

const DAY_MS = 86_400_000;

function utcMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Number of days in the replay window (Jan 1 → Aug 31 2026 inclusive). */
export const REPLAY_DAYS = Math.round((utcMs(REPLAY_END) - utcMs(REPLAY_START)) / DAY_MS) + 1;

export function dayIndexOf(iso: string): number {
  return Math.round((utcMs(iso) - utcMs(REPLAY_START)) / DAY_MS);
}

export function isoFromDayIndex(index: number): string {
  const clamped = Math.max(0, Math.min(REPLAY_DAYS - 1, Math.round(index)));
  return new Date(utcMs(REPLAY_START) + clamped * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return new Date(utcMs(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((utcMs(toIso) - utcMs(fromIso)) / DAY_MS);
}

export function clampDate(iso: string): string {
  if (iso < REPLAY_START) return REPLAY_START;
  if (iso > REPLAY_END) return REPLAY_END;
  return iso;
}

/**
 * Anuva's and Vibhrav's pages read the as-of date from `?asOf=` until they adopt
 * AsOfProvider — every link into them carries the global date so it never resets.
 */
export function withAsOf(path: string, asOf: string): string {
  return `${path}?asOf=${encodeURIComponent(asOf)}`;
}

/** `Jun 9, 2026` (or `Jun 9` with `{ year: false }`). */
export function formatDate(iso: string | null | undefined, opts: { year?: boolean } = {}): string {
  if (!iso) return '—';
  return new Date(utcMs(iso)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: opts.year === false ? undefined : 'numeric',
    timeZone: 'UTC',
  });
}

/** First day of each month in the replay window — scrubber axis ticks. */
export const MONTH_TICKS: { iso: string; label: string; index: number }[] = Array.from({ length: 8 }, (_, i) => {
  const iso = `2026-${String(i + 1).padStart(2, '0')}-01`;
  return {
    iso,
    label: new Date(utcMs(iso)).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
    index: dayIndexOf(iso),
  };
});

/* ───────────────────────────── Number formatting (FRONTEND §2) ───────────────── */

/** `$1,840` · `$67K` · `$15.8M`; `{ perDay }` appends `/day`, `{ approx }` prefixes `~`. */
export function formatUsd(
  value: number | null | undefined,
  opts: { perDay?: boolean; approx?: boolean } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  let text: string;
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    text = `$${millions >= 10 ? millions.toFixed(0) : millions.toFixed(1).replace(/\.0$/, '')}M`;
  } else if (abs >= 10_000) {
    text = `$${Math.round(abs / 1000)}K`;
  } else {
    text = `$${Math.round(abs).toLocaleString('en-US')}`;
  }
  if (value < 0) text = `−${text}`;
  if (opts.approx) text = `~${text}`;
  return opts.perDay ? `${text}/day` : text;
}

/** `+8.5%` (signed by default). */
export function formatPct(value: number | null | undefined, opts: { signed?: boolean; digits?: number } = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const digits = opts.digits ?? 1;
  const sign = opts.signed === false ? '' : value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(digits)}%`;
}

/** Backtest threshold: `3.0`, `2.75` (the slider steps by 0.25). */
export function formatThreshold(value: number): string {
  const fixed = value.toFixed(2);
  return fixed.endsWith('0') ? fixed.slice(0, -1) : fixed;
}

/** Risk score, one decimal. */
export function formatRisk(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toFixed(1);
}

/** `12,345` with thousands separators. */
export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

/** `350K` · `1.2M` — for square footage and similar large counts. */
export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 1_000) return `${Math.round(abs / 1000)}K`;
  return Math.round(abs).toLocaleString('en-US');
}

/** Worst (lowest-ranked) status in a list; HEALTHY when empty. */
export function worstStatus(statuses: Status[]): Status {
  return statuses.reduce<Status>((worst, s) => (STATUS_RANK[s] < STATUS_RANK[worst] ? s : worst), 'HEALTHY');
}
