> **Round 2 (FEATURE EXPANSION) plan is at the bottom of this file** (`## ROUND 2 …`). It adds the
> `editorial` space + digests/topics/personalization AND remediates `newsroom` to full space format.
> The round-1 plan below is kept for provenance — round 2 is strictly additive.

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

---

# ROUND 2 — FEATURE EXPANSION (editorial · digests · topics · personalization + newsroom remediation)

Strictly additive to round 1. Output root unchanged: `store/projects/blog/`. All contracts grounded
in the shipped engine (see PROGRESS "Environment"; reference full-format space = `store/projects/trips/spaces/concierge`).

## database/ (+5 tables, +3 columns)
- `topics.json` — id(pk uuid), slug(string unique req), label(string), followed(bool def true),
  muted(bool def false), weight(number def 1), articleCount(number def 0), createdAt(now).
  relation `digestItems` hasMany digest_items via topicSlug.
- `digests.json` — id(pk), title(req), summary(req), period(string def 'daily'), status(string def 'ready'),
  articleCount(number def 0), createdAt(now). relations items→digest_items via digestId, newsletters→newsletters via digestId.
- `digest_items.json` — id(pk), digestId→digests(cascade,req), articleId→articles(cascade,req),
  topicSlug(string), position(number def 0), blurb(string). relations digest(belongsTo), article(belongsTo).
- `reading_events.json` — id(pk), articleId→articles(setNull), kind(string req), dwellMs(number def 0),
  tag(string), createdAt(now). relation article(belongsTo).
- `newsletters.json` — id(pk), digestId→digests(cascade,req), subject(req), body(req), sentAt(date), createdAt(now).
  relation digest(belongsTo).
- articles.json ADD COLUMNS: pinned(bool def false), editorNote(string), clusterKey(string). (additive — keep all round-1 columns/relations.)

