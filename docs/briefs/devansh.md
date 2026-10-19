# Brief: Devansh — data pipeline, network, Plan B

> Paste everything below the line into your coding agent.

---

You are the coding agent for **Devansh** on team zeroday@c3, building "Before It Breaks" in C3 Code.
Three other agents work in parallel on other folders. First read `AGENTS.md`, `docs/RULES.md`,
`docs/CONTRACT.md`, `docs/DATA.md`, `docs/RUBRIC.md`. Work on branch `devansh/data` (or a fresh
`devansh/<topic>` from `main`). Never commit to `main`.

**Be creative.** The specs and deliverables below are a starting point: improve, simplify or rethink anything that isn't the contract, folder ownership, git rules or honesty labels. Keep it simple enough to work reliably in the demo — something smaller that works beats something bigger that doesn't.

**You own:** `data/`, `network/`. **Read-only for you:** everything else.

**You produce:** `data/seed/plants.csv`, `segments.csv`, `buildings.csv`, `assets.csv`,
`weather_daily.csv`, `sensor_daily.csv`, `events.csv` (CONTRACT §3, exact columns and units);
`events()` and `simulatePlanB(segmentId, tempF, priorityOnly)` matching `contract/fixtures/events.json`
and `plan_b_S3.json`.

## Deliverables in order
1. **By 12:00 — seed v1 (crude is fine, shapes must be exact):** ~25 real building names with
   segments, 3 real plants, ~60 assets, real NOAA weather if the pull works, synthetic sensors with
   F4 (`S3-PIPE`, failure Jun 17) planted. Open a PR immediately — Vibhrav and the UI are waiting.
2. **By 12:45:** all failures F1–F5 and decoys D1–D4 + `R1` per DATA.md §5 (heating dates from
   the real coldest stretches, chiller from a real hot stretch); real building facts (year built,
   GSF, lat/lon) with a `source` for each.
3. **By 1:30:** `network/`: `simulatePlanB` per CONTRACT (order, load_factor, chillers, totals,
   priority_only, `reference` = REAL_OUTAGE) and a helper Vibhrav can call for the `plan_b` line of `building()`.

## Rules for data
- Generator is a script with a fixed random seed so output is reproducible.
- Raw downloads go in `data/raw/` (git-ignored). Commit only cleaned seed CSVs.
- Never present invented numbers as real. `source` column says where each building fact came from;
  if you estimated it, write `estimate`.
- Missing values are empty/null, never 0.
- Don't tune failures so the model "wins" — tune for realism (DATA.md §4 ranges).

## Acceptance checks (DATA.md §7)
- CSV columns/types/units match CONTRACT exactly.
- Raw cooling energy visibly rises in the real June heat; healthy assets flat-with-noise.
- S3-PIPE pressure and flow imbalance drift from ~May 30 to Jun 17.
- `simulatePlanB('S3', 95, false)` → 9 buildings incl. Bascom, Science Hall, Grainger; totals add up.

Rubric impact: Feasibility (real data, honest labels), Implementation (Plan B depth).
