# ui/ — owners: Arnav and Anuva

Spec: `docs/FRONTEND.md`. Data only through `ui/shared/api` (fixtures first, `USE_FIXTURES` switch).

| Path | Owner |
|---|---|
| `ui/shell/` (nav, routes, as-of scrubber, weather chip) | Arnav |
| `ui/shared/api/` | Arnav creates it; Anuva may add her own call functions only |
| `ui/shared/` tokens, StatusPill, SystemIcon, KpiTile, Schematic, ProvenanceChip | Arnav |
| `ui/shared/` RiskChart, Sparkline, SignalBars, WorkOrderCard | Anuva |
| `ui/pages/overview/`, `planb/`, `backtest/`, `buildings/` | Arnav |
| `ui/pages/building/`, `asset/`, `workorders/`, `ui/agent-drawer/` | Anuva |

Use each other's components; never copy or edit them. If C3 Code imposes its own UI layout, map
these same ownership lines onto it.
