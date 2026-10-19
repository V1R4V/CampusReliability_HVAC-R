# Workspace Summary — Before It Breaks (team zeroday@c3)

> Work-to-date map of the C3 package `pkg22bc8209`. Each owner edits **only their own section**.
> Plan, contract and rules live at the repo root: `docs/PLAN.md`, `docs/CONTRACT.md` (§5 = C3 mapping),
> `docs/RULES.md`, `AGENTS.md`.

## Vibhrav (types, model, agent, integration)

**Backend types (`src/*.c3typ`, snake_case per contract):**
- Entities: `Plant`, `LoopSegment`, `Building`, `Asset` (category field is `asset_type`), `WeatherDay`,
  `SensorReading`, `RiskScore` (+ `driver_label`, `days_in_status`), `FailureEvent`, `WorkOrder`
  (member `approve(approver)`, `dismiss(reason)`).
- API types (static methods returning `json` in the exact fixture shapes): `CampusSnapshot.compute(as_of)`
  + `CampusSnapshot.queue(as_of)` (shared ranking), `BuildingDashboard.compute(building_id, as_of)`,
  `AssetHistory.get(asset_id)`, `Briefing.generate(asset_id, as_of)` (template; drafts a PENDING_APPROVAL
  WorkOrder), `PlanB.simulate(segment_id, temp_f, priority_only)`, `Backtest.run(threshold)`,
  `FacilitiesAgent.ask(question, as_of)` (template; intents: inspect / plan B / energy).
- `RiskModel.score_all(threshold)` — ML.md §1–2 in pandas/numpy; writes `RiskScore` rows (4,860 rows,
  ~4 s). Energy baseline returns NaN when the day's degree-days are outside the fitted range (no
  extrapolation → energy excluded that day).
- **Forecast layer (ML.md §8):** `RiskModel.forecast_all()` → `RiskForecast` rows (asset × day × method,
  19,440 rows, ~12 s) with P(fail within 7/14/30 d) from four methods — `heuristic` (logistic
  calibration of risk), `classifier` (L2 logistic on 8 features), `monte_carlo` (1,000 paths of
  age-normalised risk drift; p10/p50/p90 days to failure), `weibull` (ASHRAE age baseline). Trained
  methods are leave-one-failure-out; numpy/scipy only (no sklearn in the default runtime).
  API: `RiskForecast.compare(asset_id, as_of)` and `RiskForecast.campus(as_of)` (CONTRACT §5.2).
  Run order after a seed change: `upsertSeedData` → `score_all(3.0)` → `forecast_all()`.
- Seed: `WeatherDay` is **real** NOAA GHCN-Daily USW00014837 (tavg derived); `SensorReading` is synthetic
  from `tools/datagen/interim_generator.py` (stdlib only; F1–F5, D1/D2/D4 planted; D3 is the real
  Jul 12–17 heat wave).
- Both `score_all` and `forecast_all` **wipe their table before writing** (`removeAll({}, True)`):
  `mergeBatch` only touches non-null fields, so a value that becomes unknown in a rerun would
  otherwise keep the stale number from the previous run.
- All Python impls in `src/*.py`; fetch helpers return Python lists (C3 arrays have no `.sort`).

**Validation on the interim seed (runJsCode, 2026-10-19; ML.md §7):** all 5 failures flagged, leads
F1 6 / F2 6 / F3 6 / F4 9 / F5 7 days, S3-PIPE first due Jun 8; decoys D1–D4 ignored; **2 false-alarm
days at 3.0** (S4-PIPE May 16–17, +7.9 % energy in the first mid-May warm spell on a 54-year-old main —
reported, not tuned away), 0 at 3.25–3.5. `forecast_all` 19,440 rows in ~10 s; S3-PIPE on Jun 9:
heuristic 0.92 / classifier 0.72 / Monte Carlo 0.94 (p50 3 d) / Weibull 0.002 → consensus 0.86;
every healthy asset ≤ 0.06. Biggest fix along the way: the first warm days of spring read as "+300 %
energy" on every chiller until the baseline stopped extrapolating without degree-day support.

**Smoke tests (runJsCode, 2026-06-09):** all 7 API calls return contract keys; PlanB S3 = 18 chillers /
$66,672/day (matches fixture); BuildingDashboard van_vleck_hall plan_b = rank 6 / 1 chiller / $3,704;
WorkOrder approve/dismiss persist and reload.

