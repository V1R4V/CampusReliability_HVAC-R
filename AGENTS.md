# Rules for coding agents (read before doing anything)

You are one of four coding agents building **Before It Breaks** in parallel, each driven by a
different teammate. Breaking someone else's work costs the whole team. Follow these rules exactly.

## Fixed vs. yours to be creative with
- **Fixed (do not change):** the data contract (`docs/CONTRACT.md` + `contract/fixtures/`), folder
  ownership, git rules, and honesty labels (real / synthetic / estimate).
- **Yours:** everything else. The specs in `docs/FRONTEND.md`, `docs/DATA.md`, `docs/ML.md` and
  your brief are a **starting point, not a checklist**. Wireframes, layouts, chart styles, colors
  beyond the status colors, animations, wording, algorithms and parameters are suggestions —
  improve them, simplify them, or do something better. Keep it simple enough to finish and demo
  reliably by 1:30; a smaller thing that works beats a bigger thing that doesn't.

## Before you write code
1. Read `docs/RULES.md`, `docs/CONTRACT.md`, and your owner's brief in `docs/briefs/<name>.md`.
2. Confirm which branch you are on (`git branch --show-current`). It must be your owner's branch
   (`vibhrav/*`, `devansh/*`, `arnav/*`, `anuva/*`). **Never commit to `main`.**
3. Pull latest `main` into your branch before starting a new task: `git fetch origin && git rebase origin/main`.

## What you may edit
- Only the folders your owner owns (table below). Everything else is read-only to you.
- If you need a change in someone else's folder or in `contract/` / `docs/CONTRACT.md`, **stop and
  tell your human**. They will ask the owner. Do not "just fix it".

| Owner   | Folders |
|---------|---------|
| Vibhrav | `model/`, `agent/`, `contract/`, `docs/`, root config files |
| Devansh | `data/`, `network/` |
| Arnav   | `ui/shell/`, `ui/shared/api/` (Anuva may add her own call functions), `ui/shared/` (tokens, StatusPill, SystemIcon, KpiTile, Schematic, ProvenanceChip), `ui/pages/overview/`, `ui/pages/planb/`, `ui/pages/backtest/`, `ui/pages/buildings/` |
| Anuva   | `ui/shared/` (RiskChart, Sparkline, SignalBars, WorkOrderCard), `ui/pages/building/`, `ui/pages/asset/`, `ui/pages/workorders/`, `ui/agent-drawer/` |

`ui/shared/` is split by component (see `ui/ui.md`). Touch only your own components.

## The contract is law
- Names, fields, units, and enums come from `docs/CONTRACT.md`. Do not rename, add, or drop fields.
- UI code reads data **only** through the data calls in the contract. Until the real backend lands,
  use `contract/fixtures/*.json`. Swapping fixtures for real data must need no UI changes.
- Backend code must return exactly the shapes in the contract, validated against the fixtures.

## Never
- Force-push, rewrite shared history, or delete branches.
- Reformat, re-indent, or "clean up" files you did not need to change.
- Delete or move files you did not create.
- Commit secrets/API keys, `.env` files, `node_modules`, virtualenvs, or raw downloads > 5 MB.
- Create files named `README.md` (C3 upload rejects them). Name docs after their folder, e.g. `ui/ui.md`.
- Add a new dependency without telling your human (it touches shared config).
- Invent real-world facts. Anything not from a cited source is labeled synthetic or estimate.

## Always
- Small commits with clear messages: `<area>: <what>` (e.g. `ui/overview: ranked queue cards`).
- Before saying "done": run it, check it against the acceptance checks in your brief, and say
  exactly what you verified.
- Open a PR into `main` using the template; Vibhrav merges. Keep PRs small (under ~45 min of work).
