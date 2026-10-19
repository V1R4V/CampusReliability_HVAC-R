/*
 * Copyright 2009-2025 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import { ReactElement } from 'react';

export interface User {
  id: string;
  name: string;
  email: string;
  lastName: string;
  firstName: string;
}

export interface UserGroup {
  id: string;
  name: string;
  description: string;
}

export interface SnackbarMessage {
  message: ReactElement;
  key: number;
  severity?: 'success' | 'info' | 'warning' | 'error';
  error?: boolean;
}

/** Sample / API document row (examples + fetchDocuments). */
export interface Document {
  documentName: string;
  program: string;
  owner: string;
  checklistApplied: string;
  attachments: number;
  uploadedBy: string;
  uploadedAt: string;
}

export interface ProgramDocument {
  documentName: string;
  owner: string;
  status: string;
  uploadedAt: string;
}

/** Program row with optional nested documents (examples + fetchPrograms). */
export interface Program {
  id: string;
  program: string;
  totalDocuments: number;
  passed: number;
  failed: number;
  pending: number;
  documents?: ProgramDocument[];
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  estimatedTime: string;
}

/* =============================================================================
 * Anuva — Building dashboard, Asset detail, Work Orders, Agent drawer.
 * Shapes mirror docs/CONTRACT.md §5.2 / contract/fixtures/*.json exactly —
 * every backend call below returns JSON in this shape, no wrapper object.
 * ============================================================================= */

export type SystemType = 'cooling' | 'heating' | 'air';
export type AssetStatus = 'HEALTHY' | 'WATCH' | 'INSPECTION_DUE' | 'FAILED';
export type WorkOrderStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'DISMISSED';
export type ProvenanceKind = 'REAL' | 'SYNTHETIC' | 'ESTIMATE';

/** One point of {@link Sparkline}'s `points` prop / a building system card's trend. */
export interface RiskPoint {
  date: string;
  risk: number;
}

/** Sensor values/bands keyed by sensor name — null when that asset has no such sensor. */
export interface SensorMap {
  pressure_psi?: number | null;
  flow_imbalance_pct?: number | null;
  delta_t_f?: number | null;
  vibration_mm_s?: number | null;
  energy_kwh?: number | null;
}

export interface SensorBandMap {
  pressure_psi?: [number, number] | null;
  flow_imbalance_pct?: [number, number] | null;
  delta_t_f?: [number, number] | null;
  vibration_mm_s?: [number, number] | null;
  energy_kwh?: [number, number] | null;
}

/** Driver contribution / z-score keyed by driver name — this is {@link SignalBars}'s `contrib`/`z`. */
export interface DriverMap {
  pressure?: number | null;
  flow_imbalance?: number | null;
  delta_t?: number | null;
  vibration?: number | null;
  energy?: number | null;
}

/** One day of {@link AssetHistory}'s `series` — one point on {@link RiskChart}. */
export interface RiskSeriesPoint {
  date: string;
  risk: number;
  status: AssetStatus;
  driver: string;
  z: DriverMap;
  contrib: DriverMap;
  sensors: SensorMap;
  band: SensorBandMap;
  energy_over_expected_pct: number;
}

/** A failure / real-reference / decoy marker on {@link RiskChart} — `AssetHistory.events`. */
export interface AssetEvent {
  event_id: string;
  kind: 'failure' | 'real_reference' | 'decoy' | string;
  asset_id: string | null;
  onset_date: string | null;
  date: string;
  end_date: string | null;
  label: string;
  synthetic: boolean;
}

export interface BuildingRef {
  building_id: string;
  name: string;
  criticality: string;
}

export interface AssetHistoryAsset {
  asset_id: string;
  name: string;
  system: SystemType;
  type: string;
  segment_id: string;
  building_id: string | null;
  age_years: number;
  install_year: number;
  buildings_served: BuildingRef[];
}

/** `AssetHistory.get(assetId)` — the asset detail page's main data source. */
export interface AssetHistory {
  asset: AssetHistoryAsset;
  threshold: number;
  series: RiskSeriesPoint[];
  events: AssetEvent[];
}

/** A facilities work order — `WorkOrder.fetch`, embedded in `BuildingDashboard`/`Briefing`/`Ask`. */
export interface WorkOrder {
  wo_id: string;
  asset_id: string;
  building_ids: string[];
  title: string;
  description: string;
  priority: number;
  crew: string;
  est_hours: number;
  status: WorkOrderStatus;
  drafted_by: string;
  drafted_on: string;
  approved_by: string | null;
  approved_on: string | null;
  dismiss_reason: string | null;
}

/**
 * What a facilities manager may change on a pending work order (member `WorkOrder.edit`).
 * Every key is optional; an omitted or `null` key leaves that field unchanged.
 */
export interface WorkOrderEditFields {
  title?: string | null;
  description?: string | null;
  /** 1 high … 3 low. */
  priority?: number | null;
  crew?: string | null;
  est_hours?: number | null;
}

/** `Briefing.generate(assetId, asOf)` — the agent-authored panel on the asset detail page. */
export interface Briefing {
  asset_id: string;
  as_of: string;
  status: AssetStatus;
  headline: string;
  text: string;
  bullets: string[];
  driver: string;
  energy_over_expected_pct: number;
  buildings_served: string[];
  cost_per_day_usd: number;
  generated_by: 'template' | 'llm' | string;
  work_order: WorkOrder | null;
}

