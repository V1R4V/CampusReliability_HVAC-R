# Before It Breaks — predictive maintenance + Plan B for UW–Madison campus utilities

Team **zeroday@c3** · C3 AI hackathon, Oct 19 2026 · one C3 package: `pkg22bc8209/`

On June 17, 2026 a chilled-water supply main (~4 ft wide, ~20 ft underground) broke near the
Charter Street plant. 23 buildings closed and 11 more partly closed during a statewide heat
emergency; the bill was **$15.8M, and ~$10.0M (63%) of it was renting temporary chillers**. The
expensive part was not the pipe — it was being caught unprepared. *Before It Breaks* is an agent for
UW Facilities (FP&M) that watches every monitored cooling, heating and air-handling asset on
campus against its own weather-adjusted normal, says **"inspection due"** on whichever is most
likely to fail next, ranks the queue by the buildings and dollars at stake, flags the energy each
degrading asset wastes while it degrades, drafts the work order as **PENDING APPROVAL** (a human
approves; nothing is auto-executed), and has **Plan B** — who loses cooling, in what order, how many
rental chillers, $/day — ready before the failure. It replays Jan 1 → Aug 31 2026 on real Madison
weather with a planted reenactment of the June 17 break. Fix it before it breaks.

---

## 1. What you see — the demo path (≈85 s)

Six steps, from `docs/PLAN.md` §7, with the numbers the running app produces on the current seed
(`docs/ML.md` §7, `pkg22bc8209/src/WORKSPACE_SUMMARY.md`, validated 2026-10-19):

1. **Overview on the January cold-snap warning date.** The Vilas Hall unit heater `VIL-UH-2` tops
   the ranked queue — first `INSPECTION_DUE` on **Jan 22**, six days before its planted failure on
   Jan 28. "This is what the Regents heard in 2019."
2. **Asset detail → agent briefing → Approve.** The briefing names the driving signal, the energy
   over normal and the buildings served, and the drafted work order (FP&M format `WO 26-0NNNNN`)
   flips from pending to approved.
3. **Click the black "Real break" marker on the scrubber.** It lands 8 days earlier, on **~Jun 9**;
   the S3 "Bascom Hill loop" main turns red on the schematic. `S3-PIPE` first went `INSPECTION_DUE`
   on **Jun 8**, 9 days before the Jun 17 failure, and ranks #1 with its 9 buildings. Labeled
   "Reenactment of the real June 17 event."
4. **Read the S3-PIPE briefing** — buildings served, pressure falling + flow imbalance rising (leak
   signal), energy over normal, $/day if it fails — then **Approve**. The Predictions panel on the
   same page shows the four forecasts for Jun 9: heuristic **0.92** · classifier **0.72** ·
   Monte Carlo **0.94** (days to failure p10/p50/p90 = 1/3/11) · Weibull age-only **0.002** →
   consensus **0.86** (spread 0.22). Every healthy asset that day: consensus ≤ 0.06.
5. **Plan B → S3 → Simulate failure.** Buildings go dark in criticality order, labs first; totals
   for all nine buildings: **18 chillers / $66,672 per day** (ESTIMATE), shown next to the real tile
   (**$15.8M · ~30 chillers · ~$111K/day · 23 closed + 11 partial**). Priority-only staging
   (patient care + research labs) at 95 °F: 8 chillers / $29,632 per day.
6. **Backtest → slide the threshold.** At 3.0 all five planted failures are flagged with lead
   times of **6 / 6 / 6 / 9 / 7 days**, **2 false-alarm days**, all **4 decoys ignored**. Moving the
   slider trades lead time against false alarms live.

---

## 2. Honesty / provenance

Every number in the UI carries a chip. The labels below are the ones used in the data (`source`,
`synthetic`) and on screen.

