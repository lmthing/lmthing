# Autonomous task — build & ship the `__APP__` project-application

You are running **fully autonomously and non-interactively** (headless). No human will
answer questions during this run, so **never stop to ask** — make the best reasonable
decision, write down your assumptions, and keep going until the task is complete or you
hit a hard blocker you cannot work around. This same task fires again every 5 hours, so
if you run out of budget/time, leave the repo in a clean, committed, resumable state.

## This run: round __ROUND__ — __ROUND_MODE__

The build proceeds in **rounds**. One round is a full pass over all four apps
(blog → kitchen → health → trips). This run is **round __ROUND__** for `__APP__`, and the
size of what you add scales with the round:

- **Round 1 — CORE BUILD.** Establish the app exactly as its spec describes: the core
  database, the one project-scoped space and its agents, the core pages/api/hooks, and the
  core loop working end-to-end **with the live model**. Modest, high-quality spec
  improvements are welcome; the goal is a correct, green baseline.

- **Round 2 and every later round — FEATURE EXPANSION.** The app already exists from earlier
  rounds; now make it **dramatically bigger**. Add a **very large batch** of brand-new
  capability to BOTH the spec and the implementation, then build, test, and ship it exactly
  like round 1. On an expansion round you must add, at minimum:
    - **≥1 new project-scoped space** (a whole new specialist team under
      `store/projects/__APP__/spaces/<newspace>/`) with its own agents, tasklists, knowledge;
    - **≥3 new agents** across the spaces — each least-privilege (config-bearing
      `capabilities:` frontmatter, per-verb `tables` scope);
    - **≥5 new pages** + components (new routes, richer UX) — **design tokens only**;
    - **≥8 new API endpoints** (named, typed, described) and **≥3 new hooks** (cron/database);
    - **≥3 new database tables** (plus new columns/relations) to back all of the above;
    - substantial **new user-facing features** in the spirit of the spec's "Additional
      features" sections — but many more of them, **fully implemented**, not just described.
  More than these floors is better. **Never regress or delete what earlier rounds shipped** —
  expansion is strictly additive, and everything (old + new) must stay green and tested with
  the live model before you push. Use `PROGRESS.__APP__.md` to see what prior rounds built so
  you extend rather than duplicate.

## Ground truth (read these first, in order)

1. `app-specifications/project-as-application.md` — **the architecture you must abide by.**
   This is the canonical model: Space = agent capability; Project = the app (`database/
   pages/ api/ hooks/ package.json`) + its project-scoped spaces; capability globals; the
   typed-contract pipeline; serving; the `system-appbuilder` space. Everything you build
   must conform to it.
2. `app-specifications/__SPEC_FILE__` — **the spec for the app you are building this run**
   (`__APP__`).
3. Skim `app-specifications/project-as-application-implementation.md` if present, and
   `sdk/org/CLAUDE.md` + root `CLAUDE.md` for runtime/repo conventions.
4. `automation/app-builder/PROGRESS.__APP__.md` — **your running log for THIS app.** If it
   exists, read it first: it tells you what previous runs already did and where to resume.
   If it does not exist, create it.

## What "done" means for this run (do these phases in order)

### Phase 0 — Orient & resume
- Read `automation/app-builder/PROGRESS.__APP__.md`. Continue from the last incomplete
  step rather than redoing finished work. Keep this file updated **after every phase** —
  it is how the next 5-hour run knows where to pick up. (This is a hard requirement.)
- `git status` must be understood before you touch anything. You are on `main`.

