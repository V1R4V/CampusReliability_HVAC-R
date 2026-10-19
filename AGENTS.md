# Rules for coding agents (read before doing anything)

You are one of four coding agents building **Before It Breaks** in parallel, each driven by a
different teammate. Breaking someone else's work costs the whole team. Follow these rules exactly.

## The app is one C3 package: `pkg22bc8209/`
- All runnable code lives in `pkg22bc8209/` (C3 types in `src/`, Python impls in `src/`, seed JSON in
  `data/<Type>/`, React UI in `ui/react/src/`). The root folders `contract/`, `docs/`, `model/`,
  `agent/`, `data/`, `network/`, `ui/` hold **docs and fixtures only** — never create code there.
- The exact mapping from the plan's folders to C3 paths, and the C3 call for every data call, is
  **`docs/CONTRACT.md` §5**. Read it before touching anything.
- Never rename the package, edit its manifest, or edit `pkg22bc8209/ui/react/src/components/ui/`
  (vendored design system).

## Fixed vs. yours to be creative with
- **Fixed (do not change):** the data contract (`docs/CONTRACT.md` incl. §5, the `.c3typ` files,
  `contract/fixtures/`), folder ownership, git rules, and honesty labels (real / synthetic / estimate).
- **Yours:** everything else. The specs in `docs/FRONTEND.md`, `docs/DATA.md`, `docs/ML.md` and
  your brief are a **starting point, not a checklist**. Wireframes, layouts, chart styles, colors
  beyond the status colors, animations, wording, algorithms and parameters are suggestions —
  improve them, simplify them, or do something better. Keep it simple enough to finish and demo
  reliably by 1:30; a smaller thing that works beats a bigger thing that doesn't.

## Before you write code
1. Read `docs/RULES.md`, `docs/CONTRACT.md` (all of §5), and your owner's brief in `docs/briefs/<name>.md`.
2. Confirm which branch you are on (`git branch --show-current`). It must be your owner's branch
   (`vibhrav/*`, `devansh/*`, `arnav/*`, `anuva/*`). **Never commit to `main`.**
3. Pull latest `main` into your branch before starting a new task:
   `git fetch origin && git merge origin/main` (merge, not rebase — never force-push).
   If `pkg22bc8209/src/` is empty on your branch, you have not merged `main` yet.

## What you may edit
- Only the C3 paths your owner owns — the table in `docs/CONTRACT.md` §5.4. Everything else is
  read-only to you.
- If you need a change elsewhere (another owner's path, a `.c3typ`, `docs/CONTRACT.md`, `App.tsx`,
  `navigation.ts`), **stop and tell your human**. They will ask the owner. Do not "just fix it".
- `pkg22bc8209/src/WORKSPACE_SUMMARY.md`: edit only your own `## <Name>` section.

## The contract is law
- Names, fields, units, and enums come from `docs/CONTRACT.md`. Do not rename, add, or drop fields.
- UI code reads data **only** through the calls in CONTRACT §5.2 (via `@/c3Action`), wrapped in
  `pkg22bc8209/ui/react/src/shared/api/`. Pages never call `c3Action` directly.
- The backend already returns fixture-shaped payloads from seed data. A `VITE_USE_FIXTURES`
  switch is allowed only for development outside C3 Code; it defaults off and is never committed on.
- Backend code returns exactly the shapes in the contract, validated against the fixtures.

## Never
- Force-push, rewrite shared history, or delete branches.
- Reformat, re-indent, or "clean up" files you did not need to change.
- Delete or move files you did not create.
- Commit secrets/API keys, `.env` files, `node_modules`, virtualenvs, or raw downloads > 5 MB.
- Create files named `README.md` (C3 rejects them). Name docs after their folder, e.g. `ui/ui.md`.
- Add a new npm or C3 dependency without telling your human (it touches shared config).
- Invent real-world facts. Anything not from a cited source is labeled synthetic or estimate.
- Put `null` values in seed JSON — omit the key instead (the loader rejects `null` for numbers).

## Always
- Small commits with clear messages: `<area>: <what>` (e.g. `ui/overview: ranked queue cards`).
- Before saying "done": `npm run build` passes (type-check + lint); each new backend method has
  one `runJsCode` smoke call; check the acceptance checks in your brief; say exactly what you verified.
- Open a PR into `main` using the template; Vibhrav merges. Keep PRs small (under ~45 min of work).