| Label | What |
|---|---|
| **REAL** | Daily weather Jan 1 – Aug 31 2026 from NOAA GHCN-Daily station `USW00014837` (Madison Dane County Regional Airport; `tavg_f` derived as (tmax+tmin)/2 where NOAA omits it). The three plants (Charter Street Heating Plant, Walnut Street Heating Plant, West Campus Cogeneration Facility) and the campus building names. The outage facts: $15.8M total, ~$10.0M rentals, ~$4.0M extra deterioration found, ~$1.8M line repair, ~30 chillers, 23 closed + 11 partial, Jun 17 → reopen Aug 10 (Cap Times Oct 8 2026; WPR; UW News). FP&M's work-order ID format `WO 26-0NNNNN` and preventive-maintenance asset categories (May 2021 Physical Plant Operations Report). |
| **SYNTHETIC** | All sensor readings (pressure, flow imbalance, ΔT, vibration, daily energy) — UW does not publish building-automation data. The chilled-water loop layout (3 plants → 6 segments → buildings) and the building-to-segment assignment. The planted failures **F1–F5** and decoys **D1–D4**. |
| **ESTIMATE** | `$3,704` per rental chiller per day (= $10M ÷ ~30 chillers ÷ ~90 days). `~$111K/day` campus rental burn in June (same arithmetic). `$0.10/kWh` for energy-waste dollars. 400 tons per rental chiller. Building `peak_load_tons` (gsf/250 for labs and patient care, gsf/400 otherwise). |

Two further caveats, stated rather than hidden:

- `F4` on `S3-PIPE` is labeled **"Reenactment of the real June 17 event"**, and `R1` (the actual
  break, `synthetic = false`) is drawn as a separate black marker. The reenactment's sensor drift is
  planted from May 30.
- In the interim seed currently in the package, building `year_built` / `gsf` carry
  `source: placeholder` (fixture-derived) pending the real pull described in `docs/DATA.md` §1;
  names and plant identities are real.

**The failures were planted; this proves the pipeline, not that the real break was predictable.**

---

## 3. Architecture

One C3 AI package, `pkg22bc8209/`. Backend = C3 entity types + Python implementations in `src/`;
seed JSON in `data/<Type>/`; React (TypeScript, Vite) in `ui/react/src/`. All risk and forecast
rows are precomputed over the whole replay, so every UI call is a cheap read and the as-of scrubber
is instant — nothing heavy runs during the demo. Root folders (`docs/`, `contract/`, `tools/`) hold
docs, fixtures and the generator only.

### Entity types (`src/*.c3typ`, contract snake_case)

| Type | Purpose | Provenance |
|---|---|---|
| `Plant` | Utility plant (`CHARTER`, `WALNUT`, `WCCF`) with lat/lon | REAL |
| `LoopSegment` | Chilled-water loop segment `S1`…`S6`, fed by one plant; `S3` is the reenactment segment | SYNTHETIC topology |
| `Building` | Campus building (slug id), segment, criticality, year/gsf, `peak_load_tons`, `source` | names REAL; assignment SYNTHETIC |
| `Asset` | Monitored equipment or pipe (`S3-PIPE`, `WAL-CHL-2`, …); `system`, `asset_type`, age | SYNTHETIC inventory, REAL categories |
| `WeatherDay` | One real day of Madison weather (id = date) | REAL |
| `SensorReading` | One synthetic daily sensor row per asset (id `<asset>_<date>`; missing = null, never 0) | SYNTHETIC |
| `FailureEvent` | Ground truth: `failure` F1–F5, `decoy` D1–D4, `real_reference` R1 | planted / REAL marker |
| `RiskScore` | Model output per asset-day: risk, status, driver, z-scores, contributions, expected energy — **computed, not seeded** | derived |
| `RiskForecast` | Per asset-day-method failure probabilities (7/14/30 d), days-to-failure, confidence — computed | derived |
| `WorkOrder` | Agent-drafted order, `PENDING_APPROVAL` → `approve(approver)` / `dismiss(reason)` members | REAL id format |

### API types and the contract calls they implement (`docs/CONTRACT.md` §5.2)

Each static method returns `json` in the exact shape of its fixture in `contract/fixtures/`.
Arguments go to `c3Action` as a positional array.

