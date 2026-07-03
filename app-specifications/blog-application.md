# lmthing.blog as a Project-Application — the `blog` project

> A concrete instantiation of [project-as-application.md](./project-as-application.md) for
> **lmthing.blog**: personalized AI news. The `blog` project owns the app — `database/` (sources,
> raw items, synthesized articles, research), `pages/` (client React feed / preferences / article),
> `api/` (named typed Node endpoints), `hooks/` (poll + synthesize), and a project-scoped
> **`newsroom`** space of agents that a `cron`/`database` hook loop drives. Read the parent plan first
> for the mechanisms (capability globals, typed-contract pipeline, serving); this file is only the
> blog-specific shape. Paths are relative to the org repo root.

## Context

`blog/` today is a **static SPA stub** (`blog/src/routes/{index,post/$slug,tag/$tag}.tsx` — TanStack
Router placeholders rendering a title). The README describes the real product: users subscribe to
**RSS feeds** and **web-search queries**; a THING agent **fetches, synthesizes, and presents** news
tailored to each user; users can request **deeper research** on any topic. Nothing in a static SPA can
express that. This plan rebuilds lmthing.blog as a **`blog` project-application**: its `pages/` become
the SPA (the stub routes map straight over), its `database/` holds the news, and its `newsroom` space +
`hooks/` are the "THING agent that continuously fetches and synthesizes".

## The project

- **Project id**: `blog`. One per user pod (personalized feed = per-user data).
- **Project-scoped space**: `blog/spaces/newsroom/` — the specialists that maintain the app
  (`fetcher`, `synthesizer`, `researcher`). Because the db is **project-rooted**, all three
  read/write the **same** tables and feed the **same** pages (the multi-agent-application shape).
- **THING** builds/evolves the app by delegating to `system-appbuilder` (parent plan §"system-appbuilder");
  **runtime** work is the `newsroom` agents, driven by hooks and chat — not THING.
- **Provisioning**: v1 seeds the `blog` project from a checked-in template materialized into the
  pod's `<root>/blog/` (the repo's `blog/src/routes/*` stubs are *source material* for that
  template, not runtime files). In a **later phase** the blog app becomes **installable from
  lmthing.store** as a project app (parent plan §Risks "Distribution"), which is also where
  update/divergence semantics for user-modified copies get decided.

## Directory layout

```
blog/
├── package.json              # react, @tanstack/react-router, @lmthing/{ui,css}, lucide-react …
├── database/
│   ├── sources.json          # RSS feeds + web-search subscriptions
│   ├── raw_items.json        # unsynthesized fetched entries
│   ├── articles.json         # synthesized feed articles
│   ├── citations.json        # article ⇄ raw_item provenance (join)
│   ├── research.json         # on-demand deep-dive reports
│   └── settings.json         # single-row account settings (tier + budget)
├── pages/                    # client-side React SPA (replaces blog/src/routes)
│   ├── _app.tsx              # QueryClient + design-system theme provider
│   ├── _layout.tsx           # nav chrome: Feed · Preferences
│   ├── index.tsx             # "/"              → the feed (was routes/index.tsx)
│   ├── preferences.tsx       # "/preferences"   → RSS · web searches · topics
│   ├── feed/
│   │   ├── [articleId].tsx   # "/feed/:articleId"          → synthesized article
│   │   └── [articleId]/research.tsx  # "/feed/:articleId/research" → deep dive
│   └── tag/[tag].tsx         # "/tag/:tag"      (was routes/tag/$tag.tsx)
├── components/               # shared page components (ArticleCard, SourceRow, MarkdownBody…)
├── api/
│   ├── feed-list/GET.ts               # feedList
│   ├── mark-read/POST.ts              # markRead
│   ├── articles/[id]/GET.ts           # getArticle
│   ├── articles/[id]/research/
│   │   ├── GET.ts                     # getResearch
│   │   └── POST.ts                    # requestResearch   (subscription-gated)
│   └── sources/
│       ├── GET.ts                     # listSources
│       ├── POST.ts                    # addSource
│       └── [id]/DELETE.ts             # removeSource
├── hooks/
│   ├── refresh-sources.ts    # cron  30m → newsroom/fetcher#refresh
│   └── synthesize-new.ts     # database raw_items:insert → newsroom/synthesizer#synthesize
├── spaces/
│   └── newsroom/             # project-scoped space (agents / tasklists / knowledge)
│       └── agents/{fetcher,synthesizer,researcher}/instruct.md
├── types/generated.d.ts      # GENERATED — row + endpoint I/O types
└── .data/
    ├── app.db                # SQLite (WAL)
    ├── app.sql               # backup dump
    └── hooks-state.json      # cron last-run / pending queue
```

