# Frontend spec

Owners: **Arnav** (shell, Overview, Plan B, Backtest, Buildings index) and **Anuva** (Building
dashboard, Asset detail, Work Orders, Agent drawer). Design is 5 of 20 rubric points and the demo
runs entirely through these screens.

**This is a starting point — be creative.** Wireframes show what each page must *answer*, not how
it must look. Change layouts, chart types, visuals and wording freely if it's clearer or better
looking. Only three things are fixed: the data calls/shapes (CONTRACT), status colors meaning status
only, and the REAL / SYNTHETIC / ESTIMATE labels. If something here is too much to finish, simplify it.

## 1. Who it's for
A UW FP&M utilities/facilities manager at 7am. Every screen answers one question:
1. **What needs attention today?** → Overview
2. **Why, and what do I do?** → Asset detail + agent briefing + work order
3. **What happens if I don't?** → Plan B

## 2. Design rules
- **Color means status, nothing else.**

  | Token | Hex | Use |
  |---|---|---|
  | `status-healthy` | `#2E7D32` | HEALTHY (use muted; most of campus is healthy) |
  | `status-watch` | `#F59E0B` | WATCH |
  | `status-due` | `#DC2626` | INSPECTION_DUE |
  | `status-failed` | `#111827` | FAILED |
  | `wo-pending` | `#2563EB` outline | work order PENDING_APPROVAL |
  | `wo-approved` | `#2563EB` solid | work order APPROVED |
  | `ink` / `ink-muted` | `#111827` / `#6B7280` | text |
  | `surface` / `canvas` / `border` | `#FFFFFF` / `#F7F7F5` / `#E5E7EB` | backgrounds |

- **Systems use icons, never color:** ❄ cooling, 🔥 heating, 🌀 air (or equivalent line icons), grey.
- **Light theme, projector-first.** Target 1440×900. Body ≥ 16px, labels ≥ 13px, KPI numbers ≥ 40px.
  One font family (Inter or platform default). Generous whitespace; no more than one accent per card.
- **Real vs synthetic always labeled.** Small `REAL` chip on costs, weather, building facts;
  `SYNTHETIC` chip on sensor charts; `ESTIMATE` on $/day derived figures. Judges see honesty without us saying it.
- **Status pill text** is the enum in words: Healthy, Watch, Inspection due, Failed.
- Numbers: `$67K/day`, `$15.8M`, `+8.5%`, `3.4` (risk, 1 decimal), dates `Jun 9, 2026`.

## 3. Global state
- `asOf` date — one value for the whole app, set by the scrubber. Every page re-reads data for `asOf`.
- `threshold` — default 3.0, changed only on Backtest.
- Selected system filter on Overview (All / Cooling / Heating / Air).

## 4. App shell (Arnav)
```
┌──────────────────────────────────────────────────────────────────────────┐
│ ◆ Before It Breaks   As of ◀ [====●=============] ▶  Jun 9, 2026  ▶Play │
│                      ▲Jan cold snap   ▲Jun 17 reenactment   ☀ 91°F REAL │
│                                                      [ ✦ Ask the agent ] │
├────────────┬─────────────────────────────────────────────────────────────┤
│ Overview   │                                                             │
│ Buildings  │                      page content                           │
│ Plan B     │                                                             │
│ Work Orders│                                                             │
│ Backtest   │                                                             │
└────────────┴─────────────────────────────────────────────────────────────┘
```
- Scrubber spans 2026-01-01 → 2026-08-31, step 1 day, ◀ ▶ step a day. Markers from `events()`:
  failures (red tick), `R1` real June 17 break (black tick, label "Real break"), click → jump to
  that marker's date minus 8 days (so the demo lands on the warning, not the failure).