| Contract call | C3 call | Page(s) |
|---|---|---|
| `campusSnapshot(asOf)` | `CampusSnapshot.compute(as_of)` | Shell, Overview, Buildings |
| `building(buildingId, asOf)` | `BuildingDashboard.compute(building_id, as_of)` | Building dashboard |
| `assetHistory(assetId)` | `AssetHistory.get(asset_id)` | Asset detail |
| `briefing(assetId, asOf)` | `Briefing.generate(asset_id, as_of)` — template text; drafts a `PENDING_APPROVAL` work order | Asset detail |
| `simulatePlanB(seg, tempF, priorityOnly)` | `PlanB.simulate(segment_id, temp_f, priority_only)` | Plan B, Building dashboard |
| `backtest(threshold)` | `Backtest.run(threshold)` | Backtest |
| `workOrders()` | built-in `WorkOrder.fetch` | Work Orders |
| `approveWorkOrder` / `dismissWorkOrder` | member `WorkOrder.approve(approver)` / `WorkOrder.dismiss(reason)` | Asset detail, Work Orders |
| `ask(question, asOf)` | `FacilitiesAgent.ask(question, as_of)` — intents: inspect / Plan B / energy; proposed actions never executed | Agent drawer |
| `events()` | built-in `FailureEvent.fetch` | Scrubber markers, charts |
| `riskForecast(assetId, asOf)` | `RiskForecast.compare(asset_id, as_of)` | Asset detail (four probabilities side by side) |
| `riskForecastCampus(asOf)` | `RiskForecast.campus(as_of)` | Predictions |
| — | `RiskModel.score_all(threshold)` / `RiskModel.forecast_all()` | offline, writes `RiskScore` / `RiskForecast` |

### React UI (`ui/react/src/`)

- **Routes** (`App.tsx`): `/` → `/overview` · `/overview` · `/buildings` · `/building/:buildingId` ·
  `/asset/:assetId` · `/planb/:segment?` · `/workorders` · `/predictions` · `/backtest` · `*` not found.
  Pages are code-split with a per-route error boundary and a one-time chunk reload on load failure.
- **Side nav** (`config/navigation.ts`): Overview, Buildings, Plan B, Work orders (badge = pending
  approvals), Predictions, Backtest.
- **Global as-of scrubber** (`contexts/AsOfProvider.tsx`, rendered in `TopNav` outside the router):
  one `asOf` date for the whole app (Jan 1 → Aug 31 2026, ◀ ▶ step a day, Play = 1 day / 300 ms),
  failure markers in red and the "Real break" in black — clicking a marker lands 8 days before it,
  so the demo lands on the warning, not the failure. One debounced `campusSnapshot(asOf)` per date is
  shared by shell, Overview and Buildings; `asOf` persists in sessionStorage. The weather chip shows
  the real `tmax_f` for the day with a REAL chip. Threshold (default 3.0) changes only on Backtest.
- **Data layer**: pages never call `c3Action` directly; everything goes through `shared/api/`
  (`index.ts`, `anuva.ts`, `forecast.ts`). `VITE_USE_FIXTURES=true` swaps in `contract/fixtures/*.json`
  for development without a backend; it defaults off and is never committed on.
- **Design rules**: color means status only (`StatusPill`: Healthy / Watch / Inspection due /
  Failed); systems use icons, never color; REAL / SYNTHETIC / ESTIMATE `ProvenanceChip`s on costs,
  weather, sensor charts and derived dollars; light theme, projector-first; every panel has
  loading / empty / error states.

---

## 4. The ML path

Specified in `docs/ML.md`; implemented in `src/RiskModel.py` (pandas/numpy) and `src/RiskForecast.py`.

### Stage 1 — `RiskScore`: how abnormal is this asset today? (`RiskModel.score_all(threshold)`)

