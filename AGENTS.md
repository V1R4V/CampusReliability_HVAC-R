# Rules for coding agents (read before doing anything — 2 minutes)

You are one of four coding agents building **Before It Breaks** in parallel, each driven by a
different teammate. Four people commit independently; these rules keep them from colliding.

## 1. Where code goes
- **Everything runnable lives in the one C3 package `pkg22bc8209/`**: C3 types + Python in `src/`,
  seed JSON in `data/<Type>/`, React in `ui/react/src/`. Root folders (`docs/`, `contract/`, `model/`,
  `agent/`, `data/`, `network/`, `ui/`) are docs and fixtures only — never put code there.
- Your exact paths are in your brief (`docs/briefs/<name>.md`, top block) and `docs/CONTRACT.md` §5.4.
  Edit only those. Need something elsewhere → tell your human; they ping the owner.
- Never edit `pkg22bc8209/ui/react/src/components/ui/` (vendored design system), the package name or
  manifest, or anyone else's folder. In `pkg22bc8209/src/WORKSPACE_SUMMARY.md` edit only your `## <Name>` section.

## 2. Git — you commit and merge on your own
- Work on your branch (`<name>/<topic>`), e.g. `arnav/overview`. Never commit directly to `main`.
- Start every task with `git fetch origin && git merge origin/main` (merge, **never rebase/force-push**).
  If `pkg22bc8209/src/` is empty on your branch you haven't merged `main` yet.
- **You merge your own PR** (squash) when all are true: only your paths touched; `npm run build`
  passes if you touched `ui/`; `readPkgIssues`/`gen/cache/Pkg.Issue` has nothing critical if you
  touched `src/` or `data/`; the PR says what you ran. No need to wait for Vibhrav.
- Vibhrav must OK the PR **only** if it touches a `.c3typ`, `docs/CONTRACT.md`, the package manifest,
  `.gitignore`, or another owner's path.
- Broke `main`? Whoever notices runs `git revert` on the merge commit — no blame, fix on your branch.
- Small PRs (≤45 min of work). Commit messages: `<area>: <what>` (`ui/overview: ranked queue`).

## 3. The contract is law
- Field names, units, enums, and call shapes: `docs/CONTRACT.md` (+ `contract/fixtures/*.json`).
  Do not rename, add or drop fields. The `.c3typ` files are part of the contract.
- UI reads data **only** via the `c3Action` one-liners in CONTRACT §5.2, wrapped in
  `pkg22bc8209/ui/react/src/shared/api/`. Pages never call `c3Action` directly.
- The backend already returns fixture-shaped payloads from seed data. A `VITE_USE_FIXTURES` switch
  is allowed only when developing outside C3 Code; it defaults off and is never committed on.

## 4. Honesty labels
Anything not from a cited real source is labeled synthetic or estimate — in data (`source`,
`synthetic`) and in the UI (REAL / SYNTHETIC / ESTIMATE chips). Never invent real-world facts.

## 5. Be creative, finish small
Specs (`docs/FRONTEND.md`, `DATA.md`, `ML.md`) and your brief are a starting point, not a checklist.
Improve or simplify anything that isn't the contract, ownership, git rules or honesty labels.
A smaller thing that works by 1:30 beats a bigger thing that doesn't.

## Never
Force-push · rewrite history · delete branches · reformat files you didn't need to change · commit
secrets/`.env`/`node_modules`/downloads >5 MB · create `README.md` (C3 rejects it) · add a dependency
without telling your human · put `null` values in seed JSON (omit the key).

## Before saying "done"
Run it; check your brief's acceptance checks; for a new backend method give one `runJsCode` call and
its output; for UI give a screenshot; `npm run build` green. Then merge your PR.