### Phase 1 — Improve the spec (think deeply, then edit the spec file)
- **Think deeply** about `app-specifications/__SPEC_FILE__`: what improvements and feature
  additions would make `__APP__` a genuinely better, more valuable AI-assisted application —
  while staying strictly inside the parent model in `project-as-application.md` (no new
  runtime mechanisms; only data/agents/pages/api/hooks on the shared engine, exactly as the
  spec's "Additional features" sections do).
- **Edit `app-specifications/__SPEC_FILE__` in place** to fold those improvements into the spec
  (new tables/columns/endpoints/hooks/agent capabilities/pages, sharper UX, safety notes).
  Keep the document's existing structure and tone. Do not invent capabilities the parent
  plan forbids. Record what you added (and why) in the PROGRESS file.
- **Scale the batch to the round** (see "This run: round __ROUND__" above): on round 1 add a
  modest, high-quality set; on a FEATURE-EXPANSION round add a **very large** batch —
  document the new spaces, agents, pages, APIs, hooks, and tables in the spec first, then
  implement all of them in Phase 3. The spec and the implementation must stay in lockstep.

### Phase 2 — Detailed implementation plan
- Write a concrete, file-by-file implementation plan to
  `automation/app-builder/PLAN.__APP__.md`: every `database/*.json`, `pages/*.tsx`,
  `api/*/{METHOD}.ts`, `hooks/*.ts`, the project-scoped space(s) and agent `instruct.md`
  frontmatter (config-bearing `capabilities:`), `package.json`, and the test files.
  Sequence it so each step is verifiable. If a plan already exists from a prior run,
  reconcile it with your Phase-1 spec changes.

### Phase 3 — Execute the plan (build the project)
- **Create the project at `store/projects/__APP__/`** (parent repo), following the exact
  directory layout and file formats in the spec and the parent plan:
  `database/`, `pages/`, `components/`, `lib/`, `api/`, `hooks/`, `spaces/__SPACE__/`,
  `package.json`, `tsconfig.json`. `types/` and `.data/` are generated/runtime — do not
  hand-author them; make sure they are git-ignored for this project.
  On a FEATURE-EXPANSION round, also scaffold the **new** project-scoped spaces under
  `store/projects/__APP__/spaces/<newspace>/` (agents / tasklists / knowledge), and extend
  the existing space(s) with new agents — everything wired to the same project-rooted db.
- Every `database/<table>.json` table AND every column AND every relation carries a
  **required `description`** (the loader fails loud otherwise). Exactly one primary key.
  `references`/`relations` must resolve to real tables/columns.
- `api/<route>/<METHOD>.ts` handlers export `name`/`description`/`Input`/`Output` + a
  default handler. `hooks/*.ts` use the `cron`/`database` shapes from the spec. Agent
  `instruct.md` frontmatter uses the config-bearing `capabilities:` key with per-verb
  `tables` scope exactly as the spec's capability table dictates.
- **Design-system gate is mandatory** for any page/component styling: never write a raw
  color (no hex, no literal `rgb()/hsl()`, no stock Tailwind `gray-*`/`blue-*`/etc.) —
  use `@lmthing/css` tokens (`var(--foreground)`, `bg-primary`, `text-agent`, …). Run
  `pnpm lint:tokens` and keep it green.
- Keep `pnpm -w typecheck` and `pnpm -w build` green for anything you touch. If the
  runtime engine that a feature needs (e.g. the db/api/hooks host globals) is not yet
  implemented in `sdk/org/libs/{core,cli}`, implement the minimal missing piece there
  too — that is in-scope, since the app cannot be tested without it — and note it in
  PROGRESS. Prefer small, well-tested additions over broad refactors.

### Phase 4 — Test files + live-LLM verification
- **Add test files** for the project: schema-load/validation tests, api handler I/O
  tests, hook due/loop-guard logic, and at least one **end-to-end live test** that
  exercises the app's core loop through a real agent run.
- **Use the live model configured in `sdk/org/.env`** for the end-to-end agent test —
  this is the DeepSeek/Azure model wired there (`LM_MODEL_*` aliases; default alias is
  `__MODEL_ALIAS__`, model `__MODEL__`). Do NOT mock the model for the end-to-end test;
  mocks are fine only for fast unit tests. Load env from `sdk/org/.env`. If a required
  key is missing/empty, record it in PROGRESS and fall back to a mock streamFn for that
  one test rather than failing the whole run.
- Run the app locally (`lmthing serve` from the project, or the project-server test
  harness) and verify the spec's "Verification (end-to-end, local)" checklist for
  `__APP__` as far as the current engine supports: schemas load & generate types; a page
  renders and calls its api; a `database` hook fires and a delegated agent writes rows
  with the **live model**; the page reflects the change.
- **Install the project to the test user** and confirm it loads for that user. Use the
  local project-server / `lmthing` CLI to materialize `store/projects/__APP__/` into the
  test user's workspace root (the `.lmthing/` project root the server serves), then load
  it and re-run the core-loop check against the **live** model as that user. If a real
  prod test user is reachable (see `reference-prod-test-user-and-deploy` in memory:
  register → mint gateway JWT → `POST /api/compute/ensure` → `PUT /api/compute/env` with
  the `sdk/org/.env` keys), install there too; otherwise the local test user is
  sufficient for this run. Record exactly which install path you used in PROGRESS.
- **No fix is done until a test would have caught it** (repo rule). Everything you claim
  works must have a green test or a captured live-run transcript proving it.

### Phase 5 — Commit & push to `main` (ALWAYS push both repos)
Only after the build + tests are green and the app is installed to the test user. **This is
a two-repo push and you must ALWAYS push `main` on BOTH the `sdk/org` submodule AND the
parent monorepo — never leave one pushed and the other not.** Do them in this exact order:

1. **Submodule first — `sdk/org` → its `main`.** `cd sdk/org`; ensure you are on `main`
   (`git checkout main` if detached — a submodule often starts in detached HEAD); pull
   `--ff-only`. If there are changes here (e.g. runtime host globals you had to implement),
   commit them. **Then `git push origin main` regardless** — always push the submodule's
   `main` up to its remote so the parent's pointer references a pushed commit. (If the
   submodule truly has zero changes and is already level with its remote, the push is a
   harmless no-op — still run it to confirm.)