- Weather chip: real `tmax_f` for `asOf` with label (cold snap / heat / normal) + `REAL` chip.
- "Ask the agent" opens the Agent drawer (Anuva).
- Play (P2): advances one day per 300 ms.
- URL or in-memory routing: `/overview`, `/buildings`, `/building/:id`, `/asset/:id`, `/planb/:segment?`,
  `/workorders`, `/backtest`. `asOf` persists across navigation.

## 5. Pages

### 5.1 Overview — Campus Health (Arnav, P0) · `campusSnapshot(asOf)`
```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ INSPECTION   │ WATCH        │ ENERGY WASTE │ COOLING      │
│ DUE   2      │      5       │ $1,840/day   │ EXPOSURE     │
│ ▲1 vs yday   │              │ 4 assets >5% │ $67K/day EST │
└──────────────┴──────────────┴──────────────┴──────────────┘
┌──────────── Network schematic ─────────────┬──── Inspect next ──────────┐
│ [Charter St]──S1──●Bascom ●Music Hall      │ [All][❄][🔥][🌀]           │
│      │       └─S3──●Science ●Van Hise ●…   │ 1 ❄ S3-PIPE  Chilled main  │
│ [Walnut St]──S4──●WIMR ●…                  │   Inspection due · 2 days  │
│ [WCCF]──────S6──●…                         │   risk 3.4 ▮▮▮▮▮▮▯ pressure↓│
│  (dot color = building worst status)       │   9 bldgs · $67K/day   →   │
│                                            │ 2 🔥 VIL-UH-2  Unit heater │
│                                            │   Watch · energy +6%   →   │
├────────────────────────────────────────────┴────────────────────────────┤
│ ✦ Morning brief: "2 assets need inspection. S3 chilled water main has   │
│   lost pressure for 4 days and serves 9 buildings including 2 labs…"    │
└──────────────────────────────────────────────────────────────────────────┘
```
- KPI tiles: `kpis.*`. Delta arrow only on inspection_due.
- Schematic: plants (left) → segments (lines) → buildings (dots). Line color = segment worst status,
  dot color = building worst status. Hover: name + status. Click dot → `/building/:id`;
  click segment line → `/planb/:segment`.
- Queue: `queue[]` filtered by system chip. Card: rank, system icon, asset_id + name, status pill,
  days_in_status, risk bar (0–5 scale, threshold tick), driver_label, buildings_served,
  cost_per_day_usd (cooling only), work-order badge if any. Click → `/asset/:id`.
- Morning brief: `morning_brief`, with ✦ agent mark.
- Empty state (no due/watch): "All systems within normal ranges as of <date>."

### 5.2 Buildings index (Arnav, P1) · `campusSnapshot(asOf).buildings`
Grid of cards: name, criticality badge, segment, three system status dots. Sort worst-first. Search box.
Click → `/building/:id`.

### 5.3 Building dashboard (Anuva, P0) · `building(id, asOf)`
```
Van Vleck Hall   [Instruction]  Built <year> · <gsf> GSF  REAL
Served by: Charter St Plant → Segment S3
┌── ❄ Cooling ──────┬── 🔥 Heating ──────┬── 🌀 Air handling ──┐
│ Inspection due    │ Healthy            │ Watch              │
│ via S3-PIPE       │ risk 0.8           │ risk 2.1           │
│ ~~~~~~~/\/ spark  │ ~~~~~~ spark       │ ~~~~~/ spark       │
│ energy +8.5%      │ energy +1%         │ energy +4%         │
└───────────────────┴────────────────────┴────────────────────┘
┌── Energy: actual vs weather-expected (90 days)  SYNTHETIC ──┐
│  shaded gap = waste · "Excess this month ≈ 3,100 kWh ($310)"│
└─────────────────────────────────────────────────────────────┘
┌── Assets serving this building ───┐┌── If cooling fails ────┐
│ id | type | age | status | driver ││ Priority #3 on S3      │
│ (segment-level assets included)   ││ 2 chillers · $7.4K/day │
├── Work orders ────────────────────┤│ [Simulate S3 failure →]│
│ WO 26-071213 Pending approval     │└────────────────────────┘
└───────────────────────────────────┘
```
- System card is `null` → show "Not tracked" in muted text.
- Card click → `/asset/:via_asset_id`. Asset row click → `/asset/:id`.
- "Simulate" → `/planb/:segment_id`.

