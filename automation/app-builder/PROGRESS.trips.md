# PROGRESS — `trips` project-application

Running log across 5-hour autonomous runs. Single source of truth for status.

## Environment / ground truth (verified this run)
- Engine (`sdk/org/libs/{core,cli}`) is built **through Phase 8** (db, capability globals,
  api runtime, typed-contract build, pages build, hooks runtime, chat, Studio admin). Phase 9
  (`system-appbuilder`) is NOT built — so `trips` is **hand-authored** under
  `store/projects/trips/` (no appbuilder delegation needed). Mirrors the sibling `blog` app.
- Output location (operator override): **`store/projects/trips/`** in the monorepo. `types/` +
  `.data/` are generated/runtime → git-ignored.
- Key runtime contracts (grounded in engine source + the sibling `blog` build):
  - `database/<table>.json` → `validateSchemaSet` (fail-loud: required descriptions on
    table/column/relation, exactly-one PK, FKs/relations resolve). Column types
    `string|number|boolean|date|json`; flags `primaryKey/required/unique/default/generated(uuid|now)`;
    `references {table,column?,onDelete cascade|setNull|restrict}`;
    `relations {name:{hasMany|belongsTo, via, description}}`.
  - Row interface names = deterministic singularizer (`build/schema.ts`): `trips→Trip`,
    `destinations→Destination`, `itinerary_items→ItineraryItem`, `bookings→Booking`,
    `research→Research`. Pages import these from `@app/types`.
  - `db.query` `where` is **equality-only** (`Record<string,unknown>`) + `include/orderBy/limit/offset`.
    No SQL/LIKE — query-all + filter/sort in JS.
  - api handler: ESM exporting `name`/`description`/`Input`/`Output` + default
    `async (input, ctx) => Output`; `ctx = { db: AsyncDbApi, spawn, apiCall, delegate }`; import
    `{ HttpError }` from `@app/runtime`. Method = filename (`GET.ts`…), route = dir, `[id]` merges into Input.
    NOTE: the handler inlines its own `Db`/`Ctx` local types at the top (ts-json-schema-generator only
    needs `Input`/`Output` exported); see blog handlers for the exact boilerplate.
  - hooks: default-export object. cron `{type:'cron', every|daily, trigger, budget}`;
    database `{type:'database', on:{table,event}, trigger|handler, budget}`.
  - pages: default-export React component `({ params }) => JSX`; client data via `@app/runtime`
    `useApi`/`useApiMutation`/`apiCall`; `<Chat agent="space/agent" />`; router `Link`/`navigate`/
    `useParams`. Design tokens only (`@lmthing/css`), NO raw colors.
  - project-scoped spaces: `<projectRoot>/spaces/<space>/agents/<agent>/{charter.md,instruct.md}`;
    agent frontmatter allow-list = `{title,knowledge,functions,components,actions,defaultAction,
    canDelegateTo,dependencies,capabilities}`. `capabilities:` = list of bare id or `id:{config}`;
    `db:read/write/schema {tables?}`, `api:call {allow}` (required), `pages/api/hooks:write`.
  - **`webSearch`/`webFetch`/`fetch` are universal system globals** (omit `functions:` to keep them);
    listing them in `functions:` FAILS the load (that key validates against space-defined functions).
    No external-binding registry — `mapsSearch`/`weatherLookup` are aspirational.
  - Named delegate actions need an `actions:` frontmatter entry (empty tasklist = model-driven), OR a
    `tasklists/<name>/` dir for tasklist-backed actions.

## Round log
### Round 1 — CORE BUILD (in progress)
- Phase 0 orient ✅ — read both architecture docs in full + trips spec + engine source + the
  sibling `blog` build (exact template: hand-authored under `store/projects/`, engine through P8).
