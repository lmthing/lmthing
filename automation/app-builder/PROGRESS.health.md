> ⚠️ **OUTSTANDING — operator directive (2026-07-04):** this app's round-1 project space was
> created with **only `agents/`**, which violates the space format. On the **next (expansion)
> round** you MUST remediate it to the **FULL space format**: add a `charter.md` per agent
> (alongside `instruct.md`), plus `tasklists/`, `functions/`, `components/`, and especially
> **extensive `knowledge/`** (each field = `index.md` overview + ≥2 `<aspect>.md` deep-dives).
> See `automation/app-builder/prompt.tmpl.md` → Phase 3 "Project-scoped spaces MUST follow the
> FULL space format" and the round policy's "SPACE-FORMAT REMEDIATION" item. This is required
> work, not optional.

# PROGRESS — `health` project-application

Running log across 5-hour autonomous runs. Single source of truth for status.

## Environment / ground truth (verified this run, 2026-07-04)
- Engine (`sdk/org/libs/{core,cli}`) is built **through Phase 8** (db, capability globals,
  api runtime, typed-contract build, pages build, hooks runtime, chat, Studio admin). Phase 9
  (`system-appbuilder`) is NOT built — so the health app is **hand-authored** under
  `store/projects/health/` (no appbuilder delegation needed). Same model blog + kitchen used.
- Output location (operator override): **`store/projects/health/`** in the monorepo. `types/` +
  `.data/` + `node_modules/` are generated/runtime → git-ignored.
- Reference implementations = `store/projects/blog/` + `store/projects/kitchen/` (round-1 shipped,
  live-verified). Health mirrors their file shapes exactly.
- `sdk/org/.env` has AZURE keys + `LM_MODEL_S` (= `azure:DeepSeek-V4-Flash`) — live model ready.
- CLI dist is built (`sdk/org/libs/cli/dist/cli/bin.js`).

### Key runtime contracts (from engine source + blog/kitchen round-1 logs)
- `database/<table>.json` → `validateSchemaSet` (fail-loud: required descriptions on
  table/column/relation, exactly-one PK, FKs/relations resolve). Column types
  `string|number|boolean|date|json`; flags `primaryKey/required/unique/default/generated(uuid|now)`;
  `references {table,column?,onDelete cascade|setNull|restrict}`;
  `relations {name:{hasMany|belongsTo, via, description}}`.
- **Row-interface names = deterministic singularizer** (`libs/cli/src/app/build/schema.ts`
  `tableInterfaceName`/`singularize`): split on `_`/`-`, singularize LAST word, PascalCase.
  Rule: `…{cons}ies`→`…y`; `…{s,x,z,ch,sh}es`→strip `es`; bare trailing `s` stripped only after a
  "normal" consonant (NOT after s/u/i). For health:
  - `metrics→Metric`, `lab_results→LabResult`, `symptoms→Symptom`, `research→Research` (unchanged —
    ends `ch` not `ches`), `sources→Source`, **`settings→Setting`** (trailing `gs`→`g`; NOT the
    spec-prose `Settings`).
  - **Spec was corrected**: all `Settings` type references → `Setting`; added a "Row-type note".
- `db.query` `where` is **equality-only** (`Record<string,unknown>`) + `include/orderBy/limit/offset`.
  No LIKE/ranges → agents/handlers query-all + filter in JS. `include:['rel']` = single-hop join;
  a 2nd hop is hydrated manually by id.
