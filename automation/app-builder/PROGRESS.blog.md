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
- Phase 5 push ✅ — green gate then two-repo push (submodule first):
  - Gate: build ✅ typecheck ✅ test ✅ (907 passed / 21 skipped; the lone red
    `serve-tree-ws.test.ts` is a pre-existing ENOTEMPTY teardown flake — passes in
    isolation, unrelated to the `build/schema.ts` change) · system-spaces-dag ✅ (11) ·
    lint:tokens ✅ (root 567 + blog 12) · blog app tests ✅ (8, `node --test`).
  - **Pushed sdk/org `main`: `e70161a`** (escapeGlobPath fix + regression test).
  - **Pushed monorepo `main`: `a7c0e41`** (blog app + spec + PLAN/PROGRESS + pointer bump).
  - Verified: both level with origin/main; parent pointer records `e70161a` (matches
    submodule HEAD). Left the sibling health/kitchen/trips app-specs untouched (other rounds).

## Resume notes for the NEXT run (round 2 — FEATURE EXPANSION)
- The app EXISTS and is green + live-verified. Round 2 is strictly additive — do NOT
  regress/delete round-1 files. Floors: ≥1 new project-scoped space, ≥3 new agents, ≥5 new
  pages, ≥8 new api endpoints, ≥3 new hooks, ≥3 new tables + substantial new features.
- Run the app locally exactly as this run: materialize `store/projects/blog/` into a temp
  `LMTHING_ROOT`'s `<root>/blog/`, `node sdk/org/libs/cli/dist/cli/bin.js serve --port <p>`
  (flag is `--port`, NOT `--serve-port`), then drive via `POST /app/blog/api/*`, the admin
  data browser (`GET /api/projects/blog/app/data/:table`), and chat sessions
  (`POST /api/sessions {projectId:'blog', spaceRef:'<space>/<agent>'}` +
  `POST /api/sessions/:id/message {content}`). Live model via `sdk/org/.env` (AZURE keys set).
