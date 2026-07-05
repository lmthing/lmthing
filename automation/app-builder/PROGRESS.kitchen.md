> ✅ **RESOLVED (2026-07-05):** the space-format remediation is complete. All 3 project spaces
> (`chef`, `nutrition`, `sourcing`) are now FULL format — `agents/{charter,instruct}`, `tasklists/`,
> `functions/`, `components/`, and extensive `knowledge/` (each field = `index.md` overview + ≥2
> `<aspect>.md` deep-dives). Verified via the real engine `loadSpace` + the 18/18 test suite. See the
> "ROUND 2 COMPLETION" round-log entry at the bottom for details.

# PROGRESS — `kitchen` project-application

Running log across 5-hour autonomous runs. Single source of truth for status.

## Environment / ground truth (verified this run, 2026-07-04)
- Engine (`sdk/org/libs/{core,cli}`) is built **through Phase 8** (db, capability globals,
  api runtime, typed-contract build, pages build, hooks runtime, chat, Studio admin). Phase 9
  (`system-appbuilder`) is NOT built — so the kitchen app is **hand-authored** under
  `store/projects/kitchen/` (no appbuilder delegation needed). Same model the `blog` app used.
- Output location (operator override): **`store/projects/kitchen/`** in the monorepo. `types/` +
  `.data/` + `node_modules/` are generated/runtime → git-ignored.
- Reference implementation = `store/projects/blog/` (round-1 shipped, live-verified). Kitchen
  mirrors its file shapes exactly.
