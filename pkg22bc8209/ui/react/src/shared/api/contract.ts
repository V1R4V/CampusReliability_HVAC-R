/*
 * Before It Breaks — the contract's enums, constants, label maps and payload shapes
 * (docs/CONTRACT.md §1 and §4), plus the two pure helpers every page leans on.
 *
 * Pure module: no network, no `import.meta`, so it can be imported by Jest tests and by
 * derivation code (e.g. pages/Buildings/buildingRows.ts) without dragging in the data
 * layer. `shared/api/index.ts` re-exports everything here, so `@/shared/api` keeps its
 * public surface unchanged.
 */

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

export const SYSTEMS: System[] = ['cooling', 'heating', 'air'];
/** Worst first — the order chips, legends and sorts use. */
export const STATUS_ORDER: Status[] = ['FAILED', 'INSPECTION_DUE', 'WATCH', 'HEALTHY'];

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

/* ───────────────────────────── Pure helpers ──────────────────────────────────── */

/** Worst (lowest-ranked) status in a list; HEALTHY when empty. */
export function worstStatus(statuses: Status[]): Status {
  return statuses.reduce<Status>((worst, s) => (STATUS_RANK[s] < STATUS_RANK[worst] ? s : worst), 'HEALTHY');
}

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