**Forecast UI (wired, `npm run build` green):** `shared/api/forecast.ts` (`fetchRiskForecast`,
`fetchRiskForecastCampus`); `components/ForecastPanel/` — `ForecastPanel` (Asset page: consensus headline,
one row per method with 7/14/30-day bars, days-to-failure, trailing-30-day history chart, honesty labels),
`ForecastBadge` (Building page system cards: consensus P14 + a dot per method + agreement), shared
`useRiskForecast` hook/colours; `pages/Predictions/` at `/predictions` (+ nav item): per-system headline
cards (most-likely-to-fail asset per cooling / heating / air) and the full ranked table filterable by system.
Interfaces in `Interfaces.tsx` (`RiskForecastCompare`, `RiskForecastCampus`, …). Cross-boundary edits flagged
in-file: `App.tsx` route, `navigation.ts` item, `<ForecastPanel>` in `pages/Asset`, `<ForecastBadge>` in
`pages/Building`. Runtime check: UI fires `POST /api/8/RiskForecast/campus|compare`; the same calls replayed via
`runJsCode` return 20 assets / 4 methods / 31-day history (Playwright itself has no auth cookie — known limit).

**Open items:** `Briefing.generate` drafts a duplicate PENDING_APPROVAL WorkOrder on every call (see
Anuva's note) — add a dedup check. Devansh's generator replaces the interim seed by overwriting the same
file names / ids. Arnav's global as-of scrubber should replace the per-page `?asOf=` once it ships.

**Key decisions:** one package; contract snake_case kept; API methods return `json` (keeps the `type`
key, avoids ~25 result types); seed JSON omits null keys; `RiskScore` precomputed; merge-not-rebase.

## Devansh (data, network, Plan B)

- Seed JSON currently **fixture-derived placeholders** (`source: placeholder…`) in `data/{Plant,LoopSegment,
  Building,Asset,FailureEvent,WeatherDay,SensorReading,RiskScore}/`: 3 plants, 6 segments, 16 buildings,
  20 assets, 10 events, 1 weather day, 31 S3-PIPE sensor + risk days. Replace with the real pulls +
  generator output (`tools/datagen/`). Omit null keys; chunk `SensorReading` by month.
- `src/PlanB.py` implements the contract formula; refine freely.

## Arnav (shell, Overview, Plan B, Backtest, Buildings)

- UI: blank template shell (`App.tsx`, `config/navigation.ts`, `components/{SideNav,TopNav}`); no app
  routes yet. Backend calls per `docs/CONTRACT.md` §5.2.

## Anuva (Building dashboard, Asset detail, Work Orders, Agent drawer)

- **Shared components** (`ui/react/src/components/`): `RiskChart` (threshold line, shaded
  INSPECTION_DUE spans, ✕ failure markers + decoy annotations, as-of cursor, greyed future),
  `Sparkline`, `SignalBars` (contrib bars + z-sign arrow), `WorkOrderCard` (Approve/Edit/Dismiss,
  optimistic status flip, dismiss-reason modal), `AgentDrawer` (self-contained floating trigger +
  side panel, calls `FacilitiesAgent.ask`, renders entity chips + proposed work orders).
- **Pages**: `pages/Asset/Asset.tsx` (`/asset/:assetId`), `pages/Building/Building.tsx`
  (`/building/:buildingId`), `pages/WorkOrders/WorkOrders.tsx` (`/workorders`, tabs by status).
  All fetch live via `shared/api/anuva.ts` (no mock data); loading/empty/error states on every panel.
- **TEMPORARY local design tokens**: `components/RiskChart/statusColors.ts` + `Tags.tsx`
  (`StatusTag`/`WorkOrderStatusTag`/`ProvenanceTag`) hold the FRONTEND §2 hex values until Arnav's
  real tokens/`StatusPill`/`ProvenanceChip` ship — swap imports then, don't fork further.
- **TEMPORARY `asOf`**: no global scrubber yet (`contexts/AsOfProvider` is Arnav's, unbuilt), so each
  page keeps its own `asOf` in the URL query string (`?asOf=`), default `2026-06-09`. Swap the local
  `useAsOf()` hook in each page for his context in one line once it ships.
- **Cross-boundary edit (flagged, not silent):** added the three routes above + a "Work Orders" nav
  item directly to `App.tsx` / `config/navigation.ts` (Arnav's files) since no shell PR had landed —
  brief explicitly allows this ("or agree he adds them now"). Arnav: please fold into your routing
  pass and remove this note once reconciled.
- **Verified:** `npm run build` (lint + tsc + vite) green. `runJsCode` smoke-tested
  `BuildingDashboard.compute`, `AssetHistory.get`, `Briefing.generate`, `WorkOrder.fetch`
  (id/asset.id → wo_id/asset_id remap correct), `FacilitiesAgent.ask` — all return contract shapes.
  Browser check via Playwright confirmed routing/shell/error-states render correctly, but that
  Playwright session has no Genesis auth cookie (`document.cookie` is empty) so its own API calls
  redirect to Okta/CORS-fail — an environment/session limitation, not an app bug; did not work
  around it with a `c3auth` cookie bootstrap (forbidden).
- **Noted for Vibhrav:** `Briefing.generate` drafts a new PENDING_APPROVAL `WorkOrder` on *every*
  call — the Asset page calls it on every mount/asOf change, so repeated visits/demo runs will draft
  duplicate work orders for the same asset. Worth a dedup check (e.g. skip drafting if a pending WO
  for that asset already exists) before the demo.
