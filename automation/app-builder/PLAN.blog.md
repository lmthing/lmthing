# PLAN — `blog` project-application (round 1, CORE BUILD)

File-by-file plan. Output root: **`store/projects/blog/`** (monorepo). `types/` + `.data/`
git-ignored. All contracts grounded in the shipped engine (see PROGRESS "Environment").

## Root files
- `store/projects/blog/package.json` — name `@lmthing/app-blog`, private, deps: `react`,
  `react-dom`, `@lmthing/ui`, `@lmthing/css`, `lucide-react`. Type module. (Resolved from cli
  node_modules by the pages build; no install needed for the runtime build.)
- `store/projects/blog/tsconfig.json` — sensible default (react-jsx, strict, bundler moduleRes).
- `store/projects/blog/.gitignore` — `types/`, `.data/`.
- `store/projects/blog/README.md` — one-paragraph what/how + install pointer.

## database/ (6 tables — descriptions mandatory, FK/relations resolve)
Exactly per spec §Database + round-1 additions:
- `sources.json` — id, kind, value(unique), label, topics(json), active(def true), lastFetchedAt,
  createdAt; relation `items` hasMany raw_items via sourceId.
- `raw_items.json` — id, sourceId→sources(cascade), title, url(unique), excerpt, imageUrl(new),
  fetchedAt, processed(def false); relations source(belongsTo), citations(hasMany).
- `articles.json` — id, title, summary, body, tags(json), **imageUrl**, score(def 0),
  read(def false), **saved(def false)**, createdAt; relations citations, research.
- `citations.json` — id, articleId→articles(cascade), rawItemId→raw_items(setNull), quote;
  relations article, item.
- `research.json` — id, articleId→articles(cascade), topic, body, status(def pending), createdAt;
  relation article.
- `settings.json` — id, tier(def free), weeklyBudgetUsd(def 1), maxFreeSources(def 5, new).
  (`raw_items.imageUrl` added so a synthesized article can inherit a hero image.)

## api/ (12 endpoints) — each: name/description/Input/Output + default async handler; `@app/runtime` HttpError
- `feed-list/GET.ts` → `feedList` `{unreadOnly?, savedOnly?, tag?}` → `Article[]` (query-all,
  JS filter for tag/unread/saved, orderBy score desc).
- `stats/GET.ts` → `feedStats` `{}` → `{unread,saved,total,sources,tags:{tag,count}[]}`.
- `mark-read/POST.ts` → `markRead` `{id}` → `{ok}`.
- `mark-all-read/POST.ts` → `markAllRead` `{tag?}` → `{count}`.
- `settings/GET.ts` → `getSettings` `{}` → `Setting` (seed row if none).
- `articles/[id]/GET.ts` → `getArticle` `{id}` → `Article` (include citations).
- `articles/[id]/save/POST.ts` → `saveArticle` `{id, saved}` → `{ok}`.
- `articles/[id]/research/GET.ts` → `getResearch` `{id}` → `Research[]`.
- `articles/[id]/research/POST.ts` → `requestResearch` `{id, topic}` → `{researchId,status}` —
  tier gate (402 free) via getSettings-equivalent; spawn `newsroom/researcher#deep-dive` onError→error.
- `sources/GET.ts` → `listSources` `{}` → `Source[]`.
- `sources/POST.ts` → `addSource` `{kind,value,label?,topics?}` → `Source` (free-tier cap: if
  tier free and count ≥ maxFreeSources → 402).
- `sources/[id]/DELETE.ts` → `removeSource` `{id}` → `{ok}`.

## hooks/ (2)
- `refresh-sources.ts` — cron `every:'30m'`, `trigger:'newsroom/fetcher#refresh'`, budget.
- `synthesize-new.ts` — database `on:{table:'raw_items',event:'insert'}`, imperative handler:
  idempotence guard (`row.processed`) then `delegate('newsroom/synthesizer','synthesize',{input:{rawItemId:row.id}})`.