- Key runtime contracts (from engine source + the blog round-1 log):
  - `database/<table>.json` → `validateSchemaSet` (fail-loud: required descriptions on
    table/column/relation, exactly-one PK, FKs/relations resolve). Column types
    `string|number|boolean|date|json`; flags `primaryKey/required/unique/default/generated(uuid|now)`;
    `references {table,column?,onDelete cascade|setNull|restrict}`;
    `relations {name:{hasMany|belongsTo, via, description}}`.
  - **Row-interface names are a deterministic singularizer** (`build/schema.ts`
    `tableInterfaceName`): split on `_`/`-`, singularize the LAST word, PascalCase. For kitchen:
    `ingredients→Ingredient`, `recipes→Recipe`, `recipe_ingredients→RecipeIngredient`,
    `meal_plans→MealPlan`, `plan_meals→PlanMeal`, **`shopping_list→ShoppingList`** (the last word
    `list` ends in `t`, unchanged — NOT the spec-prose `ShoppingItem`). Pages/types import
    `ShoppingList`. Spec corrected to say so.
  - `db.query` `where` is **equality-only** (`Record<string,unknown>`) + `include/orderBy/limit/offset`.
    No LIKE/ranges → agents/handlers query-all + filter in JS. `include: ['rel']` expands a relation
    (join); nested include (`recipe.ingredients.ingredient`) is honored per the spec centrepiece.
  - api handler: ESM exporting `name`/`description`/`Input`/`Output` + default
    `async (input, ctx) => Output`; `ctx = { db: AsyncDbApi, spawn, apiCall }`; `import { HttpError }
    from '@app/runtime'`. Method = filename (`GET.ts`…), route = dir, `[id]` merges into Input.
    **AsyncDbApi is Promise-returning** in handlers (await every db call), unlike the sync agent surface.
  - hooks: default-export object. cron `{type:'cron', every|daily, trigger, budget}`; database
    `{type:'database', on:{table,event}, trigger|handler, budget}`.
  - pages: default-export React `({ params }) => JSX`; data via `@app/runtime` `useApi`/
    `useApiMutation`/`apiCall`; `<Chat agent="space/agent" />`; router `Link`/`navigate`/`useParams`.
    Import row types from `@app/types`. Design tokens only (`@lmthing/css`) — no raw colors.
  - project-scoped spaces at `<projectRoot>/spaces/<space>/agents/<agent>/instruct.md`. Agent
    frontmatter allow-list `{title,knowledge,functions,components,actions,defaultAction,
    canDelegateTo,dependencies,capabilities}`. `capabilities:` = list of bare id or `id:{config}`;
    `db:read/write/schema {tables?}`, `api:call {allow}` (required), `pages/api/hooks:write`.
    A named delegate action needs an `actions:` entry (empty tasklist = model-driven).
  - **Engine gotchas already fixed by the blog round** (keep applying, do NOT reintroduce): dynamic
    `[param]` api routes need the glob-escape in `build/schema.ts` (shipped `escapeGlobPath`);
    `functions:` in agent instruct validates against SPACE functions only — do NOT list system
    `webSearch/webFetch/fetch` there (they're universal globals); `where` is equality-only.
  - Reconciling the spec's `recipeSearch`/`webSearch` "api:call bindings": in the real engine there
    is **no external-binding registry** — `webSearch/webFetch/fetch` are **universal system globals**,
    not `api:call` named bindings. So the planner does not need any `api:call` entry to search the web
    (it just uses the global). `api:call` is reserved for the app's own typed endpoints. Round 1
    keeps agents db-only (the recipe box is seeded); web search is a round-2 concern.

## Round log
### Round 1 — CORE BUILD (in progress, 2026-07-04)
- Phase 0 orient ✅ — read both architecture docs in full + kitchen spec + engine source + the
  blog round-1 reference. Confirmed engine built through P8; `store/projects/kitchen/` absent →
  fresh build. Recorded row-type singularizer + equality-only-where + no-external-binding facts.
- Phase 1 spec improvements ✅ — folded into `app-specifications/kitchen-application.md`:
  - **Bug fix (arch docs win):** corrected `ShoppingItem` → `ShoppingList` everywhere (the engine's
    deterministic singularizer leaves `shopping_list`'s tail `list` unchanged). Added an explicit
    "Row-type note (engine truth)" block.
  - New column `recipes.imageUrl` (recipe card / detail hero).
  - **+2 endpoints → 14 total:** `lowStock` (GET api/pantry/low) and `kitchenStats` (GET api/stats,
    dashboard counts). Home grid gains a counts strip; pantry page reads `lowStock`.
  - Reconciled the spec's `api:call [recipeSearch, webSearch]` honestly: no external-binding registry
    exists → round-1 `chef` agents are **db-only** (planner drops `api:call`); web search / recipe
    importer is a documented round-2 concern. Added engine-truth Notes (equality-only `where`,
    universal system globals).
- Phase 2 PLAN ✅ — `automation/app-builder/PLAN.kitchen.md`.
- Phase 3 build ✅ — `store/projects/kitchen/` built: 6 database schemas, 14 api handlers, 2 hooks,
  `chef` space (3 agents), 8 pages + 8 components, package.json/tsconfig/.gitignore/README.
  Fanned out to 3 parallel Sonnet subagents by directory (api / pages+components / hooks+spaces);
  I wrote root+database directly and integrated. No engine (sdk/org) changes were needed — the
  blog round already shipped the fixes kitchen relies on (glob-escaped `[param]` routes, etc.).
- Phase 4 tests + live ✅:
  - Structural + schema suite: `store/projects/kitchen/tests/kitchen.test.mjs` — **11/11 green**
    (`validateSchemaSet` via real built `@lmthing/core`; 14-endpoint contract; hook shapes;
    least-privilege chef caps + per-verb table scope). Run: `node --test
    store/projects/kitchen/tests/kitchen.test.mjs` (NB: `node --test <dir>` fails on node 24 —
    pass the file path).
  - Token gate: kitchen 16 pages/components **0 violations** (root `pnpm lint:tokens` doesn't scan
    `store/projects/`, so run the linter script directly on the kitchen dirs — did so, green).
  - **Full pipeline HTTP-verified** under `lmthing serve` (temp `LMTHING_ROOT`, kitchen materialized,
    `LM_MODEL=S`): manifest lists 6 tables + **14 endpoints** + 2 hooks; `types/generated.d.ts`
    generated with all 6 row interfaces incl. **`ShoppingList`**; pages built (3 assets);
    `GET /app/kitchen/` → 200. API live: addIngredient/addRecipe (find-or-create ingredient lines),
    getRecipe **two-hop join** renders ingredient lines, lowStock, kitchenStats.
  - **🔴 LIVE core loop (DeepSeek `azure:DeepSeek-V4-Flash`), end-to-end** — driven via a project
    chat session bound to `chef/planner` (the spawn-from-api path is **stubbed** in this engine
    build: log says `spawn("chef/planner#plan") deferred — agent runner arrives in Phase 6`, so
    `generatePlan`'s fire-and-forget is a no-op until P6; the chat/hook path is the live path, same
    as the blog round). Planner (live) wrote **7 `plan_meals`** (one per day, alternating recipes for
    variety, then marked the plan `ready`) → the **`recompute-shopping` database hook fired**
    (coalesced across the 7 inserts into ONE run) → delegated `chef/shopper` (live) → shopper wrote
    **4 `shopping_list` gap rows**. Diff math verified exactly correct: 4×Garlic Pasta + 3×Tomato
    Soup vs pantry → pasta 300g, garlic 12, tomato 1200g, onion 3; **olive oil correctly excluded**
    (pantry covers it). `shoppingList` read view + `kitchenStats` (plannedMeals 7, shoppingGaps 4)
    reflect it. `toggleBought` topped up the pantry (pasta 500→800, +300).
  - **Capability gate proven live**: the shopper hit `[error] db db:read: table "plans" not
    permitted; allowed tables: plan_meals, recipes, recipe_ingredients, ingredients` and recovered —
    per-verb "read wide, write narrow" host enforcement, live.
  - **Bug found + fixed live (in-scope, kitchen prompt):** the `pantry-keeper` chat agent (weak
    DeepSeek-Flash model) went filesystem-spelunking (`execShell ls`/`listDir`/`readFile` its own
    instruct) instead of using the ambient `db` global. Fixed by prepending an imperative directive
    to `pantry-keeper/instruct.md` ("you already have a `db` global — do NOT read files or explore;
    call `db.query('ingredients', …)` directly"). Re-tested live: keeper set olive oil → 350 ml in
    ~15s, no spelunking. Chat control surface verified.
- Phase 5 push ✅ — see "Pushed SHAs" below.

## Pushed SHAs
- sdk/org: **no changes this round** (engine already at the needed state) — submodule `main` left
  level with origin (push is a no-op confirm).
- monorepo `main`: **`8ff6dfa`** (kitchen app + spec + PLAN/PROGRESS). Verified: both repos level
  with origin/main; parent pointer records submodule `0a875677` which is on origin/main. Left the
  pre-existing ` M automation/app-builder/supervise.sh` (harness file, not mine) untouched/unstaged.

## Resume notes for the NEXT run (round 2 — FEATURE EXPANSION)
- The kitchen app EXISTS and is green + live-verified. Round 2 is strictly additive — do NOT
  regress/delete round-1 files. Floors: ≥1 new project-scoped space, ≥3 new agents, ≥5 new pages,
  ≥8 new api endpoints, ≥3 new hooks, ≥3 new tables + substantial new features.
- The spec's **"Additional features"** section is the round-2 backlog, already written: dietary
  preferences & household (`settings` table, planner hard-filters allergies/diet, `/preferences`
  page), **reduce-waste** (`ingredients.expiresAt` + a `use-it-up` cron hook + planner scoring),
  **recipe import from URL** (`importRecipe` endpoint + a new `chef/importer` agent with
  `functions: [webFetch]` — the FIRST use of web fetch; note there is NO external-binding registry,
  so use the universal `webFetch`/`webSearch` globals via `functions:`, not `api:call`), **ratings**
  (`plan_meals.rating`/`cookedAt` + `rateMeal` endpoint + planner favors winners). That's a natural
  ≥1 new space (e.g. a `nutrition`/`sourcing` space) + agents + tables + endpoints + hooks + pages.
- Run the app locally exactly as this round: materialize `store/projects/kitchen/` into a temp
  `LMTHING_ROOT`'s `<root>/kitchen/` (rsync excluding `types/ .data/ node_modules/ tests/`),
  `LMTHING_ROOT=$ROOT LM_MODEL=S node sdk/org/libs/cli/dist/cli/bin.js serve --port <p>`, then drive
  via `POST /app/kitchen/api/*`, the admin data browser (`GET /api/projects/kitchen/app/data/:table`
  → shape `{table,rows,limit,offset}`), and chat sessions (`POST /api/sessions
  {projectId:'kitchen', spaceRef:'<space>/<agent>'}` + `POST /api/sessions/:id/message {content}`,
  returns 202 async → poll the db). Live model via `sdk/org/.env` (AZURE keys set; `LM_MODEL_S`).
- Engine gotchas confirmed this round (keep applying): api-handler **`spawn` is stubbed** (P6) — the
  live agent path is chat sessions / database-hook delegates, not api `spawn`; `db.query` `where` is
  equality-only; `include` is single-hop (hydrate the 2nd join manually); weak models need
  imperative "use the `db` global, don't explore the filesystem" guidance in chat-agent instructs.

## Round log — ROUND 2 (FEATURE EXPANSION, 2026-07-04, in progress)
Theme: **from a meal planner → a full kitchen-intelligence system** — nutrition tracking, smart
sourcing (recipe import + shopping optimization), and proactive pantry/waste intelligence. Two whole
new specialist teams (`nutrition`, `sourcing`) + chef full-format remediation. Strictly additive;
round-1 files never regressed.
- Phase 0 orient ✅ — re-read BOTH architecture docs in full + the kitchen spec + round-1 PROGRESS/PLAN;
  studied the full-format reference `store/projects/blog/spaces/{newsroom,editorial}` (blog is 2 rounds
  in). Confirmed engine built through P8 (dist present), `sdk/org/.env` AZURE keys set, kitchen baseline
  **11/11 green**, both repos level with origin/main. Verified the row-type singularizer for all 6 new
  tables (`settings→Setting`, `nutrition_facts→NutritionFact`, `meal_nutrition→MealNutrition`,
  `substitutions→Substitution`, `shopping_trips→ShoppingTrip`, `suggestions→Suggestion`).
- **Critical engine facts carried from the blog round-2 log (apply, do NOT rediscover):**
  (a) hook `delegate` DROPS structured input + api `spawn` is a no-op stub → agents invoked by
  hooks/spawn get only a generic message and MUST **self-query** their work (bound tasklists get
  `{ query, ...context }`). (b) task-level `functions:` is an ALLOWLIST that gates SYSTEM
  webSearch/webFetch/fetch too — the importer's fetch task must list them. (c) db hooks fire on
  api-writes / top-level (chat) writes in the main process, but NOT on writes inside a headless
  hook-triggered session (so a hook→agent→hook 2nd hop won't auto-cascade; cron/api/chat paths do).
  (d) db-hook handlers must guard `row` undefined (manual/boot/cron runs). (e) `db.query` where is
  equality-only. → all four new hooks fire on working paths (2 db-insert from top-level/api writes,
  2 cron self-query) — NONE rely on headless-session re-dispatch.
- Phase 1 spec ✅ — added a "## Round 2 — Nutrition, Sourcing & Kitchen Intelligence (expansion)" section
  to `app-specifications/kitchen-application.md` (6 new tables + 5 columns, 13 endpoints, 4 hooks, 2 new
  full-format spaces `nutrition`+`sourcing`, 4 new agents, 5 pages, chef full-format remediation).
- Phase 2 PLAN ✅ — appended a file-by-file round-2 section to `automation/app-builder/PLAN.kitchen.md`.
- Phase 3 build (in progress):
  - database/ ✅ — 6 new tables + column adds. **All 12 validate** via the real engine `validateSchemaSet`
    (I authored these directly — foundation locked before fan-out).
  - api/ ✅ — 13 new handlers (Sonnet subagent). → 27 endpoints total.
  - hooks/ ✅ — 4 new hooks (all declarative-trigger self-query). → 6 total.
  - spaces (chef remediation + nutrition + sourcing) + pages/components — fanned out to parallel Sonnet
    subagents by directory. Integration + full build/test/live pending.

## Round log — ROUND 2 COMPLETION (2026-07-05, this run) — shipped ✅
Picked up the in-flight round-2 expansion (all round-2 files were on disk but uncommitted, unverified,
and the space-format remediation was incomplete). Completed it end-to-end, found+fixed 4 real bugs, and
shipped. This run's expansion floors are all met: **+2 spaces (nutrition, sourcing → 3 total), +4 agents,
+5 pages (13 total), +13 endpoints (27 total), +4 hooks (6 total), +6 tables (12 total)**.

- **Space-format remediation (the flagged defect) — DONE.** All 3 spaces are now FULL format:
  - `chef`: added `tasklists/{plan(7-day forEach),suggest-uses,recompute}`, `functions/{scaleQuantity,
    coverageScore,diffShoppingNeeds,expiringSoon}`, `components/view/{WeekPlanCard,ShoppingListCard}`,
    `knowledge/{meal-planning/{dietary-constraints,variety-and-balance}, pantry/pantry-management,
    shopping/shopping-diff}` (4 topics, each index.md + ≥2 aspects). Planner gained `db:read settings`,
    `db:write suggestions`, a `suggest-uses` action + `knowledge:` refs.
  - `nutrition`: added `tasklists/{compute,analyze-recipe,explain-week}` + `knowledge/{nutrition-science/
    {macros-and-estimation,targets-and-adherence}, coaching/not-a-dietitian}`. (functions/components pre-existed.)
  - `sourcing`: added `tasklists/{import,substitutions,organize-trip}`, `components/view/{ImportedRecipePreview,
    ShoppingTripPreview,SubstitutionCard}`, `knowledge/{recipe-import/{parsing-web-recipes,web-fetch-safety},
    shopping-optimization/{aisle-and-cost,substitutions}}`, and **4 new functions** (see bug #1).
  - Fanned out to 3 parallel Sonnet subagents by directory (one per space); I integrated + verified.
- **All 3 spaces load clean via the real engine `loadSpace`** (pre-flight before the live test).
- **Test suite: 18/18 green** (`node --test store/projects/kitchen/tests/kitchen.test.mjs`) — 12 schemas
  validate, 27 endpoints, 6 hooks, 3 full-format spaces, knowledge index+≥2-aspects, least-privilege caps,
  + 3 NEW regression tests (see bugs below). Token scan: **0 raw colors** across pages+components+space-components.
- **Full pipeline under `lmthing serve` (temp LMTHING_ROOT, LM_MODEL=S):** manifest = **12 tables / 27
  endpoints / 6 hooks**; `types/generated.d.ts` has all 11 row interfaces; **11 page routes build** (3 assets);
  `GET /app/kitchen/ → 200`. Deterministic read endpoints verified exactly correct: `shoppingList`
  (pasta 1900, garlic 26, tomato 400 — olive oil excluded, pantry covers it), `getShoppingTrip` (aisle-grouped
  pantry/produce + cost), `getPlanNutrition`/`nutritionStats` (13638 wk cal, 1948/day avg).

### 🔴 LIVE core loop (DeepSeek `azure:DeepSeek-V4-Flash`), end-to-end — PROVEN
- **Planner (chat session, live):** wrote **7 plan_meals** (one/day 07-06→07-12), **scaled servings to
  householdSize=4 from `settings`** (round-2 dietary/household feature LIVE), marked the plan `ready`,
  favored in-stock recipes (6× Garlic Pasta + 1× Tomato Soup).
- **enrich-recipe-nutrition db hook (recipes:insert) → nutritionist (live):** wrote **4 nutrition_facts**
  (all seeded ingredients estimated via `estimateNutrition`).
- **recompute-shopping db hook fired → shopper (live):** after bug #4 fix, wrote **3 shopping_list gaps**
  matching the deterministic diff exactly.
- **compute-nutrition db hook fired → nutritionist compute (live):** after bug #3 fix, wrote **7
  meal_nutrition rows** (Garlic Pasta @4srv ≈2182 cal/46g; Tomato Soup ≈546 cal/16g) → `getPlanNutrition`
  + `nutritionStats` now show real macros.
- **Capability gate proven live** (host-enforced per-verb table scope errors, agents recovered).

### Bugs found + fixed live this run (each now has a regression test / is engine-verified)
1. **Sourcing space failed to load (fail-loud).** The importer/optimizer agent `functions:` listed system
   globals `webFetch/webSearch/fetch` (not files → loader throws "not found in functions/") and 4 helper
   functions that didn't exist. Fix: removed system globals from AGENT `functions:` (they're universal/ambient
   at top level; the import **tasklist fetch task** keeps them as a task-level allowlist — the correct engine
   location) and **created the 4 helper functions** `matchIngredient, groupByAisle, estimateTripCost,
   suggestSubstitute` (sourcing now has 5 functions). New tests: `the importer reaches the web via its
   task-level functions allowlist…` + `no agent-level functions: lists a system global (fail-loud loader trap)`.
2. **Round-2 columns had no write path.** `addIngredient`/`updatePantry` didn't accept `expiresAt`/`costPerUnit`,
   so the /expiring page, use-it-up hook, and shopping-trip cost estimate would build but never have data.
   Fix: both handlers now accept the optional columns (updatePantry became partial — quantity-only PATCH no
   longer clobbers expiry). New test: `pantry writes accept the round-2 columns…`.
3. **nutritionist `compute` couldn't run** — `db:read: table "meal_nutrition"/"suggestions" not permitted`
   (they were write-only, but compute must read them for its idempotence guard). Fix: added `meal_nutrition`
   + `suggestions` to the nutritionist's `db:read`. Verified live: 7 meal_nutrition rows written.
4. **shopper `recompute` wrote 0 rows** — its instruct assumed a `planId` input, but **hook delegates drop
   structured input**; the weak model then guessed a non-existent `plans` table. Fix: instruct now tells it
   to **self-query `plan_meals`** for the plan ids and warns there is no `plans` table (the week is
   `meal_plans`). Verified live: 3 correct shopping_list rows.

### Known / accepted (non-blocking)
- **Weak-model noise:** DeepSeek-Flash sometimes calls `loadKnowledge('<field>/overview')` (guessing an
  option name) → a **retryable** yield error (the field overview is `index.md`, auto-injected; no `overview.md`).
  Non-fatal — the planner completed correctly. Could add aspect-name hints to each index.md in a later round.
- DeepSeek-Flash occasionally flakes on the shopper's multi-step diff (a non-yielding-binding nudge loop) on
  the first hook-triggered run; a fresh session + the bug-#4 self-query fix succeeded. The **deterministic
  `shoppingList`/`getShoppingTrip` API endpoints guarantee UI correctness regardless of agent flakiness.**
- sdk/org engine: **no changes needed this run** (kitchen relies only on already-shipped engine behavior).

### Pushed SHAs (round-2 completion, 2026-07-05)
- sdk/org: **e4be05f4** (no engine changes this run — submodule left level with origin/main; push was a no-op confirm).
- monorepo `main`: **a165147b** (kitchen round-2 app + spec + PLAN/PROGRESS; 144 files). Verified: both repos
  level with origin/main; parent pointer records submodule e4be05f4 which is on origin/main.

### Phase 6 — prod install + AI functional test (2026-07-05)
Followed `.claude/skills/test-app-install-prod.md` fresh. All server-side (pod-IP, in-cluster, no JWT —
the gateway JWT was expired and minting is classifier-blocked in autonomous mode; the skill's substantive
Steps 2/5/6 need no JWT).
- **Deploy status:** my Phase-5 push `a165147b` (~20 min old) is **NOT yet in `compute:latest`** — the
  deployed catalog `GET /api/apps` lists `kitchen` with only the **6 round-1 tables** (round-2 tables
  settings/nutrition_facts/meal_nutrition/substitutions/shopping_trips/suggestions absent). CI/ArgoCD lag.
  Per the operator rule this is **not a run failure**; the round-2-specific prod functional test **defers to
  the next run** once CI rebuilds+rolls the compute image. (No `.issues/` entry — deploy lag, not a defect.)
- **Install: PASS** — `POST /api/apps/install {appId:kitchen, force:true}` → `ok:true, built.pages.ok:true`
  on two test-user pods (`user-379847043318834826`, `user-380011590780479114`). The app materializes + the
  page bundle builds on the live cluster.
- **AI functional: PASS** (round-1 kitchen, user `380011590780479114`) — seeded pantry+recipe, `generatePlan`,
  then drove `chef/planner` via a pod chat session: the planner ran the **real `/v1` LiteLLM model**, wrote
  `plan_meals` and marked the plan `ready`, **0 budget errors** in the pod log, DB updated (`plannedMeals` via
  `GET /app/kitchen/api/stats`). Proves the real model path fires on prod.
- The first test user (`379847043318834826`) was **budget-exhausted** (`ExceededBudget: Spend=$3.0174,
  Limit=$3.00` — the $3/1d free-tier window, spent by today's earlier blog prod test + local runs); switched
  to a fresher user per the skill's Troubleshooting. Documented non-defect.
- **Cleanup:** did NOT scale any user pods down this run (node was not saturated), so nothing to scale back up;
  left the test users' kitchen installs in place (harmless).
- **Strong live proof already stands locally** for the round-2 code (full loop + all 4 bug fixes, above), so
  the round-2 prod functional check is the only deferred item, gated purely on CI deploying `a165147b`.