## api/ (+14 endpoints → 26 total). Each: name/description/Input/Output + default async handler; local Db/Ctx types (mirror round-1 handlers).
- topics/GET.ts → listTopics {} → Topic[] (weight desc)
- topics/POST.ts → followTopic {slug,label?,weight?} → Topic (upsert by slug: query-all, find slug, insert or update)
- topics/[id]/PATCH.ts → updateTopic {id,followed?,muted?,weight?} → Topic
- topics/[id]/DELETE.ts → removeTopic {id} → {ok}
- topics/[id]/feed/GET.ts → topicFeed {id} → Article[] (load topic, filter articles whose tags include slug)
- digests/GET.ts → listDigests {} → Digest[] (createdAt desc)
- digests/[id]/GET.ts → getDigest {id} → Digest & {items:(DigestItem&{article})[]} (query digest_items where digestId, join article per item, sort position)
- digests/POST.ts → buildDigest {period?} → {digestId,status:'building'} (insert digest status building; spawn editorial/curator#digest {digestId}; onError set status error)
- digests/[id]/newsletter/GET.ts → getNewsletter {id} → Newsletter|null (newest for digestId)
- reading-events/POST.ts → logReadingEvent {articleId,kind,dwellMs?,tag?} → {ok} (insert row)
- personalize/POST.ts → personalizeFeed {} → {ok} (spawn editorial/personalizer#rescore)
- insights/GET.ts → feedInsights {} → {totalRead,totalSaved,totalDismissed,byTag[],byDay[],topTopics[]} (aggregate reading_events + articles + topics in JS)
- articles/[id]/pin/POST.ts → pinArticle {id,pinned} → {ok} (update articles.pinned)
- articles/[id]/dismiss/POST.ts → dismissArticle {id} → {ok} (update articles.read=true; insert reading_events kind 'dismiss')

## hooks/ (+4 → 6 total)
- build-daily-digest.ts — cron daily:'07:00', trigger 'editorial/curator#digest', budget maxEpisodes 20.
- render-newsletter.ts — database digests:insert, handler: if row.status==='building' return; query newsletters where digestId, if exists return; delegate('editorial/digest-writer','render',{input:{digestId:row.id}}).
- personalize-on-read.ts — database reading_events:insert, handler: delegate('editorial/personalizer','learn',{input:{eventId:row.id}}).
- rescore-on-topic-change.ts — database topics:update, handler: delegate('editorial/personalizer','rescore',{}).

## spaces/editorial/ (NEW, full format — 3 agents)
- agents/curator/{charter,instruct}.md — title Curator; knowledge editorial/{editorial-standards,ranking-and-personalization,digest-craft};
  functions [scoreByTopics,clusterArticles,dedupeArticles,summarizeEngagement]; defaultAction digest→tasklist build-digest;
  actions digest(tasklist build-digest), pin, annotate; canDelegateTo editorial/digest-writer#render;
  capabilities db:read[articles,citations,topics,reading_events,digests,digest_items] db:write[digests,digest_items,articles]. functions:[] (fetch). components [DigestPreview].
- agents/digest-writer/{charter,instruct}.md — title Digest writer; knowledge editorial/{editorial-standards,digest-craft};
  functions [formatNewsletter]; action render; capabilities db:read[digests,digest_items,articles,newsletters] db:write[newsletters].
- agents/personalizer/{charter,instruct}.md — title Personalizer; knowledge editorial/{ranking-and-personalization};
  functions [scoreByTopics,summarizeEngagement,computeTopicWeights]; actions learn, rescore;
  capabilities db:read[reading_events,topics,articles] db:write[topics,articles]. components [TopicWeightBadge].
- tasklists/build-digest/ — index.md (input {digestId}); 01-gather.md (role explore/general, read recent unread articles + topics), 02-cluster.md (dedupe+cluster by topic weight), 03-write.md (insert digest_items + finalize digest).
- functions/ — scoreByTopics.ts, clusterArticles.ts, dedupeArticles.ts, summarizeEngagement.ts, computeTopicWeights.ts, formatNewsletter.ts (typed, pure).
- components/view/ — DigestPreview.tsx, TopicWeightBadge.tsx (design tokens only).
- knowledge/editorial/ — editorial-standards/{index,voice-and-tone,accuracy-and-provenance}.md;
  ranking-and-personalization/{index,signals-and-weights,avoiding-filter-bubbles}.md;
  digest-craft/{index,selection-and-ordering,newsletter-format}.md. (index has `variable:` + `description:` frontmatter.)

## spaces/newsroom/ REMEDIATION (full format — additive, don't break round-1 loop)
- tasklists/refresh/ — index.md (fetcher per-source fan-out); bind fetcher action refresh→tasklist refresh. 01-load_sources, 02-fetch_each(forEach sources.ids), 03-done. Keep guardrails (no fabrication).
- tasklists/deep-dive/ — researcher survey→fetch→write; bind researcher action deep-dive→tasklist deep-dive. index.md input {researchId?|topic}.
- synthesizer: STAYS model-driven (single-shot; hook delegates 'synthesize'). Add knowledge/functions refs only.
- functions/ — parseFeedEntries.ts, dedupeByUrl.ts, extractImage.ts, formatCitation.ts, scoreRelevance.ts.
- components/view/ — ArticlePreview.tsx, ResearchPreview.tsx.
- knowledge/journalism/ — synthesis-method/{index,from-raw-to-article,headline-and-deck}.md;
  source-evaluation/{index,credibility-signals,dedup-and-clustering}.md;
  deep-dive-method/{index,structuring-a-report,grounding-and-honesty}.md.
- Update fetcher/researcher/synthesizer instruct.md frontmatter to reference knowledge:/functions:/components: and (fetcher/researcher) tasklist actions. Keep capabilities unchanged.

## pages/ (+5) + components (+5). Design tokens ONLY.
- pages/topics.tsx (/topics) — listTopics; TopicChip w/ follow/mute/weight (updateTopic/removeTopic/followTopic).
- pages/digests/index.tsx (/digests) — listDigests; DigestCard; buildDigest button.
- pages/digests/[digestId].tsx (/digests/:id) — getDigest + getNewsletter; NewsletterView.
- pages/insights.tsx (/insights) — feedInsights; InsightsPanel + TopicWeightBar.
- pages/discover.tsx (/discover) — listTopics + feedInsights + <Chat agent="editorial/curator">.
- components: TopicChip.tsx, DigestCard.tsx, NewsletterView.tsx, InsightsPanel.tsx, TopicWeightBar.tsx.
- _layout.tsx: add nav Topics · Digests · Insights · Discover (keep Feed · Saved · Preferences).
- index.tsx / feed/[articleId].tsx: additive — Pin + Dismiss actions (pinArticle/dismissArticle), logReadingEvent('open') on article open. Keep existing behavior.

## tests (extend store/projects/blog/tests/blog.test.mjs)
- Update expected table list (11), endpoint list (26), hooks (6), spaces (newsroom+editorial), agents.
- Assert new schemas validate (validateSchemaSet), FK/relations resolve, descriptions present.
- Assert editorial agents least-privilege (no db:schema/pages:write/api:write/hooks:write; functions [] fetch).
- Assert new hooks shapes; new endpoints export name/Input/Output/default.
- Assert full-format: newsroom+editorial each have tasklists/ functions/ components/ knowledge/; each agent charter.md+instruct.md; each knowledge field index.md + ≥2 aspects.
- Live e2e (Phase 4): materialize into temp root, lmthing serve, drive: buildDigest → curator#digest (DeepSeek) writes digest+items; logReadingEvent → personalizer learns; assert via getDigest/feedInsights. Keep round-1 synthesize loop test.

## Build sequence (fan-out by directory, integrate, then test)
1. database/ (+5 tables +3 cols) → schema test green.
2. spaces/editorial/ + newsroom remediation (full format) → space loads + typechecks.
3. api/ (+14) → contract gen + I/O tests.
4. hooks/ (+4) → loader + dispatch.
5. pages/components (+5/+5) → buildProjectPages + lint:tokens green.
6. tests update; materialize + serve + live editorial loop (DeepSeek). Green gate → push both repos.

---

# ROUND 3 — FEATURE EXPANSION (research workspace: collections · annotations · alerts · briefings + `research` space)

Strictly additive to rounds 1-2. Output root unchanged: `store/projects/blog/`. All contracts
grounded in the shipped engine (see PROGRESS "Environment"; reference full-format spaces =
`store/projects/blog/spaces/{newsroom,editorial}`). newsroom+editorial are ALREADY full-format
(round-2 remediation done) — no remediation this round.

## database/ (+7 tables, +2 columns, +4 relations). Descriptions mandatory; exactly-one PK; FK/relations resolve.
- `collections.json` — id(pk uuid), title(req), description, kind(def 'manual'), query(json),
  pinned(bool def false), articleCount(number def 0), createdAt(now). relations items→collection_items via collectionId, briefings→briefings via collectionId.
- `collection_items.json` — id(pk), collectionId→collections(cascade,req), articleId→articles(cascade,req),
  note, position(number def 0), addedAt(now). relations collection(belongsTo), article(belongsTo).
- `annotations.json` — id(pk), articleId→articles(cascade,req), quote, note, kind(def 'note'),
  color(def 'accent' — TOKEN name), verified(bool def false), createdAt(now). relation article(belongsTo).
- `subscriptions.json` — id(pk), name(req), query(json), cadence(def 'daily'), channel(def 'alert'),
  active(bool def true), lastRunAt(date), createdAt(now). relation alerts→alerts via subscriptionId.
- `alerts.json` — id(pk), subscriptionId→subscriptions(cascade,req), articleId→articles(setNull),
  title(req), summary, read(bool def false), createdAt(now). relations subscription(belongsTo), article(belongsTo).
- `briefings.json` — id(pk), title(req), topic(req), body, status(def 'pending'),
  collectionId→collections(setNull), sourceCount(number def 0), createdAt(now). relation collection(belongsTo).
- `source_health.json` — id(pk), sourceId→sources(cascade,req,UNIQUE), fetchCount(number def 0),
  itemCount(number def 0), errorCount(number def 0), lastError, lastStatus(def 'ok'), successRate(number def 1),
  updatedAt(now). relation source(belongsTo).
- articles.json ADD COLUMNS: annotationCount(number def 0), collectionCount(number def 0);
  ADD RELATIONS: annotations→annotations via articleId, collectionItems→collection_items via articleId, alerts→alerts via articleId.
- sources.json ADD RELATION: health→source_health via sourceId.
(Keep ALL round-1/2 columns/relations untouched.)

## api/ (+21 endpoints → 47). Each: local Row/Db/Ctx types (mirror round-2 handlers), name/description/Input/Output + default async handler; `HttpError` from `@app/runtime` where gated.
Collections: collections/GET.ts→listCollections; collections/POST.ts→createCollection;
  collections/[id]/GET.ts→getCollection (items+article join, position sort); collections/[id]/PATCH.ts→updateCollection;
  collections/[id]/DELETE.ts→removeCollection; collections/[id]/items/POST.ts→addToCollection (dedupe by articleId; bump collections.articleCount + articles.collectionCount);
  collection-items/[id]/DELETE.ts→removeCollectionItem (decrement counters).
Annotations: articles/[id]/annotations/GET.ts→listAnnotations; articles/[id]/annotations/POST.ts→addAnnotation (bump articles.annotationCount);
  annotations/[id]/DELETE.ts→removeAnnotation (decrement).
Subscriptions/alerts: subscriptions/GET.ts→listSubscriptions; subscriptions/POST.ts→createSubscription;
  subscriptions/[id]/PATCH.ts→updateSubscription; subscriptions/[id]/DELETE.ts→removeSubscription;
  alerts/GET.ts→listAlerts {unreadOnly?}; alerts/[id]/read/POST.ts→markAlertRead.
Briefings: briefings/GET.ts→listBriefings; briefings/[id]/GET.ts→getBriefing; briefings/POST.ts→requestBriefing (insert pending {topic,collectionId?}; NO spawn — the generate-briefing hook drives analyst).
Search/health: search/GET.ts→search {q}→{articles,briefings,collections} (query-all + JS case-insensitive substring); source-health/GET.ts→sourceHealth (join sources).

## hooks/ (+4 → 10 total)
- scan-subscriptions.ts — cron every:'30m', trigger 'research/librarian#scan', budget maxEpisodes 15.
- generate-briefing.ts — database briefings:insert, handler: guard row undefined; if row && (row.body || row.status!=='pending') return; delegate('research/analyst','brief',{input:{briefingId:row?.id}}).
- file-into-collections.ts — database articles:insert, handler: guard row undefined; delegate('research/librarian','file',{input:{articleId:row?.id}}).
- track-source-health.ts — database raw_items:insert, PURE-DB handler (no delegate): guard row undefined; query source_health, find by sourceId, insert-or-update (itemCount+1, fetchCount+1, lastStatus 'ok', successRate recompute, updatedAt now).

## spaces/research/ (NEW, full format — 3 agents)
- agents/analyst/{charter,instruct}.md — title Analyst; defaultAction brief→tasklist build-briefing;
  actions brief(tasklist), quick-take; knowledge research/{research-method,fact-checking,curation-and-collections};
  functions [rankBriefingSources,formatBriefing,summarizeCollection] (SPACE fns only — system webSearch/webFetch universal at agent scope);
  components [BriefingPreview]; capabilities db:read[articles,citations,collections,collection_items,briefings,topics] db:write[briefings].
- agents/fact-checker/{charter,instruct}.md — title Fact-checker; defaultAction verify; actions verify;
  knowledge research/{fact-checking,research-method}; functions [triageClaims,formatCitation?→use triageClaims];
  components [BriefingPreview]; capabilities db:read[articles,citations,raw_items,annotations] db:write[annotations]. (single-shot, model-driven; NO tasklist.)
- agents/librarian/{charter,instruct}.md — title Librarian; defaultAction file; actions file, scan(tasklist scan-subscriptions);
  knowledge research/{curation-and-collections}; functions [matchSubscription,dedupeAlerts,summarizeCollection];
  components [AlertBadge]; capabilities db:read[articles,collections,collection_items,topics,subscriptions,alerts] db:write[collections,collection_items,alerts,articles]. (db-only, no fetch.)
- tasklists/build-briefing/ — index.md input {query}; 01-survey.md (role explore, OMIT functions: to keep webSearch/webFetch; self-query oldest pending briefing or use query; webSearch+webFetch top hits + read feed articles/collection), 02-write.md (role general, formatBriefing; UPDATE the pending briefing to ready w/ body+sourceCount, or insert fresh).
- tasklists/scan-subscriptions/ — index.md input {query}; 01-load.md (load active subscriptions + recent articles + existing alerts), 02-match.md (matchSubscription per sub over recent articles, dedupeAlerts vs existing, insert new alerts, set subscriptions.lastRunAt).
- functions/ — matchSubscription.ts (article, query→boolean), rankBriefingSources.ts, summarizeCollection.ts, dedupeAlerts.ts (candidates, existing→new), formatBriefing.ts, triageClaims.ts. (typed, pure.)
- components/view/ — BriefingPreview.tsx, AlertBadge.tsx (design tokens only).
- knowledge/research/ — research-method/{index,framing-a-question,multi-source-synthesis}.md;
  fact-checking/{index,verification-and-provenance,claim-triage}.md;
  curation-and-collections/{index,smart-collections,saved-search-alerts}.md. (index has variable:+description: frontmatter.)

## pages/ (+7) + components (+8). Design tokens ONLY.
- pages/collections/index.tsx (/collections) — listCollections; CollectionCard grid; createCollection form.
- pages/collections/[collectionId].tsx (/collections/:id) — getCollection; items list; updateCollection/removeCollection/removeCollectionItem; requestBriefing scoped to collection.
- pages/subscriptions.tsx (/subscriptions) — listSubscriptions; SubscriptionRow; create/update/remove.
- pages/alerts.tsx (/alerts) — listAlerts; AlertRow; markAlertRead.
- pages/briefings/index.tsx (/briefings) — listBriefings; BriefingCard; requestBriefing form.
- pages/briefings/[briefingId].tsx (/briefings/:id) — getBriefing; MarkdownBody; <Chat agent="research/analyst">.
- pages/search.tsx (/search) — search {q}; SearchResults (articles/briefings/collections sections).
- components: CollectionCard.tsx, AnnotationItem.tsx, SubscriptionRow.tsx, AlertRow.tsx, BriefingCard.tsx, SearchResults.tsx, SourceHealthBar.tsx, AddToCollectionMenu.tsx.
- _layout.tsx: add nav Collections · Briefings · Alerts · Search (keep all existing).
- feed/[articleId].tsx: ADDITIVE — Annotations panel (listAnnotations + addAnnotation/removeAnnotation, color from tokens) + AddToCollectionMenu (addToCollection). Keep existing behavior.
- preferences.tsx: ADDITIVE — Source health strip (sourceHealth + SourceHealthBar). Keep existing.

## tests (extend store/projects/blog/tests/blog.test.mjs)
- Update expected table list (18), endpoint list (47), hooks (10), spaces (newsroom+editorial+research).
- Assert new schemas validate (validateSchemaSet), FK/relations resolve, descriptions present.
- Assert research agents least-privilege (no db:schema/pages:write/api:write/hooks:write).
- Assert new hook shapes (scan cron→librarian#scan; generate-briefing briefings:insert→analyst; file-into-collections articles:insert→librarian; track-source-health raw_items:insert pure-db upsert).
- Assert research is full-format (assertFullFormatSpace + 3 knowledge fields).
- Live e2e (Phase 4): materialize temp root, lmthing serve, drive: createCollection(smart) → insert article via synthesize path → file-into-collections files it; requestBriefing → generate-briefing → analyst#brief (DeepSeek) writes briefing ready; createSubscription → scan (manual hook run) → librarian inserts alert; addAnnotation. Assert via getCollection/getBriefing/listAlerts. Keep round-1/2 loops.

## Build sequence (fan-out by directory, integrate, then test)
1. database/ (+7 tables +2 cols +4 rel) → schema test green.
2. spaces/research/ (full format) → space loads + typechecks.
3. api/ (+21) → contract gen + I/O shape.
4. hooks/ (+4) → loader + dispatch.
5. pages/components (+7/+8) → buildProjectPages + lint:tokens green.
6. tests update; materialize + serve + live research loop (DeepSeek). Green gate → push both repos.