- Engine gotchas already handled (keep applying): dynamic `[param]` api routes need the
  glob-escape fix (now shipped); agent `functions:` is space-functions-only (system
  webSearch/webFetch/fetch are universal — don't list them); named delegate actions need an
  `actions:` frontmatter entry (empty tasklist = model-driven); `db.query` `where` is
  equality-only; per-hook coalesce means rapid same-table inserts synthesize once per window.
- Ideas for round 2 spaces/features: an **`editorial`** space (curator/ranker/copyeditor);
  tables `digests`, `topics`, `reading_events`, `newsletters`; endpoints for personalization
  (topic follow/mute, per-topic feeds), a daily **digest** builder hook, saved-search alerts,
  full-text-ish client search, an article **/tag** aggregation page, RSS OPML import.

## Round log — ROUND 2 (FEATURE EXPANSION, 2026-07-04, in progress)
Theme: raw feed → curated/personalized newsroom (topics · digests · newsletters · personalization) +
newsroom full-format remediation. Strictly additive; round-1 files untouched.
- Phase 0 orient ✅ — re-read both architecture docs in full + spec + PROGRESS; studied full-format
  reference `store/projects/trips/spaces/concierge`; confirmed round 1 green + sdk/org pointer 5db0e3e.
- Phase 1 spec ✅ — added "Round 2 — Editorial, digests & personalization" section to
  `app-specifications/blog-application.md` (+5 tables, +3 articles cols, +14 endpoints, +4 hooks,
  +5 pages, editorial space, newsroom remediation); patched directory layout.
- Phase 2 PLAN ✅ — round-2 section appended to `automation/app-builder/PLAN.blog.md`.
- Phase 3 build (in progress):
  - database/ ✅ — 5 new tables (topics, digests, digest_items, reading_events, newsletters) +
    articles cols (pinned, editorNote, clusterKey). **All 11 validate** via engine validateSchemaSet.
  - hooks/ ✅ — build-daily-digest (cron daily 07:00→curator#digest), render-newsletter
    (digests:insert→digest-writer#render), personalize-on-read (reading_events:insert→personalizer#learn),
    rescore-on-topic-change (topics:update→personalizer#rescore). Loop-guard analyzed (cascade depth ≤2).
  - api/ · spaces/editorial/ · spaces/newsroom remediation · pages+components — fanned out to parallel
    Sonnet subagents (by directory).

### Floors check (round 2)
new space editorial (1) · newsroom+editorial = 2 total ✅ · new agents curator/digest-writer/personalizer (3) ✅ ·
new pages 5 ✅ · new endpoints 14 ✅ · new hooks 4 ✅ · new tables 5 ✅.

### Round 2 — Phase 3 integration, Phase 4 live verification, engine findings (2026-07-04)
- Fanned out api / editorial-space / newsroom-remediation / pages+components to 4 parallel Sonnet
  subagents (disjoint dirs); integrated by orchestrator.
- **Engine facts confirmed this round (no sdk/org code changed — app-only round):**
  1. Task-level `functions:` frontmatter is an ALLOWLIST that gates SYSTEM functions too
     (webSearch/webFetch are system-global space functions). A task listing only space fns loses
     webFetch → the fetcher `02-fetch_each` needed `webFetch/webSearch/fetch` added to its list. (fixed)
  2. **Hook `delegate` DROPS structured input** (`routes/hooks.ts` `void opts`) AND the **api `spawn`
     runner is a Phase-3 no-op stub** (`server/routes/app-api.ts` — "arrives in Phase 6"). So agents
     invoked by hooks/spawn get only a generic message and MUST **self-query** their work; the
     bound-tasklist convention passes `{ query, ...context }` (delegate.ts), not named ids. Reworked
     the editorial + researcher agents/tasklists to self-query (digest: fill oldest `building` digest
     or insert fresh; digest-writer: newest `ready` digest w/o newsletter; personalizer learn:
     recent reading_events; deep-dive: oldest `pending` research or `query` topic). Round-1
     synthesizer already worked via a `where:{id:undefined}` self-query quirk — left unchanged.
  3. Database-hook handlers must guard `row` being undefined on manual/boot/cron runs — hardened
     render-newsletter / personalize-on-read / synthesize-new (`if (row && …)`, additive).
  4. **api-write auto-dispatch fires db hooks** (updateTopic in the main process → rescore-on-topic-change
     fired). Writes inside a *headless hook-triggered* session did NOT re-dispatch (learn→rescore
     second hop didn't auto-fire) — the user-facing path (updateTopic slider / personalizeFeed /
     daily cron / manual) reaches rescore fine; noted as an engine limitation, feature works.
- **🔴 LIVE (DeepSeek azure:DeepSeek-V4-Flash), end-to-end, all via `lmthing serve` on a temp root:**
  - App loads: manifest = **11 tables + 26 endpoints + 6 hooks**; additive migration added
    articles.pinned/editorNote/clusterKey; `types/generated.d.ts` regenerated; pages built; `GET
    /app/blog/`→200. New endpoints verified live (listTopics, followTopic upsert, updateTopic,
    getDigest join, feedInsights aggregate, reading-events, feed-list).
  - **Editorial digest loop:** chat→`editorial/curator#digest`→`build-digest` tasklist
    (gather→cluster→write, live) wrote a real digest "Daily digest: AI, Rust, and the web platform"
    (status ready, **4 digest_items** across ai/rust/web with curator blurbs, correct article joins).
  - **Newsletter cascade:** the `digests:insert` **auto-fired `render-newsletter`** → `digest-writer#render`
    (live, self-queried the ready digest) → wrote a real **newsletter** (subject + 736-char markdown body).
  - **Personalization learn:** 3 reading_events (open/dwell/save on an AI article) **auto-fired
    `personalize-on-read`** → `personalizer#learn` (live) → nudged topic `ai` weight **2 → 2.15**.
  - **Personalization rescore (user path):** `updateTopic` ai→weight 4 **auto-fired
    `rescore-on-topic-change`** → `personalizer#rescore` (live) → rescored every article by topic
    weight (AI articles a2/a3 → **6**, non-AI a1/a4 → **3**) — feed re-ranks, AI content surfaced.
  - All 6 agents (newsroom fetcher/synthesizer/researcher + editorial curator/digest-writer/personalizer)
    create chat sessions cleanly = full space-format capability/frontmatter/tasklist/knowledge load OK.
- **Gate:** blog structural tests **16/16 green** (`node --test`: 11 tables, 26 endpoints, 6 hooks,
  2 full-format spaces w/ tasklists+functions+components+≥3 knowledge fields each, editorial
  least-privilege). Design tokens: root lint:tokens ✓ (575) + blog project-app ✓ (37 files, 0 raw colors).
  sdk/org untouched → its build/typecheck/test unchanged from round-1's pushed green state (5db0e3e→a340052);
  engine proven functional by the full live serve run.

### Floors delivered (round 2) — all exceeded
new space **editorial** (full format) → **2 spaces total** ✅ · **3 new agents**
(curator/digest-writer/personalizer, least-privilege) ✅ · **5 new pages** (topics/digests/index/
digests/[id]/insights/discover) + 5 components ✅ · **14 new endpoints** (→26) ✅ · **4 new hooks**
(→6) ✅ · **5 new tables** (→11) + 3 new articles columns ✅ · newsroom **remediated to full format**
(tasklists/functions/components/3 knowledge fields) ✅.

### Round 2 — Phase 5 push ✅ (2026-07-04)
- Green gate: blog structural tests 16/16 · lint:tokens root ✓ (575) + blog app ✓ (37) ·
  live e2e comprehensive (digest/newsletter/learn/rescore all live). sdk/org untouched (app-only round).
- **Submodule sdk/org: no changes** — clean, level with origin/main at **a340052** (push = no-op).
- **Pushed monorepo `main`: `b83cd29`** (round-2 blog app + spec + PLAN/PROGRESS; sdk/org pointer a340052).
- Verified: both level with origin/main; parent pointer a340052 == sdk/org HEAD (references a pushed commit).

## Resume notes for the NEXT run (round 3 — FEATURE EXPANSION)
- App now has **2 full-format spaces** (newsroom, editorial), **11 tables, 26 endpoints, 6 hooks,
  12 pages, 15 components**. Round 3 is strictly additive — do NOT regress. Floors: ≥1 new space
  (→≥3 total), ≥3 new agents, ≥5 pages, ≥8 endpoints, ≥3 hooks, ≥3 tables + substantial features.
- **Critical engine facts to keep applying (verified round 2):** (a) hook `delegate` drops input +
  api `spawn` is a no-op stub → agents MUST self-query; bound tasklists get `{ query, ...context }`.
  (b) task `functions:` allowlist gates system webSearch/webFetch too — list them or omit the key.
  (c) db hooks fire on api-writes (main process) but NOT on writes inside a headless hook-triggered
  session (learn→rescore 2nd hop won't auto-cascade; user/api/cron paths do). (d) db-hook handlers
  must guard `row` undefined (manual/boot runs). (e) `db.query` where is equality-only.
- **Possible engine improvement (out of app scope, flag for a runtime round):** wire the api-runtime
  `spawnRunner` (app-api.ts) to `runHeadless` (Phase 6) so buildDigest/personalizeFeed fire agents,
  and make headless-session db writes re-dispatch hooks so hook→agent→hook cascades work end to end.
- Ideas for round 3: a **research** space (deep-dive analysts split from newsroom); tables
  `collections`/`annotations`/`subscriptions`/`alerts`; saved-search alerts, article collections/
  boards, an OPML import endpoint, a newsletter-schedule/cadence, per-source health metrics, a
  weekly digest cron, full-text-ish client search page.

## Round log — ROUND 3 (FEATURE EXPANSION, 2026-07-04, in progress)
Theme: **Research workspace** — collections/boards, annotations & highlights, saved-search alerts,
analyst briefings, source-health metrics, full-text-ish search + a third `research` specialist space.
Strictly additive; round-1/2 files untouched.
- Phase 0 orient ✅ — re-read BOTH architecture docs in full (`project-as-application.md` +
  `…-implementation.md`), the spec, PROGRESS, and studied round-2 reference files
  (editorial/curator + personalizer instruct.md, build-digest tasklist, scoreByTopics fn,
  digest-craft knowledge, DigestCard component, blog.test.mjs, deep-dive/01-survey task, _layout).
  Confirmed round-2 green + pushed (monorepo b83cd29, sdk/org pointer a340052). Working tree also
  has **in-progress kitchen** changes from a sibling round — Phase 5 will stage ONLY blog files.
- Round-3 plan (floors): new space **research** (analyst/fact-checker/librarian, full format) → **3
  spaces total**; **7 new tables** (collections, collection_items, annotations, subscriptions,
  alerts, briefings, source_health) + articles cols/relations; **21 new endpoints** (→47); **4 new
  hooks** (→10); **7 new pages** + components. newsroom+editorial already full-format (round-2
  remediation complete) — no remediation needed.
- Phase 1 spec ✅ — added "Round 3 — Research workspace" section to `app-specifications/blog-application.md`
  (7 tables, 21 endpoints, 4 hooks, 7 pages, research space, articles cols/relations); patched dir layout.
- Phase 2 PLAN ✅ — round-3 section appended to `automation/app-builder/PLAN.blog.md`.
- Phase 3 build ✅ — fanned out 5 parallel Sonnet subagents by directory (database / api /
  hooks+research-space / research-knowledge / pages+components); integrated by orchestrator.
  Result: **18 tables** (all validate via engine `validateSchemaSet`), **47 api handlers**, **10 hooks**,
  **3 full-format spaces**, **7 new pages + 8 new components**.

### Round 3 — Phase 4 live verification + engine findings (2026-07-05)
- **App loads** via `lmthing serve` on a temp root: manifest = **18 tables + 47 endpoints + 10 hooks +
  17 pages**; additive migration added articles.annotationCount/collectionCount + relations;
  `types/generated.d.ts` regenerated; **pages built** (`built:true`, entry.js/css + 17 routes; all new
  routes /collections /briefings /alerts /search /subscriptions serve 200). Design tokens: root
  lint:tokens ✓ (575) + blog project-app tsx 0 raw colors (manual grep).
- **Deterministic API verified live** (curl over serve): createCollection(smart)+createSubscription
  (json cols marshal), addToCollection (dedupe + articleCount/collectionCount bump + article join),
  addAnnotation (default color 'accent', annotationCount bump), getCollection join, search, sourceHealth.
- **🔴 LIVE agent loops (DeepSeek azure:DeepSeek-V4-Flash), all end-to-end via serve:**
  1. **Briefing:** `requestBriefing` seeds a pending briefing → **`generate-briefing` (briefings:insert)
     hook auto-fired** → `research/analyst#brief` ran the `build-briefing` tasklist (live webSearch +
     2 webFetch + 2 feed articles) → wrote a real **ready briefing** (2146-char body, sourceCount 2,
     on-topic "AI coding assistants…", grounded in web + seeded feed articles).
  2. **Scan→alert:** manual-run `scan-subscriptions` hook → `research/librarian#scan` tasklist (live)
     → matched the seeded Rust article vs the "Rust news" subscription → inserted **1 alert**.
  3. **File→smart-collection:** manual-run `file-into-collections` hook → `research/librarian#file`
     (live) → filed the 2 ai-tagged articles into the "AI watch" smart collection (query tags:[ai]),
     **deduping** the pre-existing item (1→3 items, counters bumped).
- **Engine facts re-confirmed / new this round (NO sdk/org code changed — app-only round):**
  1. **`role: explore` tasklist forks are unreliable for `db.query`** with DeepSeek-Flash — the survey
     task (originally `role: explore`) improvised `todoRead()` instead of `db.query('briefings')`,
     found nothing, and fell back to the hook-trigger string as the topic → empty/error briefing.
     **Fix (app-level):** switched `build-briefing/01-survey` to **`role: general`** (matches the proven
     round-2 editorial `gather` task) + made the self-query instruction unmissable ("read the `briefings`
     table with db.query — do NOT use todoRead"). After the fix the survey used db.query (0 todoRead) and
     the loop went green.
  2. **Hook-delegated headless briefing needs real budget** — `generate-briefing` at `maxEpisodes:10`
     starved the survey mid-fetch (webSearch + fetches + write) → honest-but-empty error briefing.
     Bumped to **`maxEpisodes:30, maxWallClockMs:600000`**.
  3. **Never let the write task fabricate** — the original `02-write` inserted a fresh briefing with a
     model-invented topic when the survey failed. Hardened: on the hook path always fill the pending row
     (ready on success, error on failure); only the free-form chat path may insert, and only when the
     survey genuinely succeeded — never a fabricated row.
  4. **Two concurrent headless DeepSeek sessions → `"Lifetime not alive"`** (shared QuickJS WASM
     teardown contention, per sdk/org CLAUDE.md gotchas). Ran the live loops **sequentially** (one agent
     at a time) and all three passed cleanly. Flag for a future runtime round; not app-fixable.
  5. `track-source-health` (pure-db raw_items:insert upsert) is deterministic and structurally tested
     (asserted pure-db / no delegate); not exercised with a live raw_items insert this run (would need a
     full fetcher cascade) — low-risk, same dispatch mechanism proven by synthesize-new in rounds 1-2.
- **Gate:** blog structural tests **22/22 green** (`node --test`: 18 tables, 47 endpoints, 10 hooks,
  3 full-format spaces w/ tasklists+functions+components+≥3 knowledge fields each, research
  least-privilege). sdk/org untouched → its build/typecheck/test unchanged from round-2's pushed green
  state (pointer a340052); engine proven functional by the full live serve run.

### Floors delivered (round 3) — all exceeded
new space **research** (full format) → **3 spaces total** ✅ · **3 new agents** (analyst/fact-checker/
librarian, least-privilege) ✅ · **7 new pages** (collections/index, collections/[id], subscriptions,
alerts, briefings/index, briefings/[id], search) + 8 components ✅ · **21 new endpoints** (→47) ✅ ·
**4 new hooks** (→10) ✅ · **7 new tables** (→18) + 2 articles columns + 4 relations ✅ ·
newsroom+editorial already full-format (no remediation needed) ✅.

### Round 3 — Phase 5 push ✅ (2026-07-05)
- Green gate: blog structural tests 22/22 · lint:tokens root ✓ (575) + blog project-app tsx 0 raw
  colors · pages build ✓ (built:true, 17 routes) · live e2e (briefing/scan/file all live green).
  sdk/org untouched (app-only round).
- **Submodule sdk/org: no changes** — clean, level with origin/main at **e4be05f4** (confirm-push = no-op).
- **Pushed monorepo `main`: `8b7ba19a`** (round-3 blog app + spec + PLAN/PROGRESS; sdk/org pointer e4be05f4).
  Rebased over a CI status-data commit; verified 8b7ba19a is an ancestor of origin/main (landed). A later
  `ci: update status data` commit (afbdefa4) advanced remote after the push — normal, not a regression.
- Verified: parent pointer e4be05f4 == sdk/org HEAD == origin/main (references a pushed commit). Staged
  ONLY blog files — the in-progress sibling **kitchen** working-tree changes were left untouched/uncommitted.

### Round 3 — Phase 6 prod install + AI functional test (2026-07-05)
Followed `.claude/skills/test-app-install-prod.md` (read in full). Test user `user-379847043318834826`.
- **Deploy lag (expected):** my round-3 push's CI "Build and Push Images" completed **success**, but
  **ArgoCD had not yet synced the round-3 store/compute images** — the deployed catalog `GET /api/apps`
  still lists **round-2 blog (11 tables, no briefings/collections/alerts)**. Per the skill, deploy lag
  is **not a run failure** → the round-3-specific prod functional test (requestBriefing/scan/file) is
  **deferred to the next run** once ArgoCD deploys round-3. (Round 3 was already exhaustively
  live-verified LOCALLY this run — all 3 agent loops green with DeepSeek.)
- Node was cpu-saturated (95%): scaled the 4 non-test user pods to 0 (Step 1), **restored all 4 to
  replicas=1 in cleanup (Step 8)**.
- Rolled the test pod to latest compute (`rollout restart`); `GET /api/apps` served the catalog.
- **Pre-existing pod-state divergence fixed:** the test pod's stale blog `.data` had a
  `digest_items.createdAt` column absent from the current schema → boot reconcile threw a non-additive
  divergence and blocked install. Removed `/data/.lmthing/blog` and **reinstalled clean** → succeeded.
- **Install + build + serve verified on prod:** after the clean reinstall, `GET /api/projects` lists
  `blog`, `GET /app/blog/` → 200, `GET /app/blog/api/feed-list` → `[]` (app API live). (First install
  curl hit the ~150s/Envoy timeout mid-build — known; the pod finished the build and the second check
  confirmed it settled.)
- **🔴 Prod AI functional path confirmed live:** `POST /app/blog/api/digests {period:'daily'}` →
  seeded a `building` digest → **`editorial/curator` ran on the live cluster** (LiteLLM `/v1/*` → Azure,
  not 429/401) → filled the digest row ("Daily Digest — No Highlights Today" — honestly empty because
  the freshly-reinstalled feed had no articles; correct guardrail behavior). Proves the prod
  model→agent→db path works on the current (round-2) image.
- **Next run:** once ArgoCD deploys the round-3 images, re-run the prod functional test for the round-3
  loops (requestBriefing→analyst briefing; scan→alert; file→smart-collection) against the installed app.

## Resume notes for the NEXT run (round 4 — FEATURE EXPANSION)
- App now has **3 full-format spaces** (newsroom, editorial, research), **18 tables, 47 endpoints,
  10 hooks, 19 pages, 26 components**. Round 4 is strictly additive — do NOT regress. Floors: ≥1 new
  space (→≥4 total), ≥3 new agents, ≥5 pages, ≥8 endpoints, ≥3 hooks, ≥3 tables + substantial features.
- **FIRST at Phase 6 next run:** the round-3 prod functional test is owed — restart the test pod to the
  (by then) round-3 image, confirm `GET /api/apps` blog has 18 tables, reinstall, and drive
  requestBriefing/scan/file live. If the `digest_items.createdAt`-style stale divergence recurs, nuke
  `/data/.lmthing/blog` before reinstall (done this run).
- **Critical engine facts to keep applying (verified round 3):** (a) **tasklist forks must be
  `role: general` for reliable `db.query`** — `role: explore` led DeepSeek-Flash to improvise
  `todoRead()` instead of the db; (b) hook-delegated headless agents need a real budget
  (`maxEpisodes: 30`) or a multi-fetch survey starves; (c) write/finalize tasks must never fabricate a
  row when a self-query fails — fill the pending row (error) instead; (d) run headless agent loops
  **sequentially** — two concurrent DeepSeek sessions → `"Lifetime not alive"` QuickJS teardown; (e)
  hook `delegate` still drops input → agents self-query; (f) `db.query` where is equality-only.
- Ideas for round 4: a **community/social** space (comments, reactions, shared boards) or an
  **archive/export** space (OPML export, EPUB/PDF briefing export, scheduled newsletter sending);
  tables `comments`/`reactions`/`exports`/`schedules`; a newsletter-send cron, a saved-view/board-share
  endpoint set, per-briefing citations table, a reading-streak/gamification surface.
