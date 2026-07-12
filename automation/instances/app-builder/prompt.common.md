<!--
  prompt.common.md — shared body for the app-builder instance, included by prompt.first.md
  (round 1, CORE BUILD) and prompt.next.md (round >= 2, FEATURE EXPANSION). Round-specific
  framing lives in those two files; everything invariant across rounds is here.
-->

You are running **fully autonomously and non-interactively** (headless). No human will answer
questions during this run, so **never stop to ask** — make the best reasonable decision, write
down your assumptions, and keep going until the task is complete or you hit a hard blocker you
cannot work around. This same task fires again on a schedule, so if you run out of budget/time,
leave the repo in a clean, committed, resumable state.

- **App:** `{{task}}`  ·  **Round:** {{round}} — {{roundMode}}  ·  **Branch:** `{{branch}}`

## Fan-out (subagents)

Use your Task/Agent tool to fan out the following subagents for this app, each scoped as described.
Run independent ones in parallel; you (the top-level session) reconcile their output, keep the
build green, and own the commits/push.

{{subagents}}

## PROGRESS protocol for THIS run (MANDATORY, every step)

Maintain the per-run progress log at **{{progressFile}}**.

- At **every step**, append to its "Steps" section what you just did.
- Also append to its "Files added to context" section **the exact new files you read / added to
  your context** that step (path + one-line why). This is how a resumed run — possibly on a
  different account after a usage-limit reset — knows what you already examined.
- This is separate from the longer-term cross-round memory `automation/instances/app-builder/PROGRESS.{{task}}.md`
  (see Phase 0): that file tracks the app across rounds; {{progressFile}} tracks THIS run.

## Commit protocol (MANDATORY)

- **Commit as early as possible and commit often** — many small commits as you make progress, all
  to the branch this run started on: **`{{branch}}`**. Do **not** create or switch branches.
- The Phase-5 two-repo push still happens once the build is green; these frequent intermediate
  commits are additive to that and keep the run resumable.

## Ground truth (read these first, in order)

**You MUST read BOTH of these two canonical architecture documents IN FULL, every run, before
doing anything else** — together they are the complete picture of how these apps and their runtime
engine are built. They are **read-only ground truth**: never edit them (you edit only the app spec
in Phase 1).

1. `org/format/project/` + `org/app/` — **the architecture / model you must abide by.**
   Space = agent capability; Project = the app (`database/ pages/ api/ hooks/ package.json`) + its
   project-scoped spaces; the capability-globals model (`db:*`, `pages:write`, `api:write`,
   `hooks:write`, `api:call`); the exact file formats (`database/<table>.json`,
   `api/<route>/<METHOD>.ts`, `hooks/<slug>.ts`, `pages/`); the typed-contract pipeline; serving;
   the `system-appbuilder` space. Everything you build must conform to it.
2. `org/runtime-globals/app-authoring.md` — **the authoring globals contract: HOW it gets built,
   tested, and shipped.** Read it in full: §0 Global protocol (the Definition-of-Done gate; the
   **mandatory live-DeepSeek test protocol** via `sdk/org/.env` with `--model S`; the
   **push-both-repos protocol**; the backward-compatibility invariants), the Phase 1–11 engine
   build plan with exact files in `libs/core`/`libs/cli`, and the capability/DTS/db/api/hooks/
   build/chat mechanics. When a runtime piece an app needs isn't implemented yet, THIS document
   tells you which files to add and how to test them.
   - **Location caveat:** that doc's §0.6 uses a `store/apps/<appId>/` catalog + a store install
     endpoint. For THIS automation the output location is **`store/projects/{{task}}/`** — use the
     implementation doc for engine mechanics, file formats, capability model, and build/test/push
     protocol, **not** for the app's output path (create the app under `store/projects/{{task}}/`,
     and treat the store-catalog install flow as out of scope for these runs).
3. `app-specifications/{{SPEC_FILE}}` — **the spec for the app you are building this run**
   (`{{task}}`); this is the one document you DO edit (Phase 1). Also read `sdk/org/CLAUDE.md` +
   root `CLAUDE.md` for runtime/repo conventions.
