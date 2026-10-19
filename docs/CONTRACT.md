# Data contract (single source of truth)

Every type, field, unit, enum, and data call the team shares. Owner: Vibhrav. Change only by PR,
announced to the team. After 12:30, changes are additive only.

Conventions: dates are ISO `YYYY-MM-DD` strings. IDs are strings. Missing sensor values are `null`
(JSON) / empty (CSV), never 0. Temperatures °F, pressure psi, vibration mm/s RMS, energy kWh/day,
money USD. Replay window: **2026-01-01 → 2026-08-31**.

---

## 1. Enums and constants

| Name | Values |
|------|--------|
| `System` | `cooling`, `heating`, `air` |
| `Status` | `HEALTHY`, `WATCH`, `INSPECTION_DUE`, `FAILED` |
| `Criticality` | `patient_care`, `research_lab`, `instruction`, `office` |
| `AssetType` | `chw_main`, `chiller`, `chw_pump`, `isolation_valve`, `heat_exchanger`, `steam_line`, `steam_trap`, `condensate_pump`, `unit_heater`, `ahu` |
| `WorkOrderStatus` | `PENDING_APPROVAL`, `APPROVED`, `DISMISSED` |
| `EventKind` | `failure`, `decoy`, `real_reference` |
| `Signal` | `pressure`, `flow_imbalance`, `delta_t`, `vibration`, `energy` |

Asset types follow FP&M's real preventive-maintenance program categories (May 2021 Physical Plant
Operations Report) plus chillers, unit heaters and AHUs.

| Constant | Value | Provenance |
|----------|-------|------------|
| `CRITICALITY_WEIGHT` | patient_care 4, research_lab 3, instruction 2, office 1 | our choice |
| `INSPECTION_THRESHOLD` (default) | 3.0 | tunable in Backtest |
| `WATCH_THRESHOLD` | 2.0 | our choice |
| `PERSISTENCE_DAYS` | 2 | our choice |
| `CHILLER_RENTAL_USD_PER_DAY` | 3704 | **estimate**: $10M ÷ ~30 chillers ÷ ~90 days |
| `TONS_PER_RENTAL_CHILLER` | 400 | **assumption** |
| `ENERGY_USD_PER_KWH` | 0.10 | **assumption** (label in UI) |
| `REAL_OUTAGE` | total 15.8M; rentals 10.0M; extra deterioration 4.0M; line repair 1.8M; ~30 chillers; ~111K/day; 23 closed + 11 partial; Jun 17 → reopen Aug 10 | **real** (Cap Times Oct 8 2026; WPR; UW News) — ~111K/day is our estimate |

Work order ID format (real FP&M format): `WO 26-0NNNNN`, e.g. `WO 26-071213`.

## 2. Status rules (computed by `model/`)
- `WATCH`: risk ≥ `WATCH_THRESHOLD` and not due.
- `INSPECTION_DUE`: risk ≥ threshold on `PERSISTENCE_DAYS` consecutive days. Stays due while risk
  ≥ `WATCH_THRESHOLD`; clears after 2 consecutive days below it.
- `FAILED`: from the failure event's `date` through its `end_date`.
- Otherwise `HEALTHY`.

## 3. Tables (seed CSVs in `data/seed/`, produced by Devansh unless noted)

### plants.csv
| column | type | notes |
|---|---|---|
| plant_id | str | `CHARTER`, `WALNUT`, `WCCF` |
| name | str | Charter Street Heating Plant, Walnut Street Heating Plant, West Campus Cogeneration Facility (real) |
| lat, lon | float | real |

### segments.csv  (synthetic topology)
| column | type | notes |
|---|---|---|
| segment_id | str | `S1`…`S6` |
| plant_id | str | |
| name | str | e.g. "Bascom Hill loop" |

### buildings.csv
| column | type | notes |
|---|---|---|
| building_id | str | slug, e.g. `van_vleck_hall` |
| name | str | real |
| segment_id | str | synthetic assignment |
| criticality | Criticality | |
| year_built | int | real, cite in `source` |
| gsf | int | gross sq ft, real where findable, else estimate + say so in `source` |
| peak_load_tons | float | derived: gsf/250 for research_lab & patient_care, gsf/400 otherwise |
| lat, lon | float | real (OpenStreetMap) |
| source | str | where year/gsf came from |

