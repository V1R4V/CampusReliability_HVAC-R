> ## C3 quickstart (added after the scaffold landed — read this first)
> **Your paths (all under `pkg22bc8209/ui/react/src/`):** `pages/{Building,Asset,WorkOrders}/`, `components/{RiskChart,Sparkline,SignalBars,WorkOrderCard,AgentDrawer}/`, your own files in `shared/api/` (e.g. `shared/api/anuva.ts`), your section of `../../src/WORKSPACE_SUMMARY.md`. Routes live in Arnav's `App.tsx` — ask him to add `/building/:id`, `/asset/:id`, `/workorders` (or agree he adds them now). Never touch `components/ui/` (vendored design system — import from it).
> **Backend is live.** One line per call (CONTRACT §5.2), args as a **positional array**: `c3Action('BuildingDashboard','compute',[buildingId, asOf])`, `c3Action('AssetHistory','get',[assetId])`, `c3Action('Briefing','generate',[assetId, asOf])`, `c3Action('FacilitiesAgent','ask',[question, asOf])`, `c3Action('WorkOrder','fetch',[{ include: 'this, asset.id', limit: -1, order: 'descending(drafted_on)' }])` → `.objs` (map `id`→`wo_id`, `asset.id`→`asset_id`), `c3MemberAction('WorkOrder','approve',{ id: woId },[approver])`, `c3MemberAction('WorkOrder','dismiss',{ id: woId },[reason])`. Responses are exactly the fixture shapes. Demo data today: asset `S3-PIPE`, building `van_vleck_hall`, as-of `2026-06-09`.
> **Charts:** Recharts and ECharts are already installed. Reference components: `.claude/skills/c3-frontend/references/examples/`.
> **Dev outside C3 Code:** `cd pkg22bc8209/ui/react && npm install && VITE_C3_PKG=pkg22bc8209 VITE_USE_FIXTURES=true npm run dev`. Default off; never commit it on.
> **Verify before merging:** `VITE_C3_PKG=pkg22bc8209 npm run build` green; screenshot in PR; Approve flips the pill and persists (reload shows APPROVED).

# Brief: Anuva — Building dashboard, Asset detail, Work Orders, Agent drawer

> Paste everything below the line into your coding agent.

---

You are the coding agent for **Anuva** on team zeroday@c3, building "Before It Breaks" in C3 Code.
Three other agents work in parallel; Arnav's agent builds the shell, tokens and other pages. First
read `AGENTS.md`, `docs/RULES.md`, `docs/CONTRACT.md`, `docs/FRONTEND.md` (your main spec),
`docs/RUBRIC.md`. Work on branch `anuva/ui` (or a fresh `anuva/<topic>` from `main`). Never commit to `main`.

**Be creative.** The specs and deliverables below are a starting point: improve, simplify or rethink anything that isn't the contract, folder ownership, git rules or honesty labels. Keep it simple enough to work reliably in the demo — something smaller that works beats something bigger that doesn't.

**You own:** `ui/pages/building/`, `ui/pages/asset/`, `ui/pages/workorders/`, `ui/agent-drawer/`,
and shared components `RiskChart`, `Sparkline`, `SignalBars`, `WorkOrderCard`.
**Do not edit:** Arnav's shell, tokens, `StatusPill`, `SystemIcon`, `KpiTile`, `Schematic`,
`ProvenanceChip`, his pages, or anything outside `ui/`. Import his components; never copy or fork them.
If you need a new API call in `ui/shared/api`, add only your own call functions there and tell Arnav.

**Data:** only through `ui/shared/api` (fixtures first). Calls you consume: `building`,
`assetHistory`, `briefing`, `workOrders`, `approveWorkOrder`, `dismissWorkOrder`, `ask`, `simulatePlanB` (for the building's Plan B line, via `building().plan_b`).

## Deliverables in order
1. **By 12:00 (others use these):** `RiskChart`, `Sparkline`, `SignalBars`, `WorkOrderCard` with the
   props in FRONTEND §6, rendering from fixtures. Until Arnav's tokens land, use the hex values in
   FRONTEND §2 via a local constant, then switch to his tokens. PR immediately.
2. **By 1:00:** Asset detail (FRONTEND §5.4) — the heart of the demo: risk chart with threshold,
   due spans, failure/decoy markers, as-of cursor, greyed future; signal bars; small multiples;
   briefing; work order Approve/Dismiss.
3. **By 1:30:** Building dashboard (§5.3) — header, 3 system cards, energy actual vs expected,
   assets table, work orders, "If cooling fails" card linking to Plan B.
4. **P1:** Work Orders page (§5.6), Agent drawer (§5.8).

## Design non-negotiables
- Use Arnav's tokens and `StatusPill` everywhere — one look across the app.
- S3 failure marker text: "Reenactment of the real June 17 event". Sensor charts carry SYNTHETIC chip.
- Approve gives instant feedback (pill turns solid blue + toast). Dismiss requires a reason.
- Loading/empty/error states on every panel.

## Acceptance checks
- `/asset/S3-PIPE` at asOf Jun 9: due span starts ~Jun 9, failure ✕ on Jun 17, decoy labels visible,
  data after asOf greyed, briefing + work order show; Approve flips status.
- `/building/<any>`: all three system cards render (or "Not tracked"), links work.
- Switching fixtures to real data needs no page changes.
- Screenshot every page in your PR.

Rubric impact: Design (most of it), Implementation (the demo's core interaction), Creativity (agent drawer).