## Database (schemas — descriptions mandatory, FKs + relations)

Every table and column carries a required `description` (parent plan §"database"); the loader fails
loud on any missing one. Foreign keys map to real SQLite `FOREIGN KEY` (`PRAGMA foreign_keys=ON`);
`relations` generate typed navigation fields + power `db.query(…, { include })`.

```json
// database/sources.json
{ "title": "Sources",
  "description": "A subscription the user follows — an RSS feed or a saved web-search query — that the newsroom polls for news.",
  "columns": {
    "id":            { "type": "string",  "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "kind":          { "type": "string",  "description": "'rss' (feed URL) or 'search' (web-search query)", "required": true },
    "value":         { "type": "string",  "description": "the RSS feed URL or the search query text; dedupe key", "required": true, "unique": true },
    "label":         { "type": "string",  "description": "human label shown in Preferences" },
    "topics":        { "type": "json",    "description": "array of topic tag strings this source is filed under" },
    "active":        { "type": "boolean", "description": "whether the newsroom currently polls it", "default": true },
    "lastFetchedAt": { "type": "date",    "description": "when the newsroom last polled this source" },
    "createdAt":     { "type": "date",    "description": "when the user subscribed", "generated": "now" } },
  "relations": {
    "items": { "hasMany": "raw_items", "via": "sourceId", "description": "raw entries fetched from this source" } } }
```

```json
// database/raw_items.json
{ "title": "Raw items",
  "description": "One unsynthesized entry fetched from a source, before the newsroom writes it up.",
  "columns": {
    "id":        { "type": "string",  "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "sourceId":  { "type": "string",  "description": "the source this was fetched from", "required": true,
                   "references": { "table": "sources", "column": "id", "onDelete": "cascade" } },
    "title":     { "type": "string",  "description": "original headline as fetched", "required": true },
    "url":       { "type": "string",  "description": "canonical source URL — dedupe key", "required": true, "unique": true },
    "excerpt":   { "type": "string",  "description": "raw summary / first paragraph as fetched" },
    "fetchedAt": { "type": "date",    "description": "when fetched", "generated": "now" },
    "processed": { "type": "boolean", "description": "whether an article has been synthesized from it", "default": false } },
  "relations": {
    "source":    { "belongsTo": "sources", "via": "sourceId", "description": "the feed it came from" },
    "citations": { "hasMany": "citations", "via": "rawItemId", "description": "articles that cite this item" } } }
```

```json
// database/articles.json
{ "title": "Articles",
  "description": "A synthesized, personalized news article shown in the user's feed.",
  "columns": {
    "id":        { "type": "string",  "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "title":     { "type": "string",  "description": "headline shown in the feed", "required": true },
    "summary":   { "type": "string",  "description": "one-paragraph deck shown in the feed list", "required": true },
    "body":      { "type": "string",  "description": "full synthesized article, markdown", "required": true },
    "tags":      { "type": "json",    "description": "topic tag strings — feed filtering and the /tag route" },
    "score":     { "type": "number",  "description": "personalization relevance rank; higher = surfaced first", "default": 0 },
    "read":      { "type": "boolean", "description": "whether the user has opened it", "default": false },
    "createdAt": { "type": "date",    "description": "when the article entered the feed", "generated": "now" } },
  "relations": {
    "citations": { "hasMany": "citations", "via": "articleId", "description": "the raw items this article was synthesized from" },
    "research":  { "hasMany": "research",  "via": "articleId", "description": "deep-dive reports requested on this article" } } }
```

