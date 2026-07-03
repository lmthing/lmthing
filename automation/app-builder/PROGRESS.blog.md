# PROGRESS — `blog` project-application

Running log across 5-hour autonomous runs. Single source of truth for status.

## Environment / ground truth (verified this run)
- Engine (`sdk/org/libs/{core,cli}`) is built **through Phase 8** (db, capability globals,
  api runtime, typed-contract build, pages build, hooks runtime, chat, Studio admin). Phase 9
  (`system-appbuilder`) is NOT built — so the blog app is **hand-authored** under
  `store/projects/blog/` (no appbuilder delegation needed).
- Output location (operator override): **`store/projects/blog/`** in the monorepo. `types/` +
  `.data/` are generated/runtime → git-ignored.
- Key runtime contracts learned from the engine source (not just the spec):
  - `database/<table>.json` loaded by `libs/cli/src/app/loader.ts` → `validateSchemaSet`
    (fail-loud: required descriptions on table/column/relation, exactly-one PK, FKs/relations
    resolve). Column types: `string|number|boolean|date|json`; flags `primaryKey/required/unique/
    default/generated(uuid|now)`; `references {table,column?,onDelete cascade|setNull|restrict}`;
    `relations {name:{hasMany|belongsTo, via, description}}`.
  - Row interface names are the **deterministic singularizer** in `build/schema.ts`:
    `sources→Source`, `raw_items→RawItem`, `articles→Article`, `citations→Citation`,
    `research→Research`, `settings→Setting` (NOT `Settings` — trailing `gs`→`g`). Pages import
    these from `@app/types`.
  - `db.query` `where` is **equality-only** (`Record<string,unknown>`), plus `include/orderBy/
    limit/offset`. No SQL/LIKE — agents must query-all + filter in JS (Phase-7 learning).
  - api handler: ESM module exporting `name`/`description`/`Input`/`Output` + default
    `async (input, ctx) => Output`; `ctx = { db: AsyncDbApi, spawn, apiCall }`; import
    `{ HttpError }` from `@app/runtime`. Method = filename (`GET.ts`…), route = dir, `[id]`
    dynamic segment merges into Input.
  - hooks: default-export object. cron `{type:'cron', every|daily, trigger, budget}`;
    database `{type:'database', on:{table,event}, trigger|handler, budget}`.
  - pages: default-export React component `({ params }) => JSX`; client data via `@app/runtime`
    `useApi`/`useApiMutation`/`apiCall`; `<Chat agent="space/agent" />`; router `Link`/`navigate`/
    `useParams`. Design tokens only (`@lmthing/css`), no raw colors.
  - project-scoped spaces live at `<projectRoot>/spaces/<space>/agents/<agent>/instruct.md`;
    agent frontmatter allow-list = `{title,knowledge,functions,components,actions,defaultAction,
    canDelegateTo,dependencies,capabilities}`. `capabilities:` = list of bare id or `id:{config}`;
    `db:read/write/schema {tables?}`, `api:call {allow}` (required), `pages/api/hooks:write`.
    `functions:` allowlist gates system functions (webSearch/webFetch/fetch).
  - Reconciling the spec's `webSearch` "api:call binding": in the actual engine `webSearch`/
    `webFetch`/`fetch` are **system functions** gated via `functions:` frontmatter — NOT api:call
    named bindings (no external-binding registry is implemented). Newsroom agents fetch via
    `functions`; `api:call` is for the app's own typed endpoints.

