> ## C3 quickstart (added after the scaffold landed — read this first)
> **Your paths:** `pkg22bc8209/src/*.c3typ` (all types), `pkg22bc8209/src/{RiskModel,RiskScore,CampusSnapshot,BuildingDashboard,AssetHistory,Backtest,Briefing,FacilitiesAgent,WorkOrder}.py`, `pkg22bc8209/data/{WorkOrder,RiskScore}/`, `docs/`, `contract/`, package manifest, your section of `pkg22bc8209/src/WORKSPACE_SUMMARY.md`.
> **Already done on `main`:** all types; all 9 API calls implemented and smoke-tested; `RiskModel.score_all(threshold)` written (ML.md §1–2) but **not yet run** — only 31 fixture days of S3-PIPE sensors exist.
> **Next:** when Devansh's sensor seed lands → `upsertSeedData` → `runJsCode: RiskModel.score_all(3.0)` → `Backtest.run(3.0)`: S3-PIPE first due ≈ Jun 9, decoys ignored. Then LLM briefing (`generated_by: 'llm'`, template fallback) — only after 1:30 if stable.
> **Verify:** `runJsCode` the call; `gen/cache/Pkg.Issue/` empty; `.c3typ` changes announced (contract).

# Brief: Vibhrav — ML, agent backend, integrator

> Paste everything below the line into your coding agent.

---

You are the coding agent for **Vibhrav** on team zeroday@c3, building "Before It Breaks" in C3 Code.
Three other agents work in parallel on other folders. First read `AGENTS.md`, `docs/RULES.md`,
`docs/CONTRACT.md`, `docs/ML.md`, `docs/RUBRIC.md`. Work on branch `vibhrav/ml` (or a fresh
`vibhrav/<topic>` from `main`). Never commit to `main`.

**Be creative.** The specs and deliverables below are a starting point: improve, simplify or rethink anything that isn't the contract, folder ownership, git rules or honesty labels. Keep it simple enough to work reliably in the demo — something smaller that works beats something bigger that doesn't.

**You own:** `model/`, `agent/`. (Vibhrav also owns `contract/` and `docs/`, but do not edit those
unless he explicitly asks.) **Read-only for you:** `data/`, `network/`, `ui/`.

**You consume:** `data/seed/*.csv` (from Devansh). Until it lands, generate a tiny local stand-in that
matches CONTRACT §3 exactly and delete it once real seed data is merged.

**You produce (exact shapes in `contract/fixtures/`):** `risk_daily.csv`, `campusSnapshot(asOf)`,
`building(buildingId, asOf)` (except the `plan_b` field, which calls Devansh's `simulatePlanB`),
`assetHistory(assetId)`, `backtest(threshold)`, `briefing(assetId, asOf)`, `workOrders()`,
`approveWorkOrder`, `dismissWorkOrder`, `ask(question, asOf)`.

## Deliverables in order
1. **By 12:30** — `model/`: risk score per ML.md §2 on seed v1; write `risk_daily`; expose
   `campusSnapshot` matching `campus_snapshot.json`. Morning brief can be a template string for now.
2. **By 1:15** — energy baseline (ML.md §1), all failures/decoys, `assetHistory`, `backtest` with sweep.
3. **By 1:30** — `agent/`: `briefing` (template first, see below), work-order drafting with IDs
   `WO 26-0NNNNN`, approve/dismiss persisted.
4. **P1 after 1:30 if stable** — LLM briefing + `ask` using tools that call the functions above
   (`campusSnapshot`, `assetHistory`, `simulatePlanB`). Template fallback must remain if the LLM fails.

## Briefing template (must work without an LLM)
Headline: "Inspection due: {name}, {age} years old."
Text: "{driver_label} for {n} days. Running {energy_over_expected_pct}% over its normal energy use.
Serves {n_buildings} buildings, including {top 2 by criticality}. If it fails: {chillers} temporary
chillers, about ${cost_per_day}/day." (last sentence cooling only)
Work order: title "Inspect {name}", priority 1 if INSPECTION_DUE and impact in top quartile else 2,
crew by system (cooling/heating: "Utilities – Piping" or "HVAC – Mechanical"; air: "HVAC – Mechanical"),
est_hours 4–8, status PENDING_APPROVAL, drafted_by "agent".

## Agent rules
- Never auto-approve or execute anything. Every action ends as PENDING_APPROVAL.
- Answers only use numbers returned by the tool calls — no invented facts.

## Acceptance checks (ML.md §7 plus)
- Every failure flagged 5–10 days early at threshold 3.0; S3-PIPE first due around Jun 9; decoys ignored.
- Every call's JSON matches its fixture keys and types exactly (write a quick shape check).
- Briefing reads well aloud for S3-PIPE on Jun 9 and VIL-UH-2 on its warning date.

## Integrator duties (Vibhrav the human, not the agent)
Merge PRs at checkpoints (data → model/network → agent → UI), run the app after each merge, revert
anything that breaks `main`, fill in CONTRACT §5 "C3 mapping", tag `demo-v1` at 2:15, run the
RUBRIC.md checklist at 2:10.

Rubric impact: Implementation (depth, completeness), Feasibility (honest backtest), Creativity (agent + Plan B story).