### assets.csv
| column | type | notes |
|---|---|---|
| asset_id | str | `<LOC>-<TYPE>-<n>`, e.g. `S3-PIPE`, `VIL-UH-2`, `WIMR-AHU-3`, `WAL-CHL-2` |
| name | str | human label, e.g. "Chilled water main, segment S3" |
| system | System | |
| type | AssetType | |
| segment_id | str | |
| building_id | str or empty | empty = serves the whole segment |
| age_years | int | as of 2026 |
| install_year | int | |

### weather_daily.csv  (real)
| column | type | notes |
|---|---|---|
| date | date | |
| tmax_f, tmin_f, tavg_f | float | NOAA GHCN-Daily, Madison Dane County Regional Airport |
| source | str | station id |

### sensor_daily.csv  (synthetic)
| column | type | notes |
|---|---|---|
| date, asset_id | | one row per asset per day |
| pressure_psi | float/null | supply pressure (mains, pumps, steam, HX) |
| flow_imbalance_pct | float/null | (supply − return)/supply × 100; leak signal |
| delta_t_f | float/null | supply/return temperature difference |
| vibration_mm_s | float/null | rotating equipment only |
| energy_kwh | float | raw daily energy, weather-driven (not normalized) |

### events.csv  (ground truth for backtest + UI markers)
| column | type | notes |
|---|---|---|
| event_id | str | `F1`…`F5`, `D1`…`D4`, `R1` |
| kind | EventKind | |
| asset_id | str or empty | |
| onset_date | date or empty | when degradation starts |
| date | date | failure date / decoy date |
| end_date | date or empty | end of FAILED period |
| label | str | short UI label, e.g. "Reenactment of the real June 17 event" |
| synthetic | bool | true for planted events; `R1` (real June 17 break) is false |

### risk_daily.csv  (produced by Vibhrav's `model/`)
| column | type | notes |
|---|---|---|
| date, asset_id | | |
| risk | float | ≥ 0 |
| status | Status | at default threshold |
| driver | Signal | largest weighted contribution |
| z_pressure, z_flow_imbalance, z_delta_t, z_vibration, z_energy | float/null | direction-adjusted (positive = bad) |
| contrib_pressure … contrib_energy | float/null | share of risk, sum to 1 over available signals |
| expected_energy_kwh | float | weather-normalized baseline |
| energy_over_expected_pct | float | (actual − expected)/expected × 100 |

### work_orders.csv / store  (produced by Vibhrav's `agent/`)
Fields = `WorkOrder` below.

---

## 4. Data calls (what the UI calls)

UI reads only these. Fixtures for each live in `contract/fixtures/`. "Owner" builds the real one.

| Call | Owner | Fixture | Used by |
|---|---|---|---|
| `campusSnapshot(asOf)` | Vibhrav | `campus_snapshot.json` | Shell, Overview, Buildings index |
| `building(buildingId, asOf)` | Vibhrav (+Devansh Plan B line) | `building_van_vleck_hall.json` | Building dashboard |
| `assetHistory(assetId)` | Vibhrav | `asset_history_S3-PIPE.json` | Asset detail |
| `briefing(assetId, asOf)` | Vibhrav | `briefing_S3-PIPE.json` | Asset detail |
| `simulatePlanB(segmentId, tempF, priorityOnly)` | Devansh | `plan_b_S3.json` | Plan B, Building dashboard |
| `backtest(threshold)` | Vibhrav | `backtest.json` | Backtest |
| `workOrders()` / `approveWorkOrder(woId, approver)` / `dismissWorkOrder(woId, reason)` | Vibhrav | `work_orders.json` | Work Orders, Asset detail |
| `ask(question, asOf)` | Vibhrav | `ask.json` | Agent drawer |
| `events()` | Devansh | `events.json` | Shell scrubber markers, charts |
| `riskForecast(assetId, asOf)` *(additive, ML.md §8)* | `RiskForecast.compare(asset_id, as_of)` | `c3Action('RiskForecast', 'compare', [assetId, asOf])` → `{ asset_id, name, as_of, as_of_used, status, risk, threshold, methods[{method, label, p_fail_7d, p_fail_14d, p_fail_30d, days_to_failure{p10,p50,p90}\|null, confidence, basis, trained_on}], consensus{p_fail_7d, p_fail_14d, p_fail_30d, spread_14d, n_methods, note}, history[{date, heuristic, classifier, monte_carlo, weibull, consensus}], next_failure{event_id, date, days_from_as_of, synthetic}\|null }`. Fixture: `forecast_compare_S3-PIPE.json` |
| `riskForecastCampus(asOf)` *(additive)* | `RiskForecast.campus(as_of)` | `c3Action('RiskForecast', 'campus', [asOf])` → `{ as_of, assets[{asset_id, name, system, type, building_id, status, risk, consensus_14d, heuristic_14d, classifier_14d, monte_carlo_14d, weibull_14d, days_to_failure_p50, confidence, spread_14d}] }` ranked by `consensus_14d` desc |

