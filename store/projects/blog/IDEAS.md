# `blog` — Product Ideas & Proposals

A forward-looking design document for the **blog** project-application (`lmthing.blog` as a
project-as-app). This is a proposal, not an implementation plan — nothing here is built yet. Every
idea is grounded in what the app *actually is today* and what the pod runtime *actually supports*
(QuickJS-sandboxed agents via `spawn`/`delegate`/`<Chat>`, Node worker `api/` handlers, cron + db
`hooks/`, Tavily `webSearch`, Azure/lmthing.cloud model tiers XS/S/M/L + reasoning variants,
capability-gated `db`/`api:call` globals, token-driven design system, inline-SVG icons only).

## 0. What the app is today (the baseline every proposal builds on)

**Data model (18 tables).** Ingest: `sources` → `raw_items` → `articles` (+ `citations`,
`source_health`). Personalization: `topics`, `reading_events`, `settings`. Research/curation:
`research`, `annotations`, `collections`/`collection_items`, `briefings`, `digests`/`digest_items`,
`newsletters`, `subscriptions`/`alerts`.

**Pages (feed-first, ~15 routes).** `/` (Feed with All/Unread/Saved + StatsStrip), `/discover`
(trending + an *existing* `<Chat agent="editorial/curator">`), `/topics`, `/collections` (+
`/collections/:id`), `/digests` (+ `/digests/:id`), `/briefings` (+ `/briefings/:id`), `/alerts`,
`/subscriptions`, `/insights`, `/search`, `/preferences`, `/feed/:articleId` (+ `/research`),
`/tag/:tag`. Nav is a single flat horizontal bar of 11 links in `pages/_layout.tsx`.

**Agents (3 spaces / 9 agents).** `newsroom/{fetcher,synthesizer,researcher}`,
`editorial/{curator,digest-writer,personalizer}`, `research/{analyst,fact-checker,librarian}`. Each
declares narrow `capabilities:` (e.g. curator: `db:read` on articles/topics/etc, `db:write` on
`digests`/`digest_items`/`articles`).

**Automation (10 hooks).** cron: `refresh-sources` (30m), `scan-subscriptions` (30m),
`build-daily-digest` (07:00). db-triggered: `synthesize-new`, `track-source-health`,
`file-into-collections`, `personalize-on-read`, `rescore-on-topic-change`, `generate-briefing`,
`render-newsletter`.

**The one honest gap that shapes everything below:** the app has enormous *machinery* (10 hooks, 9
agents, 18 tables) but a **thin, list-heavy, non-reactive UI** and **no cross-cutting conversational
control**. Most agent output (digests, briefings, research, alerts) lands in the DB and is only
discoverable by navigating to the right list page. The proposals target that gap.

---

## 1. Modern, well-thought UX

The current UI is competent but reads as *18 CRUD list pages behind a flat 11-item nav*. It hides
the app's best feature — a living, self-updating newsroom — behind navigation. The through-line of
every proposal here: **make the async agent work visible and alive**, and **collapse the nav into an
intent-shaped IA**.

### P0 — Now

**1.1 Restructure the IA: 11 flat links → 4 intent groups.**
The flat bar in `_layout.tsx` doesn't scale and gives Feed no primacy. Regroup:

- **Read** — Feed (`/`), Discover, Topics, Search
- **Library** — Collections, Digests, Briefings (the things *you* accumulate)
- **Signals** — Alerts, Subscriptions, Insights
- **Settings** — Preferences

Desktop: a slim left rail (icons + labels, groups as sections) freeing the top bar for context
(current-view title, global actions, the assistant launcher — see §4). Mobile: a bottom tab bar of
the 4 groups; secondary items in a sheet. This alone modernizes the app more than any single screen.

**1.2 A real Feed card, not a text row.** `ArticleCard` today is title/summary/tags. Redesign to a
scannable editorial card:
- Left: optional `imageUrl` thumbnail (already on `articles`/`raw_items`) with a graceful
  token-colored placeholder when null.
