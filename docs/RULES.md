# Team rules: git, branches, merges, ownership

Four people, four agents, one repo, one C3 package, ~3 hours. Optimized so **everyone commits and
merges on their own**; Vibhrav is only in the loop for contract/type changes and integration checks.

## 1. Layout
- The app is the single C3 package **`pkg22bc8209/`**. Root folders hold docs/fixtures only.
- Owner → C3 paths: **`docs/CONTRACT.md` §5.4** (also at the top of each brief). Edit only yours.
- Shell (`App.tsx`, `config/navigation.ts`) is Arnav's; others request routes from him.
- `pkg22bc8209/ui/react/src/components/ui/` (vendored design system) and the package manifest: nobody.

## 2. Branches
- Branch from fresh `main`: `<name>/<topic>` (`arnav/overview`, `devansh/seed-v1`). Starter branches
  `vibhrav/ml`, `devansh/data`, `arnav/ui`, `anuva/ui` exist; merge `origin/main` into them first.
- Before each task and before each PR: `git fetch origin && git merge origin/main`. Merge, not rebase —
  a rebased branch needs a force-push, which is forbidden. PRs are squash-merged so your merge
  commits never reach `main`.
- Never force-push. Never delete others' branches. Never commit directly to `main`
  (exception: Vibhrav for scaffold/hotfix/revert).

## 3. Self-merge rule (the important one)
You merge your own PR into `main` (squash) when **all** hold:
1. Only your paths are touched (CONTRACT §5.4).
2. If you touched `pkg22bc8209/ui/`: `npm run build` passes (it runs lint + type-check).
3. If you touched `pkg22bc8209/src/` or `pkg22bc8209/data/`: no critical issue in
   `gen/cache/Pkg.Issue/` (`readPkgIssues`), and the PR shows one `runJsCode` smoke call per new method.
4. The PR template is filled (what, paths, how verified, screenshot for UI).

Vibhrav's OK is required **only** when a PR touches: any `.c3typ`, `docs/CONTRACT.md`,
`contract/fixtures/`, the package manifest, `.gitignore`, or another owner's path.

## 4. `main` is always demoable
- Broke `main`? Whoever notices reverts the squash commit (`git revert <sha>`, push), posts in chat,
  owner fixes on their branch. No blame, no debugging on `main`.
- Integrator check (Vibhrav, in C3 Code, at each checkpoint): `git merge origin/main` →
  `upsertSeedData` → `RiskModel.score_all(3.0)` if sensor data changed → `npm run build` →
  `readPkgIssues` → click the demo path once. Backup: Devansh.

## 5. The contract
- `docs/CONTRACT.md` (+ `contract/fixtures/`, + the `.c3typ` files) defines every field, unit, enum
  and call. Change only by PR from Vibhrav, announced out loud. After 12:30 additive only.
- Backend returns the fixture shapes exactly; UI consumes only CONTRACT §5.2 calls through
  `pkg22bc8209/ui/react/src/shared/api/`.

## 6. Schedule

| Time | What |
|---|---|
| now | Scaffold on `main`: types, seed placeholders, all API calls live. Everyone merges `main` and starts |
| 12:30 | **Checkpoint 1:** shell + Overview render real backend data; seed v1 (real buildings/weather) merged |
| 12:30–1:30 | Depth: full synthetic sensors + model run, Asset detail, Building dashboard, Plan B page, briefings |
| **1:30** | **Feature freeze.** P0 merged. Fixes and polish only |
| 1:30–2:15 | Polish; run demo path 3×; fix what breaks |
| **2:15** | **Code freeze.** Vibhrav tags `demo-v1`, records backup capture |
| 2:15–3:00 | Rehearse pitch twice. Code untouched except revert to `demo-v1` |

## 7. Conflicts
- In your own paths: resolve on your branch.
- In a shared file (`WORKSPACE_SUMMARY.md`, `App.tsx`, a `.c3typ`): stop, ping the owner, resolve
  together. Never take "ours" wholesale on files you don't own.

## 8. Agents
- Agents follow `AGENTS.md`. Humans: paste your brief at the start; re-paste the "Never" list if the
  agent wanders.
- No new npm/C3 dependencies without telling the team (shared manifests).
- No secrets in code. Keys go in the platform secret store / env, never committed.
- Anything not from a cited real source is labeled synthetic or estimate in data and UI.