### Shared object shapes

**QueueItem** (one asset row as of a date)
```
asset_id, name, system, type, segment_id, building_id|null, status, risk, days_in_status,
driver, driver_label ("pressure ↓ 6 psi"), energy_over_expected_pct, impact, rank_score,
buildings_served (int), cost_per_day_usd|null (cooling only), work_order_status|null
```
Ranking: `INSPECTION_DUE` first, then `FAILED`, then by `rank_score = risk × impact` desc.
`impact = Σ CRITICALITY_WEIGHT × peak_load_tons / 500` over buildings served.
`cost_per_day_usd = Σ ceil(peak_load_tons / 400) × 3704` over buildings served (cooling only).

**WorkOrder**
```
wo_id, asset_id, building_ids[], title, description, priority (1 high … 3 low),
crew, est_hours, status (WorkOrderStatus), drafted_by ("agent"), drafted_on,
approved_by|null, approved_on|null, dismiss_reason|null
```

**Event** — fields of events.csv.

### Call shapes
See the fixture files; they are the exact shapes. Top-level keys:

- `campusSnapshot` → `as_of, weather{tmax_f,tmin_f,tavg_f,label,source}, kpis{inspection_due,
  inspection_due_delta, watch, failed, energy_waste_usd_per_day, assets_over_5pct_energy,
  cooling_exposure_usd_per_day}, queue[QueueItem], buildings[{building_id,name,segment_id,
  criticality,worst_status}], segments[{segment_id,plant_id,name,worst_status}],
  plants[{plant_id,name}], morning_brief`
- `building` → `as_of, building{…buildings.csv}, served_by{plant_id,plant_name,segment_id,segment_name},
  systems{cooling|heating|air: {status,risk,via_asset_id,energy_over_expected_pct,
  sparkline[{date,risk}]}|null}, energy_series[{date,actual_kwh,expected_kwh}] (90 days),
  assets[QueueItem], work_orders[WorkOrder], plan_b{segment_id,priority_rank,chillers_needed,
  cost_per_day_usd}|null`
- `assetHistory` → `asset{…assets.csv, buildings_served[{building_id,name,criticality}]},
  threshold, series[{date,risk,status,driver,z{…},contrib{…},sensors{…},
  band{pressure_psi:[lo,hi],…},energy_over_expected_pct}], events[Event]`
  (`band` = 30-day mean ± 2 std, for the "normal" shading)
- `briefing` → `asset_id, as_of, status, headline, text, bullets[], driver,
  energy_over_expected_pct, buildings_served[names], cost_per_day_usd|null,
  generated_by ("template"|"llm"), work_order: WorkOrder`
- `simulatePlanB` → `segment_id, plant_id, temp_f, priority_only, load_factor,
  buildings[{order,building_id,name,criticality,peak_load_tons,chillers_needed,cost_per_day_usd,
  staged}], totals{buildings,chillers,cost_per_day_usd,cost_per_week_usd},
  reference{…REAL_OUTAGE,source}`
  Order: criticality weight desc, then peak_load_tons desc. `load_factor = clamp((temp_f − 55)/40, 0.3, 1.0)`;
  `chillers_needed = ceil(peak_load_tons × load_factor / 400)`. `priority_only` stages chillers only
  for patient_care + research_lab (`staged=false` for the rest, excluded from totals).
- `backtest` → `threshold, failures[{event_id,asset_id,system,failure_date,first_due_date,lead_days,
  energy_over_expected_pct_at_flag}], false_alarm_days, healthy_assets, decoys[{event_id,label,
  ignored,reason}], sweep[{threshold,mean_lead_days,min_lead_days,false_alarm_days,missed}],
  aligned_curves[{event_id,asset_id,points[{days_before,risk}]}]`
  False-alarm day = an asset-day in `INSPECTION_DUE` with no failure on that asset within 21 days after.