- Phase 1 spec improvements ✅ — folded into `app-specifications/trips-application.md`:
  - Promoted **budget roll-up** into round-1 core: `estimatedCost` + `currency` columns on
    `itinerary_items`; `tripBudget` (`GET api/trips/:id/budget`) endpoint; `BudgetStrip` on the timeline.
  - Added `deleteTrip` (`DELETE api/trips/:id`) — a genuinely-missing core operation (cascades).
  - Added an **"Engine reconciliation (round-1 build notes)"** section: honest `webSearch`=system-global,
    equality-only `where`, row-type singularizer, `actions:` requirement, and that the `concierge` space
    is built in **FULL space format from round 1** (charter+instruct per agent, tasklists/, functions/,
    components/, extensive knowledge/) — avoiding the `agents/`-only defect the sibling apps have.
  - **Endpoint count: 11** (10 core + `tripBudget`). Tables: **5** (budget uses columns, no new table).
- Phase 2 PLAN ✅ — `automation/app-builder/PLAN.trips.md`.
- Phase 3 build ✅ — `store/projects/trips/` built end-to-end. Fanned out to 3 parallel Sonnet
  subagents by directory (api / pages+components / hooks+concierge-space); integrated by orchestrator:
  - **database/** — 5 schemas (trips, destinations, itinerary_items[+estimatedCost,currency],
    bookings, research); pass the real `validateSchemaSet`.
  - **api/** — 12 typed handlers (tripList, createTrip, getTrip[nested], updateTrip, deleteTrip,
    tripBudget, addDestination, updateItem, removeItem, addBooking, removeBooking, getResearch).
    `createTrip` uses `ctx.spawn` (NOT ctx.delegate — the real api ctx is `{db,apiCall,spawn}`).
  - **hooks/** — research-new-destination (database:insert→researcher#dive, idempotent),
    watch-booking-prices (cron 12h→researcher#price-check).
  - **spaces/concierge/** — FULL space format: planner/researcher/scheduler each charter+instruct;
    `plan-trip` tasklist (propose_destinations → research_each forEach → lay_out); 3 typed functions
    (rollUpBudget, groupByDay, dedupeDestinations); components/view/DestinationProposal.tsx;
    knowledge/travel/{destination-research,itinerary-pacing,budgeting} each index.md + 2 aspects.
  - **pages/** — 5 routes (index, new, trips/[tripId] timeline+BudgetStrip+polling, plan+Chat,
    research/[destId]+Chat) + _app/_layout + 8 components. Token-clean (no raw colors).
- Phase 4 tests + live ✅ — app tests 12/12 green (`node --test`); real-engine live verification:
  - **Booted under `lmthing serve`** (temp root, trips materialized). Had to rebuild `better-sqlite3`
    native binding for Node v24/ABI-137 (`npm run build-release` in the pnpm dir) — env-only, not an
    app defect. Manifest: 5 tables + 12 endpoints + 2 hooks; **pages build succeeded** (built:true,
    5 routes, CSS+JS+index.html); `GET /app/trips/`→200; `types/generated.d.ts` generated.
  - **API round-trip:** createTrip→row+tripId; tripList; getTrip(nested destinations→items+bookings);
    tripBudget rolls up (budget/booked/estimated/remaining/byKind).
  - **🔴 LIVE core loop (DeepSeek `azure:DeepSeek-V4-Flash`):**
    (a) `addDestination('Sintra')` → **research-new-destination database hook fired** → delegated
    `concierge/researcher#dive` (live) → wrote a real "Deep Dive: Sintra" research row (status
    `ready`, real webFetch'd content). getResearch read-view reflects it.
    (b) **Chat session** bound to `concierge/scheduler` → live `lay-out` wrote 3 realistic
    `itinerary_items` for Sintra (Pena Palace $14, lunch $18, Quinta da Regaleira $10). getTrip nested
    shows Sintra→3 items; tripBudget estimated=42 (24 activity+18 meal), remaining=1758. Proves:
    project-scoped chat, capability-gated sync db, in-proc db-hook dispatch, live multi-agent delegate,
    typed api read views — all live.
  - **Engine gap noted (NOT an app defect):** api-handler `ctx.spawn('concierge/planner#plan-trip')`
    logs `deferred — agent runner arrives in Phase 6`, so createTrip's fire-and-forget planner
    fan-out doesn't execute in this engine build. The **hook** delegate path IS wired and runs live
    (proven above), and the chat-session path runs the specialists live. Same limitation blog hit;
    the plan-trip full fan-out will light up when the api spawn runner lands. No code change needed.
  - Install path used: **local test user via `lmthing serve`** (temp `LMTHING_ROOT`, trips
    materialized into `<root>/trips/`). No prod install this run.
- Phase 5 push ✅ — green gate (app tests 12/12, lint:tokens ✓ 571 files, trips raw-color scan clean,
  full serve-pipeline build/typecheck/pages-build green) then two-repo push (submodule first):
  - **sdk/org `main`: `6da8f42`** — UNCHANGED this round (no engine changes were needed; pushed as a
    confirmed no-op, level with origin/main).
  - **monorepo `main`: `e81a960`** — trips app + spec + PLAN/PROGRESS (pointer records 6da8f42, matches
    submodule HEAD, which is on origin/main). Verified both level with origin.

## Resume notes for the NEXT run (round 2 — FEATURE EXPANSION)
- Round 2 is strictly additive — do NOT regress/delete round-1 files. Floors: ≥1 new project-scoped
  space, ≥3 new agents, ≥5 new pages, ≥8 new api endpoints, ≥3 new hooks, ≥3 new tables + features.
- Round-1 concierge is already FULL space format (no remediation needed for it — good baseline).
- Round-2 feature ideas from the spec's "Additional features": packing list (packer agent +
  `packing_items` table + weather-aware regeneration cron), weather-aware itinerary, to-book reminders
  (daily cron scan), plus a whole new **`logistics`** space (transit/visa/currency specialists).
- Run locally: materialize `store/projects/trips/` into a temp `LMTHING_ROOT`'s `<root>/trips/`,
  `node sdk/org/libs/cli/dist/cli/bin.js serve --port <p>`, drive via `POST /app/trips/api/*`, admin
  data browser (`GET /api/projects/trips/app/data/:table`), chat sessions (`POST /api/sessions
  {projectId:'trips', spaceRef:'concierge/planner'}` + `POST /api/sessions/:id/message {content}`).
  Live model via `sdk/org/.env` (AZURE keys + `LM_MODEL_S` set).

## Round 2 — FEATURE EXPANSION (complete)
Strictly additive to round 1. Floors met/exceeded: **+5 tables, +2 spaces (3 agents), +12 api,
+4 hooks, +5 pages**. Totals now: 10 tables, 24 api endpoints, 6 hooks, 3 project-scoped spaces
(concierge+records+logistics), 12 pages.

### Phase 1 spec ✅ — folded into `app-specifications/trips-application.md`
- New `logistics` space section (navigator + packer) + `transit_legs` table; sharpened
  documents/packing/reminders; new "Round-2 reconciliation" subsection documenting: **text-content
  upload** (no multipart/blob — `documents.content` holds pasted text; ajv-friendly), no external
  weather/maps bindings (universal webSearch), `knowledge_notes` as db-backed note store, the new
  row-type singularizers, and the ≥2-space/full-format requirement satisfied.

### Phase 3 build ✅ (fanned to 3 Sonnet subagents by dir; integrated by orchestrator)
- **database/** (me): documents, document_extractions, knowledge_notes, packing_items, transit_legs
  (+itinerary_items.needsBooking/bookByDate/weatherNote). All 10 pass real `validateSchemaSet`.
  concierge caps extended with knowledge_notes (researcher gains db:write knowledge_notes).
- **api/** (12): uploadDocument, listDocuments, getDocument; packingList, generatePacking,
  addPackingItem, togglePacked, removePackingItem; transitLegs, planTransit; tripReminders, tripNotes.
- **spaces/records/** (analyst, full format) + **spaces/logistics/** (navigator + packer, full
  format) — charter+instruct per agent, tasklists, functions, components, extensive knowledge (each
  field index.md + ≥2 aspects). Least-privilege caps (no authoring caps).
- **hooks/** (4): analyze-document (database:insert docs), plan-transit-on-destination (database:insert
  destinations), regenerate-packing (cron→packer#pack-due), to-book-reminders (cron→navigator#booking-windows).
- **pages/** (5): trips/[tripId]/{documents,packing,logistics,reminders}, documents/[docId] + 7 components
  + TripTabs sub-nav wired into existing trip pages. Token-clean (raw-color scan + lint:tokens 575 files ✓).

### Engine constraints discovered + fixed THIS round (grounded in real serve run)
- **cron hooks require a declarative `trigger`; only `database` hooks take an imperative `handler`**
  (`libs/cli/src/app/hooks/loader.ts validateHook`). My two cron hooks originally used `handler` →
  `loadHooks` threw → the WHOLE hook set silently loaded as `[]` (incl. round-1's two). Fixed:
  cron hooks now `trigger: 'logistics/packer#pack-due'` / `'logistics/navigator#booking-windows'`,
  and the packer/navigator gained **self-scanning** actions.
- **Hook `delegate(ref, action, {input})` DROPS the input** (`routes/hooks.ts:160 void opts` — matches
  memory `reference-project-app-engine-facts`). Hook-delegated agents must **self-query the db**.
  Fixed: `records/analyst#analyze`, `logistics/navigator#plan-transit`, and (non-regressively)
  `concierge/researcher#dive` are now model-driven self-scanning actions that discover their targets
  (pending documents / destinations lacking legs / un-researched destinations) and seed the tasklist
  with real ids — instead of relying on `input`.
- **A tasklist task's `output` schema is validated fail-loud** — `02-extract` declared
  `newDestinationId: string` (required) but resolved `undefined` for a booking → "Fork output does not
  match schema" killed the analysis. Fixed: output is `{ ok }`; research-followup recovers new dest ids
  from `document_extractions` provenance.
- **forEach-fork db writes are unreliable with the weak model** — the weak DeepSeek-V4-Flash in a
  `forEach` fork hallucinated `remember/recall/readFileRaw` instead of `db.insert`. Fixed: `plan-transit`
  writes all legs in a **single non-forEach `general` task loop** (the pattern the analyst extract task
  provably uses), carrying `tripId` inside each pair.

### Phase 4 tests + 🔴 LIVE (DeepSeek `azure:DeepSeek-V4-Flash`, real `lmthing serve`) ✅
- `tests/trips.test.mjs` extended: 26 tests green (10-table validateSchemaSet, new columns, 24
  endpoints, 6 hooks, records+logistics full-format + least-privilege, ≥2 spaces).
- Booted `lmthing serve` on a temp `LMTHING_ROOT` (trips materialized). Manifest: **10 tables, 24
  endpoints, 6 hooks, 10/12 page routes, build built:true**. All new pages serve 200.
- **LIVE database-hook write paths, all three proven writing real rows:**
  - `analyze-document`: uploaded a pasted hotel confirmation → hook → analyst self-scan → analyze-document
    tasklist → wrote a `bookings` row + a `document_extractions` provenance row + set `documents.status`
    `pending→analyzing→analyzed`. (Field accuracy imperfect on the weak flash model — one run got
    cost=340 right, another grabbed the header as provider — a MODEL limitation, not a code defect; the
    pipeline/provenance/lifecycle are correct.)
  - `research-new-destination`: added Lisbon+Porto → researcher self-scan → 2 `research` rows (status ready).
  - `plan-transit-on-destination`: → navigator self-scan → plan-transit tasklist → 2 `transit_legs`
    (origin→Lisbon flight €150, Lisbon→Porto train €25, status suggested). `transitLegs` API read view
    returns them with resolved from/to names.
- Install path: **local test user via `lmthing serve`** (temp root). No prod install yet (Phase 6 next run/below).

### Phase 5 push
