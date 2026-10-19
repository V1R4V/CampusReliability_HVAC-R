# Team rules: git, branches, merges, ownership

Four people, four coding agents, one repo, ~3 hours. These rules exist so nobody's agent breaks
anyone else's work. If a rule is in the way, ask Vibhrav — don't route around it.

## 1. `main` is always demoable
- Nobody commits to `main` directly. All changes land by PR.
- **Only Vibhrav merges** into `main` (squash merge). He runs the app after every merge.
- If a merge breaks `main`, it is reverted immediately (`git revert`), then fixed on the branch.
- Recommended GitHub setting (Vibhrav): protect `main` → require PR, block force-push.

## 2. Branches
- Starter branches (already created from `main`): `vibhrav/ml`, `devansh/data`, `arnav/ui`, `anuva/ui`.
- For each new chunk of work, branch from fresh `main`: `<name>/<topic>`, e.g. `arnav/overview-queue`,
  `devansh/planb`. Short-lived: open a PR within ~45 minutes.
- Before opening a PR: `git fetch origin && git rebase origin/main`, then run your part again.
- Never force-push a branch someone else has pulled. Never delete others' branches.

## 3. Folder ownership (strict)

| Owner   | Folders |
|---------|---------|
| Vibhrav | `model/`, `agent/`, `contract/`, `docs/`, root config (`README.md`, `AGENTS.md`, `.gitignore`, package manifests, C3 package config) |
| Devansh | `data/`, `network/` |
| Arnav   | `ui/shell/`, `ui/shared/api/` (Anuva may add her own calls), `ui/pages/overview/`, `ui/pages/planb/`, `ui/pages/backtest/`, `ui/pages/buildings/`, shared: tokens, StatusPill, SystemIcon, KpiTile, Schematic |
| Anuva   | `ui/pages/building/`, `ui/pages/asset/`, `ui/pages/workorders/`, `ui/agent-drawer/`, shared: RiskChart, Sparkline, SignalBars, WorkOrderCard |

- You (and your agent) edit only your folders. Need something elsewhere → ask the owner, they make it.
- Shared UI components: the owner builds it first (by 12:00) with props from `docs/FRONTEND.md`;
  others import it, never fork or edit it.
- **If C3 Code forces its own project layout** (type files, seed folders, UI package), that layout
  wins. Vibhrav maps each owner to the matching C3 subfolders in `docs/CONTRACT.md` → "C3 mapping"
  and the same rule applies: edit only your mapped paths.

## 4. The contract
- `docs/CONTRACT.md` + `contract/fixtures/` define every type, field, unit, enum, and data call.
- Changing it: only Vibhrav, by PR, announced to the whole team out loud before merging. Additive
  changes only after 12:30 (add fields, never rename/remove).
- UI builds against fixtures from minute one. Backend output must match fixtures exactly, so
  switching from fixtures to real data is a one-line change.

## 5. Schedule and merge windows

| Time   | What |
|--------|------|
| 11:30  | Kickoff: everyone has read AGENTS.md + their brief; agents started on their branches |
| 12:00  | Shared UI components merged (Arnav, Anuva). Seed CSVs v1 merged (Devansh), crude is fine |
| **12:30** | **Checkpoint 1:** app runs end to end on `main` (shell + Overview on v1 data, even rough) |
| 12:30–1:30 | Depth: ML v1, Plan B, Asset detail, Building dashboard, briefings |
| **1:30** | **Checkpoint 2 / feature freeze.** All P0 merged. No new features after this, only fixes and polish |
| 1:30–2:15 | Polish, demo path run 3×, fix what breaks |
| **2:15** | **Code freeze.** Vibhrav tags `demo-v1`, records a backup screen capture of the demo |
| 2:15–3:00 | Rehearse pitch twice. Nobody touches code except a revert to `demo-v1` |

Merge order at each checkpoint: data → model/network → agent → UI. Vibhrav calls the window;
PRs not ready wait for the next one.

## 6. Conflicts
- A conflict inside your own folder: resolve it yourself on your branch.
- A conflict in someone else's folder or a shared file: stop, call the owner, resolve together.
  Never resolve by taking "ours" wholesale on files you don't own.

## 7. Commits and PRs
- Message format: `<area>: <what>` — e.g. `data: NOAA weather pull`, `ui/asset: approve button`.
- PR uses the template: what changed, folders touched, how verified, screenshot for UI.
- One concern per PR. No drive-by refactors.

## 8. Agents specifically
- Agents follow `AGENTS.md`. Humans: paste your brief into your agent at the start and re-paste the
  "Never" list if it starts wandering.
- No new dependencies without telling Vibhrav (shared manifests).
- No secrets in code. API keys go in the platform's secret store / env, never committed.
- Anything not from a cited real source must be labeled synthetic or estimate in data and UI.