- `workOrders` → `work_orders[WorkOrder]`; `approveWorkOrder` / `dismissWorkOrder` → the updated `WorkOrder`.
- `ask` → `question, as_of, answer, entities[{kind: asset|building|segment, id, label}],
  proposed_actions[{kind:"draft_work_order", work_order: WorkOrder}], generated_by`
  Proposed actions are never auto-executed; they appear as `PENDING_APPROVAL`.
- `events` → `events[Event]`

---

## 5. C3 mapping (authoritative — the C3 layout wins)

The app is **one C3 package: `pkg22bc8209/`**. Everything runnable lives inside it; the root folders
`contract/`, `docs/`, `model/`, `agent/`, `data/`, `network/`, `ui/` hold only docs/fixtures. Do not
create code in them. Do not rename the package.

### 5.1 Tables → C3 entity types (`pkg22bc8209/src/<Type>.c3typ`)

Field names are the contract's snake_case names. Dates are ISO strings. **One deviation:** the
asset category column is `asset_type` on the C3 `Asset` type because `type` is a reserved platform
word — API payloads still use the contract key `type`.

| Contract table | C3 type | Seed location (JSON array, string ids for refs, omit null keys) | Owner |
|---|---|---|---|
| plants.csv | `Plant` (`name` built-in, `lat`, `lon`) | `pkg22bc8209/data/Plant/*.json` | Devansh |
| segments.csv | `LoopSegment` (`plant`) | `pkg22bc8209/data/LoopSegment/*.json` | Devansh |
| buildings.csv | `Building` (`segment`, `criticality`, `year_built`, `gsf`, `peak_load_tons`, `lat`, `lon`, `source`) | `pkg22bc8209/data/Building/*.json` | Devansh |
| assets.csv | `Asset` (`system`, `asset_type`, `segment`, `building`, `age_years`, `install_year`) | `pkg22bc8209/data/Asset/*.json` | Devansh |
| weather_daily.csv | `WeatherDay` (id = date) | `pkg22bc8209/data/WeatherDay/*.json` | Devansh |
| sensor_daily.csv | `SensorReading` (id = `<asset_id>_<date>`) | `pkg22bc8209/data/SensorReading/*.json`, chunk by month | Devansh |
| events.csv | `FailureEvent` (`kind`, `asset`, `onset_date`, `date`, `end_date`, `label`, `synthetic`) | `pkg22bc8209/data/FailureEvent/*.json` | Devansh |
| risk_daily.csv | `RiskScore` — **not a file**: `RiskModel.score_all(3.0)` computes and persists it | — | Vibhrav |
| work_orders | `WorkOrder` (id `WO 26-0NNNNN`, member methods `approve`, `dismiss`) | `pkg22bc8209/data/WorkOrder/*.json` (history rows) | Vibhrav |

Seed rules: JSON **arrays**; every row has `id` and all required fields; references are plain id
strings (`"segment": "S3"`); **omit keys whose value is null** (the loader rejects `null` for
doubles); a file with exactly one row must be named `<id>.json`. The generator script lives at
`tools/datagen/` (repo root, outside the package) and writes these JSON files. After changing seed
files, the integrator runs `upsertSeedData`.

### 5.2 Data calls → C3 methods (all return `json` in the exact fixture shape)

Arguments are passed to `c3Action` / `c3MemberAction` as a **positional array**, in the order of
the C3 method signature (this is how the template's own `shared/api.ts` calls the backend:
`c3Action('User', 'fetch', [{ limit: -1 }])`).

