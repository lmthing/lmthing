# lmthing.homes — Product Ideas & Direction

A working proposal for evolving the **`homes`** project-application. Everything below is grounded in
what the app is **today** and in the runtime primitives it actually has (QuickJS-sandboxed agents,
Node-isolated `api/`/`hooks/`, client-side React `pages/` on `@app/runtime`, capability-gated `db`,
`webFetch`/`webSearch` via Tavily, `<Chat>` widgets, `spawn` from handlers). It does **not** touch
any other app.

---

## 0. What `homes` is today (the baseline we're building on)

`homes` is an AI-assisted home finder. The mental model is *paste-first triage*: you describe a
search, then paste the alert emails / saved-search pages / links you already receive, and the app
turns each capture into one canonical, comparable `listings` row — true monthly cost, stated-vs-
measured size, commute estimates, a triangulated location guess, scout findings, and a taste-model
score, with the best new match surfaced as an `alert`.

**Data model (10 tables):** `searches`, `sources`, `raw_captures`, `listings`, `listing_analyses`,
`location_guesses`, `commutes`, `taste_signals`, `taste_notes`, `alerts`.

**Pages:** `/` (search list), `/new` (create search), `/searches/:id` (ranked feed + alert strip),
`/searches/:id/inbox` (capture desk + sources + `intake/clipper` chat), `/searches/:id/compare`
(2–4 listing side-by-side), `/searches/:id/taste` (learned taste notes + signals + `scout/ranker`
chat), `/listings/:id` (detail + true-cost + commutes + location + analyses + `scout/analyst` chat).

**API (19 handlers):** `searchList`, `createSearch`, `updateSearch`, `deleteSearch`, `getSearch`,
`ingestCapture`, `listCaptures`, `addSource`, `updateSource`, `pollSource`, `listingFeed`,
`getListing`, `updateListing`, `saveListing`, `dismissListing`, `compareListings`, `tasteProfile`,
`listAlerts`, `markAlertRead`.

**Agents:** `intake/clipper` (parse/refresh/poll), `intake/surveyor` (true cost + commute),
`scout/analyst` (photos/floorplan/mismatch — **text-only, no vision in the engine**),
`scout/locator` (triangulation), `scout/ranker` (rank + learn, raises the `new_match` alert).

**Pipeline (hooks):** `parse-new-capture` (db) → `enrich-new-listing` (db; runs surveyor → analyst
→ locator → ranker as sequential delegates) → `learn-from-signal` (db) → `poll-saved-searches` +
`refresh-tracked-listings` (6h cron).

**Honest constraints to respect in every proposal below:**
- **No pixels.** The analyst reads caption/description *text*, never images. Any "look at the photo"
  feature is gated on a vision-capable model tier being wired into the pod runtime — treat as Later.
- **`db.query` `where` is equality-only.** Ranking/filtering across ranges happens in memory or in
  an `api/` handler, not in a rich SQL predicate.
- **Design tokens only** in `pages/` (`var(--foreground)`, `bg-card`, `text-primary`, …) and
  **inline-SVG icons** (`components/icons.tsx`) — npm icon packs don't resolve in the app sandbox.
- **Polling is opt-in, per-source, robots-aware.** Any new fetching integration inherits that
  discipline — paste-first stays the safe default.

Priority key used throughout: **P0 = Now** (high value, low runtime risk), **P1 = Next**,
**P2 = Later** (bigger lift or gated on a new capability).

---

## 1. Modern, well-thought UX

The current UI is clean and functional but flat: every screen is a centered `max-w` column of
`rounded-lg border bg-card` stacks, the bell in `_layout.tsx` is decorative (no dropdown), there is
no cross-search dashboard, and the feed has no sort/filter/grouping. The listing detail is a long
scroll. Below is a redesign that keeps the token system and component vocabulary but adds
information architecture, density, and state polish.

### 1.1 Information architecture & navigation (P0)

**Problem:** the global nav (`_layout.tsx`) has only *Searches / New / (dead) bell*. There is no
"what needs my attention now" surface, and alerts are trapped inside a single search feed.

**Proposals:**
- **Make the bell real.** Wire it to a global alerts popover backed by a new `listAllAlerts`
  endpoint (union of `listAlerts` across active searches, unread-first). Clicking an alert deep-
  links to `/listings/:id` or the owning feed. Badge shows unread count. This is the single
  highest-value nav fix — the whole product promise is "act before someone else does," and today
  the alert only lives inside one feed you have to already be looking at.