1. **Weather-normalized energy baseline** (degree-day regression, ASHRAE Guideline 14 style).
   Cooling `expected = a + b × CDD`, `CDD = max(0, tavg_f − 55)`; heating `a + b × HDD`,
   `HDD = max(0, 60 − tavg_f)`; air uses both. Fit on a trailing 60-day window ending 7 days before
   the scored day, so a slow degradation never teaches the baseline that "bad is normal". Days inside
   a FAILED window are excluded from every baseline window.
   **No degree-day support → expected is unknown:** a slope is trusted only when the fit window has
   ≥ 5 days with degree-days > 0 and ≥ 1 degree-day of spread, and is extrapolated at most 5
   degree-days past the window's range. Otherwise `expected` is null, the energy signal is excluded
   that day and the weights renormalise. Without this rule the first warm days of spring (a winter
   of zero CDD behind them) read as "+300% energy" on every chiller — the single largest source of
   false alarms found in testing. It is also what keeps the real July heat wave (D3) from firing.
2. **30-day z-scores per signal** against the asset's own previous 30 days (excluding today), with
   floors (pressure 0.5 psi, flow 0.2%, ΔT 0.5 °F, vibration 0.1 mm/s, energy-pct 1.0);
   direction-adjusted so positive = bad (pressure falling, flow imbalance rising, ΔT shrinking,
   vibration rising, energy over expected rising); negatives clipped to 0; then a **3-day rolling
   median** (a median removes a one-day spike outright — decoy D1 — while monotone drift passes).
3. **Risk** = `0.6 × weighted mean + 0.4 × max z`, weights pressure 0.25 · flow imbalance 0.25 ·
   ΔT 0.15 · vibration 0.15 · energy 0.20, renormalized over non-null signals. The max term exists
   because a pure weighted mean diluted a bearing failure visible only in vibration (F3 was missed).
   Multipliers: `× (1 + age_years / 60)`; heating `× 1.3` when `tavg_f < 0`; cooling `× 1.2` when
   `tmax_f > 85`. A day with all signals null carries forward the previous risk × 0.9 (D2).
   `driver` = largest weighted contribution; `contrib_*` sum to 1.
4. **Status machine** (`docs/CONTRACT.md` §2): `WATCH` at risk ≥ 2.0; `INSPECTION_DUE` at risk ≥
   threshold (default 3.0) on 2 consecutive days, held while risk ≥ 2.0 and cleared after 2
   consecutive days below; `FAILED` from a failure event's date through its `end_date`; else `HEALTHY`.
5. **Ranking** (`CampusSnapshot`): `INSPECTION_DUE` first, then `FAILED`, then `risk × impact` desc,
   where `impact = Σ CRITICALITY_WEIGHT × peak_load_tons / 500` over buildings served
   (patient_care 4, research_lab 3, instruction 2, office 1) and, for cooling only,
   `cost_per_day_usd = Σ ceil(peak_load_tons / 400) × 3704`.

Output: 4,860 `RiskScore` rows (20 assets × 243 days) in ~4 s.

### Stage 2 — `RiskForecast`: how likely is it to fail in 7 / 14 / 30 days? (`RiskModel.forecast_all()`)

Four independent methods per asset-day, so the UI shows the spread rather than one opaque number:

| Method | What it is | Trained on |
|---|---|---|
| `heuristic` | Logistic calibration of `RiskScore.risk` (capped at 8) vs "failed within horizon" | planted F1–F5, leave-one-failure-out |
| `classifier` | L2 logistic regression on 8 condition features: risk, 3- and 7-day slopes, max z, number of elevated signals, energy over expected, days at WATCH, age | planted F1–F5, leave-one-failure-out |
| `monte_carlo` | 1,000 forward paths of the age-normalised risk from the asset's own trailing 14-day drift and noise, drift growing 3%/day; probability = share of paths reaching the failure level (median pre-failure risk of the *other* failures); also p10/p50/p90 days to first crossing | nothing — the asset's own history |
| `weibull` | ASHRAE median service life by equipment type, Weibull shape 2.5 (pipes) / 3.0, conditional on survival to `age_years` | population estimate, no sensors |

`consensus` = mean of the three condition-based methods; **Weibull is excluded** and shown as the
"age alone" reference. Each row carries `confidence` (low / medium / high), a one-line `basis` and a
`trained_on` honesty label for the UI chip. Output: 19,440 rows (4,860 × 4 methods) in ~10 s.

### Runtime notes