```json
// database/citations.json — provenance join (article ⇄ raw_item)
{ "title": "Citations",
  "description": "Links a synthesized article to a raw item it drew from, for provenance.",
  "columns": {
    "id":        { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "articleId": { "type": "string", "description": "the article", "required": true,
                   "references": { "table": "articles", "column": "id", "onDelete": "cascade" } },
    "rawItemId": { "type": "string", "description": "the source raw item (kept when article deleted → set null)",
                   "references": { "table": "raw_items", "column": "id", "onDelete": "setNull" } },
    "quote":     { "type": "string", "description": "the passage the article relied on" } },
  "relations": {
    "article": { "belongsTo": "articles",  "via": "articleId", "description": "the citing article" },
    "item":    { "belongsTo": "raw_items",  "via": "rawItemId", "description": "the cited raw item" } } }
```

```json
// database/research.json
{ "title": "Research reports",
  "description": "An on-demand deep-dive the researcher agent produces for an article or a free topic.",
  "columns": {
    "id":        { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "articleId": { "type": "string", "description": "the article this expands (null for a free-topic dive)",
                   "references": { "table": "articles", "column": "id", "onDelete": "cascade" } },
    "topic":     { "type": "string", "description": "the question or topic researched", "required": true },
    "body":      { "type": "string", "description": "the deep-dive report, markdown; empty while pending" },
    "status":    { "type": "string", "description": "'pending' while the researcher runs, 'ready' when done", "default": "pending" },
    "createdAt": { "type": "date",   "description": "when the dive was requested", "generated": "now" } },
  "relations": {
    "article": { "belongsTo": "articles", "via": "articleId", "description": "the article being expanded" } } }
```

```json
// database/settings.json — single row
{ "title": "Settings",
  "description": "The single account-settings row for this user's blog. Exactly one row.",
  "columns": {
    "id":              { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "tier":            { "type": "string", "description": "'free' or 'subscription' — gates deep research", "default": "free" },
    "weeklyBudgetUsd": { "type": "number", "description": "newsroom spend allowance per week (tier-driven)", "default": 1 } } }
```

The "exactly one row" invariant is **not schema-expressible** — the row is seeded at provisioning
and every reader does `db.query('settings', {})[0]`; nothing enforces the invariant beyond that
(documented, not enforced).

## Pages (client React, file-based routing)

Data comes from the generated typed client `useApi(name, input)` — no pod-side loaders. The current
stub routes map over: `index.tsx`→feed, `post/$slug`→`feed/[articleId]` (article detail),
`tag/$tag`→`tag/[tag]`.

| File | Route | Reads |
|---|---|---|
| `pages/index.tsx` | `/` | `feedList` (unread + `?tag`) |
| `pages/preferences.tsx` | `/preferences` | `listSources`; mutates via `addSource`/`removeSource` |
| `pages/feed/[articleId].tsx` | `/feed/:articleId` | `getArticle` (`include` citations); `markRead` on open |
| `pages/feed/[articleId]/research.tsx` | `/feed/:articleId/research` | `getResearch`; `requestResearch` + `<Chat agent="newsroom/researcher">` |
| `pages/tag/[tag].tsx` | `/tag/:tag` | `feedList` filtered by tag |

```tsx
// pages/index.tsx  → "/"  (the feed)
import type { Article } from '../types/generated'
import { useApi } from '@app/runtime'
import { ArticleCard } from '../components/ArticleCard'

export default function Feed() {
  const { data: articles, isLoading } = useApi('feedList', { unreadOnly: true })
  if (isLoading) return <Spinner />
  return <main>{articles.map((a: Article) => <ArticleCard key={a.id} article={a} />)}</main>
}
```

## API (named, typed, Node handlers)

Endpoint = dir, method = filename; each exports `name`/`description`/`Input`/`Output` + a default
**`async`** handler `(input, { db, spawn, apiCall }) => Promise<Output>` (`db` is the async Node-side
surface; `spawn` is fire-and-forget). Dual-addressed (HTTP for the browser, `name` for agents via
`apiCall`).

