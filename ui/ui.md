# ui/ — owners: Arnav and Anuva (docs only)

The React app is the C3 package UI: `pkg22bc8209/ui/react/src/`. Spec: `docs/FRONTEND.md`.
Backend calls: `docs/CONTRACT.md` §5.2 (every call is one `c3Action(...)` line). Ownership of C3
paths: `docs/CONTRACT.md` §5.4.

| Plan path | C3 path (`pkg22bc8209/ui/react/src/`) | Owner |
|---|---|---|
| `ui/shell/` (nav, routes, as-of scrubber, weather chip) | `App.tsx`, `config/navigation.ts`, `components/{SideNav,TopNav}/`, `contexts/AsOfProvider*` | Arnav |
| `ui/shared/api/` | `shared/api/` — Arnav creates `index.ts`; Anuva adds her own files only | Arnav (+Anuva) |
| shared tokens, StatusPill, SystemIcon, KpiTile, Schematic, ProvenanceChip | `components/<Name>/` | Arnav |
| shared RiskChart, Sparkline, SignalBars, WorkOrderCard | `components/<Name>/` | Anuva |
| `ui/pages/overview/`, `planb/`, `backtest/`, `buildings/` | `pages/{Overview,PlanB,Backtest,Buildings}/` | Arnav |
| `ui/pages/building/`, `asset/`, `workorders/`, `ui/agent-drawer/` | `pages/{Building,Asset,WorkOrders}/`, `components/AgentDrawer/` | Anuva |

`components/ui/` is the vendored C3 design system — nobody edits it; import from it. Use each
other's components; never copy or edit them. Routes are added in `App.tsx` by Arnav only.