- The default C3 Python runtime has numpy / pandas / scipy but **no scikit-learn**, so the logistic
  models are fit with `scipy.optimize` (L-BFGS) — a hackathon trade-off, not a design choice.
- Both `score_all` and `forecast_all` wipe their table before writing (`removeAll`), because
  `mergeBatch` only touches non-null fields and would keep a stale number from a previous run.
- **Run order after any seed change, one call at a time** (two concurrent `forecast_all` calls race
  on the wipe):

  ```
  upsertSeedData  →  RiskModel.score_all(3.0)  →  RiskModel.forecast_all()  →  Backtest.run(3.0)
  ```

---

## 5. Data generation

`tools/datagen/interim_generator.py` (repo root, outside the package; pure Python stdlib;
deterministic, `SEED = 20260617`) writes the two large seed tables into `pkg22bc8209/data/`:

- **`WeatherDay/weather_2026.json` — REAL.** Pulls NOAA GHCN-Daily for station `USW00014837`
  (TMAX/TMIN/TAVG, 2026-01-01 → 2026-08-31; a cached copy lives in `tools/datagen/raw/`), derives
  `tavg_f` where missing, and attaches a label (heat / hot / bitter cold / cold / cool / mild) for
  the scrubber's weather chip.
- **`SensorReading/sensors_2026-MM.json` (one file per month) — SYNTHETIC**, physically shaped per
  `docs/DATA.md` §4: each asset type reports only the sensors it physically has (a chilled-water
  main has pressure, flow imbalance, ΔT and pumping energy; a chiller has ΔT, vibration, energy; the
  rest are null). Healthy values are a fixed per-asset baseline plus Gaussian noise (pressure σ 0.8
  psi, flow σ 0.3%, vibration σ 0.15 mm/s, ISO 10816 bands). Daily energy is **driven by the real
  weather** in ASHRAE degree-day form (CDD base 55 °F, HDD base 60 °F), with a weekend effect for
  AHUs and ~2% of readings missing at random.
- **Failure modes** come from the LBNL/PNNL chiller-plant FDD fault taxonomy (which signals move for
  which fault; the dataset itself is not downloaded): leak → pressure + flow imbalance; bearing →
  vibration + energy; fouling → ΔT + energy. Each planted failure ramps its 2–3 signals convexly
  (exponent 1.9, faster near failure) from `onset_date` to the failure day, e.g. `S3-PIPE`: pressure
  −8 psi, flow imbalance +4.5%, ΔT −1.2 °F, energy +6% over weather-expected.
- **Events** are read from `data/FailureEvent/events.json`, not hardcoded: F1 `VIL-UH-2` (Jan 14 →
  Jan 28), F2 `STE-HX-1` (Feb 2 → Feb 16), F3 `WIMR-AHU-3` (Apr 2 → Apr 14), F4 `S3-PIPE` (May 30 →
  **Jun 17**, FAILED until Aug 10), F5 `WAL-CHL-2` (Jul 8 → Jul 22). Decoys D1 (one-day vibration
  spike, `CHA-CHL-1`, Mar 3), D2 (5-day full sensor dropout, `VIL-AHU-1`, May 4–8) and D4 (slow
  normal aging drift on `CHA-CHL-2` all year, never a step) are planted; **D3 needs no planting** —
  the real NOAA heat wave of Jul 12–17 (90–95 °F) raises every cooling asset's raw energy by itself.
  `R1` is the real break marker.

The interim seed also contains 3 plants, 6 segments, 16 buildings (9 on S3) and 20 assets.
Devansh's full generator (real building facts, ~25 buildings, ~60 assets per `docs/DATA.md`)
**overwrites the same file names and ids** under `pkg22bc8209/data/`, so the model, API and UI need
no changes when it lands; the run order in §4 re-derives everything.

---

## 6. Running it

**Inside C3 Code** (the intended environment)

- Code sync to the C3 environment is automatic.
- Frontend check: `cd pkg22bc8209/ui/react && VITE_C3_PKG=pkg22bc8209 npm run build` (runs lint +
  `tsc` + the Vite bundle). The app is served at `http://localhost:9000`.