- Body: headline, one-line deck (`summary`), a source/citation chip row (from `citations` →
  `raw_items.source`), relative time (`createdAt`).
- Signals: a subtle **relevance meter** driven by `articles.score` (a 3-segment bar in
  `bg-primary`), a **pin** ribbon when `pinned`, the `editorNote` as an inline "Editor's note"
  callout, and `annotationCount`/`collectionCount` as small counters.
- Actions on hover/focus: Save, Pin, Dismiss, Add-to-collection (the `AddToCollectionMenu` already
  exists), "Deep-dive" (→ research). Keep them keyboard-reachable.

**1.3 First-class loading / empty / error states.** Today most pages render a bare `<Spinner />` and
"No articles yet." Replace with:
- **Skeletons** matching the target layout (feed cards, digest slots) so the page doesn't jump.
- **Empty states with a next action**, not a dead end. Empty Feed → "Your newsroom is warming up —
  add sources" CTA + link to Preferences; empty Collections → inline create; empty Alerts → "Create
  a saved search" → Subscriptions.
- **Actionable errors** — the current red box is a token-correct start, but add a Retry that calls
  the hook's `refetch`, and for `addSource`'s 402 (free-tier `maxFreeSources` cap) show an upgrade
  affordance rather than a raw message.

**1.4 "Newsroom activity" indicator.** The whole point of the app is that agents are working in the
background (fetch every 30m, synthesize on insert, digest at 07:00). Surface it: a small live status
in the header — "Last refresh 6m ago · 3 new" — driven by a lightweight `feedStats`/`sourceHealth`
poll. When `synthesize-new`/`refresh-sources` produce new `articles`, show a **"N new stories —
show"** pill at the top of the Feed (don't reflow silently). This makes the async pipeline legible.

### P1 — Next

**1.5 Redesign `/feed/:articleId` into a reading + research surface.** The article page is where
depth lives. Two-column on desktop:
- Main column: `MarkdownBody` article with generous reading measure, a citations footnote strip
  (from `citations`, each linking `raw_items.url`), and inline **highlight-to-annotate** — selecting
  text opens a small popover to save an `annotations` row (`kind: 'highlight'|'note'`, token
  `color`). This finally makes the `annotations` table user-facing beyond the fact-checker.
- Right rail: "Deep dive" (existing `research` request), "Fact-check this" (spawn `fact-checker`),
  "Add to collection", related articles by shared `tags`/`clusterKey`, and the article's existing
  annotations list (`AnnotationItem`).

**1.6 Reader-mode + reading progress + dwell capture.** Add a distraction-free reader toggle and a
scroll progress bar. Critically, the app *already* has a `reading_events` table with a `dwell` kind
and `dwellMs`, and `personalize-on-read` consumes it — but pages need to actually emit dwell events.
Wire an intersection/visibility timer that posts a `dwell` `reading-events` row on article close.
This closes the personalization loop that the schema already anticipates.

**1.7 Digest & newsletter as a designed artifact.** `/digests/:id` should look like a published
edition, not a list: a masthead (title/`summary`/`period` badge), topic-bucketed sections
(`digest_items.topicSlug`), each slot showing the curator's `blurb` as a pull-quote. Add a "View as
newsletter" toggle that renders the `newsletters` row (`NewsletterView` exists) and a copy-to-
clipboard / "send" affordance (see §3 email integration).

**1.8 Topics as a tactile control panel.** `/topics` should be the personalization cockpit:
per-topic follow/mute toggles, a `weight` slider (writes `topics.weight`, which triggers
`rescore-on-topic-change`), and an `articleCount` sparkline. Show *why* a topic is weighted using
`feedInsights`. Add an "anti-filter-bubble" nudge (the `avoiding-filter-bubbles` knowledge already
exists) — a muted-toned card suggesting an under-followed topic.

### P2 — Later