| name | method + route | I/O sketch |
|---|---|---|
| `feedList` | `GET api/feed-list` | `{ unreadOnly?, tag? }` → `Article[]` |
| `getArticle` | `GET api/articles/:id` | `{ id }` → `Article & { citations }` |
| `markRead` | `POST api/mark-read` | `{ id }` → `{ ok }` |
| `listSources` | `GET api/sources` | `{}` → `Source[]` |
| `addSource` | `POST api/sources` | `{ kind, value, label?, topics? }` → `Source` |
| `removeSource` | `DELETE api/sources/:id` | `{ id }` → `{ ok }` |
| `requestResearch` | `POST api/articles/:id/research` | `{ id, topic }` → `{ researchId, status:'pending' }` — **gated** |
| `getResearch` | `GET api/articles/:id/research` | `{ id }` → `Research[]` |

```ts
// api/articles/[id]/research/POST.ts → POST .../api/articles/:id/research ; name "requestResearch"
/** Kick off a deep-dive on an article's topic (fire-and-forget). */
import { HttpError } from '@app/runtime'   // → 402 { error: { status, message } } — parent plan §api "Error contract"

export const name = 'requestResearch'
export const description = 'Request a deep-dive research report for an article; the researcher fills it in asynchronously.'

export interface Input  { /** article id */ id: string; /** topic/question to dig into */ topic: string }
export interface Output { researchId: string; status: 'pending' }

export default async function handler(input: Input, ctx: { db: AsyncDbApi; spawn: SpawnFn }): Promise<Output> {
  const [settings] = await ctx.db.query('settings', {})
  if (settings.tier !== 'subscription') throw new HttpError(402, 'Deep research is a subscription feature')
  const r = await ctx.db.insert('research', { articleId: input.id, topic: input.topic, status: 'pending' })
  // fire-and-forget; onError fails-closed the pending row so the page never spins forever
  ctx.spawn('newsroom/researcher', 'deep-dive', { input: { researchId: r.id } },
            { onError: () => ctx.db.update('research', { where: { id: r.id }, set: { status: 'error' } }) })
  return { researchId: r.id, status: 'pending' }
}
```

`requestResearch` enforces the **subscription tier** in-handler (free tier gets the feed, not deep
research). Tier + `weeklyBudgetUsd` live on `settings`; the newsroom runs on the user's budget windows
(see Tiers).

## Hooks (the "continuously fetches and synthesizes" loop)

```ts
// hooks/refresh-sources.ts — poll every source on a schedule
export default {
  type: 'cron',
  every: '30m',
  trigger: 'newsroom/fetcher#refresh',              // declarative: run the fetcher
  budget: { maxEpisodes: 20, maxWallClockMs: 600000 },
}
```

```ts
// hooks/synthesize-new.ts — write up each newly fetched item
export default {
  type: 'database',
  on: { table: 'raw_items', event: 'insert' },
  budget: { maxEpisodes: 10 },
  handler: async ({ row, delegate }) => {
    if (row.processed) return                        // idempotence (loop guard: self-write excluded anyway)
    await delegate('newsroom/synthesizer', 'synthesize', { input: { rawItemId: row.id } })
  },
}
```

- `fetcher#refresh` reads `active` sources, fetches (RSS via `fetch`; `kind:'search'` via the
  `webSearch` `api:call` binding), and `db.insert`s `raw_items` (dedupe on `url` → unique constraint).
- Each insert fires `synthesize-new` → `synthesizer` writes one `articles` row + `citations` and sets
  `raw_items.processed=true`. The `articles` insert can update the feed live; no hook cascades off it
  (depth cap + self-write exclusion keep the loop bounded, parent plan §Safety).
- The article insert is what the browser sees on next `feedList` — the newsroom is a background loop,
  the pages are a live read view.