- Backend, after any seed change, via the C3 console / `runJsCode`, one call at a time:
  `upsertSeedData` → `RiskModel.score_all(3.0)` → `RiskModel.forecast_all()` → `Backtest.run(3.0)`.
- Smoke checks used during the build: `CampusSnapshot.compute('2026-06-09')`,
  `AssetHistory.get('S3-PIPE')`, `Briefing.generate('S3-PIPE','2026-06-09')`,
  `PlanB.simulate('S3', 95, false)`, `Backtest.run(3.0)`, `RiskForecast.compare('S3-PIPE','2026-06-09')`,
  `RiskForecast.campus('2026-06-09')`, `FacilitiesAgent.ask(...)`, `WorkOrder.fetch(...)` — all
  return the contract keys from live seed.

**Outside C3 Code** (UI only, no backend)

```
cd pkg22bc8209/ui/react
npm install
VITE_C3_PKG=pkg22bc8209 VITE_USE_FIXTURES=true npm run dev
```

Fixtures in `contract/fixtures/` are the exact shapes the backend returns. The switch defaults off
and is shown in the side-nav footer when on; `main` never depends on it.

**Regenerating the seed**: `python3 tools/datagen/interim_generator.py [--noaa-file tools/datagen/raw/noaa_USW00014837_2026.json]`,
then the backend run order above.

---

## 7. Results and known limitations

### Backtest on the interim seed (`Backtest.run(3.0)`, 2026-10-19 — `docs/ML.md` §7)

| | F1 `VIL-UH-2` | F2 `STE-HX-1` | F3 `WIMR-AHU-3` | F4 `S3-PIPE` | F5 `WAL-CHL-2` |
|---|---|---|---|---|---|
| system | heating | heating | air | cooling | cooling |
| failure date | Jan 28 | Feb 16 | Apr 14 | **Jun 17** | Jul 22 |
| first `INSPECTION_DUE` | Jan 22 | Feb 10 | Apr 8 | **Jun 8** | Jul 15 |
| lead days | 6 | 6 | 6 | 9 | 7 |

- Decoys D1–D4: all ignored.
- **False-alarm days at 3.0: 2** — `S4-PIPE`, May 16–17: +7.9% energy in the first mid-May warm spell
  on a 54-year-old main; clears in two days. Reported, not tuned away (`docs/ML.md` §5).
- Threshold sweep: 2.5 → 7 false-alarm days; 3.25–3.5 → 0 false alarms with no misses; ≥ 3.75
  misses F3.
- Forecasts, `S3-PIPE` as of Jun 9 (8 days before F4): heuristic 0.92 · classifier 0.72 ·
  Monte Carlo 0.94 (p10/p50/p90 = 1/3/11 days) · Weibull 0.002 → consensus 0.86, spread 0.22.
  Every healthy asset that day: consensus ≤ 0.06.

### Known limitations

- **2 false-alarm days at the default threshold** (above). A threshold of 3.25–3.5 gives zero on
  this seed, but we ship 3.0 and show the slider rather than pick the flattering number.
- **Monte Carlo median is early by design.** Its p50 days-to-failure (3 days for S3-PIPE on Jun 9,
  actual 8) is the first crossing of a failure level derived from the *other* failures; it is a
  lower-bound style estimate, which is why the UI shows the p10–p90 range and all four methods.
- **The classifier and heuristic are trained on 5 planted failures**, leave-one-failure-out. That is
  enough to demonstrate calibration, not to claim generalisation; the `trained_on` chip says so.
- **The failures were planted.** Lead times measure that the pipeline detects the physically shaped
  drift we generated; they say nothing about whether the real June 17 break was detectable.
- **`Briefing.generate` drafts a duplicate `PENDING_APPROVAL` work order on every call.** The Asset
  page calls it on every mount / as-of change, so repeated visits create duplicates for the same
  asset. Open item: skip drafting when a pending order for that asset already exists.
- **Interim seed**: building year/GSF are placeholders; 16 buildings and 20 assets rather than the
  ~25 / ~60 in `docs/DATA.md`. The briefing and agent are template-generated (`generated_by:
  template`), with an LLM rewrite specified as an optional upgrade.
