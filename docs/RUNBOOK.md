# Runbook — running, re-seeding, re-scoring, testing and screenshotting Before It Breaks

Owner: Vibhrav (integrator). Everything runnable lives in the one C3 package `pkg22bc8209/`.
This is the operational companion to `README.md` (what/why), `CONTRACT.md` (shapes) and `ML.md` (model).

## 1. One-time orientation
- Read `AGENTS.md`, then `pkg22bc8209/src/WORKSPACE_SUMMARY.md` (one section per owner — the map of
  what exists), then this file.
- In C3 Code the app is always at `http://localhost:9000`; the UI dev server is managed for you
  (never start/stop `npm run dev`). Code changes sync to the live app automatically.

## 2. Bring the data up (after a seed change or a fresh environment)
Run order matters — each step reads the previous one's table.

| Step | Tool / call | What it does | Expect |
|---|---|---|---|
| 1 | `upsertSeedData` (MCP) | loads `pkg22bc8209/data/<Type>/*.json` (Plant, LoopSegment, Building, Asset, FailureEvent, WeatherDay, SensorReading, WorkOrder, …) | counts per type, no errors |
| 2 | `runJsCode`: `RiskModel.score_all(3.0)` | ML.md §1–2: weather-normalised energy baseline, z-scores, persistence rule → **wipes and rewrites** `RiskScore` | ~4,860 rows, ~4 s |
| 3 | `runJsCode`: `RiskModel.forecast_all()` | ML.md §8: four failure-probability methods → **wipes and rewrites** `RiskForecast` | ~19,440 rows, ~12 s |
| 4 | `runJsCode`: `Backtest.run(3.0)` | replays the planted failures + decoys (acceptance list in ML.md §7) | every failure flagged 5–10 days early, decoys ignored |

While steps 2–3 run, `CampusSnapshot.compute` and the UI briefly see empty tables — that is expected.

Smoke calls (one per API, CONTRACT §5.2) — all should return the fixture keys:
```js
CampusSnapshot.compute('2026-06-09')              // kpis, queue[20], buildings[16], segments[6], plants[3], morning_brief
BuildingDashboard.compute('chemistry_building', '2026-06-09')
AssetHistory.get('S3-PIPE')                       // 243-day series, events
Briefing.generate('S3-PIPE', '2026-06-09')        // drafts / reuses the asset's work order
PlanB.simulate('S3', 95, true)                    // priority-only staging on a 95°F day
Backtest.run(3.0)
FacilitiesAgent.ask('What should 2 crews inspect this week?', '2026-06-09')
RiskForecast.compare('S3-PIPE', '2026-06-09'); RiskForecast.campus('2026-06-09')
```

## 3. Build, lint, test
```bash
cd pkg22bc8209/ui/react
VITE_C3_PKG=pkg22bc8209 npm run build   # lint (ESLint, errors fail) → tsc → vite build; must be green before any merge
npm test                                 # jest unit tests (pure functions; no network)
```
Backend tests live in `pkg22bc8209/test/py/` and run with the `runTest` MCP tool.
Package validation: `readPkgIssues` (or `pkg22bc8209/gen/cache/Pkg.Issue/`) must show nothing critical.

## 4. Screenshots with real data (Playwright MCP)
The headless browser cannot authenticate against the C3 API (the Vite proxy forwards the user's cookie
and has no fallback), so screenshots use **real backend payloads served back to the page**:

1. Capture payloads with `runJsCode` (they persist to a tool-result file when large) and merge them with
   `node .playwright/extract-payload.js <persisted-result> [group[:id]]` → `.playwright/payloads.json`
   (converts the C3 runtime's index-keyed arrays back to arrays).
2. `cp .playwright/payloads.json pkg22bc8209/ui/react/playwright-payloads.tmp.json` — Vite serves it at
   `http://localhost:9000/<env>/<app>/uiservice/playwright-payloads.tmp.json` (untracked; never commit).
3. In `browser_run_code_unsafe`: load it with `page.request.get(...)`, register one
   `page.route('**/*', …)` handler (the `**/api/8/**` glob does not match in this build; `URL`/`import`
   are unavailable — parse `/api/8/<Type>/<method>` with a regex), fulfil API calls from the map keyed
   by `Type.method` + positional args, `route.continue()` everything else, then `page.goto(url)` **and**
   `page.reload()` per page (hash-only navigation keeps stale state). Save to `.playwright/shots/*.png`;
   use a taller viewport for long pages (`<main>` is the scroll container, so `fullPage` adds nothing).

## 5. Git (RULES.md §2–3, condensed)
Branch `<name>/<topic>` from fresh `main`; `git fetch origin && git merge origin/main` before each task
(merge, never rebase/force-push); build green + no critical package issue + screenshot for UI → squash-merge
your own PR. Vibhrav OKs anything touching a `.c3typ`, `docs/CONTRACT.md`, `contract/fixtures/`, the
manifest, `.gitignore` or another owner's path.

## 6. Demo path (FRONTEND §8) — rehearse three times
Overview on the January cold-snap warning → Asset detail → read briefing → **Approve** → click the
"Real break" flag (lands on Jun 9) → S3 turns red → S3-PIPE briefing → **Approve** → Outage plan → S3 →
**Simulate failure** → Backtest → move the threshold for ten seconds.