- Cron timing is the parent plan's **crond → hook-run endpoint** mechanism (`POST /api/projects/blog/
  hooks/refresh-sources/run`); a window missed while the pod was down runs once via the boot
  catch-up; local dev uses the in-process fallback tick.

## Chat (deep research + co-writing)

One drop-in `<Chat agent="…">` widget, reusing the always-available multisession WS endpoint
(parent plan §Chat) — the binding is a runtime prop, no `chats/` dir:

- **`/feed/:articleId/research`** → `<Chat agent="newsroom/researcher" />`. The user asks for a deeper
  dive interactively; the researcher runs with full caps (`db:write` + `api:call:[webSearch]`), so its
  `db.insert('research', …)` is a first-class write and the report shows on the page. The one-click
  `requestResearch` POST is the non-interactive path to the same agent.
- History persists at `blog/spaces/newsroom/sessions/<id>` (project-session snapshot form, resumable) —
  **net-new plumbing** (today sessions live only at `<project>/sessions/`; needs a `spaceId`-parameterized
  snapshot dir + a `listSpaceSessions`, parent §Chat). This is **the one place the catalog descriptor
  renderer re-enters the app** — pages stay real React.

## The `newsroom` space (agents + capabilities)

Project-scoped at `blog/spaces/newsroom/`. Capabilities are least-privilege per agent — one
config-bearing `capabilities:` frontmatter key, table scope **per verb** (parent plan §"Capability
globals"):

| Agent | `db:read` tables | `db:write` tables | `api:call` allow | Role |
|---|---|---|---|---|
| **fetcher** | `sources, raw_items` | `raw_items, sources` | `webSearch` | poll `active` sources, insert deduped `raw_items` (writes `sources` only for `lastFetchedAt`) |
| **synthesizer** | `raw_items, sources, articles` | `articles, citations, raw_items` | — | read unprocessed items → write `articles` + `citations`, mark processed |
| **researcher** | `articles, citations, research` | `research` | `webSearch` | deep dives → fill `research` rows (chat- and POST-driven) |

```yaml
# blog/spaces/newsroom/agents/fetcher/instruct.md frontmatter
capabilities:
  - db:read:  { tables: [sources, raw_items] }
  - db:write: { tables: [raw_items, sources] }   # sources: lastFetchedAt updates only
  - api:call: { allow: [webSearch] }