- In-container Playwright has no auth cookie, so browser-level API checks were replayed through
  `runJsCode` instead (an environment limit, not an app bug).

---

## 8. Team and repo map

| Person | Owns |
|---|---|
| Vibhrav | risk model, forecast layer, agent backend, contract/types, integration, pitch |
| Devansh | real + synthetic data, loop topology, Plan B compute |
| Arnav | UI shell (scrubber, nav), Overview, Plan B page, Backtest, Buildings index, shared tokens/StatusPill/Schematic/ProvenanceChip |
| Anuva | UI Building dashboard, Asset detail, Work Orders, Agent drawer, RiskChart/Sparkline/SignalBars/WorkOrderCard |

```
/usr/workspace
├── START_HERE.md, AGENTS.md          team start page; rules for coding agents
├── docs/
│   ├── PLAN.md                       problem, locked decisions, demo path, pitch, judge Q&A, sources
│   ├── RUBRIC.md                     judging rubric and how each category is addressed
│   ├── CONTRACT.md                   data contract: enums, constants, tables, calls, §5 C3 mapping
│   ├── ML.md                         risk model + four forecast methods, acceptance results
│   ├── DATA.md                       real sources, topology, synthetic sensor physics, events
│   ├── FRONTEND.md                   pages, shell, design rules
│   ├── RULES.md                      git, self-merge gate, schedule
│   └── briefs/{vibhrav,devansh,arnav,anuva}.md
├── contract/fixtures/*.json          exact payload shapes for every call (also loaded as seed v0)
├── tools/datagen/
│   ├── interim_generator.py          real NOAA pull + synthetic sensors → pkg22bc8209/data/
│   └── raw/noaa_USW00014837_2026.json
└── pkg22bc8209/                      the one C3 package (do not rename)
    ├── pkg22bc8209.c3pkg.json
    ├── src/                          *.c3typ types + *.py implementations, WORKSPACE_SUMMARY.md
    ├── data/{Plant,LoopSegment,Building,Asset,WeatherDay,SensorReading,FailureEvent,WorkOrder,RiskScore}/
    └── ui/react/src/                 App.tsx, config/navigation.ts, contexts/AsOfProvider.tsx,
                                      shared/api/, components/, pages/{Overview,Buildings,Building,
                                      Asset,PlanB,WorkOrders,Predictions,Backtest}/
```

---

## 9. Judge Q&A (honest answers)

| Question | Answer |
|---|---|
| Would this have caught the June break? | We don't know. UW is still investigating. Leaks often show first as pressure loss and flow imbalance, which we watch. Our June 17 is a labeled reenactment on synthetic data. |
| Is the data real? | Weather, buildings, plants, costs and FP&M's work-order format are real. Sensor readings, loop layout and failures are synthetic because UW doesn't publish them. The failures were planted — this proves the pipeline, not that the real break was predictable. |
| Where does $111K/day come from? | Our estimate: ~$10M rentals ÷ ~30 chillers ÷ ~90 days. |
| Why not a threshold alarm? | Each asset is compared with its own normal, energy is weather-adjusted, and drift must persist. The Backtest page shows a one-day spike, a sensor dropout and a heat wave all ignored. |
| Isn't this just predictive maintenance? | The ranking is by what's at stake across the whole campus network, and Plan B is ready before the failure — that's where 63% of the $15.8M went. |
| What would UW need to adopt it? | Read access to building-automation and work-order data, and a manager to approve work orders. No new hardware if pressure/flow are already logged — a question for FP&M. |
| Why C3? | Predictive maintenance on a utility network is C3's pattern; C3 Code built the data model, model and agent in a day. |

Sources (cited in `docs/PLAN.md` §10): UW News Jun–Aug 2026; WPR Jun 30 2026 and Feb 8 2019;
Cap Times Oct 8 2026; WMTV Jul 1 and Jul 15 2026; FP&M Physical Plant May 2021 Operations Report;
NOAA GHCN-Daily, Madison Dane County Regional Airport.