| Contract call | C3 call | `ui/react` invocation via `@/c3Action` |
|---|---|---|
| `campusSnapshot(asOf)` | `CampusSnapshot.compute(as_of)` | `c3Action('CampusSnapshot', 'compute', [asOf])` |
| `building(buildingId, asOf)` | `BuildingDashboard.compute(building_id, as_of)` | `c3Action('BuildingDashboard', 'compute', [buildingId, asOf])` |
| `assetHistory(assetId)` | `AssetHistory.get(asset_id)` | `c3Action('AssetHistory', 'get', [assetId])` |
| `briefing(assetId, asOf)` | `Briefing.generate(asset_id, as_of)` | `c3Action('Briefing', 'generate', [assetId, asOf])` |
| `simulatePlanB(seg, tempF, priorityOnly)` | `PlanB.simulate(segment_id, temp_f, priority_only)` | `c3Action('PlanB', 'simulate', [segmentId, tempF, priorityOnly])` |
| `backtest(threshold)` | `Backtest.run(threshold)` | `c3Action('Backtest', 'run', [threshold])` |
| `workOrders()` | built-in `WorkOrder.fetch` | `c3Action('WorkOrder', 'fetch', [{ include: 'this, asset.id', limit: -1, order: 'descending(drafted_on)' }])` → `.objs`; map `id`→`wo_id`, `asset.id`→`asset_id` |
| `approveWorkOrder(woId, approver)` | member `WorkOrder.approve(approver)` | `c3MemberAction('WorkOrder', 'approve', { id: woId }, [approver])` |
| `dismissWorkOrder(woId, reason)` | member `WorkOrder.dismiss(reason)` | `c3MemberAction('WorkOrder', 'dismiss', { id: woId }, [reason])` |
| `ask(question, asOf)` | `FacilitiesAgent.ask(question, as_of)` | `c3Action('FacilitiesAgent', 'ask', [question, asOf])` |
| `events()` | built-in `FailureEvent.fetch` | `c3Action('FailureEvent', 'fetch', [{ include: 'this, asset.id', limit: -1 }])` → `.objs`; map `id`→`event_id`, `asset?.id`→`asset_id` |

Every C3 method above has been smoke-tested on real seed data and returns the fixture keys. The
`type` key in `QueueItem` / `assetHistory.asset` is present as in the fixtures. **Arnav: the first
real browser call confirms the argument convention end-to-end — if the server rejects the array
form, tell Vibhrav before working around it.**

### 5.3 Fixtures and the `USE_FIXTURES` switch

The fixtures are now **also loaded as seed data**, so the backend returns fixture-equivalent
payloads from minute one. If you develop the UI outside C3 Code (no backend), keep a
`VITE_USE_FIXTURES` env switch that reads `contract/fixtures/*.json`; it must default to **off**,
never be committed on, and `main` must never depend on it (RUBRIC: "no fixture flags left on").

### 5.4 Folder ownership → C3 paths (strict; same rule as RULES §3)

| Owner | Plan folders | C3 paths you may edit |
|---|---|---|
| Vibhrav | `model/`, `agent/`, `contract/`, `docs/` | `pkg22bc8209/src/{RiskModel,RiskScore,CampusSnapshot,BuildingDashboard,AssetHistory,Backtest,Briefing,FacilitiesAgent,WorkOrder}.*`, all `*.c3typ`, `pkg22bc8209/data/{WorkOrder,RiskScore}/`, package manifest, `pkg22bc8209/src/WORKSPACE_SUMMARY.md` |
| Devansh | `data/`, `network/` | `pkg22bc8209/data/{Plant,LoopSegment,Building,Asset,WeatherDay,SensorReading,FailureEvent}/`, `pkg22bc8209/src/PlanB.py`, `pkg22bc8209/src/SyntheticData.*` (if created), `tools/datagen/` |
| Arnav | `ui/shell/`, `ui/shared/api/`, shared tokens/StatusPill/SystemIcon/KpiTile/Schematic/ProvenanceChip, pages overview/planb/backtest/buildings | `pkg22bc8209/ui/react/src/App.tsx`, `config/navigation.ts`, `components/{SideNav,TopNav}/`, `shared/api/` (Anuva adds her own files there), `components/{StatusPill,SystemIcon,KpiTile,Schematic,ProvenanceChip}/`, `styles/` tokens additions, `pages/{Overview,PlanB,Backtest,Buildings}/`, `contexts/AsOfProvider*` |
| Anuva | pages building/asset/workorders, agent drawer, shared RiskChart/Sparkline/SignalBars/WorkOrderCard | `pkg22bc8209/ui/react/src/pages/{Building,Asset,WorkOrders}/`, `components/{RiskChart,Sparkline,SignalBars,WorkOrderCard,AgentDrawer}/`, her own files under `shared/api/` |

Nobody edits `pkg22bc8209/ui/react/src/components/ui/` (vendored C3 design system). The shell
(`App.tsx` + `navigation.ts`) is Arnav's: others request routes from him.
`pkg22bc8209/src/WORKSPACE_SUMMARY.md`: each owner edits only their own `## <Name>` section.

### 5.5 Changes to the type definitions

A `.c3typ` change is a contract change: Vibhrav only, by PR, announced. Adding a field to a type
is additive and fine after 12:30; renaming/removing is not.