**1.9 Micro-interactions & polish.** Optimistic Save/Pin/Dismiss with a subtle scale/opacity
transition and an Undo toast (dismiss especially — it's destructive to the feed). Animated relevance
meters. A cohesive iconography pass (inline SVG only — no lucide/npm packs, per the runtime
constraint). Respect `prefers-reduced-motion`.

**1.10 Accessibility & responsive hardening.** Full keyboard nav for card actions and
highlight-to-annotate; `aria-live` on the "N new stories" pill and alert badge; focus management in
`<Chat>` and menus; color-contrast audit (tokens make this tractable). Ensure the two-column article
and digest layouts collapse cleanly to single-column on mobile.

**1.11 A `/today` home.** A single "morning briefing" landing that composites the latest `digest`,
unread `alerts`, top-scored unread `articles`, and any `briefings` that turned `ready` overnight —
the one screen a returning user opens. Complements (doesn't replace) the raw Feed.

---

## 2. Better use of LLMs

The app already uses agents well for *production* (synthesis, digests, briefings). The opportunity is
in **reading-side intelligence**: synthesis-on-demand, ranking, extraction, and personalized framing
— plus making existing agent runs feel live via streaming. Tier guidance below maps to the
XS/S/M/L (+ reasoning) aliases the pod exposes.

### Model-tier heuristic (used throughout)
- **XS/S** — high-volume, latency-sensitive, structured extraction/classification: tag extraction,
  dedupe/cluster-key assignment, subscription matching, alert one-liners, TL;DRs. Cheap, runs in
  hooks at feed scale.
- **M** — default synthesis/summarization quality: article synthesis (current `synthesizer`), digest
  blurbs, collection summaries, the assistant (§4).
- **L / reasoning** — multi-source reasoning where being wrong is expensive: `analyst` briefings,
  `fact-checker` verification, contradiction detection, weekly "what changed" synthesis. Gate behind
  `settings.tier` / `weeklyBudgetUsd` since these are the costly calls.

### P0 — Now

**2.1 Streaming everywhere an agent runs.** Today `research`/`briefings` seed a `pending` row and the
user watches a status flip — no progress. Because these run via `spawn`/`delegate`, wire the run's
token stream to the pending detail page (a `runId` is already returned by `ctx.spawn`). Show the
report *composing live* on `/briefings/:id` and `/feed/:id/research`. This is the single biggest
perceived-quality win and needs no new agent — just surfacing the stream the runtime already emits.

**2.2 Per-article "Explain / TL;DR / ELI5" inline actions (XS/S, inline call).** On the article page,
lightweight one-shot calls (not full agents) that rewrite the *already-synthesized* `body` into a
3-bullet TL;DR, a plain-language version, or "why this matters to me" (conditioned on the reader's
top `topics`). Cache the result on the article (or a small `article_takes` table) so it's computed
once. Inline call, not `spawn` — no orchestration needed, latency matters.

**2.3 Smarter subscription matching (S, in the existing `scan-subscriptions` loop).** `subscriptions.query`
is tag/keyword criteria matched literally by the `librarian`. Upgrade the match step to *semantic*
intent matching ("EU AI regulation" should catch "Brussels finalizes the AI Act" even without a tag
hit), and have it write a genuinely useful `alerts.summary` ("Matches your 'AI regulation' watch:
first concrete enforcement timeline") instead of a mechanical one. Keep it in the existing cron hook.

### P1 — Next

**2.4 Cross-article synthesis: "Storylines" (M/L, new agent + cron hook).** The app has
`clusterKey` on `articles` but only uses it to collapse digest dupes. Introduce a `storylines` table
and a `synthesizer`-adjacent agent that, on a cadence, groups articles by evolving `clusterKey` and
writes a **running synthesis of a developing story** ("Here's the 5-day arc of X, and what's new
today"). Surface as a Feed card type and a `/storylines/:id` timeline. This is the flagship
LLM feature — it turns a river of items into narrative.

**2.5 Contradiction & novelty detection (L/reasoning, hook on `synthesize-new`).** When a new article
enters a cluster, have a reasoning-tier check compare it against the cluster's prior citations: is
this *new information*, a *contradiction* of an earlier claim, or a *rehash*? Store a
`noveltyKind` + a one-line rationale on the article; the Feed badges "New development" /
"Conflicting report" and can *demote* rehashes (feeding `articles.score`). Directly leverages the
existing `credibility-signals` / `dedup-and-clustering` knowledge.

**2.6 Personalized re-framing of digest blurbs (M).** The `curator` writes one `blurb` per
`digest_items` slot for everyone. Add an optional personalization pass keyed to the reader's `topics`
weights so the "why this matters" is framed to *this* reader's interests — the `personalizer`
already owns the weight model; extend it (or a sibling) to annotate digest slots.

**2.7 Query understanding on `/search` (S).** `/search` is keyword today. Add an LLM query-parse step
that turns "recent skeptical takes on fusion funding" into a structured filter (topics + sentiment +
recency) over the DB, plus an optional "synthesize an answer from my feed" mode that composes a short
grounded answer with citations to `articles` the reader already has — RAG strictly over the user's
own corpus (no fabrication; reuse the newsroom's grounding standards).

### P2 — Later

**2.8 Source quality scoring (S, in `track-source-health`).** `source_health` tracks *fetch*
reliability. Add an LLM-judged *editorial* quality signal — over a rolling window, rate a source's
originality/accuracy/signal-to-noise and factor it into `articles.score` and Preferences ("This
source is 80% rehash — mute?").

**2.9 Weekly "what I missed / what changed" reasoning digest (L/reasoning, cron).** Beyond the daily
roundup: a reflective weekly synthesis over `reading_events` + `articles` — themes you engaged with,
threads that advanced, one contrarian piece you skipped. Gate on `subscription` tier.

**2.10 Prompt/quality guardrails (cross-cutting).** All reader-facing generation must inherit the
newsroom's existing anti-fabrication charter language and `editorial-standards` knowledge — every
generated take cites a real `articles`/`raw_items`/`citations` row, and "found nothing" is a valid
answer. Add a cheap self-check pass (XS) on high-stakes L outputs (briefings, fact-checks) before
they flip to `ready`. Budget: keep XS/S in hooks (feed-scale), reserve L behind explicit user intent
or tier so `weeklyBudgetUsd` stays honest.

---

## 3. Integrations with other services

The newsroom is only as good as what flows in and out. Every integration below names the service, the
exact data flow, the tables/endpoints/hooks it touches, and how it connects on the pod runtime (Node
`api/` handlers can `fetch`; cron `hooks/` can poll; agents have Tavily `webSearch`).

### P0 — Now (highest value, lowest friction)

**3.1 Real RSS/Atom ingestion (the foundational gap).** `sources.kind: 'rss'` exists but the
`fetcher` leans on `webSearch`. Add proper feed ingestion: a Node `api/`/hook path that `fetch`es the
feed URL, parses XML→entries (the `parseFeedEntries` newsroom function already exists), and inserts
`raw_items` (dedup on `url`, extract `imageUrl` via existing `extractImage`). Connects via plain HTTP
GET in the `refresh-sources` cron. **Data in:** feed entries → `raw_items`. **Touches:** `sources`,
`raw_items`, `source_health`. This makes "RSS source" actually mean RSS.

**3.2 OPML import/export.** Let users bring their existing reader subscriptions. `api/sources/import`
(POST) parses uploaded OPML → bulk-inserts `rss` `sources`; `api/sources/export` (GET) emits OPML.
Pure file parse in a Node handler. **Value:** removes the cold-start problem; **touches:** `sources`,
Preferences page.

**3.3 Email newsletter delivery (Resend or Postmark).** The app *renders* `newsletters` but `sentAt`
never gets set. Add `api/newsletters/:id/send` that POSTs to Resend's `/emails` REST API (API key via
pod env), sets `newsletters.sentAt`. Trigger optionally from `render-newsletter` (auto-send the
daily) or a "Send" button on `/digests/:id`. **Data out:** rendered `newsletters.body` → the reader's
inbox. **Touches:** `newsletters`, `settings` (a `deliveryEmail` column to add). Makes the digest
pipeline reach outside the app.

### P1 — Next

**3.4 Read-later / bookmarking sync (Pocket, Instapaper, Readwise).** Two directions:
(a) *import* saved links → `sources`/`raw_items` for synthesis; (b) *export* `articles.saved` and
`annotations` (highlights!) out to Readwise via its REST API. Readwise is the natural home for the
`annotations` table's highlights. Connect via OAuth + REST poll in a cron hook. **Touches:**
`articles`, `annotations`, `raw_items`.

**3.5 Newsletter *inbound* ingestion (email → source).** Many great sources are email newsletters, not
RSS. Provision a per-user ingest address (Postmark/Resend inbound webhook → gateway → pod
`api/inbound-email`), parse the email into a `raw_item` under a synthetic `source` (`kind: 'email'`).
**Data in:** forwarded newsletters → `raw_items`. This is a genuinely differentiated source type.

**3.6 YouTube / podcast transcripts.** `sources.kind: 'search'|'rss'` → add `'youtube'`/`'podcast'`.
Poll a channel/RSS, fetch transcript (YouTube transcript API / a transcription service for podcasts),
insert as `raw_items` for the `synthesizer` to write up. **Value:** the newsroom covers audio/video,
not just text.

**3.7 Reddit / Hacker News as sources.** Both expose clean JSON REST (HN Firebase API, Reddit
`.json`). A cron hook polls a subreddit/HN query, inserts top items as `raw_items`. **Touches:**
`sources` (new kinds), `raw_items`. High signal, trivial to connect (no OAuth for read).

### P2 — Later

**3.8 Slack / Discord digest delivery.** Post the daily `digest` (or high-priority `alerts`) to a
Slack channel via Incoming Webhook. **Data out:** `digest_items` → formatted Slack blocks. Extends
`render-newsletter` with a channel dispatch. Good for team/shared feeds.

**3.9 Notion / Obsidian export of collections & briefings.** Push a `collection` or a `briefing` to a
Notion database page via Notion's REST API (OAuth). **Data out:** `briefings.body`,
`collection_items` → Notion. Turns the research desk into a knowledge-base feeder.

**3.10 Calendar-aware briefings (Google Calendar).** Read upcoming meeting titles (OAuth, read-only)
and pre-generate a `briefing` on the topic the morning of ("You have 'Q3 fusion strategy' at 2pm —
here's what's new"). **Data in:** event titles → `briefings.topic`; **touches:** `briefings`,
`generate-briefing`.

**3.11 Push notifications (Web Push / ntfy).** For `channel: 'alert'` subscriptions, deliver a real
push instead of only an in-app badge. Web Push via a service worker + VAPID, or ntfy for a
zero-account option. **Touches:** `alerts`, `subscriptions`.

**Integration hygiene (cross-cutting):** all third-party keys live in pod env (never in `sources`
rows); all outbound calls go through Node `api/`/hook handlers (agents stay sandboxed to
`db`/`webSearch`); every inbound webhook validates a signature at the gateway before reaching the
pod. Add a small `integrations` table (service, status, last-sync, error) surfaced in Preferences so
connections are observable the way `source_health` is.

---

## 4. Its own agent chat to control the whole application

Today `<Chat agent="editorial/curator">` lives on `/discover` — but it only talks to *one* desk and
only knows about digests. The proposal: a single **"Editor" concierge agent** reachable from anywhere
(a header launcher + a `⌘K` command bar), that can *drive every surface of the app* conversationally,
and that **complements the pages rather than duplicating them** — pages are for browsing/scanning; the
Editor is for *intent you'd otherwise click through five screens to express*.

### 4.1 The agent: `assistant/editor`

A new space `spaces/assistant/` with one orchestrator agent `editor` whose job is to understand a
reader request, do the read-only parts itself, and **delegate writes to the specialist agents that
already own each table** (curator, personalizer, librarian, analyst, researcher, fetcher). It should
own *routing and conversation*, not duplicate the specialists' write logic.

```yaml
# spaces/assistant/agents/editor/charter.md (frontmatter)
title: Editor
defaultAction: chat
capabilities:
  - db:read: { tables: [articles, topics, collections, collection_items, digests,
               digest_items, briefings, alerts, subscriptions, sources, reading_events,
               research, annotations, source_health, settings] }   # broad READ
  - db:write: { tables: [collections, collection_items, subscriptions, topics] }  # only low-risk, reversible writes it does directly
  - api:call: { names: [addSource, removeSource, createCollection, createBriefing,
               requestResearch, pinArticle, saveArticle, personalizeFeed, buildDigest] }
canDelegateTo:
  - editorial/curator#digest
  - editorial/curator#pin
  - editorial/personalizer#rescore
  - research/librarian#file
  - research/analyst#brief
  - newsroom/researcher#research
```

**Capability design rationale.** The Editor gets *broad read* (so it can answer "what did I miss
about X?" across the whole DB) but **narrow direct write** — only reversible, low-blast-radius tables
(collections, subscriptions, topic weights). Anything that spends model budget or produces
content (a digest, a briefing, a deep-dive, a re-score) is **delegated** to the specialist that
already holds that write capability and the relevant `knowledge/`. This keeps the capability model's
least-privilege invariant intact: the Editor can't fabricate an article because it can't write
`articles.body`, and it can't run up spend without going through a budgeted specialist.

### 4.2 What it can do (mapped to real tables/endpoints/agents)

| Intent | How the Editor handles it |
|---|---|
| "What happened in AI regulation this week?" | `db:read` articles filtered by tag/recency → synthesize a grounded answer citing real `articles` rows (RAG over the feed) |
| "Follow fusion energy, mute crypto." | direct `db:write` to `topics` (follow/mute) → triggers `rescore-on-topic-change` |
| "Turn up how much I see about biotech." | direct write `topics.weight` → auto re-score |
| "Make a collection of everything on the EU AI Act." | `createCollection` (smart, `query.tags`) via `api:call` → `librarian` auto-files via existing hook |
| "Give me a briefing on small modular reactors." | delegate `research/analyst#brief` (seeds a `briefings` row, analyst fills it, streams back) |
| "Deep-dive this article." (with article context) | `requestResearch` / delegate `newsroom/researcher` |
| "Build me a digest about this week's climate news." | delegate `editorial/curator#digest` |
| "Add TechCrunch's feed." | `addSource` via `api:call` (respects the `maxFreeSources` 402) |
| "Watch for anything about my competitor Acme." | `db:write` a `subscriptions` row → `scan-subscriptions` picks it up |
| "Why am I seeing so much about X?" | `db:read` `topics.weight` + `reading_events` → explain the personalization, offer to adjust |
| "Pin this / save this / mark all read." | `pinArticle` / `saveArticle` / delegate curator pin |

### 4.3 Surfacing results in the UI

The Editor shouldn't just print text — results should **link into the app**:
- When it creates/updates a row, render an **inline result card** (a collection card, a
  briefing-in-progress card with the live stream from §2.1, an alert) with a "View" link to the real
  page. The `<Chat>` widget + the catalog descriptor renderer already support rich component output;
  reuse the existing preview components (`BriefingPreview`, `DigestPreview`, `ArticlePreview`).
- **Streaming**: long delegations (briefing/research/digest) show the token stream in the chat bubble
  and a persistent toast so the user can navigate away and get pulled back when it turns `ready`.
- **Command-bar mode** (`⌘K`): a compact single-shot input for terse commands ("mute crypto",
  "digest on climate") that routes to the same agent but collapses to a toast instead of a full
  conversation — the fast path that complements the deliberate chat panel.

### 4.4 Safety & confirmation

Least-privilege capabilities are the first line of defense; conversational confirmation is the
second:
- **Destructive/irreversible or spendy actions require an explicit in-chat confirm chip** before
  execution: `removeSource`, deleting a collection/subscription, mass "mark all read", and anything
  that spends budget (briefings, digests, re-personalize). The Editor proposes → renders a
  "Confirm / Cancel" chip → only then calls.
- **Batch actions preview first**: "This will mute 4 topics and re-score ~120 articles — proceed?"
- **Budget awareness**: before delegating an L/reasoning briefing, the Editor reads `settings`
  (`tier`, `weeklyBudgetUsd`) and warns/blocks on the free tier, mirroring the `addSource` 402 rule.
- **No silent writes**: every write the Editor makes is echoed as a result card with an Undo where
  the underlying table allows it (collections, subscriptions, topic weights are all reversible).
- **Grounding**: the Editor inherits the newsroom `editorial-standards` — answers cite real rows,
  and "I couldn't find anything in your feed on that" is a valid, preferred response over invention.

### 4.5 How it complements (doesn't duplicate) the pages

Pages remain the home for **browsing, scanning, and direct manipulation** — the Feed, the digest
reader, the topics control panel. The Editor is for **intent that spans surfaces** ("catch me up and
make a collection and set a watch") and **natural-language reach into the whole DB** ("what changed
since Tuesday?"). It replaces the current single-desk `/discover` chat with an app-wide concierge,
and it's the fastest on-ramp for the very features (subscriptions, smart collections, briefings) that
are currently buried behind list pages a new user never discovers.

### Rollout
- **P0**: ship `assistant/editor` with `db:read` + read-only Q&A over the feed (RAG) + the safe
  direct writes (topics follow/mute/weight, create collection/subscription). Header launcher.
- **P1**: add delegated content generation (briefings, digests, research) with streaming result
  cards and confirm chips; `⌘K` command bar.
- **P2**: proactive mode — the Editor opens with a spoken-word "here's your morning" summarizing new
  `digests`/`alerts`/`ready` briefings (pairs with the `/today` home in §1.11).

---

## Priority summary

| # | Proposal | Priority |
|---|---|---|
| 1.1 | IA regroup (11 flat links → 4 groups, left rail / bottom tabs) | Now |
| 1.2 | Editorial Feed card (image, source chips, relevance meter) | Now |
| 1.3 | Skeletons + actionable empty/error states | Now |
| 1.4 | Live "newsroom activity" + "N new stories" pill | Now |
| 1.5 | Article page as reading + research surface (highlight-to-annotate) | Next |
| 1.6 | Reader mode + dwell capture (closes the `reading_events` loop) | Next |
| 1.7 | Digest/newsletter as a designed edition | Next |
| 1.8 | Topics control panel (weight sliders, anti-bubble nudge) | Next |
| 1.9–1.11 | Micro-interactions, a11y, `/today` home | Later |
| 2.1 | Stream agent runs into pending pages | Now |
| 2.2 | Inline TL;DR / ELI5 / "why this matters to me" (XS/S) | Now |
| 2.3 | Semantic subscription matching + better alert summaries | Now |
| 2.4 | Storylines: cross-article running synthesis (flagship) | Next |
| 2.5 | Contradiction/novelty detection feeding `score` | Next |
| 2.6–2.7 | Personalized blurbs, query understanding on Search | Next |
| 2.8–2.10 | Source quality scoring, weekly reflection, guardrails | Later |
| 3.1 | Real RSS/Atom ingestion | Now |
| 3.2 | OPML import/export | Now |
| 3.3 | Email newsletter delivery (Resend/Postmark) | Now |
| 3.4–3.7 | Readwise/Pocket, inbound email, YT/podcast, HN/Reddit | Next |
| 3.8–3.11 | Slack/Discord, Notion, Calendar, Push | Later |
| 4 | `assistant/editor` app-wide concierge chat | Now→Later (phased) |
