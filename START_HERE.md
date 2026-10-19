# Before It Breaks — team zeroday@c3 · START HERE

An agent for UW–Madison Facilities that says **"inspection due"** on whichever building system
(cooling, heating, air handling) is most likely to fail next, ranks it by the buildings and dollars
at stake, flags the energy it wastes while it degrades, drafts a work order **PENDING APPROVAL**, and
has **Plan B** ready for cooling failures. Why: ~$1.5B deferred maintenance; the June 17, 2026
chilled-water break closed 23 buildings and cost $15.8M — $10M of it renting chillers.

## The app is one C3 package: `pkg22bc8209/`
It is already on `main` with every type, placeholder seed data, and all 9 backend calls working.
You build your part inside it. Root folders are docs only.

## Your 5-minute start (everyone)
1. `git fetch origin && git checkout <your-branch> && git merge origin/main`
   (your branch: `vibhrav/ml`, `devansh/data`, `arnav/ui`, `anuva/ui`, or a new `<name>/<topic>`).
   In C3 Code: Git dropdown → switch to your branch → pull `main`.
2. Read `AGENTS.md` (2 min) and the **top block of your brief** `docs/briefs/<name>.md` — it lists
   your exact folders, your first deliverable and the commands to verify it.
3. Paste your brief into your coding agent. Start.
4. Commit small, `git merge origin/main` often, open a PR, **merge it yourself** when the gate in
   `docs/RULES.md` §3 passes. Don't wait for anyone.
5. UI people outside C3 Code: `cd pkg22bc8209/ui/react && npm install && VITE_C3_PKG=pkg22bc8209 VITE_USE_FIXTURES=true npm run dev`
   (fixtures = the same shapes the backend returns; switch off inside C3 Code).

## Team

| Person  | Owns | Brief |
|---------|------|-------|
| Vibhrav | risk model, agent backend, contract/types, integration | `docs/briefs/vibhrav.md` |
| Devansh | real + synthetic data, topology, Plan B | `docs/briefs/devansh.md` |
| Arnav   | UI shell, Overview, Plan B page, Backtest, Buildings index | `docs/briefs/arnav.md` |
| Anuva   | UI Building dashboard, Asset detail, Work Orders, Agent drawer | `docs/briefs/anuva.md` |

## Docs
- `AGENTS.md` — rules for agents (and humans). `docs/RULES.md` — git, self-merge gate, schedule.
- `docs/CONTRACT.md` — data contract; **§5 = C3 mapping** (types, seed, every `c3Action` call, your paths).
- `docs/PLAN.md` pitch + demo path · `docs/RUBRIC.md` how we score · `docs/FRONTEND.md` · `docs/DATA.md` · `docs/ML.md`.
- `pkg22bc8209/src/WORKSPACE_SUMMARY.md` — what exists in the package right now (edit your own section).
