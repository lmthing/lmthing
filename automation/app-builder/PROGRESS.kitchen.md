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
- monorepo `main`: <filled at commit>

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