```

- **Per-verb table scope keeps each agent in its own lane** — the fetcher can't touch `articles`,
  the researcher reads `articles` but can only write `research`; none of them can even read
  `settings` (tier gating is the api handler's job, not an agent's).
- **No `db:schema`/`pages:write`/`api:write` here** — the newsroom *operates* the app; *building/evolving*
  it (new tables, pages, endpoints) is THING → `system-appbuilder` (parent plan). "Add a 'saved'
  column and a Saved page" is an authoring request, not a newsroom one.
- `webSearch` is a **named binding** (hidden URL+key kept out of the transcript); the allowlisted set
  is each agent's callable-tool menu.

## Serving & domains

- **Local CLI**: `localhost:8080/app/blog/…` (pages) and `localhost:8080/app/blog/api/<name>` — exactly
  the parent plan's mount, `<project>` = `blog`.
- **Prod**: the **`lmthing.blog`** product domain is a thin **Host-anchored alias** onto the app layer
  — `lmthing.blog/*` → the user's pod `/app/blog/*` (root-anchored to `/app/blog`, so **no** admin
  `/api/*` is reachable — safe by construction; Envoy JWT + per-user routing, same wiring as
  `lmthing.app`). It's the friendly public host for this one project; the existing `blog/` nginx SPA
  image is replaced by "serve the `blog` project app from the pod".
- **Admin/dev**: `lmthing.studio` manages it via `/api/projects/blog/app` (manifest, data browser,
  manual hook run, build status) and previews it **same-origin** at `lmthing.studio/app/blog/`. Pages
  render fetched third-party news → **strict CSP + sanitize rendered content** (parent §Safety).

**No public/shared surface** — with the public profile removed, every route and endpoint is an
authenticated, per-user pod read/write; the app stays fully within per-user pod isolation, so there is
no v1 deviation from the parent plan (no cross-user routing to build).

## Tiers & budget

Maps the README revenue model onto `settings.tier` + the existing budget windows (see
`reference-litellm-budget-windows`):

- **Free** — `tier:'free'`, `weeklyBudgetUsd: 1`, cheap model for the newsroom; feed only.
  `requestResearch` 402. Limited sources (loader/handler cap on `addSource`).
- **Subscription** ($5/mo) — `tier:'subscription'`, unlimited sources + web-search subscriptions, deep
  research on demand; better synthesis model. Stripe entitlement flips `settings.tier` (gateway
  webhook — parent backend is `cloud/gateway`, no new service).
- The newsroom's cron/hook episodes consume the user's budget windows; **budget-exhaustion queue**
  (parent §Safety) defers `refresh-sources` (one coalesced pending entry) and **retries on the next
  run attempt** — the pod gets no push signal, so each subsequent cron fire re-checks the window and
  runs once it has rolled over. The free tier simply refreshes less often near its ceiling.

## Phases & order

Assumes the parent plan's engine (db + capability globals, api runtime, typed-contract build, pages
build, hooks runtime, chat) exists. Blog-specific work on top:

1. **Schemas** — the six `database/*.json`; verify FK/relations resolve and required descriptions
   pass the fail-loud loader; row + relation types generate.
2. **`newsroom` space** — the three agents' `instruct.md` (config-bearing `capabilities:`
   frontmatter — per-verb `tables`, `api:call` allow — plus tasklists for
   `refresh`/`synthesize`/`deep-dive`); `webSearch` named binding registered.
3. **API** — the eight endpoints (dir/method layout above), tier gate on `requestResearch`.
4. **Hooks** — `refresh-sources` (cron) + `synthesize-new` (database:insert); confirm the
   insert→synthesize loop is bounded (no article-insert cascade).
5. **Pages** — port `blog/src/routes/*` to `pages/*` (index→feed, post/$slug→`feed/[articleId]`,
   tag/$tag), add preferences/article/research; wire `useApi` + the `<Chat agent="newsroom/researcher">`
   widget; keep the design-system token gate (no raw colors).
6. **Serving** — seed each pod's `blog` project from the checked-in template (store install is a
   later phase); replace the `blog/` static-SPA image with the pod-served `blog` app; alias
   `lmthing.blog/*` → pod `/app/blog/*`; Studio manages it under `/api/projects/blog/app`.
7. **Tiers** — Stripe entitlement → `settings.tier` via the gateway webhook; budget-window wiring.
8. **Docs** — fold into `SPACE_DEVELOPMENT.md` "Project apps" as the worked example.

## Verification (end-to-end, local)

1. Load the `blog` project → schemas validate (descriptions/FK/relations), `types/generated.d.ts` has
   `Source`/`RawItem`/`Article`/`Citation`/`Research`/`Settings` with relation fields
   (`Article.citations: Citation[]`).
2. `lmthing serve`; `GET localhost:8080/app/blog/` renders the feed page (client-side), which calls
   `GET …/app/blog/api/feed-list`.
3. `addSource {kind:'rss', value:<feed>}`; mock the fetcher emitting `db.insert('raw_items', …)` →
   `synthesize-new` fires → an `articles` row + `citations` appear; the feed shows it; opening it fires
   `markRead`.
4. Subscription tier (`settings.tier`): `<Chat agent="newsroom/researcher">` on the research page → a
   message makes it `db.insert('research', {status:'ready', body})`; the page shows the report; history
   under `blog/spaces/newsroom/sessions/`. Free tier: `requestResearch` returns 402.
5. `apiCall` with a bad shape or an un-allowlisted name fails the agent typecheck / host allowlist
   (parent plan §Verification 5).
6. cron `refresh-sources` at `every:'30m'` (test `'5m'`, local fallback tick): restart → one boot
   catch-up run; immediate second restart → no double-run; budget-exhausted → single coalesced
   pending entry, runs on the next attempt after the window rolls.
7. Backup: `app.sql` + schemas + pages + api + hooks + newsroom space committed; `**/sessions/` not;
   restore rebuilds `app.db`.

## Notes

- **Reuses the parent engine wholesale** — no blog-specific runtime; this is data + agents + pages +
  hooks on the shared project-application layer. If a mechanism is missing here, it belongs in
  [project-as-application.md](./project-as-application.md), not a blog fork.
- **Personalization scoring** (`articles.score`) is a synthesizer concern (rank by the user's `topics`
  / read history), not a schema one — left to the agent, kept as a plain column.
- **The whole app stays within per-user pod isolation** — no public or cross-user surface, so no v1
  deviation from the parent plan's authz model.
