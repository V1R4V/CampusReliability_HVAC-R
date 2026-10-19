/*
 * Before It Breaks — shared data-access layer for the React UI (owner: Arnav).
 *
 * Every call the Overview / Plan B / Backtest / Buildings pages consume is wrapped
 * here as a one-liner from docs/CONTRACT.md §5.2. Pages never call `c3Action`
 * directly. Anuva's calls live beside this file in `anuva.ts`.
 *
 * The contract's enums, constants, shapes and the formatters live in the pure modules
 * `./contract` and `./format` (no network, no `import.meta`, so Jest can import them);
 * they are re-exported here so `@/shared/api` stays the one import for pages.
 *
 * Dual mode:
 *  - default: live backend via `c3Action(type, method, [positional args])`.
 *  - `VITE_USE_FIXTURES=true` (dev outside C3 Code only — never committed on):
 *    reads `contract/fixtures/*.json` instead. Responses are the exact fixture shapes
 *    either way, so switching modes needs no page changes.
 */

import { c3Action } from '@/c3Action';
import {
  CHILLER_RENTAL_USD_PER_DAY,
  TONS_PER_RENTAL_CHILLER,
  type BacktestResult,
  type CampusSnapshot,
  type EventKind,
  type FailureEvent,
  type PlanBReference,
  type PlanBResult,
} from './contract';

export * from './contract';
export * from './format';

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

/** Scenario temperature used only to read the outage reference (the reference itself is constant). */
const REFERENCE_TEMP_F = 95;

/**
 * The real June 2026 outage as the backend reports it — `PlanB.simulate(...).reference`
 * (CONTRACT `REAL_OUTAGE`). The Backtest hero quotes it from here so the real numbers are
 * never typed into the UI and Plan B and Backtest can never disagree.
 */
export async function realOutageReference(segmentId = 'S3'): Promise<PlanBReference> {
  const result = await simulatePlanB(segmentId, REFERENCE_TEMP_F, false);
  return result.reference;
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
