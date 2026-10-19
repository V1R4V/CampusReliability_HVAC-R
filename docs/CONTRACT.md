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

## 5. C3 mapping: TBD
When the C3 Code material arrives, Vibhrav fills this in: which C3 types hold each table, where
seed data lives, how data calls are exposed (type methods / API), how the UI calls them, and which
C3 paths each owner may edit. Until then, build to the shapes above.