- **A persistent search switcher.** When inside `/searches/:id/*`, add a small dropdown in the nav
  (search title → other active searches) so you can jump between hunts without going back to `/`.
- **Sub-nav consistency.** `SearchTabs` (feed / inbox / compare / taste) is good; promote it to a
  sticky sub-header (`sticky top-0 bg-background/95 backdrop-blur border-b`) so it stays reachable
  on long feeds, and add a **counts affordance** on each tab (e.g. "Inbox • 3 parsing",
  "Feed • 12", "Taste • 5 notes").

### 1.2 A real home dashboard at `/` (P1)

Today `/` is a grid of `SearchCard`s with `unreadAlerts`/`newListings` counts. Elevate it into a
command center:
- **Top strip: "Needs you now"** — the freshest high-score `new_match` alerts and `price_drop`s
  across *all* searches, as a horizontally scrollable row of compact cards (score badge, price,
  one-line reason, Save/Dismiss inline). This is the screen you check every morning.
- **Per-search cards** gain a sparkline-free but informative footer: "12 tracked · 3 shortlisted ·
  best match 88 · last capture 2h ago", plus a status chip (`active`/`paused`) that's togglable in
  place (calls `updateSearch`).
- **Empty state** stays as-is (it's already good) but gains a "paste to start" affordance — a
  create-and-paste combined flow (see 1.3).

### 1.3 The feed — the screen that matters most (P0/P1)

`/searches/:id` is a flat list of `ListingCard`s that polls every 4s while any score is 0. Make it a
triage cockpit:
- **Sort & group controls (P0):** a toolbar with sort by *Score (default) / True cost / Newest /
  Commute*, and a segmented filter *All / New / Shortlisted / Has flags / Under budget*. All done
  client-side over the `listingFeed` array (cheap, no new endpoint) or via a `listingFeed` query
  param.
- **Score-first card redesign (P0):** lead with the `ScoreBadge`, then title + `formatMoney(trueCost)`
  with the *stated* price as a struck-through secondary ("€1,600 asked · **€1,880 all-in**"), then
  `FlagChips`, then a one-line `scoreSummary` teaser (first bullet), then commute chips. Right-rail
  Save/Dismiss with a hover-reveal reason field (today dismiss-reason only exists on the detail
  page; capturing it in-feed is the highest-value taste signal and should be one keystroke away).
- **Keyboard triage (P1):** `j`/`k` to move, `s` to save, `x` to dismiss (opens inline reason),
  `enter` to open detail. Home-hunting is repetitive list work; power users will burn through 40
  listings fast.
- **Live-arrival affordance (P0 polish):** while polling, show a subtle "Scoring 3 new listings…"
  pill with a shimmer, and animate newly-scored cards in (fade + slide). Today a 0-score listing
  just silently flips to scored on the next 4s tick — make the intelligence *visible*.
- **Optimistic Save/Dismiss (P0):** `saveListing`/`dismissListing` already `invalidates:
  ['listingFeed']`; add optimistic removal/greying so the list feels instant instead of waiting for
  the refetch.

### 1.4 Listing detail — from long scroll to two-column brief (P1)

`/listings/:id` stacks eight sections vertically. Restructure into a responsive two-column layout on
`md+`:
- **Left (sticky):** the decision panel — score badge, price/true-cost, status pipeline select,
  Save/Dismiss, "Why this score" (`scoreSummary`), and the commute chips. This is what you decide
  from; keep it in view.
- **Right (scroll):** evidence — photos carousel, size & layout, true-cost breakdown, location guess
  map, description, and the append-only `listing_analyses` timeline.
- **Location guess deserves a real map (P1):** `LocationGuessPanel` currently renders a guess with a
  radius; render an actual confidence circle on a static map (see §3 Maps integration) instead of
  numbers-only. The "within this circle, ±confidence" story is far more legible visually.
- **Analyses as a timeline (P0):** since `listing_analyses` is append-only and a deep-sweep adds
  fresh rows, render them newest-first with a date and a "supersedes earlier read" affordance, and
  group by `kind` (Photo read / Floor plan / Consistency check) with the confidence as a small meter
  rather than "60% confidence" text.

### 1.5 Compare — make the winner obvious (P1)

`CompareTable` lines up 2–4 listings by attribute. Upgrade it to **highlight the best cell per row**
(cheapest true cost, largest measured size, shortest commute) with a `text-primary`/`bg-muted`
emphasis, and add a **"recommend" footer row** where `scout/ranker` writes a one-paragraph verdict
("For your stated priorities, B wins on light and commute; A is €140/mo cheaper but flags
size_overstated"). Add a share/export-to-markdown button (the compare view is exactly what people
paste into a chat with a partner).

### 1.6 The `/new` form — progressive, less intimidating (P1)

The create form is one long page of four `section`s. It's fine but heavy for a first run. Options:
- **Brief-first shortcut:** a single big textarea ("Describe what you want in plain English") plus a
  budget field, then **let `scout/ranker` (or a new setup agent) pre-fill** mode/area/mustHaves/
  commuteTargets from the brief as editable chips (LLM extraction — see §2.2). The user confirms/
  edits rather than filling 12 fields cold.
- **Combined create-and-paste:** after create, land on the inbox (already the behavior) but keep the
  brief visible and prompt "Paste your first alert email to see it ranked."

### 1.7 Empty / loading / error / offline states (P0)

The app has decent empty states on `/`, feed, and taste, and a `Spinner`. Systematize:
- **Skeletons over spinners** on the feed and detail — render 3–4 `ListingCard` skeletons
  (`animate-pulse` on token-colored blocks) so layout doesn't jump. Spinner stays for short actions.
- **Per-capture progress in the inbox (P0):** `CaptureRow` shows `pending|parsing|parsed|error`;
  make `parsing` a live step indicator ("segmenting → extracting → deduping → summarizing") driven
  by the tasklist stages, and make `error` actionable (show `raw_captures.error`, offer "retry" that
  re-inserts a pending capture, and "edit & re-paste").
- **Error states carry recovery,** not just "Failed to load." Every `error` block gets a Retry
  button calling `refetch()`.
- **Blocked-source callout (P0):** when a `source.blockedReason` is set (robots disallow), surface
  it prominently in the inbox with a "paste manually instead" nudge — reinforce the paste-first
  safe path rather than making polling failure feel like app failure.

### 1.8 Micro-interactions, responsive, accessibility, polish (P0/P1)

- **Mobile (P0):** home hunting happens on a phone with the listing open in another tab. The feed
  cards and detail must be single-column, thumb-reachable Save/Dismiss, and the compare table must
  become a horizontally scrollable card set (`overflow-x-auto`) rather than a squashed table.
- **Accessibility (P0):** flag chips and score badges need text/aria labels (a color-only "poor
  light" chip fails colorblind users — pair the token color with an icon + label); the status
  `<select>`s need visible labels; keyboard focus rings via tokens; `aria-live="polite"` on the
  "N new listings scored" pill.
- **Score legibility:** `ScoreBadge` should encode the band (e.g. 80+ = strong, 60–79 = worth a
  look, <45 = capped by a hard constraint) with a token color *and* a word, and a tooltip that
  points to "Why this score."
- **Consistent iconography:** extend `components/icons.tsx` (inline SVG only) with the few icons the
  redesign needs — trending-down (price drop), alert-triangle (flags), map, filter, sort, keyboard.

---

## 2. Better use of LLMs

The app already uses agents well for the *pipeline* (parse → enrich → rank → learn) and exposes
three scoped `<Chat>` widgets. The gaps are: (a) intelligence is buried until you open a specific
listing; (b) nothing synthesizes *across* listings; (c) the taste model only learns from clicks, not
from what you say. Model tiers referenced below are the Azure/lmthing.cloud **XS/S/M/L + reasoning**
variants.

### 2.1 Search-level digest & "state of the hunt" (P0)

**Feature:** a `scout/ranker`-authored daily digest per active search: "3 new matches since
yesterday, 1 price drop on your shortlist, the market in Arroios is running €120/mo above your cap —
your best current option is X." Rendered as a dismissible card at the top of the feed and as the
body of a `digest` alert.

**How:** a new **`daily` cron hook** → `scout/ranker#digest` (or `intake/clipper`), reading
`listings`/`alerts`/`taste_notes` for the search and writing one `alerts` row (`kind: 'digest'`).
**Tier: S** (summarization over structured rows is cheap; latency irrelevant since it's a cron).
This turns the app from reactive (open feed, scan) into a briefing you receive.

### 2.2 Brief → structured search extraction (P1)

**Feature:** on `/new`, parse the free-text brief into `mode`, `area`, `minRooms`, `minAreaSqm`,
`mustHaves`, and candidate `commuteTargets`, presented as editable chips (see §1.6).

**How:** a new `api/searches/extract-brief/POST.ts` (`extractSearchBrief`) that `ctx.spawn`s a
lightweight extraction (or calls an agent action) returning a structured draft. **Tier: S**,
single-shot, streamed into the form. This removes the biggest friction in onboarding and makes the
first ranking sharper because constraints are captured, not skipped.

### 2.3 Conversational taste correction that actually writes notes (P0)

Today `/searches/:id/taste` embeds `scout/ranker` chat, but the *highest-signal* input — a dismiss
reason — is only capturable on the detail page. Improvements:
- **Reason-first dismiss everywhere (P0):** capture `dismissedReason` in the feed and in the alert
  strip, not just detail. Each becomes a `taste_signals` row → `learn-from-signal` → a cited
  `taste_notes` update. This is pure signal quality, and it's where the LLM's learning gets its best
  fuel.
- **"Explain this note" and "this is wrong" affordances (P1):** each `TasteNoteCard` gets inline
  buttons that seed the ranker chat with the note id, so correcting taste is one click, not free
  typing. The ranker folds the correction and re-ranks (it already does `learn` + reset-score).
  **Tier: M** for the ranker (judgment + citation quality matters more than latency here).

### 2.4 Cross-listing synthesis: "which of these should I actually see?" (P1)

**Feature:** a "Shortlist review" that reasons over the *set* of shortlisted listings, not one at a
time: trade-offs, what they have in common (revealing implicit taste), which two are near-duplicates
of a decision, and a recommended viewing order. Surfaced on the compare page footer (§1.5) and as a
`<Chat>`-driven "review my shortlist" prompt.

**How:** `scout/ranker` action `review` reading all `status='shortlisted'` listings for the search.
**Tier: M or M-reasoning** — genuine multi-item reasoning benefits from a reasoning variant; it's
user-triggered so a few seconds of latency is fine, stream the verdict.

### 2.5 Smarter extraction & dedupe in the clipper (P1)

The clipper is deliberately conservative (never invent a field). Two upgrades that don't break that:
- **Better borderline-dedupe adjudication:** today a same-street/different-price-band pair is flagged
  `possible_duplicate` headlessly. A short **M-tier** reasoning pass over the two candidate texts can
  produce a confidence + rationale ("same floor plan, same photos, €50 difference is a re-list") that
  the `ConfirmMerge` ask component presents to the user with a recommendation. Still user-confirmed
  for destructive merges.
- **Structured field extraction with self-check:** run extraction, then a cheap **XS/S** verification
  pass that only flags fields it *can't* find in the source text (so absent stays absent, per the
  charter) — reduces hallucinated fields to near-zero while keeping recall.

### 2.6 Location triangulation quality (P1)

`scout/locator` triangulates from textual clues. Give it a **reasoning tier (M-reasoning)** for the
intersection step (clue extraction is cheap S; the geometric "where do these constraints overlap"
reasoning is where a reasoning model earns its cost), and let it call **`webSearch`** to resolve a
named amenity/street to coordinates (see §3 Geocoding). Keep the honest-radius discipline: more
agreeing clues → tighter circle, and always cited in `location_guesses.method`.

### 2.7 Neighborhood & market context via web search (P1)

**Feature:** on the listing detail and the digest, a short, *cited* neighborhood read — "Anjos:
well-connected (2 metro lines), lively/noisy on the main drag, rents trending up ~6% YoY [sources]."
**How:** `scout` agent action using `webSearch` (Tavily), cached per area on the `searches` row or a
new `area_notes` table so it's computed once, not per listing. **Tier: S** for synthesis, with
citations preserved. Cost control: dedupe by area, refresh weekly via cron.

### 2.8 Streaming UX & where each primitive fits

- **Inline single-shot (`apiCall`/`spawn` from a handler):** brief extraction (2.2), a one-listing
  "explain" — fast, no orchestration.
- **Agents via `<Chat>`:** taste correction, shortlist review, ask-the-analyst — anything
  conversational and multi-turn where the user steers.
- **Hooks (cron/db):** the digest (2.1), neighborhood caching (2.7), and the existing pipeline —
  anything that should happen *without* the user waiting. The db-triggered enrichment already nails
  this pattern; extend it, don't move it into request paths.
- **Always stream** ranker verdicts and digests token-by-token in the UI (the `<Chat>` widget and a
  streamed `apiCall`) — the "why" is the product; showing it think builds trust.
- **Cost/latency discipline:** default to **S** for extraction/summarization/dedupe; reserve **M /
  reasoning** for ranking judgment, cross-listing synthesis, and location intersection. Cache
  anything area-level. Never run an L-tier pass in a 4s-polled request path.

---

## 3. Integrations with other services

Every integration below inherits the app's guardrails: opt-in, per-source, robots/ToS-aware, and
paste-first stays the safe default. For each: the service, the data flow, the tables/endpoints/hooks
it touches, the user value, and the technical connection. **Note on portal APIs:** the major real-
estate portals (Idealista, Rightmove, Zillow, Immobilienscout24) do *not* offer open listing APIs to
consumers and their ToS forbid scraping — so the app's paste-first + robots-aware-poll model is a
deliberate, correct choice, not a limitation. The integrations that add the most value are the ones
*around* the listing, not more listing firehoses.

### 3.1 Geocoding & maps — **Nominatim (OSM) + static map tiles** (P0)

- **What:** OpenStreetMap Nominatim for forward/reverse geocoding; a static-map image for the
  location-guess circle and commute targets.
- **Data flow in:** `commuteTargets[].address` → lat/lng; a listing's clue ("2 min from Anjos
  metro", a street name) → candidate coordinates for `scout/locator`. **Out:** rendered map on
  `/listings/:id`.
- **Touches:** `location_guesses` (lat/lng/radius/confidence), `commutes` (needs target coords),
  `LocationGuessPanel`, listing detail. A new `api/geocode/GET.ts` (`geocode`) wraps Nominatim
  server-side (worker `fetch`) so the client never calls it directly and we can cache/throttle.
- **Value:** the location-guess story becomes a *picture* (§1.4); commute estimates get real
  endpoints instead of vague addresses.
- **How:** `api/` handler → `fetch('https://nominatim.openstreetmap.org/search?...')` honoring the
  1 req/s usage policy (throttle + cache results on the row). Static tiles via an OSM tile URL as an
  `<img src>` (no key) or embedded static map; keep it token-styled and inline.

### 3.2 Transit / drive time — **Google Distance Matrix / OpenRouteService** (P1)

- **What:** a routing API for real door-to-door minutes by mode (transit/walk/bike/drive) instead of
  the surveyor's heuristic estimates. OpenRouteService (free key, OSM-based) for walk/bike/drive;
  Google Distance Matrix (needs billing) for reliable public-transit times.
- **Data flow in:** best `location_guesses` coords (or claimed pin) + each `commuteTargets[].address`
  coords → minutes. **Out:** `commutes.minutes` + `commutes.basis` (now "routed via ORS transit,
  10:30 depart" instead of a heuristic).
- **Touches:** `commutes`, `intake/surveyor` (which currently computes commutes heuristically),
  `CommuteChips`. A new `api/route-time/POST.ts` or a surveyor-callable path.
- **Value:** commute minutes are the #1 hard filter for most hunters; making them *real* (and cited)
  is a step-change in trust. Keep the surveyor's cited-basis discipline — routed time still labels
  its assumptions (departure time, mode).
- **How:** `api/` handler with the key in pod env; cache per (guess, target) pair since coords rarely
  change; fall back to the existing heuristic when the key is absent (graceful degradation).

### 3.3 Email intake — **inbound forwarding address (Postmark / Cloudflare Email Routing)** (P1)

- **What:** give each search a unique inbound email address (e.g. `homes+<searchId>@…`) so users
  *forward* portal alert emails instead of copy-pasting bodies.
- **Data flow in:** forwarded email → inbound webhook → parsed body. **Out:** a `raw_captures` row
  (`status: 'pending'`) which re-enters the existing `parse-new-capture` pipeline unchanged.
- **Touches:** `sources` (a new/auto `alert_email` source per sender), `raw_captures`, and a
  **gateway** endpoint (the pod isn't publicly addressable for inbound mail, so per the repo's
  backend rule this webhook lands in `cloud/gateway/` and relays to the pod, or writes via the
  authenticated app API). The clipper's `parseAlertEmail` already handles the body format.
- **Value:** removes the single biggest chore — no more selecting-and-pasting an email body. This is
  the highest-leverage intake integration.
- **How:** Cloudflare Email Routing or Postmark inbound → HTTPS webhook → gateway → `ingestCapture`.
  Auth via a per-search secret token embedded in the plus-address. Still opt-in (user enables
  forwarding for a search).

### 3.4 Calendar — **Google Calendar / .ics** for viewings (P1)

- **What:** when a listing moves to `status: 'viewing'`, create/offer a calendar event; export the
  shortlist's viewings as an `.ics`.
- **Data flow in:** none required (or read free/busy to suggest slots). **Out:** an event with the
  listing title, address/best-guess area, price, url, and the `scoreSummary` in the notes.
- **Touches:** `listings.status` transitions (in `updateListing`), a new `api/listings/:id/ics/GET.ts`
  returning an `.ics` file (no OAuth needed for download); Google Calendar add-to-calendar link as a
  zero-integration first step.
- **Value:** viewings are the real-world action the whole app funnels toward; putting them on a
  calendar with the reasoning attached closes the loop.
- **How:** start with a generated `.ics` / Google add-event URL (no auth, ship immediately); full
  two-way sync via Google Calendar OAuth is a P2.

### 3.5 Mortgage & FX — **rate feeds + exchangerate.host** (P1)

- **What:** for `mode: 'buy'`, the surveyor's mortgage estimate should use a *cited current rate*,
  not a baked constant; for cross-currency searches, normalize `currency` mismatches.
- **Data flow in:** a public mortgage-rate reference (ECB / national bank series, or a curated feed)
  + FX rates from exchangerate.host. **Out:** `listings.costBreakdown` line items gain a real
  `rateSource` (the charter already demands one) and `trueCostMonthly` reflects today's rate.
- **Touches:** `intake/surveyor`, `listings.trueCostMonthly`/`costBreakdown`. A `api/rates/GET.ts`
  (`getRates`) cached daily via cron.
- **Value:** the "true cost" promise is only as honest as its rate assumption; sourcing it live and
  citing it is exactly the surveyor's stated principle.
- **How:** daily cron caches rates to a small `rates` table or onto the search; surveyor reads them.

### 3.6 Notifications — **push / email / Telegram** for alerts (P0)

- **What:** deliver `new_match` / `price_drop` / `gone` alerts *outside* the app (the whole value is
  speed).
- **Data flow out:** an `alerts` insert → notification. **In:** delivery receipts (optional).
- **Touches:** `alerts` (a db-insert hook on `alerts` → notify), a user-settings store for the
  channel. Web Push (VAPID, no third party) is the cleanest first channel; email via the gateway;
  Telegram bot as a power-user option.
- **Value:** turns "act before someone else" from aspiration into reality — you get pinged in
  minutes, not when you next open the tab.
- **How:** a new **db hook** `on: { table: 'alerts', event: 'insert' }` → notify handler. Web Push
  needs a service worker in the SPA + VAPID keys in pod/gateway env; email/Telegram relay through the
  gateway.

### 3.7 Neighborhood data — **Tavily web search + Overpass (OSM POIs)** (P2)

- **What:** enrich the neighborhood read (§2.7) with concrete POIs — nearest metro, supermarket,
  park, school — from OpenStreetMap Overpass, plus qualitative context from Tavily.
- **Touches:** a new `area_notes` (or listing-level) cache table, listing detail. **Value:**
  answers "what's it actually like to live here" without ten map tabs. **How:** Overpass query
  around the best guess coords in an `api/` handler; cache aggressively (POIs are static).

### 3.8 Smart-home / utilities (P2, explicitly out of core scope)

Utilities/energy APIs (e.g. an EPC/energy-rating lookup where public) could sharpen the utilities
line in `costBreakdown` for a specific market. This is market-specific and low-priority vs. the above
— note it, don't build it yet.

---

## 4. Its own agent chat to control the whole application

Today's three `<Chat>` widgets are **scoped**: `intake/clipper` (inbox), `scout/analyst` (one
listing), `scout/ranker` (taste). None can *navigate the app or act across it* — you can't say "pause
my Lisbon search and shortlist everything under €1,700 with a sub-30 commute" in one place. The
proposal is a new **`concierge`** agent + a persistent, app-wide chat dock that drives the entire
`homes` surface.

### 4.1 Where it lives (P0)

- A new space **`spaces/concierge/agents/concierge/`** (charter + instruct), embedded via
  `<Chat agent="concierge/concierge" />` in a **persistent right-side dock** added to `_layout.tsx`
  (collapsible, remembers open/closed), so it's available on every page — mirroring the studio THING
  dock pattern. On mobile it's a full-screen sheet toggled from the nav.
- It **complements, not duplicates** the scoped chats: the scoped chats stay for deep, in-context
  work (correct this taste note, interrogate this listing). The concierge is the *orchestrator and
  navigator* — it reads across all tables, takes bulk/cross-cutting actions, and hands off to the
  specialists (via `delegate`) for the deep work.

### 4.2 Capabilities (least-privilege, per the capability model)

```yaml
# spaces/concierge/agents/concierge/instruct.md (frontmatter)
capabilities:
  - db:read:  { tables: [searches, sources, raw_captures, listings, listing_analyses,
                         location_guesses, commutes, taste_signals, taste_notes, alerts] }
  - db:write: { tables: [searches, listings, taste_signals, alerts, sources] }
  - api:call: { allow: [createSearch, updateSearch, ingestCapture, saveListing,
                        dismissListing, updateListing, addSource, updateSource,
                        pollSource, compareListings, markAlertRead] }
canDelegateTo:
  - scout/ranker#learn
  - scout/ranker#review
  - scout/analyst#analyze
  - intake/clipper#parse
```

Rationale: it reads everything (it's a concierge over the whole app), but its **writes go through
the typed `api:call` handlers** wherever one exists — so it inherits ajv validation and the same
invariants the UI uses, rather than poking raw rows. Direct `db:write` is reserved for bulk reads-
then-writes that have no single endpoint (e.g. batch status changes). It **delegates** the genuinely
hard reasoning to the specialists instead of re-implementing it.

### 4.3 What it can do

**Read / explain (no confirmation):**
- "What needs my attention across all my searches?" → reads `alerts` + top-scored `listings`,
  summarizes.
- "Why did the Anjos flat score 62?" → reads `scoreSummary` + `listing_analyses`, explains.
- "How's the Lisbon hunt going?" → the digest (§2.1) on demand.
- "What have I been dismissing?" → reads `taste_signals`, reflects the pattern back ("you've passed
  on 4 ground-floor units").

**Act — reversible (light confirmation / toast with undo):**
- "Shortlist everything under €1,700 with a sub-30-min office commute" → filters `listingFeed`,
  calls `updateListing` per match, reports "shortlisted 5" with an undo.
- "Pause my Berlin search" → `updateSearch({ status: 'paused' })`.
- "Add this saved-search URL as a source and poll it every 12h" → `addSource` + `updateSource`.
- "Dismiss the ground-floor ones and tell the ranker why" → `dismissListing` with reason (→ feeds
  taste learning) + `delegate('scout/ranker','learn')`.
- "Compare the top 3 and tell me which to see first" → `compareListings` + `delegate('scout/ranker',
  'review')`, renders the verdict inline.

**Act — destructive (explicit confirm required):**
- "Delete the Porto search" → **must** surface a `ConfirmDelete` ask component (it cascades to
  listings/alerts/etc.); never fire `deleteSearch` without an explicit yes. (Note: `deleteSearch` is
  deliberately *not* in the `api:call` allow-list above — deletion routes through an explicit confirm
  flow, not a chat one-liner.)
- Any bulk write over N rows → show the affected set first, act on confirm.

### 4.4 Surfacing results in the UI (P1)

The concierge shouldn't just talk — it should *drive*:
- **Navigation actions:** it can emit a `navigate('/searches/:id/compare')`-style intent so "compare
  the top 3" opens the compare page pre-selected. (Wire via a small action protocol the dock
  interprets — the chat proposes, the page reacts.)
- **Rich result cards:** bulk actions render a compact result component (the 5 shortlisted listings
  as mini-cards with undo), reusing `ListingCard` in a condensed variant — not a wall of text.
- **Live reflection:** because actions go through the same `api:call` handlers the pages use, the
  feed/taste views (which already `invalidate`/poll) update automatically — the concierge acting and
  the page refreshing feel like one motion.

### 4.5 Safety & confirmation model (P0)

- **Read is free; reversible writes toast-with-undo; destructive writes require an explicit ask
  component.** This maps to the capability grant above (no `deleteSearch` in `api:call`).
- **Bulk actions preview before executing** — the concierge lists the affected rows and waits for
  confirmation (`ask`), so "dismiss everything over budget" can't silently nuke 30 listings.
- **Every taste-affecting action stays inspectable** — a chat-driven dismiss still writes a
  `taste_signals` row with the stated reason, so the taste page keeps its "nothing is a black box"
  promise; the concierge explains *what it will change* in the taste model before it does.
- **Scope containment:** the concierge only ever operates within the user's own `homes` data (the
  pod is the security boundary); it has no `pages:write`/`api:write`/`hooks:write`/`project:manage` —
  it *uses* the app, it can't *rewrite* it.

### 4.6 Example conversation

```
You:  How's my Lisbon hunt and what should I do today?
CC:   3 new matches since yesterday and a €90/mo price drop on a shortlisted flat.
      Top new match: "Bright 2-bed, Anjos" — 88, €1,680 all-in, 22-min transit to the
      office, flag: possible size_overstated (floor plan sums to 71m² vs 85 stated).
      [card] [Open] [Save] [Dismiss]
You:  Save it, and shortlist anything else over 80 under budget.
CC:   Saved "Bright 2-bed, Anjos". Found 2 more over-80 under €1,700 — shortlist both?
      • "Quiet corner, Alameda" (84)  • "Top-floor, Arroios" (81)   [Confirm] [Cancel]
You:  yes
CC:   Shortlisted 2. [Undo]  Want me to compare all 3 and suggest a viewing order?
You:  yes
CC:   (delegates scout/ranker#review) → opens Compare with the 3 selected and writes:
      "See Alameda first — best light + 18-min commute; Anjos second (verify the size at
      the viewing); Arroios is cheapest but on a noisy street per its own description."
```

### 4.7 Priority

- **P0:** the `concierge` space + persistent dock + read/explain + reversible single-row actions +
  the safety/confirm model.
- **P1:** bulk actions with preview, navigation intents, rich result cards, delegate-to-specialist
  handoffs.
- **P2:** proactive concierge (it opens the dock on login with "here's what changed overnight",
  driven by the digest hook).

---

## 5. Suggested sequencing (rollup)

**Now (P0):** real global alerts bell + popover (1.1); feed sort/filter + score-first cards +
optimistic + reason-first dismiss (1.3); skeletons & actionable capture/error states (1.7);
mobile + a11y pass (1.8); search-level digest cron (2.1); reason-first dismiss everywhere (2.3);
Nominatim geocoding + map render (3.1); out-of-app alert notifications via `alerts` insert hook
(3.6); the `concierge` agent + dock with read + reversible actions + safety model (4.1–4.5).

**Next (P1):** dashboard command center (1.2); two-column listing detail + analyses timeline (1.4);
compare winner-highlight + verdict (1.5); brief→structured extraction (1.6/2.2); shortlist review
(2.4); smarter dedupe/extraction (2.5); routed commute times (3.2); inbound email forwarding (3.3);
calendar `.ics` (3.4); live mortgage/FX rates (3.5); concierge bulk actions + nav intents (4.4/4.6).

**Later (P2):** neighborhood POIs/Overpass (3.7); market context caching (2.7); vision-based photo
analysis *if/when a vision tier is wired into the runtime* (revisits the analyst's text-only
constraint); proactive concierge (4.7); utilities/energy data (3.8).

Every item above reuses the existing tables, endpoints, agents, hooks, and the `@app/runtime` +
design-token + inline-SVG conventions the app already follows — nothing here requires a new runtime
primitive except the two explicitly gated Later items (vision, richer inbound mail infra in the
gateway).