### 5.4 Asset detail (Anuva, P0 — heart of the demo) · `assetHistory(id)`, `briefing(id, asOf)`
```
S3-PIPE · Chilled water main · Cooling · 61 yrs · Segment S3   [Inspection due]
┌── Risk over time (Jan–Aug 2026) ─────────────────────────── SYNTHETIC ──┐
│ 3 ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ threshold ┄┄┄┄┄┄┄/█ ✕ Jun 17     │
│        ▲ "1-day spike: ignored"              ▓▓▓ due from Jun 9          │
│                                         │ as-of cursor                   │
└──────────────────────────────────────────────────────────────────────────┘
┌── What's driving it ──────────────┐┌── ✦ Agent briefing ─────────────────┐
│ pressure     ▮▮▮▮▮▮ 41%  ↓ 6 psi  ││ Inspection due: chilled water main, │
│ flow imbal.  ▮▮▮▮ 30%    ↑ 3.1%   ││ 61 yrs. Pressure falling 4 days,    │
│ energy       ▮▮ 18%      +8.5%    ││ flow imbalance rising (leak signal).│
│ ΔT           ▮ 11%                ││ Serves 9 buildings incl. 2 labs.    │
│ [small multiples: each sensor vs  ││ If it fails: 18 chillers, ~$67K/day │
│  its 30-day normal band]          │├── Draft work order ─────────────────┤
└───────────────────────────────────┘│ WO 26-071213 · Priority 1 · Crew:   │
                                     │ Utilities – Piping · est. 6 h       │
                                     │ Pending approval                    │
                                     │ [Approve] [Edit] [Dismiss + reason] │
                                     └─────────────────────────────────────┘
```
- RiskChart: full series, threshold line, shaded `INSPECTION_DUE` spans, ✕ at failure events,
  decoy annotations with their label, vertical as-of cursor. Data after `asOf` is greyed (we only
  "know" up to asOf). F4 (S3) failure marker labeled "Reenactment of the real June 17 event".
- SignalBars: `contrib` at asOf, sorted desc, with the raw delta vs band.
- Small multiples: each non-null sensor line + `band` shading.
- Briefing panel: `headline`, `text`, `bullets`; footer "Generated by agent (template|LLM)".
- WorkOrderCard: Approve → `approveWorkOrder` → pill turns solid blue + toast "Work order approved";
  Dismiss requires a reason. Edit (P2) can be a no-op modal.
- Served buildings list with criticality badges, each linking to its dashboard.

### 5.5 Plan B — Simulate failure (Arnav, P0) · `simulatePlanB(segment, tempF, priorityOnly)`
```
Segment [S3 ▾]   Outdoor temp [ Today's real: 91°F ▾ | 95°F ]   [ Simulate failure ]
┌── Schematic (S3 buildings go dark in priority order) ──┬── Who loses cooling ─────┐
│                                                        │ 1 Chemistry  Lab   3 ch  │
│                                                        │ 2 …                      │
│                                                        │ …   total 18 chillers    │
│                                                        │ ☐ Stage priority bldgs   │
│                                                        │   only → 9 ch, $33K/day  │
├────────────────────────────────────────────────────────┴──────────────────────────┤
│ THIS SCENARIO  18 ch · $67K/day ESTIMATE │ REAL JUNE 2026  ~30 chillers · ~$111K/day │
│ 1 week early warning ≈ $466K of rentals  │ $15.8M total · 23 closed + 11 partial REAL│
└───────────────────────────────────────────────────────────────────────────────────┘
```
- Simulate: buildings dim one by one (~250 ms each) in `order`; list fills in sync. Reduced-motion: no animation.
- Priority toggle re-calls with `priorityOnly=true`; non-staged rows shown struck/muted.
- "1 week early warning ≈" = `totals.cost_per_day_usd × 7`, labeled ESTIMATE.