/** One of a building's three system cards (cooling/heating/air) — `null` means "not tracked". */
export interface SystemCard {
  status: AssetStatus;
  risk: number;
  via_asset_id: string;
  energy_over_expected_pct: number;
  sparkline: RiskPoint[];
}

export interface EnergyPoint {
  date: string;
  actual_kwh: number;
  expected_kwh: number;
}

export interface BuildingDashboardAsset {
  asset_id: string;
  name: string;
  system: SystemType;
  type: string;
  segment_id: string;
  building_id: string | null;
  status: AssetStatus;
  risk: number;
  days_in_status: number;
  driver: string;
  driver_label: string;
  energy_over_expected_pct: number;
  impact: number;
  rank_score: number;
  buildings_served: number;
  cost_per_day_usd: number | null;
  work_order_status: WorkOrderStatus | null;
}

export interface PlanBSummary {
  segment_id: string;
  priority_rank: number;
  chillers_needed: number;
  cost_per_day_usd: number;
}

/** `BuildingDashboard.compute(buildingId, asOf)` — the building dashboard page's data source. */
export interface BuildingDashboard {
  as_of: string;
  building: {
    building_id: string;
    name: string;
    segment_id: string;
    criticality: string;
    year_built: number;
    gsf: number;
    peak_load_tons: number;
    lat: number;
    lon: number;
    source: string;
  };
  served_by: { plant_id: string; plant_name: string; segment_id: string; segment_name: string };
  systems: {
    cooling: SystemCard | null;
    heating: SystemCard | null;
    air: SystemCard | null;
  };
  energy_series: EnergyPoint[];
  assets: BuildingDashboardAsset[];
  work_orders: WorkOrder[];
  plan_b: PlanBSummary | null;
}

export interface AskEntity {
  kind: string;
  id: string;
  label: string;
}

export interface AskProposedAction {
  kind: string;
  work_order: WorkOrder;
}

/** `FacilitiesAgent.ask(question, asOf)` — the agent drawer's data source. */
export interface AskResponse {
  question: string;
  as_of: string;
  answer: string;
  entities: AskEntity[];
  proposed_actions: AskProposedAction[];
  generated_by: string;
}

// ---------------------------------------------------------------------------
// Failure-probability forecasts (docs/ML.md §8, CONTRACT §5.2 additive rows)
// ---------------------------------------------------------------------------

/** The four independent forecasting methods stored per asset-day in `RiskForecast`. */
export type ForecastMethod = 'heuristic' | 'classifier' | 'monte_carlo' | 'weibull';
export type ForecastConfidence = 'low' | 'medium' | 'high';

/** Monte Carlo first-crossing day / Weibull conditional quantiles, in days from `as_of`. */
export interface DaysToFailure {
  p10: number | null;
  p50: number | null;
  p90: number | null;
}

/** One method's row in `RiskForecast.compare(...).methods`. */
export interface ForecastMethodRow {
  method: ForecastMethod;
  label: string;
  p_fail_7d: number | null;
  p_fail_14d: number | null;
  p_fail_30d: number | null;
  days_to_failure: DaysToFailure | null;
  confidence: ForecastConfidence | null;
  basis: string | null;
  trained_on: string | null;
}

/** Mean of the condition-based methods (heuristic, classifier, monte_carlo); Weibull is reference only. */
export interface ForecastConsensus {
  p_fail_7d: number | null;
  p_fail_14d: number | null;
  p_fail_30d: number | null;
  spread_14d: number | null;
  n_methods: number;
  note: string;
}

/** One day of trailing `p_fail_14d` per method, for the history chart. */
export interface ForecastHistoryPoint {
  date: string;
  heuristic: number | null;
  classifier: number | null;
  monte_carlo: number | null;
  weibull: number | null;
  consensus: number | null;
}

export interface ForecastNextFailure {
  event_id: string;
  date: string;
  days_from_as_of: number;
  synthetic: boolean | null;
}

/** `RiskForecast.compare(asset_id, as_of)`. */
export interface RiskForecastCompare {
  asset_id: string;
  name: string;
  as_of: string;
  as_of_used: string | null;
  status: AssetStatus | null;
  risk: number | null;
  threshold: number;
  methods: ForecastMethodRow[];
  consensus: ForecastConsensus;
  history: ForecastHistoryPoint[];
  next_failure: ForecastNextFailure | null;
}

/** One asset row in `RiskForecast.campus(as_of).assets`, ranked by `consensus_14d`. */
export interface ForecastCampusAsset {
  asset_id: string;
  name: string;
  system: SystemType;
  type: string;
  building_id: string | null;
  status: AssetStatus | null;
  risk: number | null;
  consensus_14d: number | null;
  heuristic_14d: number | null;
  classifier_14d: number | null;
  monte_carlo_14d: number | null;
  weibull_14d: number | null;
  days_to_failure_p50: number | null;
  confidence: ForecastConfidence | null;
  spread_14d: number | null;
}

/** `RiskForecast.campus(as_of)`. */
export interface RiskForecastCampus {
  as_of: string;
  assets: ForecastCampusAsset[];
}
