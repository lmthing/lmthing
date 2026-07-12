# Autonomous task — build & ship the `__APP__` project-application

You are running **fully autonomously and non-interactively** (headless). No human will
answer questions during this run, so **never stop to ask** — make the best reasonable
decision, write down your assumptions, and keep going until the task is complete or you
hit a hard blocker you cannot work around. This same task fires again every 5 hours, so
if you run out of budget/time, leave the repo in a clean, committed, resumable state.

## This run: round __ROUND__ — __ROUND_MODE__

The build proceeds in **rounds**. One round is a full pass over all the apps
(blog → kitchen → health → trips → homes). This run is **round __ROUND__** for `__APP__`, and the
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
      `store/projects/__APP__/spaces/<newspace>/`) in **full format** (agents with
      charter+instruct, tasklists, functions, components, extensive knowledge) — and the app must
      end the round with **≥2 project-scoped spaces total** (see Phase 3's multi-space rule);
    - **≥3 new agents** across the spaces — each least-privilege (config-bearing
      `capabilities:` frontmatter, per-verb `tables` scope);
    - **≥5 new pages** + components (new routes, richer UX) — **design tokens only**;
    - **≥8 new API endpoints** (named, typed, described) and **≥3 new hooks** (cron/database);
    - **≥3 new database tables** (plus new columns/relations) to back all of the above;
    - substantial **new user-facing features** in the spirit of the spec's "Additional
      features" sections — but many more of them, **fully implemented**, not just described.
    - **SPACE-FORMAT REMEDIATION (mandatory every expansion round until complete).** Round-1
      builds wrongly created project spaces containing **only `agents/`**. Every expansion
      round must bring this app's existing space(s) up to the **full space format** (see the
      "Project-scoped spaces MUST follow the full space format" requirement in Phase 3):
      backfill the missing `tasklists/`, `functions/`, `components/`, and especially **extensive
      `knowledge/`** for each existing agent/space, and give each agent a `charter.md` alongside
      its `instruct.md`. This is not optional and counts toward the round's work — a space that
      is still just `agents/` is a defect to fix, not preserve. **Also ensure the app has ≥2
      project-scoped spaces** (Phase 3's multi-space rule): if it still has only one, the new
      space required above satisfies this — split responsibilities into distinct specialist teams
      sharing the project-rooted db.
  More than these floors is better. **Never regress or delete what earlier rounds shipped** —
  expansion is strictly additive, and everything (old + new) must stay green and tested with
  the live model before you push. Use `PROGRESS.__APP__.md` to see what prior rounds built so
  you extend rather than duplicate.

## Ground truth (read these first, in order)

**You MUST read BOTH of these two canonical architecture documents IN FULL, every run,
before doing anything else** — together they are the complete picture of how these apps and
their runtime engine are built. They are **read-only ground truth**: never edit them (you
edit only the app spec in step 3).

1. `org/format/project/` + `org/app/` — **the architecture / model you must abide by.**
   Space = agent capability; Project = the app (`database/ pages/ api/ hooks/ package.json`)
   + its project-scoped spaces; the capability-globals model (`db:*`, `pages:write`,
   `api:write`, `hooks:write`, `api:call`); the exact file formats (`database/<table>.json`,
   `api/<route>/<METHOD>.ts`, `hooks/<slug>.ts`, `pages/`); the typed-contract pipeline;
   serving; the `system-appbuilder` space. Everything you build must conform to it.
2. `org/runtime-globals/app-authoring.md` — **the authoring globals contract:
   HOW it gets built, tested, and shipped.** Read it in full: §0 Global protocol (the
   Definition-of-Done gate; the **mandatory live-DeepSeek test protocol** via `sdk/org/.env`
   with `--model S`; the **push-both-repos protocol**; the backward-compatibility invariants),
   the Phase 1–11 engine build plan with exact files in `libs/core`/`libs/cli`, and the
   capability/DTS/db/api/hooks/build/chat mechanics. When a runtime piece an app needs isn't
   implemented yet, THIS document tells you which files to add and how to test them.
   - **Location caveat:** that doc's §0.6 uses a `store/apps/<appId>/` catalog + a store
     install endpoint. For THIS automation the operator's chosen output location is
     **`store/projects/__APP__/`** — use the implementation doc for the engine mechanics,
     file formats, capability model, and build/test/push protocol, **not** for the app's
     output path (create the app under `store/projects/__APP__/`, and treat the store-catalog
     install flow as out of scope for these runs).
3. `app-specifications/__SPEC_FILE__` — **the spec for the app you are building this run**
   (`__APP__`); this is the one document you DO edit (step Phase 1). Also read
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
  while staying strictly inside the model in `org/format/project/` and the
  mechanics/protocol in `org/runtime-globals/app-authoring.md` (only
  data/agents/pages/api/hooks on the shared engine, exactly as the spec's "Additional
  features" sections do — no capabilities the parent plan forbids).
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
  reconcile it with your Phase-1 spec changes. **The plan must explicitly enumerate the full
  space-format work** (per space: `charter.md`+`instruct.md` per agent, `tasklists/`,
  `functions/`, `components/`, and the multi-field/multi-aspect `knowledge/` files) — both for
  new spaces and for remediating any existing `agents/`-only space (see Phase 3).

### Phase 3 — Execute the plan (build the project)
- **Create the project at `store/projects/__APP__/`** (parent repo), following the exact
  directory layout and file formats in the spec and the parent plan:
  `database/`, `pages/`, `components/`, `lib/`, `api/`, `hooks/`, `spaces/__SPACE__/`,
  `package.json`, `tsconfig.json`. `types/` and `.data/` are generated/runtime — do not
  hand-author them; make sure they are git-ignored for this project.
  On a FEATURE-EXPANSION round, also scaffold the **new** project-scoped spaces under
  `store/projects/__APP__/spaces/<newspace>/` (in **full space format** — see the space-format
  requirement below), extend the existing space(s) with new agents, AND **remediate the existing
  round-1 spaces** that are currently `agents/`-only — everything wired to the same project-rooted db.
- Every `database/<table>.json` table AND every column AND every relation carries a
  **required `description`** (the loader fails loud otherwise). Exactly one primary key.
  `references`/`relations` must resolve to real tables/columns.
- `api/<route>/<METHOD>.ts` handlers export `name`/`description`/`Input`/`Output` + a
  default handler. `hooks/*.ts` use the `cron`/`database` shapes from the spec. Agent
  `instruct.md` frontmatter uses the config-bearing `capabilities:` key with per-verb
  `tables` scope exactly as the spec's capability table dictates.
- **Project-scoped spaces MUST follow the FULL space format — not just `agents/`.** A space
  with only an `agents/` dir is a **defect**. Read the canonical space format first
  (`org/format/space/`, `sdk/org/.claude/skills/new-space.md`,
  `sdk/org/libs/core/system-spaces/DEVELOPMENT.md`) and mirror how the shipped system spaces
  (`sdk/org/libs/core/system-spaces/*`) are actually structured. Every project space you author
  (and every space you remediate) must include:
    - **`agents/<slug>/`** — both a short fork-safe **`charter.md`** (identity/guardrails,
      injected into every fork) AND an **`instruct.md`** (orchestration/routing, top-level),
      not just `instruct.md`.
    - **`tasklists/<name>/`** — the decompositions the spec describes (e.g. the planner's
      fan-out, the synthesizer's pipeline): an `index.md` goal + per-task files with real
      frontmatter (`role`, `functions`, `forEach`, `canDelegateTo`). Agents that orchestrate
      must actually have their tasklist, not just prose.
    - **`knowledge/<field>/`** — **extensive** domain knowledge, the single most important gap
      to fix. Each field is a dir with an **`index.md` overview** (surfaced to the agent) plus
      **≥2 `<aspect>.md`** deep-dive files loaded on demand (never a single `overview.md`).
      Give each agent the real domain expertise it needs (e.g. the blog synthesizer's editorial
      standards; the health interpreter's reference-range/triage knowledge with the
      not-a-doctor framing; the kitchen planner's nutrition/substitution knowledge; the trips
      researcher's destination-research method). Multiple fields, multiple aspects each — this
      should be the bulk of the space's content.
    - **`functions/`** — reusable space functions (typed TS) the agents call for deterministic
      work (formatting, scoring, dedupe, diffing) instead of re-deriving it in prose.
    - **`components/`** — catalog display/`ask` components the agents render in chat (the
      descriptor renderer surface), design-token-gated.
  This applies to **every** space in every round: new spaces are born full-format, and existing
  thin spaces (the round-1 `agents/`-only ones) are remediated to full format (see the round
  policy's SPACE-FORMAT REMEDIATION item). Re-typecheck and live-test the space after.
- **Each project MUST have MORE THAN ONE project-scoped space (≥2).** A single-space project is
  incomplete — the architecture is explicitly multi-space ("one project can host several
  specialized spaces… that all read/write the same tables", `org/format/project/`). Split
  the work into **distinct specialist teams** under `store/projects/__APP__/spaces/<space>/`,
  each a full-format space sharing the same project-rooted db (e.g. blog: a `newsroom` that
  fetches/synthesizes **plus** an `editorial`/`curation` space for ranking/personalization and a
  `research` space for deep dives; kitchen: `chef` planning **plus** a `pantry` space and a
  `nutrition`/`shopping` space; health: `clinic` **plus** a `research` space and a `coaching`
  space; trips: `concierge` **plus** a `research` space and a `logistics`/`booking` space). Wire
  cross-space orchestration through `hooks/` (`trigger: '<space>/<agent>#<action>'`) as the parent
  plan describes. Round 1 should already ship ≥2 where sensible; any app still at one space MUST
  reach ≥2 on its next expansion round.
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

### Phase 6 — Prod install + AI functional test (REQUIRED after every run)
After the push, verify the app **actually works installed on the live cluster**. **ALWAYS
`Read` the current `.claude/skills/test-app-install-prod.md` IN FULL at this point and follow
the on-disk version — that skill is the authoritative runbook and IS UPDATED OVER TIME.** Do not
rely on the summary bullets below or on memory of a previous run's steps: read the file fresh
every run, and if it disagrees with anything here, **the skill wins**. (The bullets below are a
stale-prone orientation only.) Do this every run.
- **Get the pushed build onto the test pod.** Your Phase-5 push to `main` triggers CI to rebuild
  the `compute` + `store` images; the app is installable once the test user's pod runs the new
  `compute:latest`. Per the skill (Step 2), over SSH: `kubectl rollout restart deploy/lmthing -n
  <TEST>`, wait for rollout, and confirm `GET http://<POD_IP>:8080/api/apps` lists `__APP__`.
  CI/ArgoCD is flaky (memory `reference-prod-test-user-and-deploy`) — `gh run rerun --failed` /
  force an ArgoCD hard refresh and retry rather than giving up. If the new image genuinely hasn't
  deployed this cycle, **record it in PROGRESS and test against the current image (or defer the
  functional check to the next run) — do NOT fail the whole run for deploy lag.**
- **Session + install** (skill Steps 3–5): mint a gateway JWT for the test user (SSH + `node:crypto`;
  **never print the secret**), seed `localStorage.lmthing_session` on `lmthing.store` + `lmthing.app`,
  and drive `store → Install __APP__ → /app/__APP__/` with the **chrome-devtools MCP**; cross-check
  server-side with `POST /api/apps/install {appId:'__APP__'}` and confirm `built.pages.ok:true`.
- **AI functional test** (skill Step 6): open `/app/__APP__/`, drive the app's **primary AI action**
  (blog: add a source → the enrich hook populates an article; kitchen: generate a plan; health: add a
  lab → interpreter flags; trips: create a trip → concierge researches; homes: paste an alert email →
  the intake/scout pipeline parses, analyzes, and ranks listings) and confirm the real model
  path fires — `/v1/*` LiteLLM calls return **200** (not 429 budget / 401) and the **DB updated**
  (the app's list endpoint / `GET /api/projects/__APP__/…` shows new rows). Take screenshots.
- **Be conservative with the cluster:** only scale other user pods down to free CPU (skill Step 1) if
  the node is genuinely saturated, and **always scale them back up in cleanup (Step 8)**. Leave the
  test user's install in place.
- **Record the outcome in `PROGRESS.__APP__.md`** (installed? pages built? AI call 200? DB updated? +
  screenshots) and file a `.issues/` entry for any real defect (install 404, `@app/runtime` unresolved,
  blank page, hook that never fires). **If the app installs+builds but a functional bug appears, fix it
  and re-push (Phase 5)** — the app must actually *work* installed, not merely build green. (Fanning the
  test across Sonnet subagents per skill Step 7 is optional — one app per run, so a single pass suffices.)

## Hard rules
- **Read `org/format/project/` AND `org/app/` AND `org/runtime-globals/app-authoring.md` in full at the start of every run** —
  they are the complete, canonical source for how the app + engine are built, tested, and
  pushed. Abide by them. If the app spec and these architecture docs disagree, the
  architecture docs win and you fix the app spec.
- Design tokens only — `pnpm lint:tokens` is a hard gate.
- Keep `.issues/` honest: file an issue for any real bug you find and can't fix; delete it
  when fixed.
- Update `automation/app-builder/PROGRESS.__APP__.md` continuously. It is the memory across
  5-hour runs — treat it as the single source of truth for status.
- Never leave `main` broken. Green or nothing on `main`.
- **After every run, prod-install + AI-functional-test the app** (Phase 6) — it must actually work
  installed on the live cluster, not just build green locally. **`Read` the current
  `.claude/skills/test-app-install-prod.md` in full each run and follow it — that skill changes over
  time and is authoritative; never rely on a cached/remembered version.** Record the result in
  PROGRESS; deploy lag is not a run failure, but a real functional bug is (fix + re-push).
- **Always push `main` on BOTH repos** — the `sdk/org` submodule and the parent monorepo —
  at the end of a successful run (Phase 5). Submodule first, then the parent (which bumps the
  pointer). Never push one without the other.

Begin now with Phase 0.