### 5.6 Work Orders (Anuva, P1) · `workOrders()`
Tabs: Pending approval / Approved / Dismissed. Row: wo_id, asset, building(s), priority, title,
drafted on, approved by/on. Row actions same as WorkOrderCard. Empty: "No work orders pending."

### 5.7 Backtest — "How we know" (Arnav, P1) · `backtest(threshold)`
- Threshold slider 2.0–4.0 step 0.25 (default 3.0) → re-query (or read from `sweep`).
- Table: failure, system, failure date, first "inspection due", lead days, energy over normal at flag.
- Big numbers: min/mean lead days, false-alarm days, missed.
- Chart: `aligned_curves` — all failures on x = days before failure (−21…0), threshold line.
- Decoys list: label + ✓ ignored + reason ("one-day spike — persistence rule").
- Provenance panel: REAL (weather, buildings, plants, costs, WO format) vs SYNTHETIC (sensors,
  loop layout, planted failures) — one sentence: "The failures were planted; this proves the
  pipeline, not that the real break was predictable."

### 5.8 Agent drawer (Anuva, P1) · `ask(question, asOf)`
Right slide-over, 420px. Suggested prompts as chips:
"What should 2 crews inspect this week?", "What if S3 fails on a 95°F day?",
"Which buildings are wasting the most energy?". Answer text with entity chips (click → navigate).
Proposed actions render as WorkOrderCard (Pending approval). Loading: typing indicator. Error:
"Agent unavailable — the ranked queue is still current."

## 6. Shared components (build first, by 12:00)

| Component | Owner | Props |
|---|---|---|
| tokens (colors, type scale, spacing) | Arnav | — |
| `StatusPill` | Arnav | `status`, `size?` |
| `SystemIcon` | Arnav | `system` |
| `KpiTile` | Arnav | `label`, `value`, `sub?`, `delta?`, `chip? (REAL/ESTIMATE)` |
| `Schematic` | Arnav | `plants`, `segments`, `buildings`, `highlightSegment?`, `darkened?: building_id[]`, `onBuildingClick`, `onSegmentClick` |
| `RiskChart` | Anuva | `series`, `threshold`, `events`, `asOf`, `height?` |
| `Sparkline` | Anuva | `points[{date,risk}]`, `threshold` |
| `SignalBars` | Anuva | `contrib`, `z`, `driverLabel?` |
| `WorkOrderCard` | Anuva | `workOrder`, `onApprove`, `onDismiss(reason)` |
| `ProvenanceChip` | Arnav | `kind: REAL|SYNTHETIC|ESTIMATE` |

Every component handles: loading (skeleton), empty, error (one-line message, never a blank panel).

## 7. Data access
- One module `ui/shared/api` (Arnav creates the stub at kickoff; each page owner adds only the calls
  they consume) with a single switch: `USE_FIXTURES = true` → reads `contract/fixtures/*.json`.
- Flip to real calls when backend PRs land. Pages never fetch directly.

## 8. Demo path (must be smooth, rehearse 3×)
1. Overview on the January cold-snap warning date → Vilas unit heater at top of queue.
2. Asset detail → read briefing → **Approve**.
3. Click the "Real break" marker → lands on ~Jun 9 → S3 turns red on the schematic.
4. Asset detail S3-PIPE → briefing → **Approve**.
5. Plan B → S3 → **Simulate failure** → next to the real outage tile.
6. Backtest → move the slider for 10 seconds.

## 9. Priorities
- **P0 by 1:30:** shell + scrubber, Overview, Building dashboard, Asset detail, Plan B.
- **P1:** Work Orders, Backtest, Agent drawer.
- **P2:** Buildings index, Play animation, Edit work order modal.
