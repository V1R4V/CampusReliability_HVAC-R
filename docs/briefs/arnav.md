> ## C3 quickstart (added after the scaffold landed — read this first)
> **Your paths (all under `pkg22bc8209/ui/react/src/`):** `App.tsx`, `config/navigation.ts`, `components/{SideNav,TopNav}/`, `contexts/AsOfProvider*` (global as-of date + threshold), `shared/api/index.ts` (+ Anuva adds her own files there), `components/{StatusPill,SystemIcon,KpiTile,Schematic,ProvenanceChip}/`, `styles/` token additions, `pages/{Overview,PlanB,Backtest,Buildings}/`, your section of `../../src/WORKSPACE_SUMMARY.md`. Never touch `components/ui/` (vendored design system — import from it: `@/components/ui/<name>`).
> **Backend is live.** Every data call is one line — see CONTRACT §5.2. Args are a **positional array**: `c3Action('CampusSnapshot','compute',[asOf])`, `c3Action('PlanB','simulate',[segmentId, tempF, priorityOnly])`, `c3Action('Backtest','run',[threshold])`, `c3Action('FailureEvent','fetch',[{ include: 'this, asset.id', limit: -1 }])` → `.objs` (map `id`→`event_id`, `asset?.id`→`asset_id`). Responses are exactly the fixture shapes. If the server rejects the array form, tell Vibhrav before working around it.
> **Add a page:** route in `App.tsx` `<Routes>`, nav item in `config/navigation.ts` (lucide icon). Pages render content only — the shell already draws TopNav/SideNav. Reference components: `.claude/skills/c3-frontend/references/examples/` (`DashboardPage`, `ListPage`, `DetailPage`).
> **Dev outside C3 Code:** `cd pkg22bc8209/ui/react && npm install && VITE_C3_PKG=pkg22bc8209 VITE_USE_FIXTURES=true npm run dev` — `shared/api` reads `contract/fixtures/*.json` when `import.meta.env.VITE_USE_FIXTURES === 'true'`, else calls `c3Action`. Default off; never commit it on.
> **Verify before merging:** `VITE_C3_PKG=pkg22bc8209 npm run build` (lint + tsc) green; screenshot in PR.

# Brief: Arnav — app shell, Overview, Plan B, Backtest, Buildings index

> Paste everything below the line into your coding agent.

---

You are the coding agent for **Arnav** on team zeroday@c3, building "Before It Breaks" in C3 Code.
Three other agents work in parallel; Anuva's agent builds the other UI pages. First read `AGENTS.md`,
`docs/RULES.md`, `docs/CONTRACT.md`, `docs/FRONTEND.md` (your main spec), `docs/RUBRIC.md`.
Work on branch `arnav/ui` (or a fresh `arnav/<topic>` from `main`). Never commit to `main`.

**Be creative.** The specs and deliverables below are a starting point: improve, simplify or rethink anything that isn't the contract, folder ownership, git rules or honesty labels. Keep it simple enough to work reliably in the demo — something smaller that works beats something bigger that doesn't.

**You own:** `ui/shell/`, `ui/pages/overview/`, `ui/pages/planb/`, `ui/pages/backtest/`,
`ui/pages/buildings/`, `ui/shared/api/`, and shared components: design tokens, `StatusPill`,
`SystemIcon`, `KpiTile`, `Schematic`, `ProvenanceChip`.
**Do not edit:** Anuva's pages/components (`ui/pages/building/`, `ui/pages/asset/`,
`ui/pages/workorders/`, `ui/agent-drawer/`, `RiskChart`, `Sparkline`, `SignalBars`,
`WorkOrderCard`), or anything outside `ui/`.

**Data:** only through `ui/shared/api` with `USE_FIXTURES = true` reading `contract/fixtures/*.json`
until backend PRs land. Pages never fetch directly. Calls you consume: `campusSnapshot`,
`simulatePlanB`, `backtest`, `events`.

## Deliverables in order
1. **By 12:00 (others are blocked on these):** design tokens (FRONTEND §2), `StatusPill`,
   `SystemIcon`, `KpiTile`, `ProvenanceChip`, `ui/shared/api` stub with fixture switch. PR immediately.
2. **By 12:30:** app shell — nav, routes, global `asOf` scrubber with event markers + weather chip,
   "Ask the agent" button (opens Anuva's drawer; a placeholder is fine until it exists).
3. **By 1:15:** Overview (FRONTEND §5.1) with `Schematic` + ranked queue + KPIs + morning brief.
4. **By 1:30:** Plan B page (§5.5) with simulate animation, priority toggle, real-outage tile.
5. **P1:** Backtest page (§5.7). **P2:** Buildings index (§5.2), Play button.

## Design non-negotiables
- Color = status only (tokens). Systems = icons. Light theme, projector sizes (body ≥ 16px, KPIs ≥ 40px).
- REAL / SYNTHETIC / ESTIMATE chips where FRONTEND says.
- Every panel has loading, empty and error states. No blank panels, no dead clicks.

## Acceptance checks
- Scrub Jan → Aug: Overview updates instantly; marker click on "Real break" lands ~8 days earlier.
- On ~Jun 9 S3-PIPE is #1 and S3 + its buildings show red on the schematic.
- Plan B for S3 animates in priority order; toggle changes totals; real tile shows $15.8M / ~$111K/day.
- Switching `USE_FIXTURES` to false needs no page changes.
- Screenshot every page in your PR.

Rubric impact: Design (most of it), Implementation (complete working flow).