## Round log
### Round 1 — CORE BUILD (in progress, 2026-07-03)
- Phase 0 orient ✅ — read both architecture docs in full + spec + engine source.
- Phase 1 spec improvements ✅ — folded into `app-specifications/blog-application.md`:
  - `articles.imageUrl` (hero) + `articles.saved` (bookmark) columns.
  - 4 new endpoints: `feedStats` (GET api/stats), `markAllRead` (POST api/mark-all-read),
    `saveArticle` (POST api/articles/:id/save), `getSettings` (GET api/settings, seeds row) →
    **12 endpoints** total.
  - Feed page gains a stats strip + Saved filter + mark-all-read; preferences shows tier.
  - Documented the engine's deterministic row-type singularizer (`settings→Setting`) + the
    equality-only `db.query` `where` constraint (query-all + JS filter) as authoring rules.
  - Reconciled `webSearch` honestly: it's a **system `functions:`** tool (webSearch/webFetch/
    fetch), NOT an `api:call` external binding (none implemented). Synthesizer is db-only
    (`functions: []`); `api:call` reserved for own-project endpoints (newsroom needs none).
- Phase 2 PLAN ✅ — `automation/app-builder/PLAN.blog.md`.
- Phase 3 build ✅ — `store/projects/blog/` built: 6 database schemas, 12 api handlers,
  2 hooks, newsroom space (3 agents), 7 pages + 5 components, package.json/tsconfig/README.
  Fanned out to 3 parallel Sonnet subagents by directory (api / pages+components /
  hooks+spaces); integrated + fixed by orchestrator.
  - **Engine bugfix (in-scope, sdk/org):** `ts-json-schema-generator` globs the handler
    `config.path`, so a dynamic route dir `api/articles/[id]/GET.ts` (brackets = glob
    char-class) matched nothing → "No input files" → contract/type/pages build died for ANY
    app with a `[param]` route. Fixed in `libs/cli/src/app/build/schema.ts` with
    `escapeGlobPath` (bracket-wrap escaping — survives the generator's `normalize-path`).
    Regression test added (`schema.test.ts`: dynamic-[id] contract + escapeGlobPath).
  - **Agent-frontmatter fixes:** `functions:` in agent instruct.md validates against
    space-defined functions (a `functions/` dir), NOT system functions — so listing
    `webSearch` there fails the load. Dropped `functions:` (system webSearch/webFetch/fetch
    are universal globals) and added `actions:` (id/label/description, empty tasklist =
    model-driven) so the hook's `delegate(...,'synthesize',...)` named action resolves.
- Phase 4 tests + live ✅:
  - **Full pipeline HTTP-verified** under `lmthing serve` (temp root, blog materialized):
    manifest lists all 6 tables + **12 endpoints** + 2 hooks; `types/generated.d.ts`
    generated with correct interface names (Article/Citation/RawItem/Research/Setting/Source);
    **pages built** (JS+CSS+index.html, incl. dynamic `[articleId]` routes); `GET /app/blog/`
    → 200; api I/O live: `feedList`→[], `getSettings` seeds+returns the row, `addSource`
    marshals json topics, `feedStats` aggregates.
  - **🔴 LIVE core loop (DeepSeek `azure:DeepSeek-V4-Flash`), end-to-end:** created a chat
    session bound to `newsroom/fetcher` → it genuinely `webFetch`ed a real HN RSS feed,
    parsed items, `db.insert`ed 3 raw_items → **`synthesize-new` database hook fired** →
    delegated to `newsroom/synthesizer` (live) → it wrote a real synthesized article
    ("Native TypeScript Apps Without Electron…", tags `[typescript,native-apps,electron,
    developer-tools]`, score 42, 1082-char body) + a citation (articleId+rawItemId+quote) +
    marked the raw_item `processed:true`. `feedList` (page read view) + `feedStats` reflect
    it. The other 2 raw_items stayed unprocessed = per-hook coalesce/loop-guard working
    (bounded cascade). Proves: project-scoped chat, capability-gated sync db, in-process
    db-change hook dispatch, live multi-agent delegate, typed api read view — all live.
  - The fetcher correctly **refused** to insert fabricated data first (its own guardrail),
    which is why the real-feed path was used — good agent behavior, captured.
- Phase 5 push: (pending — after unit test files + full sdk/org gate + lint:tokens)
