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
- `RiskModel.score_all(threshold)` — ML.md §1–2 implemented in pandas/numpy; writes `RiskScore` rows.
  **Not yet run** (only 31 fixture days of S3-PIPE sensors exist); run after Devansh's full sensor seed.
- All Python impls in `src/*.py`; fetch helpers return Python lists (C3 arrays have no `.sort`).

**Smoke tests (runJsCode, 2026-06-09):** all 7 API calls return contract keys; PlanB S3 = 18 chillers /
$66,672/day (matches fixture); BuildingDashboard van_vleck_hall plan_b = rank 6 / 1 chiller / $3,704;
Backtest F4 lead_days 8, first_due 2026-06-09; WorkOrder approve/dismiss persist and reload.

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

- Nothing yet. Backend calls per `docs/CONTRACT.md` §5.2.