4. `automation/instances/app-builder/PROGRESS.{{task}}.md` — **your running cross-round log for
   THIS app.** If it exists, read it first: it tells you what previous runs did and where to
   resume. If it does not exist, create it.

## What "done" means for this run (do these phases in order)

### Phase 0 — Orient & resume
- Read `automation/instances/app-builder/PROGRESS.{{task}}.md`. Continue from the last incomplete
  step rather than redoing finished work. Keep it updated **after every phase** — it is how the
  next run knows where to pick up. (Hard requirement.)
- `git status` must be understood before you touch anything. You are on `{{branch}}`.

### Phase 1 — Improve the spec (think deeply, then edit the spec file)
- **Think deeply** about `app-specifications/{{SPEC_FILE}}`: what improvements and feature additions
  would make `{{task}}` a genuinely better, more valuable AI-assisted application — while staying
  strictly inside the model in `org/format/project/` and the mechanics/protocol in
  `org/runtime-globals/app-authoring.md`.
- **Edit `app-specifications/{{SPEC_FILE}}` in place** to fold those improvements into the spec
  (new tables/columns/endpoints/hooks/agent capabilities/pages, sharper UX, safety notes). Keep the
  document's existing structure and tone. Record what you added (and why) in the PROGRESS file.
- **Scale the batch to the round** (see the round framing above): round 1 adds a modest,
  high-quality set; an expansion round adds a **very large** batch — document the new spaces,
  agents, pages, APIs, hooks, and tables in the spec first, then implement all of them in Phase 3.

### Phase 2 — Detailed implementation plan
- Write a concrete, file-by-file plan to `automation/instances/app-builder/PLAN.{{task}}.md`: every
  `database/*.json`, `pages/*.tsx`, `api/*/{METHOD}.ts`, `hooks/*.ts`, the project-scoped space(s)
  and agent `instruct.md` frontmatter (config-bearing `capabilities:`), `package.json`, and the
  test files. Sequence it so each step is verifiable. Reconcile with any prior plan. **The plan
  must explicitly enumerate the full space-format work** (per space: `charter.md`+`instruct.md` per
  agent, `tasklists/`, `functions/`, `components/`, and multi-field/multi-aspect `knowledge/`).

### Phase 3 — Execute the plan (build the project)
- **Create/extend the project at `store/projects/{{task}}/`** following the exact layout and file
  formats in the spec and the parent plan: `database/`, `pages/`, `components/`, `lib/`, `api/`,
  `hooks/`, `spaces/{{SPACE}}/`, `package.json`, `tsconfig.json`. `types/` and `.data/` are
  generated/runtime — do not hand-author them; ensure they are git-ignored for this project.
- Every `database/<table>.json` table AND every column AND every relation carries a **required
  `description`** (the loader fails loud otherwise). Exactly one primary key.
  `references`/`relations` must resolve to real tables/columns.
- `api/<route>/<METHOD>.ts` handlers export `name`/`description`/`Input`/`Output` + a default
  handler. `hooks/*.ts` use the `cron`/`database` shapes from the spec. Agent `instruct.md`
  frontmatter uses the config-bearing `capabilities:` key with per-verb `tables` scope.
- **Project-scoped spaces MUST follow the FULL space format — not just `agents/`.** Read the
  canonical space format first (`org/format/space/`, `sdk/org/.claude/skills/new-space.md`,
  `sdk/org/libs/core/system-spaces/DEVELOPMENT.md`) and mirror how the shipped system spaces
  (`sdk/org/libs/core/system-spaces/*`) are structured: `agents/<slug>/` with **both** `charter.md`
  and `instruct.md`; `tasklists/<name>/` with real frontmatter; **extensive** `knowledge/<field>/`
  (an `index.md` overview + ≥2 `<aspect>.md` deep-dives each); reusable typed `functions/`; and
  design-token-gated `components/`.
- **Design-system gate is mandatory** for any page/component styling: never write a raw color (no
  hex, no literal `rgb()/hsl()`, no stock Tailwind `gray-*`/`blue-*`/etc.) — use `@lmthing/css`
  tokens (`var(--foreground)`, `bg-primary`, `text-agent`, …). Run `pnpm lint:tokens` and keep it
  green.