- api handler: ESM exporting `name`/`description`/`Input`/`Output` + default
  `async (input, ctx) => Output`; `ctx = { db: AsyncDbApi, spawn, apiCall }`; `import { HttpError }
  from '@app/runtime'`. Method = filename, route = dir, `[id]` merges into Input. **AsyncDbApi is
  Promise-returning** in handlers (await every db call); the AGENT surface is synchronous (no await).
  Handlers inline their own `Db`/`Ctx` types + row interfaces (they can't import `@app/types`).
- hooks: default-export object. cron `{type:'cron', every|daily, trigger, budget}`; database
  `{type:'database', on:{table,event}, trigger|handler, budget}`. Hook handler ctx = `{row, db, delegate}`.
- pages: default-export React `({ params }) => JSX`; data via `@app/runtime` `useApi`/
  `useApiMutation`/`apiCall`; `<Chat agent="space/agent" />`; router `Link`/`navigate`/`useParams`.
  Import row types from `@app/types`. Design tokens only (`@lmthing/css`) — no raw colors.
  Flag colors: `success` (normal) / `warning` (low) / `destructive` (high); charts use `primary`/`accent`.
- project-scoped spaces at `<projectRoot>/spaces/<space>/agents/<agent>/{instruct,charter}.md`. Agent
  frontmatter allow-list `{title,knowledge,functions,components,actions,defaultAction,canDelegateTo,
  dependencies,capabilities}`. `capabilities:` = list of bare id or `id:{config}`; `db:read/write/schema
  {tables?}`, `api:call {allow}` (required), `pages/api/hooks:write`. A named delegate action needs an
  `actions:` entry (empty tasklist = model-driven).
- **Engine gotchas already fixed by blog round (keep applying, do NOT reintroduce):** dynamic
  `[param]` api routes need the glob-escape in `build/schema.ts` (shipped `escapeGlobPath`);
  `functions:` in agent instruct validates against SPACE functions only — do NOT list system
  `webSearch/webFetch/fetch` there (they're universal globals; OMIT `functions:` to keep them);
  `where` is equality-only. api-handler `spawn` is stubbed in this engine build — the live agent path
  is chat sessions / **database-hook delegates**, not api `spawn`.
- **Reconciling the spec's `pubmedSearch`/`webSearch` `api:call` bindings:** there is NO
  external-binding registry in the real engine — `webSearch/webFetch/fetch` are **universal system
  globals**, not `api:call` named bindings. So the researcher does NOT need any `api:call` entry to
  search literature (it uses the universal global; grant it by OMITTING `functions:`). `api:call` is
  reserved for the app's own typed endpoints. Round 1 keeps that honest; `pubmedSearch` as a distinct
  credentialed binding is a round-2+ concern (needs the binding registry engine feature).

## Round log
### Round 1 — CORE BUILD (in progress, 2026-07-04)
- Phase 0 orient ✅ — read both architecture docs + implementation doc + health spec + engine
  source (singularizer) + blog & kitchen round-1 references + design tokens. Confirmed engine built
  through P8; `store/projects/health/` absent → fresh build. Recorded contracts above.
- Phase 1 spec improvements ✅ — folded into `app-specifications/health-application.md`:
  - **Bug fix (arch docs win):** row-type `Settings` → **`Setting`** everywhere (engine singularizer);
    added a "Row-type note (engine truth)" block enumerating Metric/LabResult/Symptom/Research/Source/Setting.
  - **+3 endpoints → 12 total:** `getSettings` (GET api/settings, find-or-creates the single row,
    seeds `tier:'free'`), `acceptDisclaimer` (POST api/settings/disclaimer), `healthStats` (GET api/stats,
    dashboard counts). Updated the api table + directory layout.
  - **+1 hook → 3 total:** added `research-deep-dive` (database on `research:insert` → `clinic/researcher#deep-dive`).
    This makes the multi-agent loop robust & engine-proven (api/interpreter writes a pending `research`
    row → a `database` hook fans it into the researcher — NO agent-to-agent delegate, exactly like
    kitchen's planner→shopper). Rewrote `requestResearch` handler to just insert the pending row (fires
    the hook) instead of relying on the stubbed api `spawn`/`delegate`.
  - **Reconciled `pubmedSearch`/`webSearch` honestly:** no external-binding registry exists → researcher
    uses the UNIVERSAL `webSearch`/`webFetch` globals (granted by omitting `functions:`), NOT an
    `api:call` binding; the credentialed `pubmedSearch` binding is deferred to round 2+. Updated the caps
    table, the frontmatter example, the Chat section, and Phases §2.
- Phase 2 PLAN ✅ — `automation/app-builder/PLAN.health.md`.
- Phase 3 build ✅ — `store/projects/health/`: 6 database schemas, 12 api handlers, 3 hooks,
  `clinic` space (3 agents: logger/interpreter/researcher), 8 pages + 8 components,
  package.json/tsconfig/.gitignore/README. Fanned out to 3 parallel Sonnet subagents by directory
  (api / pages+components / hooks+spaces+test); orchestrator wrote root+database + integrated.
- Phase 4 tests + live ✅:
  - Structural suite `tests/health.test.mjs` — **11/11 green** (`validateSchemaSet` via built
    `@lmthing/core`; 12-endpoint contract; requestResearch 402 gate; getLab include; 3 hook shapes;
    least-privilege clinic caps + per-verb table scope). Run: `node --test store/projects/health/tests/health.test.mjs`.
  - Token gate: health 16 pages/components — **0 violations** (ran the linter directly on the health
    dirs; root `lint:tokens` doesn't scan `store/projects/`).
  - **Full pipeline HTTP-verified** under `lmthing serve` (temp `LMTHING_ROOT`, health materialized,
    `LM_MODEL=S`): manifest 6 tables + **12 endpoints** + 3 hooks; `types/generated.d.ts` generated
    with all 6 row interfaces incl. **`Setting`** (not Settings); pages built (JS+CSS+index.html, 6
    routes); `GET /app/health/` → 200. API live: getSettings seeds the free row, logMetric, addLab,
    healthStats, getLab (include research), requestResearch 402 on free tier.
  - **🔴 LIVE core loop (DeepSeek `azure:DeepSeek-V4-Flash`), end-to-end** — set tier=subscription
    (admin data browser PATCH), addLab abnormal (HbA1c 9.1, refHigh 5.7 / LDL 190, refHigh 130) →
    `interpret-new-lab` database hook fired → interpreter (live) **self-query reconcile** set both
    labs `flag:'high'` and inserted **2 pending research rows (deduped)** → `research-deep-dive` hook
    fired → researcher (live) **web-searched real medical literature** (WebMD, MedlinePlus, National
    Lipid Association, Johns Hopkins, Cleveland Clinic, NCBI) and filled both `research` bodies (3936 +
    25766 chars) `status:'ready'` with a `## Sources` list + not-a-doctor line. Free-tier
    `requestResearch` → **402** (exact error contract). **Browser-verified** (chrome-devtools): labs
    list (flagged `high` badges), lab detail (nested `/labs/:id`), research page (markdown report +
    Sources + `<Chat agent="clinic/researcher">` **● Connected** over WS).
  - **Capability gate proven live**: interpreter first hit `db db:read: table "research" not
    permitted; allowed tables: lab_results, metrics, symptoms, settings` — fixed by adding `research`
    to its `db:read` scope (it must read research to dedupe pending dives). Per-verb host enforcement, live.

### Engine facts / fixes discovered this round (sdk/org)
- **`void opts` — hook-handler `delegate` DROPS structured input.** `libs/cli/src/server/routes/hooks.ts`
  `runHook` builds the handler's `delegate(agent, action, opts)` and does `void opts` ("6B carries
  structured input on its own args; opts reserved"). So a database hook **cannot thread a row id** into
  the delegated agent — the agent only gets a generic message. **Workaround (engine-correct pattern, no
  engine change): self-querying agents.** The 2 database hooks are now **declarative `trigger:`** ("reconcile
  now" signals); the interpreter re-flags ALL labs idempotently (writes only wrong flags) and the
  researcher fills ALL `status:'pending'` rows. This also absorbs insert bursts and is naturally
  loop-bounded (self-writes are UPDATEs; excluded from the insert-only hooks). This is the same lesson
  blog/kitchen imply; documented here explicitly. (A future engine improvement could pass hook `opts`
  → delegate `context`, but it's not needed and risks the shared session-manager path.)
- **🔧 ENGINE BUG FIXED (in-scope, sdk/org): SPA shell broke on depth-≥2 routes.** The built
  `index.html` used **relative** `./assets/…` URLs; on a route like `/app/health/labs/:id` the browser
  resolved them against `…/labs/` → 404 → SPA fallback → JS loaded as `text/html` → blank page (MIME
  error). Every app with a nested route was affected (blog/kitchen too — only ever API-tested). Fixed in
  `libs/cli/src/app/pages-serve.ts`: inject `<base href="/app/<project>/">` into the served SPA-fallback
  `index.html` (the pod route is always `/app/:projectId/*`, so the base is exact + prefix-safe; the
  client's `resolveAppBase` already handles router/api base at any depth — only the static asset base
  was missing). Idempotent (never doubles a `<base>`). Regression test added
  (`pages-serve.test.ts`: nested-route fallback contains exactly one `<base href="/app/health/">`).
  Full `sdk/org` gate re-run green after the fix.

### Install path used
- **Local test user** — materialized `store/projects/health/` (rsync excluding `types/ .data/
  node_modules/ tests/`) into a temp `LMTHING_ROOT`'s `<root>/health/` (the `.lmthing/` project root
  the server serves), booted `lmthing serve` (`LM_MODEL=S`), and ran the full core loop live as that
  user. No prod test user this run (local is sufficient per the task).

## Gate (round 1)
- `pnpm typecheck` ✅ (all packages) · `pnpm test` ✅ **952 passed / 21 skipped, 0 failed** (system-spaces
  included; the QuickJS "Aborted" teardown lines are the known *catchable* assertion — those tests pass)
  · health structural ✅ 11/11 · pages-serve ✅ 7/7 · `lint:tokens` health ✅ 0 violations (16 files).

## Pushed SHAs
- sdk/org `main`: **`6da8f42`** — pages-serve `<base href>` fix + regression test (pushed to origin/main).
- monorepo `main`: this commit — health app + spec + PLAN/PROGRESS + submodule pointer bump to `6da8f42`.

## Resume notes for the NEXT run (round 2 — FEATURE EXPANSION)
- The health app EXISTS and is green + live-verified. Round 2 is strictly additive — do NOT
  regress/delete round-1 files. Floors: ≥1 new project-scoped space, ≥3 new agents, ≥5 new pages,
  ≥8 new api endpoints, ≥3 new hooks, ≥3 new tables + substantial new features.
- The spec's **"Additional features"** section is the round-2 backlog, already written: **appointment
  prep brief** (`visit_briefs` table + `prepareVisit` endpoint + interpreter#prep + `/visits` page),
  **trends & correlations** (`insights` table + digest computes trends/correlations), **personal
  baselines** (flag vs your own trend), **follow-up reminders** (`followups` table + cron), **wearable
  import** (`importMetrics`). A natural ≥1 new space (e.g. `wellness` or `care-coordination`) + agents.
  Row-type names for those tables: `visit_briefs→VisitBrief`, `insights→Insight`, `followups→Followup`.
- **Engine gotchas confirmed — keep applying:** (1) hook `delegate` opts are DROPPED (`void opts`) → use
  declarative `trigger:` + self-querying agents that find their own work; (2) the SPA `<base href>` fix
  is shipped in sdk/org — nested routes now work in the browser; (3) `db.query` `where` is equality-only
  (query-all + JS filter); (4) `functions:` in agent instruct is space-functions-only — OMIT it to keep
  universal webSearch/webFetch; (5) an agent needs `db:read` on a table it wants to dedupe against, not
  just `db:write`; (6) run the app via temp `LMTHING_ROOT` + `POST /app/health/api/*` + admin data browser
  (`GET/PATCH /api/projects/health/app/data/:table[/:id]`) + `POST .../hooks/:slug/run`.
- Researcher output quality: the weak DeepSeek-Flash model can dump raw scraped content; a "summarise in
  your own words, never paste raw page content" guardrail was added — tighten further / try a stronger
  research model in round 2 if desired.