2. **Parent monorepo → `main`.** Back at the repo root, `git checkout main` if needed, pull
   `--ff-only`, then
   `git add app-specifications/__SPEC_FILE__ store/projects/__APP__ automation/app-builder sdk/org`
   (staging `sdk/org` bumps the submodule pointer to the commit you just pushed in step 1),
   commit, and **`git push origin main`**.
3. **Verify both pushes landed** — `git -C sdk/org status` and root `git status` both show
   "up to date with origin/main", and `git -C sdk/org rev-parse HEAD` matches the pointer the
   parent commit recorded. Record both pushed SHAs in `PROGRESS.__APP__.md`.

- Commit messages: conventional style, describe the app + what changed. End every commit
  body with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- **Green-or-nothing gate:** if `pnpm lint:tokens`, `typecheck`, `build`, or `test` is red,
  **do not push either repo** — fix it, or if you cannot this run, commit WIP on a branch
  (not `main`) in whichever repo is dirty, note it in PROGRESS, and stop cleanly. Once green,
  both `main`s must be pushed together — a submodule pointer on parent `main` must never
  reference an unpushed submodule commit.

## Hard rules
- Abide by `project-as-application.md`. If the spec and the parent plan disagree, the
  parent plan wins and you fix the spec.
- Design tokens only — `pnpm lint:tokens` is a hard gate.
- Keep `.issues/` honest: file an issue for any real bug you find and can't fix; delete it
  when fixed.
- Update `automation/app-builder/PROGRESS.__APP__.md` continuously. It is the memory across
  5-hour runs — treat it as the single source of truth for status.
- Never leave `main` broken. Green or nothing on `main`.
- **Always push `main` on BOTH repos** — the `sdk/org` submodule and the parent monorepo —
  at the end of a successful run (Phase 5). Submodule first, then the parent (which bumps the
  pointer). Never push one without the other.

Begin now with Phase 0.