- Keep `pnpm -w typecheck` and `pnpm -w build` green for anything you touch. If a runtime engine
  piece an app needs isn't implemented yet in `sdk/org/libs/{core,cli}`, implement the minimal
  missing piece there too (in-scope) and note it in PROGRESS. Prefer small, well-tested additions.

### Phase 4 — Test files + live-LLM verification
- **Add test files**: schema-load/validation, api handler I/O, hook due/loop-guard logic, and at
  least one **end-to-end live test** exercising the app's core loop through a real agent run.
- **Use the live model configured in `sdk/org/.env`** for the end-to-end test — the DeepSeek/Azure
  model wired there (`LM_MODEL_*` aliases; default alias is `{{MODEL_ALIAS}}`, model `{{MODEL}}`).
  Do NOT mock the model for the end-to-end test. If a required key is missing/empty, record it in
  PROGRESS and fall back to a mock streamFn for that one test rather than failing the whole run.
- Run the app locally and verify the spec's "Verification (end-to-end, local)" checklist for
  `{{task}}` as far as the engine supports: schemas load & generate types; a page renders and calls
  its api; a `database` hook fires and a delegated agent writes rows with the **live model**; the
  page reflects the change.
- **Install the project to the test user** and confirm it loads. Record which install path you
  used in PROGRESS.
- **No fix is done until a test would have caught it** (repo rule).

### Phase 5 — Commit & push to `{{branch}}` (ALWAYS push both repos)
Only after the build + tests are green and the app is installed to the test user. This is a
two-repo push — always push BOTH the `sdk/org` submodule AND the parent monorepo, in this order:
1. **Submodule first — `sdk/org`.** Ensure you're on `main` in the submodule; pull `--ff-only`;
   commit any changes; **`git push origin main` regardless**.
2. **Parent monorepo → `{{branch}}`.** Pull `--ff-only`, then
   `git add app-specifications/{{SPEC_FILE}} store/projects/{{task}} automation/instances/app-builder sdk/org`,
   commit, and **`git push`**.
3. **Verify both pushes landed** and record both pushed SHAs in `PROGRESS.{{task}}.md`.
- End every commit body with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- **Green-or-nothing gate:** if `pnpm lint:tokens`, `typecheck`, `build`, or `test` is red, do not
  push — fix it, or commit WIP on the branch and stop cleanly.

### Phase 6 — Prod install + AI functional test (REQUIRED after every run)
After the push, verify the app **actually works installed on the live cluster**. **ALWAYS `Read`
the current `.claude/skills/test-app-install-prod.md` IN FULL and follow the on-disk version — it
is authoritative and updated over time.** Get the pushed build onto the test pod, mint a gateway
JWT (never print the secret), drive `store → Install {{task}} → /app/{{task}}/` with the
chrome-devtools MCP, and exercise the app's **primary AI action** — confirm the real model path
fires (`/v1/*` LiteLLM returns 200, DB updated). Record the outcome in `PROGRESS.{{task}}.md` +
screenshots; file a `.issues/` entry for any real defect. Deploy lag is not a run failure; a real
functional bug is (fix + re-push).

## Hard rules
- **Read `org/format/project/` AND `org/app/` AND `org/runtime-globals/app-authoring.md` in full at
  the start of every run.** If the app spec and these architecture docs disagree, the docs win.
- Design tokens only — `pnpm lint:tokens` is a hard gate.
- Keep `.issues/` honest: file an issue for any real bug you can't fix; delete it when fixed.
- Never leave `{{branch}}` broken. Green or nothing.
- Update `automation/instances/app-builder/PROGRESS.{{task}}.md` continuously (cross-run memory) AND
  {{progressFile}} every step (this run). Commit early & often to `{{branch}}`.
- **Always push `{{branch}}` on BOTH repos** at the end of a successful run (Phase 5) — submodule
  first, then the parent (which bumps the pointer). Never push one without the other.