## spaces/newsroom/ (project-scoped space; 3 agents)
- `agents/fetcher/instruct.md` — title, `functions:[webSearch,webFetch,fetch]`,
  capabilities db:read[sources,raw_items] db:write[raw_items,sources]. Action `refresh`.
- `agents/synthesizer/instruct.md` — title, `functions:[]`,
  capabilities db:read[raw_items,sources,articles] db:write[articles,citations,raw_items]. Action `synthesize`.
- `agents/researcher/instruct.md` — title, `functions:[webSearch,webFetch,fetch]`,
  capabilities db:read[articles,citations,research] db:write[research]. Action `deep-dive`.
- Each with a `charter.md` (fork-safe identity) + instruct.md orchestration. Knowledge optional
  (skip for round 1; keep lean). Equality-only `where` rule embedded in instructions.

## pages/ + components/
- `pages/_app.tsx` — providers wrapper (design-system theme; the build supplies QueryClient? use
  plain — `@app/runtime` useApi has its own cache). Minimal wrapper passing children.
- `pages/_layout.tsx` — nav chrome (Feed · Saved · Preferences) with `Link`; tokens only.
- `pages/index.tsx` — Feed: `feedStats` strip + `feedList`; ArticleCard list; mark-all-read.
- `pages/preferences.tsx` — sources CRUD + tier/budget from getSettings.
- `pages/feed/[articleId].tsx` — article detail (markRead on open, save toggle, citations).
- `pages/feed/[articleId]/research.tsx` — research list + requestResearch + `<Chat agent="newsroom/researcher">`.
- `pages/tag/[tag].tsx` — feedList by tag.
- `components/ArticleCard.tsx`, `SourceRow.tsx`, `MarkdownBody.tsx`, `StatsStrip.tsx`, `Spinner.tsx`.
- Design tokens ONLY (`bg-surface`, `text-foreground`, `text-muted`, `border-border`, etc.).

## types/ (generated — do not author)
Produced by the pages/contracts build → `types/generated.d.ts` (Source/RawItem/Article/Citation/
Research/Setting + endpoint I/O). Git-ignored.

## Tests (co-located under store/projects/blog/ or a test harness in sdk/org)
Because the app lives in the monorepo (not a pnpm workspace pkg), unit tests run via a small
vitest config OR I validate through the engine's own loaders. Plan:
- `blog.schema.test.ts` — `validateSchemaSet(loadProjectApp(blogRoot).tables)` passes; interface
  names generate; FK/relations resolve. (import from @lmthing/core / cli app loader.)
- `blog.api.test.ts` — handler I/O against an in-memory `openProjectDb`: feedList filters,
  markRead/markAllRead/saveArticle mutate, addSource cap, requestResearch 402 on free tier.
- `blog.hooks.test.ts` — synthesize-new idempotence guard + delegate call shape.
- Live e2e: materialize blog into a temp root, `lmthing serve`, insert raw_items via api,
  synthesize-new hook fires → `newsroom/synthesizer` (--model S / DeepSeek) writes an articles
  row; assert via feedList. Fallback to mock streamFn if AZURE key missing.

Test placement decision: put the vitest suites **inside `sdk/org`** (where vitest + the engine
live) under `libs/cli/src/app/blog-app.test.ts`, pointing at the monorepo `store/projects/blog/`
via a resolved path, so they run in the existing green `pnpm test`. If that cross-repo path is
awkward, add a self-contained `store/projects/blog/tests/` with its own vitest config.

## Sequence (verifiable steps)
1. database/ + package.json/tsconfig → `loadProjectApp` validates (schema test).
2. spaces/newsroom agents → space loads + typechecks (capabilities gate).
3. api/ handlers → contract generation + handler I/O tests.
4. hooks/ → loader + dispatch test.
5. pages/components → `buildProjectPages` succeeds; lint:tokens green.
6. Materialize + `lmthing serve` + live synthesize loop (DeepSeek).
7. Green gate → commit + push both repos.
