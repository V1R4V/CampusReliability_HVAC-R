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

**Integration pass (Vibhrav, after Arnav's shell landed):** Asset, Building, WorkOrders and Predictions pages
now read the one global date via `useAsOf()` (per-page `?asOf=` date pickers removed — the TopNav scrubber
drives every page); Anuva's temporary `StatusTag`/`ProvenanceTag` replaced by Arnav's `StatusPill` /
`ProvenanceChip` on those pages and the ForecastPanel; unused template files (`pages/Dashboard`,
`contexts/AppStateProvider`, `contexts/ReportStateProvider`) removed. `npm run build` green.

**Open items:** `Briefing.generate` drafts a duplicate PENDING_APPROVAL WorkOrder on every call (see
Anuva's note) — add a dedup check. Devansh's generator replaces the interim seed by overwriting the same
file names / ids. `RiskChart`/`Sparkline`/`WorkOrderCard` still read hex from `RiskChart/statusColors.ts`
(same values as the `--bib-*` tokens; cosmetic to unify). `AgentDrawer` could accept `open`/`onOpenChange`
so the TopNav button stops reaching it through the DOM.

**Key decisions:** one package; contract snake_case kept; API methods return `json` (keeps the `type`
key, avoids ~25 result types); seed JSON omits null keys; `RiskScore` precomputed; merge-not-rebase.

## Devansh (data, network, Plan B)

- Seed JSON currently **fixture-derived placeholders** (`source: placeholder…`) in `data/{Plant,LoopSegment,
  Building,Asset,FailureEvent,WeatherDay,SensorReading,RiskScore}/`: 3 plants, 6 segments, 16 buildings,
  20 assets, 10 events, 1 weather day, 31 S3-PIPE sensor + risk days. Replace with the real pulls +
  generator output (`tools/datagen/`). Omit null keys; chunk `SensorReading` by month.
- `src/PlanB.py` implements the contract formula; refine freely.

## Arnav (shell, Overview, Plan B, Backtest, Buildings)

All under `ui/react/src/`. `VITE_C3_PKG=pkg22bc8209 npm run build` green (lint + tsc + vite).

- **Data layer `shared/api/index.ts`** — the only place my pages touch the backend (CONTRACT §5.2,
  positional arrays): `campusSnapshot(asOf)` → `CampusSnapshot.compute`, `simulatePlanB(seg, tempF,
  priorityOnly)` → `PlanB.simulate`, `backtest(threshold)` → `Backtest.run`, `events()` →
  `FailureEvent.fetch({include:'this, asset.id', limit:-1}).objs` remapped (`id`→`event_id`,
  `asset.id`→`asset_id`, missing `onset_date`/`end_date` → null). Exports the contract TS types
  (`QueueItem`, `CampusSnapshot`, `PlanBResult`, `BacktestResult`, `FailureEvent`, enums), constants
  (`REPLAY_START/END`, `DEFAULT_AS_OF` = 2026-06-09, `DEFAULT_THRESHOLD`, `CHILLER_RENTAL_USD_PER_DAY`…),
  label maps (`STATUS_LABEL`, `CRITICALITY_LABEL`, `SYSTEM_LABEL`, `WO_STATUS_LABEL`), formatters
  (`formatUsd` `$67K/day`·`$15.8M`, `formatPct`, `formatRisk`, `formatDate` `Jun 9, 2026`,
  `formatThreshold`, `formatCompact`), UTC date helpers (`dayIndexOf`, `isoFromDayIndex`, `addDays`,
  `clampDate`, `MONTH_TICKS`), `withAsOf(path, asOf)` (appends `?asOf=` for pages that still read it),
  `errorMessage(err)`. `VITE_USE_FIXTURES=true` reads `contract/fixtures/*.json` instead (default off;
  `DATA_SOURCE` is shown in the side-nav footer when on). Deleted the template `shared/api.ts`
  (`fetchUsers`, unused) because a file named `api.ts` shadows the `shared/api/` directory for
  `@/shared/api` imports. Anuva's `anuva.ts` and Vibhrav's `forecast.ts` sit beside it untouched.
- **Global state `contexts/AsOfProvider.tsx`** — `useAsOf()` → `{ asOf, setAsOf, stepDay, jumpToEvent
  (event.date − 8 days), playing, togglePlay (1 day / 300 ms), threshold, setThreshold, systemFilter,
  setSystemFilter, events, snapshot, snapshotLoading, snapshotError, refreshSnapshot, buildingsById,
  segmentsById, plantsById, pendingWorkOrders }`. One debounced `campusSnapshot(asOf)` per date shared
  by the shell, Overview and Buildings; stale responses dropped; previous snapshot kept while loading;
  `asOf` persisted in sessionStorage. **Anuva / Vibhrav:** replace the per-page `?asOf=` hook with
  `const { asOf } = useAsOf()` — until then my links carry `?asOf=` via `withAsOf`.
- **Tokens `styles/before-it-breaks.css`** (imported by `App.tsx`): `--bib-status-{healthy,watch,due,
  failed,offline}` (+ `-soft` tints), `--bib-wo`, `--bib-ink/-muted`, `--bib-surface/canvas/border`,
  `--bib-series-1..5` (validated categorical palette for charts), type scale. Any element with
  `data-status="HEALTHY|WATCH|INSPECTION_DUE|FAILED|OFFLINE"` resolves `--bib-status-color` /
  `--bib-status-soft` for itself and descendants (`bg-[var(--bib-status-color)]`). Also `.bib-pill`,
  `.bib-range` (slider skin), `.bib-pulse`, `.bib-rise`, `.bib-skeleton` (all reduced-motion aware).
- **Shared components** (import `@/components/<Name>/<Name>`): `StatusPill` (`status`, `size`
  sm|md|lg; words Healthy/Watch/Inspection due/Failed; unknown → Offline; also exports `statusLabel`,
  `normalizeStatus`), `StatusPill/CriticalityBadge` (icon per use, grey), `SystemIcon` (`system`,
  `size`, `withLabel`; Snowflake/Flame/Wind + electrical/plumbing fallbacks; exports `systemLabel`),
  `ProvenanceChip` (`kind` REAL|SYNTHETIC|ESTIMATE, `size`, `title`), `KpiTile` (`label`, `value` ≥40px,
  `unit`, `sub`, `delta {value, vsLabel, upIsBad}`, `chip`, `loading`, `error`), `Schematic`
  (`plants`, `segments`, `buildings`, `highlightSegment`, `focusSegment`, `darkened[]`, `onBuildingClick`,
  `onSegmentClick`, `showLegend`; HTML/CSS, data-driven, tooltips, pulse on due dots), `Panel/Panel`
  (`Panel` card frame with title/subtitle/chip/actions; `PanelState` loading|empty|error + Retry;
  `Skeleton`), `Panel/SnapshotBanner` (stale-snapshot error banner).
- **Shell:** `App.tsx` — `AsOfProvider` → `TopNav` + `SideNav` + `<Routes>`: `/`→`/overview`,
  `/overview`, `/buildings`, `/planb/:segment?`, `/backtest` (mine); `/building/:buildingId`,
  `/asset/:assetId`, `/workorders` (Anuva), `/predictions` (Vibhrav); `*` not-found. Mounts Anuva's
  `<AgentDrawer asOf>` on every page that doesn't render its own; the TopNav "✦ Ask the agent" button
  presses that drawer's floating trigger (fallback popover if none) — **Anuva:** expose `open`/
  `onOpenChange` on `AgentDrawer` and we swap the DOM lookup for state. Forces light theme.
  `config/navigation.ts`: Overview, Buildings, Plan B, Work orders (badge = pending approvals),
  Predictions, Backtest. `components/TopNav/`: `DateScrubber` (Jan–Aug slider, ◀ ▶, Play, month ticks,
  failure markers red / "Real break" black → click lands 8 days earlier), `WeatherChip` (real tmax +
  label + REAL), `AskAgentButton`. `components/SideNav/SideNav.tsx`: SideNavPanelV2, 16px labels, no
  theme toggle, provenance legend footer.
- **Pages:** `pages/Overview/` (`Overview`, `MorningBrief`, `KpiRow`, `RankedQueue` with system Tabs,
  `RiskBar` 0–5 with threshold tick) — on Jun 9 S3-PIPE ranks #1 and S3 + its 9 buildings are red;
  `pages/PlanB/` (`PlanB`: segment chips, temp slider defaulting to today's real high + 95°F preset,
  priority-only Switch, "Simulate failure" reveal 250 ms/building syncing schematic dots, table rows
  and running totals; `OutageComparison`: scenario ESTIMATE vs real $15.8M / ~30 chillers / ~$111K/day
  (ESTIMATE) / 23 + 11 closures with cost breakdown; `LoadShedTable`); `pages/Backtest/` (`Backtest`:
  threshold slider 2.0–4.0 → global threshold + `backtest()`, KPIs from `sweep`, decoys ignored,
  failures table, provenance panel; `AlignedCurvesChart` Recharts 5 series + threshold line;
  `SweepCharts` lead days + false alarms, one axis each); `pages/Buildings/` (cards, worst-first,
  search; year/GSF rendered only if the payload ever carries them — not in the contract today).
- **Verified:** build green; `runJsCode` replays of all four calls return contract shapes on live
  seed (Jun 9: S3-PIPE risk 4.7 INSPECTION_DUE #1, 9 S3 buildings INSPECTION_DUE; PlanB S3 95°F
  priority-only 8 chillers / $29,632; Backtest 3.0: F4 lead 9 d, 14 false-alarm days).
- **Open for others:** `campusSnapshot.buildings[]` could additively carry `year_built`, `gsf`,
  `source` (Vibhrav) — the Buildings cards already render them when present.

## Anuva (Building dashboard, Asset detail, Work Orders, Agent drawer)

- **Shared components** (`ui/react/src/components/`): `RiskChart` (threshold line, shaded
  INSPECTION_DUE spans, ✕ failure markers + decoy annotations, as-of cursor, greyed future),
  `Sparkline`, `SignalBars` (contrib bars + z-sign arrow), `WorkOrderCard` (Approve/Edit/Dismiss,
  optimistic status flip, dismiss-reason modal), `AgentDrawer` (self-contained floating trigger +
  side panel, calls `FacilitiesAgent.ask`, renders entity chips + proposed work orders).
- **Pages**: `pages/Asset/Asset.tsx` (`/asset/:assetId`), `pages/Building/Building.tsx`
  (`/building/:buildingId`), `pages/WorkOrders/WorkOrders.tsx` (`/workorders`, tabs by status).
  All fetch live via `shared/api/anuva.ts` (no mock data); loading/empty/error states on every panel;
  all read `asOf` (and the inspection `threshold`) from Arnav's `AsOfProvider` — no per-page date
  control. Routes + the "Work orders" nav item live in Arnav's `App.tsx` / `config/navigation.ts`.
- **Building dashboard (FRONTEND §5.3)** — rebuilt on Arnav's shared components once his shell landed
  (`0b5b609`): header = worst-system `StatusPill` + `CriticalityBadge` + facts with a `ProvenanceChip`
  whose kind follows `building.source` (RULES §4: the payload's source is currently "placeholder…",
  so it reads SYNTHETIC and flips to REAL by itself when Devansh lands cited facts); three system cards
  (`SystemIcon`, `StatusPill`, risk vs the global threshold, `Sparkline`, energy vs expected,
  `ForecastBadge`; whole card → `/asset/:via_asset_id`; "Not tracked" when null); energy panel =
  `ComposedChart` with ink / ink-muted lines (no status colour on data series) and a range `Area`
  shading only the gap above the weather-expected baseline, beside a `KpiTile` "Energy over expected"
  (kWh, ≈$ at `ENERGY_USD_PER_KWH`, ESTIMATE chip); assets table worst-first (`STATUS_RANK`, then
  risk), row click → `/asset/:id`, capped at 100 rows; work orders via `WorkOrderCard`
  (Approve/Dismiss → refetch); "If cooling fails" `KpiTile` ($/day, priority rank, chillers for the
  peak load, ESTIMATE chip) + `Button asChild` → `/planb/:segment`. Scrubbing the date keeps the
  previous dashboard dimmed while the new one loads, with an inline error + Retry if it fails.
- **Tokens**: pages use the `--bib-*` CSS vars. `components/RiskChart/statusColors.ts` + `Tags.tsx`
  still hold the FRONTEND §2 hex values (identical to the tokens) for the SVG-heavy
  `RiskChart`/`Sparkline`/`SignalBars` and the Asset page. Follow-up: switch those strokes to
  `var(--bib-…)` like Arnav's charts and replace `Tags.tsx` with `StatusPill`/`ProvenanceChip`.
- **Verified:** `npm run build` (lint + tsc + vite) green. `runJsCode`:
  `BuildingDashboard.compute('van_vleck_hall','2026-06-09')` → cooling INSPECTION_DUE 3.21 via
  S3-PIPE (7-pt sparkline), heating/air HEALTHY (empty sparklines), 21-day energy series
  (May 20 – Jun 9, net +452 kWh), 5 assets, 2 work orders, plan_b S3 priority #6 · 1 chiller ·
  $3,704/day; `AssetHistory.get`, `Briefing.generate`, `WorkOrder.fetch` (id/asset.id →
  wo_id/asset_id remap) and `FacilitiesAgent.ask` return the contract shapes. Playwright renders the
  routes and error states, but that session has no Okta/Genesis cookie so its own API calls 302 — an
  environment limitation, not an app bug; no `c3auth` cookie bootstrap (forbidden).
- **Noted for Vibhrav:** `Briefing.generate` drafts a new PENDING_APPROVAL `WorkOrder` on *every*
  call — the Asset page calls it on every mount/asOf change, so repeated visits/demo runs will draft
  duplicate work orders for the same asset. Worth a dedup check (e.g. skip drafting if a pending WO
  for that asset already exists) before the demo. Also: `BuildingDashboard.assets` rows are
  `QueueItem`s with no `age_years`, so the §5.3 "age" column is omitted rather than invented.
