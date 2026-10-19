# Before It Breaks (working name) — team zeroday@c3

An agent for UW–Madison Facilities that says **"inspection due"** on whichever building system
(cooling, heating, air handling) is most likely to fail next, ranks it by the buildings and dollars
at stake, flags the energy it wastes while it degrades, drafts a work order **PENDING APPROVAL**, and
has **Plan B** ready for cooling failures.

Why: UW–Madison carries ~$1.5B in deferred maintenance. The June 17, 2026 chilled water break closed
23 buildings (11 more partly) and cost $15.8M — $10M of it renting chillers because campus was caught
unprepared.

## Team

| Person  | Owns |
|---------|------|
| Vibhrav | ML risk model, agent backend, **integrator (only person who merges to `main`)** |
| Devansh | Data pipeline (real + synthetic), network topology, Plan B compute |
| Arnav   | UI: app shell, Overview, Plan B, Backtest, Buildings index |
| Anuva   | UI: Building dashboard, Asset detail, Work Orders, Agent drawer |

## Start here (humans and agents)

1. [`AGENTS.md`](AGENTS.md) — rules every coding agent follows. Read first.
2. [`docs/RULES.md`](docs/RULES.md) — git, branches, merges, ownership.
3. [`docs/CONTRACT.md`](docs/CONTRACT.md) — the single source of truth for data types and API shapes.
4. Your brief: [`docs/briefs/`](docs/briefs/) — paste it into your agent.
5. Background: [`docs/PLAN.md`](docs/PLAN.md), [`docs/FRONTEND.md`](docs/FRONTEND.md),
   [`docs/DATA.md`](docs/DATA.md), [`docs/ML.md`](docs/ML.md).

## Repo layout

```
contract/fixtures/   example JSON for every data call (UI builds against these first)
data/                Devansh — real data pulls + synthetic generator + seed CSVs
network/             Devansh — loop topology, impact, Plan B
model/               Vibhrav — energy baseline, risk score, backtest
agent/               Vibhrav — briefings, work orders, ask()
ui/                  Arnav + Anuva — pages and shared components
docs/                plan, rules, contract, specs, briefs
```

If C3 Code requires its own project layout, that layout wins; ownership maps onto it (see RULES.md).
