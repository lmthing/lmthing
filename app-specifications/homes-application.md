# lmthing.homes as a Project-Application — the `homes` project

> A concrete instantiation of [the project-as-application model](../org/format/project/README.md) for an
> **AI-assisted home finder** for renters and buyers: every listing you're tracking lands in one
> place — not by scraping portals, but by ingesting the sources you already use (forwarded alert
> emails, saved searches, links you paste). An **`intake`** space cleans each capture into a single
> comparable record (true cost, real size, commute times); a **`scout`** space is the intelligence —
> it learns your taste from what you save and dismiss, reads listings for what the description hides,
> flags photo/text mismatches, and triangulates a fuzzed map pin into a confidence-scored location
> guess. Around that the app acts as an assistant: instant alerts, side-by-side comparisons, a
> shortlist pipeline, drafted inquiry messages, and viewing checklists — so you can act before
> someone else does. The `homes` project owns the app — `database/` (searches, sources, captures,
> listings, analyses, guesses, commutes, taste, alerts), `pages/` (client React feed / detail /
> compare), `api/` (named typed Node endpoints), `hooks/` (the ingest→enrich→rank pipeline), and the
> two project-scoped spaces. Read the parent plan first for the shared mechanisms (capability
> globals, typed-contract pipeline, serving); this file is the homes-specific shape. Paths are
> relative to the org repo root.

## Context

Hunting for a home is a second job done in the worst tooling imaginable: five portal tabs, an inbox
full of alert emails, a spreadsheet nobody keeps up to date, and listings that lie a little — a
"cozy" 52 m² that measures 44, a price that omits €180/month of fees, a map pin dropped three blocks
from the actual building, photos of a kitchen renovated fifteen years ago and shot with a wide-angle
lens. A user writes *"2-bed rental in Lisbon under €1,600, must be bright, 30 min to the office"*
and the app does the grunt work: every alert email they forward-paste and every link they drop is
parsed into **one canonical, comparable record** — all-in true monthly cost, stated vs. measured
size, commute minutes to the places they care about — then analyzed (condition, light, layout red
flags, photo/text contradictions), pinned to a **confidence-scored location guess**, and **ranked by
a taste model learned from their own saves and dismisses**. The best new match surfaces as an alert
within minutes of pasting, with a drafted inquiry ready to approve. **The value is turning listing
triage into a conversation** — the agents do the reading, measuring, and cross-checking; the user
makes the calls. Crucially, the app does **no blind portal crawling**: paste-first is the default —
it ingests content the user already receives and explicitly hands it (pasted alert-email bodies,
pasted links, saved-search pages) — and, **opt-in per source**, it can politely poll the specific
saved-search URLs the user configures (robots-aware, throttled, personal-scale; see §The `intake`
space "Scraping toolkit"). (There is no `homes/` domain today — `lmthing.casa` is the unrelated
Home-Assistant product — so this is a net-new project-application served under the generic
`lmthing.app/homes/` mount, exactly like `trips`.)

## The project

- **Project id**: `homes`. One per user pod (a home search is personal data). A user can run many
  concurrent **searches** as rows ("Lisbon 2-bed rental", "Porto 3-bed buy"); the *project* is the
  finder app, not a single search.
- **Project-scoped spaces** (≥2 from round 1): `homes/spaces/intake/` (the pipeline that turns raw
  captures into clean canonical listings — `clipper`, `surveyor`) and `homes/spaces/scout/` (the
  intelligence layer — `analyst`, `locator`, `ranker`). Because the db is **project-rooted**, all
  five agents read/write the **same** tables and feed the **same** pages (the multi-agent-application
  shape). Expansion rounds 2–6 add the **`advisor`**, **`district`**, **`finance`**, **`household`**,
  and **`closer`** spaces in order (§Additional features) — 7 spaces / 20 agents at end state, all
  on the one db.
- **THING** builds/evolves the app by delegating to `system-appbuilder` (parent plan
  §"system-appbuilder"); **runtime** work is the `intake`/`scout` agents, driven by api handlers,
  hooks, and chat — not THING.
- **Provisioning**: v1 seeds the `homes` project from a checked-in template materialized into the
  pod's `<root>/homes/`. In a **later phase** it becomes **installable from lmthing.store** as a
  project app (parent plan §Risks "Distribution").

## Directory layout

```
homes/
├── package.json              # react, @lmthing/{ui,css} …
├── database/
│   ├── searches.json         # a home search — the brief, budget, commute targets
│   ├── sources.json          # where captures come from (alert email, saved search, pasted link)
│   ├── raw_captures.json     # one raw ingested payload (pasted text / link), pre-parse
│   ├── listings.json         # THE canonical comparable record (deduped, true cost, score)
│   ├── listing_analyses.json # a scout finding per listing (photos/floorplan/mismatch)
│   ├── location_guesses.json # triangulated pin: lat/lng + radius + confidence + method
│   ├── commutes.json         # computed minutes per listing per commute target
│   ├── taste_signals.json    # save/dismiss/contact events — the raw preference evidence
│   ├── taste_notes.json      # the learned taste model, in cited natural-language statements
│   └── alerts.json           # in-app alerts: new match / price drop / gone
├── pages/                    # client-side React SPA
│   ├── _app.tsx              # QueryClient + design-system theme provider
│   ├── _layout.tsx           # nav chrome: Searches · New Search · alert bell
│   ├── index.tsx             # "/"                        → searches list
│   ├── new.tsx               # "/new"                     → describe-a-search form
│   └── searches/
│       ├── [searchId].tsx            # "/searches/:searchId"          → the ranked feed
│       ├── [searchId]/inbox.tsx      # "/searches/:searchId/inbox"    → paste captures, sources, parse status
│       ├── [searchId]/compare.tsx    # "/searches/:searchId/compare"  → side-by-side comparison
│       └── [searchId]/taste.tsx      # "/searches/:searchId/taste"    → the learned taste profile + chat
│   └── listings/
│       └── [id].tsx          # "/listings/:id"            → listing detail: analyses, guess, commutes, chat
├── components/               # ListingCard, ScoreBadge, FlagChips, TrueCostBreakdown, CompareTable…
├── api/
│   ├── searches/
│   │   ├── GET.ts                    # searchList
│   │   ├── POST.ts                   # createSearch
│   │   └── [id]/
│   │       ├── GET.ts                # getSearch      (include sources)
│   │       ├── PATCH.ts              # updateSearch
│   │       ├── DELETE.ts             # deleteSearch   (cascades everything)
│   │       ├── sources/POST.ts       # addSource
│   │       ├── captures/POST.ts      # ingestCapture  (fires the parse hook — THE entry point)
│   │       ├── captures/GET.ts       # listCaptures
│   │       ├── listings/GET.ts       # listingFeed    (ranked, filterable)
│   │       ├── compare/GET.ts        # compareListings
│   │       ├── taste/GET.ts          # tasteProfile
│   │       └── alerts/GET.ts         # listAlerts
│   ├── listings/
│   │   └── [id]/
│   │       ├── GET.ts                # getListing     (include analyses + guesses + commutes + signals)
│   │       ├── PATCH.ts              # updateListing  (shortlist pipeline moves)
│   │       ├── save/POST.ts          # saveListing    (taste signal + shortlist)
│   │       └── dismiss/POST.ts       # dismissListing (taste signal + reason — the learning gold)
│   ├── sources/
│   │   └── [id]/
│   │       ├── PATCH.ts              # updateSource   (opt polling in/out, interval, label)
│   │       └── poll/POST.ts          # pollSource     (manual "check now" — spawns the poller)
│   └── alerts/
│       └── [id]/PATCH.ts             # markAlertRead
├── hooks/
│   ├── parse-new-capture.ts          # database  raw_captures:insert → intake/clipper#parse
│   ├── enrich-new-listing.ts         # database  listings:insert → the whole scout pipeline (one hook)
│   ├── learn-from-signal.ts          # database  taste_signals:insert → scout/ranker#learn
│   ├── refresh-tracked-listings.ts   # cron 6h → intake/clipper#refresh (gone / price-drop detection)
│   └── poll-saved-searches.ts        # cron 6h → intake/clipper#poll (opt-in saved-search polling)
├── spaces/
│   ├── intake/               # project-scoped space: clipper + surveyor (full space format)
│   │   ├── agents/clipper/{charter.md,instruct.md}
│   │   ├── agents/surveyor/{charter.md,instruct.md}
│   │   ├── tasklists/parse-captures/…
│   │   ├── functions/ knowledge/ components/
│   └── scout/                # project-scoped space: analyst + locator + ranker (full space format)
│       ├── agents/analyst/{charter.md,instruct.md}
│       ├── agents/locator/{charter.md,instruct.md}
│       ├── agents/ranker/{charter.md,instruct.md}
│       ├── tasklists/learn-taste/…
│       ├── functions/ knowledge/ components/
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
// database/searches.json
{ "title": "Home searches",
  "description": "One home search the user is running — the brief, hard constraints, and commute targets everything else hangs off.",
  "columns": {
    "id":             { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "title":          { "type": "string", "description": "short name shown in the list, e.g. 'Lisbon 2-bed rental'", "required": true },
    "brief":          { "type": "string", "description": "the user's original free-text description of what they want ('bright, quiet street, near a park…')" },
    "mode":           { "type": "string", "description": "'rent' | 'buy' — decides how true cost is computed", "required": true },
    "area":           { "type": "string", "description": "free-text target area(s), e.g. 'Lisbon: Arroios, Alameda, Anjos'" },
    "budgetMax":      { "type": "number", "description": "hard budget cap — monthly all-in for rent, total price for buy", "required": true },
    "budgetMin":      { "type": "number", "description": "optional lower bound (filters obvious mistakes / too-good-to-be-true)", "default": 0 },
    "currency":       { "type": "string", "description": "ISO currency code for the budget, e.g. 'EUR'", "default": "USD" },
    "minRooms":       { "type": "number", "description": "minimum number of rooms (0 = no constraint)", "default": 0 },
    "minAreaSqm":     { "type": "number", "description": "minimum usable size in m² (0 = no constraint)", "default": 0 },
    "mustHaves":      { "type": "json",   "description": "array of hard-requirement strings, e.g. ['elevator','pets allowed'] — a listing failing one is capped, never top-ranked" },
    "commuteTargets": { "type": "json",   "description": "array of { label, address, mode:'transit'|'walk'|'bike'|'drive', maxMinutes } the surveyor computes commutes against" },
    "status":         { "type": "string", "description": "'active' (ingesting + alerting) or 'paused'", "default": "active" },
    "createdAt":      { "type": "date",   "description": "when the search was created", "generated": "now" } },
  "relations": {
    "sources":  { "hasMany": "sources",       "via": "searchId", "description": "where this search's captures come from" },
    "listings": { "hasMany": "listings",      "via": "searchId", "description": "the canonical listings tracked for this search" },
    "signals":  { "hasMany": "taste_signals", "via": "searchId", "description": "the user's save/dismiss history" },
    "notes":    { "hasMany": "taste_notes",   "via": "searchId", "description": "the learned taste statements" },
    "alerts":   { "hasMany": "alerts",        "via": "searchId", "description": "alerts raised for this search" } } }
```

```json
// database/sources.json
{ "title": "Sources",
  "description": "A place captures come from — an alert email the user forwards, a saved-search page, or ad-hoc pasted links. Paste-first by default; a 'saved_search' source with a URL can be opted into polite polling (robots-aware, throttled).",
  "columns": {
    "id":             { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "searchId":       { "type": "string", "description": "the search this source feeds", "required": true,
                        "references": { "table": "searches", "column": "id", "onDelete": "cascade" } },
    "kind":           { "type": "string", "description": "'alert_email' | 'saved_search' | 'pasted_link' | 'manual' — only 'saved_search' sources are pollable", "required": true },
    "label":          { "type": "string", "description": "human name, e.g. 'Idealista daily alert'", "required": true },
    "url":            { "type": "string", "description": "the saved-search or portal URL, if any — the ONLY thing the poller ever fetches (plus its result pages); required for polling" },
    "pollEnabled":    { "type": "boolean","description": "opt-in: whether the poll-saved-searches cron may fetch this source's url", "default": false },
    "pollIntervalHours": { "type": "number", "description": "hours between polls (min 6 — enforced by the clipper's politeFetchPlan)", "default": 12 },
    "lastPolledAt":   { "type": "date",   "description": "when the poller last fetched this source" },
    "blockedReason":  { "type": "string", "description": "why polling stopped, if it did — robots disallow, repeated fetch failures, or a block page; surfaced to the user, polling auto-disabled" },
    "notes":          { "type": "string", "description": "anything the clipper should know about this source's format" },
    "lastIngestedAt": { "type": "date",   "description": "when a capture from this source was last parsed" },
    "createdAt":      { "type": "date",   "description": "when the source was added", "generated": "now" } },
  "relations": {
    "search":   { "belongsTo": "searches",     "via": "searchId", "description": "the parent search" },
    "captures": { "hasMany":   "raw_captures", "via": "sourceId", "description": "raw payloads ingested from this source" } } }
```

```json
// database/raw_captures.json
{ "title": "Raw captures",
  "description": "One raw ingested payload — the pasted body of an alert email, the pasted text of a saved-search results page, or a pasted link. The clipper parses each into zero or more canonical listings.",
  "columns": {
    "id":            { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "sourceId":      { "type": "string", "description": "the source this capture came from", "required": true,
                       "references": { "table": "sources", "column": "id", "onDelete": "cascade" } },
    "searchId":      { "type": "string", "description": "the search this capture feeds (mirrors the source's search so agents can scan directly — db.query where is equality-only)", "required": true,
                       "references": { "table": "searches", "column": "id", "onDelete": "cascade" } },
    "content":       { "type": "string", "description": "the pasted text — email body, page text, or a bare URL", "required": true },
    "sourceUrl":     { "type": "string", "description": "optional URL the clipper may webFetch for the full listing" },
    "status":        { "type": "string", "description": "'pending' | 'parsing' | 'parsed' | 'error'", "default": "pending" },
    "summary":       { "type": "string", "description": "md — what the clipper extracted (n listings found, m merged into existing records)" },
    "error":         { "type": "string", "description": "why parsing failed, when status = 'error'" },
    "listingsFound": { "type": "number", "description": "how many listings this capture yielded (new + merged)", "default": 0 },
    "capturedAt":    { "type": "date",   "description": "when the user pasted it", "generated": "now" } },
  "relations": {
    "source": { "belongsTo": "sources",  "via": "sourceId", "description": "where it came from" },
    "search": { "belongsTo": "searches", "via": "searchId", "description": "the search it feeds" } } }
```

```json
// database/listings.json
{ "title": "Listings",
  "description": "THE canonical, comparable record of one home — deduped across portals, normalized to true cost and real size, analyzed, located, and scored. Everything the app knows about a place hangs off this row.",
  "columns": {
    "id":              { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "searchId":        { "type": "string", "description": "the search tracking this listing", "required": true,
                         "references": { "table": "searches", "column": "id", "onDelete": "cascade" } },
    "dedupeKey":       { "type": "string", "description": "canonical identity computed by the intake dedupeKey() function (normalized address + rooms + size band + price band) — the same unit cross-posted on two portals merges into one row", "required": true, "unique": true },
    "title":           { "type": "string", "description": "the listing headline as captured", "required": true },
    "url":             { "type": "string", "description": "canonical listing URL (the best of the merged duplicates)" },
    "portal":          { "type": "string", "description": "site(s) it was seen on, comma-joined, e.g. 'idealista, imovirtual'" },
    "priceAmount":     { "type": "number", "description": "the stated asking price — monthly rent (mode 'rent') or total price (mode 'buy')", "required": true },
    "currency":        { "type": "string", "description": "ISO currency code of priceAmount", "default": "USD" },
    "trueCostMonthly": { "type": "number", "description": "the all-in monthly cost the surveyor computed (rent + condo fees + utilities estimate; buy: mortgage estimate + charges). 0 = not yet computed", "default": 0 },
    "costBreakdown":   { "type": "json",   "description": "array of { label, amount, basis:'stated'|'estimated', note } line items behind trueCostMonthly — every estimate is labelled, never silently blended" },
    "address":         { "type": "string", "description": "the address AS STATED by the listing (often vague — the real guess lives in location_guesses)" },
    "claimedLat":      { "type": "number", "description": "the portal's (often fuzzed) map pin latitude, if captured" },
    "claimedLng":      { "type": "number", "description": "the portal's (often fuzzed) map pin longitude, if captured" },
    "areaSqm":         { "type": "number", "description": "size in m² as stated by the listing", "default": 0 },
    "measuredAreaSqm": { "type": "number", "description": "size the analyst re-derived (sum of per-room dimensions from the floor plan / listing text). 0 = not derivable", "default": 0 },
    "rooms":           { "type": "number", "description": "total rooms as stated", "default": 0 },
    "bedrooms":        { "type": "number", "description": "bedrooms as stated", "default": 0 },
    "floor":           { "type": "string", "description": "floor / storey as stated, e.g. '3º, elevator'" },
    "yearBuilt":       { "type": "number", "description": "construction year if stated (0 = unknown)", "default": 0 },
    "description":     { "type": "string", "description": "the cleaned listing description, markdown, SANITIZED on ingest (captures are untrusted content)" },
    "photoUrls":       { "type": "json",   "description": "array of photo/floor-plan URLs as captured (with any caption text preserved alongside each: { url, caption })" },
    "flags":           { "type": "json",   "description": "merged analysis flags, e.g. ['dated_kitchen','poor_light','size_overstated','photo_text_mismatch','fuzzed_pin'] — written by the scout analyst, rendered as chips on the feed" },
    "score":           { "type": "number", "description": "taste-ranked relevance 0..100 written by the ranker; higher = better match. 0 = not yet ranked", "default": 0 },
    "scoreSummary":    { "type": "string", "description": "md — WHY it scored what it did, citing the taste notes and hard constraints it hit/missed" },
    "status":          { "type": "string", "description": "the shortlist pipeline: 'new' | 'shortlisted' | 'contacted' | 'viewing' | 'applied' | 'dismissed' | 'gone'", "default": "new" },
    "dismissedReason": { "type": "string", "description": "the user's stated reason on dismiss — the highest-value taste evidence" },
    "firstSeenAt":     { "type": "date",   "description": "when the listing first entered the app", "generated": "now" },
    "lastSeenAt":      { "type": "date",   "description": "last time a capture or the refresh cron confirmed it live" } },
  "relations": {
    "search":   { "belongsTo": "searches",         "via": "searchId",  "description": "the parent search" },
    "analyses": { "hasMany":   "listing_analyses", "via": "listingId", "description": "scout findings for this listing" },
    "guesses":  { "hasMany":   "location_guesses", "via": "listingId", "description": "triangulated location guesses" },
    "commutes": { "hasMany":   "commutes",         "via": "listingId", "description": "computed commute times" },
    "signals":  { "hasMany":   "taste_signals",    "via": "listingId", "description": "user actions on this listing" } } }
```

```json
// database/listing_analyses.json
{ "title": "Listing analyses",
  "description": "One scout finding about a listing — a photo/condition read, a floor-plan measurement, or a description-vs-evidence mismatch check. Always cited to what was actually observed; never invented.",
  "columns": {
    "id":         { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "listingId":  { "type": "string", "description": "the listing analyzed", "required": true,
                    "references": { "table": "listings", "column": "id", "onDelete": "cascade" } },
    "kind":       { "type": "string", "description": "'photos' (condition/light/staging read) | 'floorplan' (measured size + layout red flags) | 'mismatch' (description vs photos/plan/fields contradictions)", "required": true },
    "body":       { "type": "string", "description": "md — the findings, each cited to its evidence ('caption on photo 4 says…', 'room dims sum to 71 m² vs 85 stated')", "required": true },
    "flags":      { "type": "json",   "description": "machine-readable flags this analysis contributes, merged into listings.flags" },
    "confidence": { "type": "number", "description": "0..1 — how sure the analyst is; low-confidence findings are phrased as questions to verify at a viewing, not facts", "default": 0 },
    "createdAt":  { "type": "date",   "description": "when the analysis ran", "generated": "now" } },
  "relations": {
    "listing": { "belongsTo": "listings", "via": "listingId", "description": "the listing analyzed" } } }
```

```json
// database/location_guesses.json
{ "title": "Location guesses",
  "description": "A triangulated guess of where the place REALLY sits, from the fuzzed pin + textual clues (street mentions, 'X min from <metro>', named amenities). Always advisory — a confidence-scored guess, never presented as the true address.",
  "columns": {
    "id":         { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "listingId":  { "type": "string", "description": "the listing being located", "required": true,
                    "references": { "table": "listings", "column": "id", "onDelete": "cascade" } },
    "lat":        { "type": "number", "description": "guessed latitude", "required": true },
    "lng":        { "type": "number", "description": "guessed longitude", "required": true },
    "radiusM":    { "type": "number", "description": "uncertainty radius in meters — the guess means 'within this circle'", "required": true },
    "confidence": { "type": "number", "description": "0..1 — how much the clues agree", "required": true },
    "method":     { "type": "string", "description": "md — the clues used and how they intersect ('pin center ∩ \\'2 min from Anjos metro\\' ∩ street name in photo 2 caption'), each cited", "required": true },
    "createdAt":  { "type": "date",   "description": "when the guess was made", "generated": "now" } },
  "relations": {
    "listing": { "belongsTo": "listings", "via": "listingId", "description": "the listing located" } } }
```

```json
// database/commutes.json
{ "title": "Commutes",
  "description": "A computed commute estimate from a listing to one of the search's commute targets. Estimates are cited and approximate (±), based on the best available location guess.",
  "columns": {
    "id":          { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "listingId":   { "type": "string", "description": "the listing commuted from", "required": true,
                     "references": { "table": "listings", "column": "id", "onDelete": "cascade" } },
    "targetLabel": { "type": "string", "description": "which search commuteTargets entry this answers (matched by label)", "required": true },
    "mode":        { "type": "string", "description": "'transit' | 'walk' | 'bike' | 'drive'", "required": true },
    "minutes":     { "type": "number", "description": "estimated door-to-door minutes", "required": true },
    "basis":       { "type": "string", "description": "md — how it was estimated and from which location (guess vs claimed pin), cited", "required": true },
    "computedAt":  { "type": "date",   "description": "when it was computed", "generated": "now" } },
  "relations": {
    "listing": { "belongsTo": "listings", "via": "listingId", "description": "the listing" } } }
```

```json
// database/taste_signals.json
{ "title": "Taste signals",
  "description": "The raw preference evidence — one user action on a listing. Saves, dismisses (with reasons), and contacts are what the ranker learns from.",
  "columns": {
    "id":        { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "searchId":  { "type": "string", "description": "the search the signal belongs to", "required": true,
                   "references": { "table": "searches", "column": "id", "onDelete": "cascade" } },
    "listingId": { "type": "string", "description": "the listing acted on (kept when the listing row is merged/removed)",
                   "references": { "table": "listings", "column": "id", "onDelete": "setNull" } },
    "action":    { "type": "string", "description": "'save' | 'dismiss' | 'contact' | 'viewed' | 'note'", "required": true },
    "reason":    { "type": "string", "description": "the user's stated why ('kitchen too dark', 'love the balcony') — the highest-value learning input" },
    "folded":    { "type": "boolean","description": "whether the ranker has folded this signal into taste_notes yet (the learn action's self-scan cursor)", "default": false },
    "createdAt": { "type": "date",   "description": "when the action happened", "generated": "now" } },
  "relations": {
    "search":  { "belongsTo": "searches", "via": "searchId",  "description": "the parent search" },
    "listing": { "belongsTo": "listings", "via": "listingId", "description": "the listing acted on" } } }
```

```json
// database/taste_notes.json
{ "title": "Taste notes",
  "description": "The learned taste model, kept as cited natural-language statements per dimension — inspectable and editable by the user, not an opaque vector. The ranker reads these to score; the taste page shows them.",
  "columns": {
    "id":           { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "searchId":     { "type": "string", "description": "the search this taste belongs to", "required": true,
                      "references": { "table": "searches", "column": "id", "onDelete": "cascade" } },
    "dimension":    { "type": "string", "description": "'style' | 'light' | 'layout' | 'location' | 'building' | 'dealbreaker' | 'other'", "required": true },
    "statement":    { "type": "string", "description": "md — the preference in plain language, cited to the signals that support it ('dismissed 3 ground-floor units — avoids ground floor [s12,s15,s19]')", "required": true },
    "weight":       { "type": "number", "description": "0..1 — how strongly this shifts the score; a dealbreaker is ~1", "default": 0.5 },
    "supportCount": { "type": "number", "description": "how many signals back this statement (evidence, not vibes)", "default": 1 },
    "createdAt":    { "type": "date",   "description": "when the note was first written", "generated": "now" } },
  "relations": {
    "search": { "belongsTo": "searches", "via": "searchId", "description": "the parent search" } } }
```

```json
// database/alerts.json
{ "title": "Alerts",
  "description": "In-app alerts the assistant raises — a strong new match, a price drop on a shortlisted place, a tracked listing gone. Rendered as the bell + an alerts strip; acting fast is the point.",
  "columns": {
    "id":        { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "searchId":  { "type": "string", "description": "the search alerted on", "required": true,
                   "references": { "table": "searches", "column": "id", "onDelete": "cascade" } },
    "listingId": { "type": "string", "description": "the listing concerned, if any",
                   "references": { "table": "listings", "column": "id", "onDelete": "setNull" } },
    "kind":      { "type": "string", "description": "'new_match' | 'price_drop' | 'gone' | 'back_online'", "required": true },
    "title":     { "type": "string", "description": "one-line alert headline", "required": true },
    "body":      { "type": "string", "description": "md — the detail (what changed, why it matters, next action)" },
    "read":      { "type": "boolean","description": "whether the user has seen it", "default": false },
    "createdAt": { "type": "date",   "description": "when it fired", "generated": "now" } },
  "relations": {
    "search":  { "belongsTo": "searches", "via": "searchId",  "description": "the parent search" },
    "listing": { "belongsTo": "listings", "via": "listingId", "description": "the listing concerned" } } }
```

- **`listings.dedupeKey` is `unique`** — the schema enforces what the clipper's dedupe promises: the
  same unit cross-posted on two portals is one row (the clipper checks by key first, merges portal/
  photo/fee data into the existing row, and updates `lastSeenAt`; the unique constraint backs the
  logic, it never silently double-inserts).
- **`onDelete` matters**: deleting a search cascades everything under it; removing a listing
  `setNull`s the taste signals and alerts that referenced it (the learning history survives the
  cleanup — a dismissal is evidence even after the listing is gone).
- **`getListing` returns a nested tree** via `db.query('listings', { where:{id}, include:
  ['analyses','guesses','commutes','signals'] })` — the generated types give
  `Listing & { analyses: ListingAnalysis[]; guesses: LocationGuess[]; … }`, so the detail page reads
  one typed object.

## Pages (client React, file-based routing)

Data comes from the generated typed client `useApi(name, input)` — no pod-side loaders.

| File | Route | Reads / writes |
|---|---|---|
| `pages/index.tsx` | `/` | `searchList` (+ per-search unread-alert count) |
| `pages/new.tsx` | `/new` | `createSearch` (POST) → redirects to the search's `/inbox` |
| `pages/searches/[searchId].tsx` | `/searches/:searchId` | `listingFeed` (ranked; score/flags/true-cost/commute chips; save/dismiss buttons) + `listAlerts` strip |
| `pages/searches/[searchId]/inbox.tsx` | `/searches/:searchId/inbox` | `ingestCapture` (paste box), `listCaptures` (per-row parse status, live-polls while pending), `addSource`, `<Chat agent="intake/clipper">` |
| `pages/searches/[searchId]/compare.tsx` | `/searches/:searchId/compare` | `compareListings` for the checked feed rows — one normalized row per attribute |
| `pages/searches/[searchId]/taste.tsx` | `/searches/:searchId/taste` | `tasteProfile` (the cited notes + recent signals) + `<Chat agent="scout/ranker">` |
| `pages/listings/[id].tsx` | `/listings/:id` | `getListing` (nested), `saveListing`/`dismissListing`/`updateListing`; `<Chat agent="scout/analyst">` |

```tsx
// pages/searches/[searchId].tsx  → "/searches/:searchId"  (the ranked feed)
import type { Listing } from '../../types/generated'
import { useApi, useApiMutation } from '@app/runtime'
import { ListingCard } from '../../components/ListingCard'

export default function Feed({ params }: { params: { searchId: string } }) {
  const { data: listings, isLoading, refetch } = useApi('listingFeed', { id: params.searchId })
  const dismiss = useApiMutation('dismissListing', { invalidates: ['listingFeed'] })
  if (isLoading) return <Spinner />
  return (
    <main>
      {listings.map((l: Listing) => (
        <ListingCard key={l.id} listing={l}
          onDismiss={(reason) => dismiss.mutate({ id: l.id, reason })} />
      ))}
    </main>
  )
}
```

While any capture on the search is still `pending`/`parsing`, the feed and inbox **live-poll**
(TanStack Query `refetchInterval`) so listings appear, then grow flags, a location guess, commute
chips, and finally a score — the same "pages are a live read view of a background loop" property the
sibling apps have. The `ListingCard` renders the score (`text-agent` accent), the flag chips
(`text-destructive` for mismatch/overstated flags), true cost vs. stated price, and per-target
commute minutes — **design tokens only**, no raw colors.

## API (named, typed, Node handlers)

Endpoint = dir, method = filename; each exports `name`/`description`/`Input`/`Output` + default
async handler `(input, { db, spawn, apiCall })`. Dual-addressed (HTTP for the browser, `name` for
agents via `apiCall`).

| name | method + route | I/O sketch |
|---|---|---|
| `searchList` | `GET api/searches` | `{}` → `(Search & { unreadAlerts, newListings })[]` |
| `createSearch` | `POST api/searches` | `{ title, brief, mode, budgetMax, currency?, area?, minRooms?, minAreaSqm?, mustHaves?, commuteTargets? }` → `Search` |
| `getSearch` | `GET api/searches/:id` | `{ id }` → `Search & { sources: Source[] }` |
| `updateSearch` | `PATCH api/searches/:id` | `{ id, …fields }` → `Search` |
| `deleteSearch` | `DELETE api/searches/:id` | `{ id }` → `{ ok }` (cascades everything) |
| `addSource` | `POST api/searches/:id/sources` | `{ id, kind, label, url?, notes? }` → `Source` |
| `ingestCapture` | `POST api/searches/:id/captures` | `{ id, content, sourceUrl?, sourceId? }` → `{ captureId, status:'pending' }` — **THE entry point**; auto-creates a `'manual'` source when none given; the insert fires the parse hook |
| `listCaptures` | `GET api/searches/:id/captures` | `{ id }` → `RawCapture[]` (newest first) |
| `listingFeed` | `GET api/searches/:id/listings` | `{ id, status?, minScore? }` → `Listing[]` — query-all then JS filter/sort (score desc, then firstSeenAt desc) |
| `getListing` | `GET api/listings/:id` | `{ id }` → `Listing & { analyses, guesses, commutes, signals }` |
| `updateListing` | `PATCH api/listings/:id` | `{ id, status?, … }` → `Listing` (pipeline moves; a manual `status` change also writes a `'note'` taste signal) |
| `saveListing` | `POST api/listings/:id/save` | `{ id, reason? }` → `{ ok }` — sets `status:'shortlisted'` + inserts a `'save'` taste signal (fires the learn hook) |
| `dismissListing` | `POST api/listings/:id/dismiss` | `{ id, reason? }` → `{ ok }` — sets `status:'dismissed'` + inserts a `'dismiss'` signal with the reason |
| `compareListings` | `GET api/searches/:id/compare` | `{ id, ids }` (comma-joined) → `{ rows: ComparisonRow[] }` — one normalized row per attribute (true cost, €/m², measured size, commutes, flags, score) across the picked listings |
| `tasteProfile` | `GET api/searches/:id/taste` | `{ id }` → `{ notes: TasteNote[], recentSignals: TasteSignal[] }` |
| `listAlerts` | `GET api/searches/:id/alerts` | `{ id, unreadOnly? }` → `Alert[]` |
| `markAlertRead` | `PATCH api/alerts/:id` | `{ id }` → `{ ok }` |
| `updateSource` | `PATCH api/sources/:id` | `{ id, label?, pollEnabled?, pollIntervalHours?, notes? }` → `Source` (opting polling in/out; clears `blockedReason` on re-enable) |
| `pollSource` | `POST api/sources/:id/poll` | `{ id }` → `{ ok, status:'polling' }` — manual "check now"; spawns `intake/clipper#poll` fire-and-forget (404 via `HttpError` when the source has no `url`) |

```ts
// api/searches/[id]/captures/POST.ts → POST .../api/searches/:id/captures ; name "ingestCapture"
/** Ingest a raw capture (pasted alert email / page text / link) and kick the parse pipeline. */
export const name = 'ingestCapture'
export const description = 'Store a pasted capture for a search and start parsing it into canonical listings in the background; returns immediately.'

export interface Input  {
  /** the search id (path param) */ id: string
  /** the pasted text — email body, results-page text, or a bare URL */ content: string
  /** optional URL to fetch the full listing from */ sourceUrl?: string
  /** optional existing source to attribute this to */ sourceId?: string
}
export interface Output { captureId: string; status: 'pending' }

export default async function handler(
  input: Input,
  ctx: { db: AsyncDbApi },
): Promise<Output> {
  let sourceId = input.sourceId
  if (!sourceId) {
    const manual = await ctx.db.insert('sources', {
      searchId: input.id, kind: 'manual', label: 'Pasted by hand' })
    sourceId = manual.id
  }
  const capture = await ctx.db.insert('raw_captures', {
    sourceId, searchId: input.id,
    content: input.content, sourceUrl: input.sourceUrl, status: 'pending',
  })  // ← this insert fires hooks/parse-new-capture.ts
  return { captureId: capture.id, status: 'pending' }
}
```

- `ingestCapture` **inserts and returns** — the db-hook pipeline does the rest (the parent plan's
  decoupled dispatch). The user stays on the inbox and watches captures flip
  `pending → parsing → parsed (n listings)` live.
- `saveListing`/`dismissListing` are deliberately their own endpoints (not a bare `updateListing`)
  because they carry the **taste signal** — the reason string is the learning gold, and the UI
  prompts for it on dismiss.
- **Error contract + one-shot calls**: handlers throw `HttpError(status, message)` from
  `@app/runtime` (404 on a missing listing/source, 400 rides ajv) — the same `error` shape surfaces
  to the browser and, via `apiCall`, to agents as a retryable yield error. Pages use the bare
  **`apiCall`** for fire-and-forget one-shots (e.g. `markAlertRead` when an alert scrolls into
  view) alongside the `useApi`/`useApiMutation` hooks. Across the app the api surface exercises
  **all five methods** (GET/POST/PATCH/DELETE here; PUT arrives with round 4's
  `setFinanceProfile`).

## Hooks

Homes is a **pipeline app**: one database hook per pipeline stage boundary, shaped to stay inside
the loop-guard depth cap (3). The scout enrichment is deliberately **one imperative hook that
delegates the specialists in sequence**, not a chain of per-table hooks — a chained design
(capture→listing→analysis→score, one hook each) would hit the depth cap on the refresh path.

```ts
// hooks/parse-new-capture.ts — parse each pasted capture
export default {
  type: 'database',
  on: { table: 'raw_captures', event: 'insert' },
  budget: { maxEpisodes: 10 },
  handler: async ({ row, db, delegate }) => {
    if (row.status !== 'pending') return                       // idempotence
    await delegate('intake/clipper', 'parse', { input: { captureId: row.id } })
  },
}
```

```ts
// hooks/enrich-new-listing.ts — the WHOLE scout pipeline, one hook, sequential delegates
export default {
  type: 'database',
  on: { table: 'listings', event: 'insert' },
  budget: { maxEpisodes: 12, maxWallClockMs: 900000 },
  handler: async ({ row, db, delegate }) => {
    // Loop guard note: the clipper's merge-updates never re-fire this (insert only), and this
    // handler's delegates all write OTHER tables (analyses/guesses/commutes/notes/score), so the
    // pipeline cannot cascade back onto itself. Idempotence: skip if already analyzed.
    const existing = db.query('listing_analyses', { where: { listingId: row.id } })
    if (existing.length) return
    await delegate('intake/surveyor', 'normalize', { input: { listingId: row.id } })  // true cost + commutes
    await delegate('scout/analyst',  'analyze',   { input: { listingId: row.id } })  // photos/floorplan/mismatch
    await delegate('scout/locator',  'locate',    { input: { listingId: row.id } })  // triangulate the pin
    await delegate('scout/ranker',   'rank',      { input: { listingId: row.id } })  // score + maybe alert
  },
}
```

```ts
// hooks/learn-from-signal.ts — fold each save/dismiss into the taste model
export default {
  type: 'database',
  on: { table: 'taste_signals', event: 'insert' },
  budget: { maxEpisodes: 8 },
  handler: async ({ row, db, delegate }) => {
    if (row.folded) return                                     // idempotence
    await delegate('scout/ranker', 'learn', { input: { searchId: row.searchId } })
  },
}
```

```ts
// hooks/refresh-tracked-listings.ts — cron: gone / price-drop detection on tracked listings
export default {
  type: 'cron',
  every: '6h',
  trigger: 'intake/clipper#refresh',                           // declarative; self-scans active searches
  budget: { maxEpisodes: 10, maxWallClockMs: 600000 },
}
```

```ts
// hooks/poll-saved-searches.ts — cron: opt-in polite polling of user-configured saved searches
export default {
  type: 'cron',
  every: '6h',
  trigger: 'intake/clipper#poll',    // declarative; self-scans pollEnabled sources due per their interval
  budget: { maxEpisodes: 10, maxWallClockMs: 600000 },
}
```

- **Depth accounting** (why this shape): user `ingestCapture` (depth 0) → `parse-new-capture`
  (depth-1 session) → clipper inserts `listings` → `enrich-new-listing` (depth-2 session) runs the
  entire scout pipeline as sequential delegates inside that one session; its writes (analyses,
  guesses, commutes, score, alerts) fire nothing further. The refresh and poll crons re-ingest via
  new `raw_captures`, adding one level — the pipeline still completes because enrichment never
  relies on a *fourth* hook.
- The ranker's `rank` **writes the `alerts` row itself** when a score crosses the search's bar
  (strong `new_match`) — no separate alert hook, so alerting works even at max depth.
- Cron timing is the parent plan's **crond → hook-run endpoint** mechanism
  (`POST /api/projects/homes/hooks/refresh-tracked-listings/run`); a window missed while the pod was
  down runs once via boot catch-up; local dev uses the in-process fallback tick.

## The `intake` space (agents + capabilities)

The pipeline crew: everything between "user pasted something" and "a clean canonical row exists".

| Agent | `db:read` | `db:write` | universal fns | Role |
|---|---|---|---|---|
| **clipper** | `searches, sources, raw_captures, listings` | `raw_captures, sources, listings, alerts` | `webFetch`, `webSearch` | parse captures into listings (extract, sanitize, dedupe-merge); refresh tracked listings (gone / price-drop → alert); poll opted-in saved-search sources (robots-aware, throttled) |
| **surveyor** | `searches, listings, commutes` | `listings, commutes` | `webFetch`, `webSearch` | normalize: compute `trueCostMonthly` + `costBreakdown` (deterministic space functions), and commute estimates per target |

```yaml
# homes/spaces/intake/agents/clipper/instruct.md frontmatter
title: Listing clipper
capabilities:
  - db:read:  { tables: [searches, sources, raw_captures, listings] }
  - db:write: { tables: [raw_captures, sources, listings, alerts] }
actions:
  - parse      # self-scans pending raw_captures; extracts + dedupes into listings
  - refresh    # self-scans active searches' tracked listings; re-fetches URLs; marks gone / price drops
  - poll       # self-scans pollEnabled sources due per interval; fetch → paginate → parse → raw_captures
```

- **The clipper never invents a field** — a value absent from the capture stays at its default; a
  suspicious one (price wildly off the search's band) is kept but flagged in the capture `summary`.
  All extracted text is **sanitized** on write (captures are untrusted content — XSS surface, parent
  plan §Safety).
- **The scraping toolkit lives in `functions/`, not prose** — deterministic, typed, unit-testable
  extraction the clipper drives with the universal `webFetch`:
  - `parseAlertEmail.ts` — split a pasted alert-email body into per-listing candidate blocks
    (portal-idiom heuristics: title/price/link/size patterns);
  - `parsePortalHtml.ts` — strip boilerplate from a fetched listing page and pull the description,
    structured fields, photo URLs + captions, and the **JSON-LD block**
    (`schema.org/RealEstateListing` etc.) when present — the highest-fidelity source;
  - `extractListingFields.ts` — normalize a candidate into canonical listing columns (price via
    `parseMoney.ts`, m², rooms, floor, year);
  - `paginateSavedSearch.ts` — find the result-card blocks + the next-page URL in a saved-search
    results page (bounded page count per poll);
  - `robotsAllowed.ts` — parse a fetched `robots.txt` and answer path allowance; disallowed ⇒ the
    source gets `blockedReason` + polling auto-disables (surfaced to the user, never silently
    retried);
  - `politeFetchPlan.ts` — turn the due sources into a throttled fetch plan (min interval per
    host, jitter, hard per-run page cap) the `poll` action follows.
  The model classifies and narrates; the functions parse and throttle.
- **Polling is opt-in, per source, and self-limiting** — only `saved_search` sources with a `url`
  and `pollEnabled:true` are ever fetched; `pollIntervalHours` floors at 6; a robots disallow, a
  block page, or repeated failures set `blockedReason` and stop the source. Poll results enter as
  ordinary `raw_captures`, so the parse→enrich pipeline and all its guards apply unchanged.
- **Dedupe is a function, not prose**: `functions/dedupeKey.ts` computes the canonical key
  (normalized address + rooms + size band + price band); the clipper queries by key before every
  insert and **merges** on a hit (union of portals/photos/fees, best URL, `lastSeenAt` bump) — the
  `unique` constraint backs it. A **borderline** match (same street + size band, different price
  band) is not silently merged: in a chat session the clipper raises the
  `components/ask/ConfirmMerge.tsx` **ask component** (merge / keep separate, with the evidence
  side-by-side); in a headless hook run — where `ask` doesn't exist — it keeps the rows separate
  and flags both `possible_duplicate` for the user to resolve later.
- **The surveyor's money math is deterministic**: `functions/trueCost.ts` (rent: rent + stated fees
  + a per-m² utilities estimate; buy: amortized mortgage at a cited reference rate + charges) builds
  `costBreakdown` with every line labelled `stated`/`estimated`. The model narrates; the function
  computes. Commute estimates come from `webSearch`/`webFetch` of transit-directions results, cited
  in `commutes.basis`, computed from the **best location guess** when one exists (re-run after
  `locate` improves it) else the claimed pin.

## The `scout` space (agents + capabilities)

The intelligence layer — what makes this more than a listing bookmark manager.

| Agent | `db:read` | `db:write` | universal fns | Role |
|---|---|---|---|---|
| **analyst** | `listings, listing_analyses, searches` | `listing_analyses, listings` | `webFetch` | read the listing against itself: condition/light/staging from photo captions + description, floor-plan measurement, mismatch flags |
| **locator** | `listings, listing_analyses` | `location_guesses` | `webSearch`, `webFetch` | triangulate the fuzzed pin from textual clues into a lat/lng + radius + confidence + cited method |
| **ranker** | `searches, listings, listing_analyses, location_guesses, commutes, taste_signals, taste_notes` | `listings, taste_notes, taste_signals, alerts` | — | score listings against the taste model (deterministic blend function + written rationale); fold new signals into cited taste notes |

```yaml
# homes/spaces/scout/agents/ranker/instruct.md frontmatter
title: Taste ranker
capabilities:
  - db:read:  { tables: [searches, listings, listing_analyses, location_guesses, commutes, taste_signals, taste_notes] }
  - db:write: { tables: [listings, taste_notes, taste_signals, alerts] }
actions:
  - rank    # self-scans unscored/changed listings; writes score + scoreSummary; alerts on a strong match
  - learn   # self-scans unfolded taste_signals; updates cited taste_notes; re-ranks affected listings
defaultAction: rank
```

- **The analyst separates observation from inference.** Every `listing_analyses.body` finding cites
  its evidence; `confidence` is honest, and low-confidence findings are phrased as **questions to
  verify at a viewing** ("photos show no radiator — check heating"), never stated as facts. Its
  mismatch checks are cross-references the description can't dodge: stated m² vs the sum of per-room
  dimensions (`functions/sumRoomAreas.ts` — deterministic), "bright/south-facing" vs photo captions
  and orientation clues, floor/elevator claims vs plan labels, "renovated" vs a kitchen the photos
  date. Confirmed contradictions become `flags` (`size_overstated`, `photo_text_mismatch`, …)
  rendered as warning chips.
- **The locator's method is transparent**: start from the claimed pin (portals fuzz within a few
  hundred meters), extract textual clues (street names, "2 min from <metro>", named cafés/schools,
  visible landmarks in photo captions), `webSearch` the clue coordinates, and intersect
  (`functions/haversine.ts`). Output is **always** a circle + confidence + cited method — the UI
  renders "probably here ±120 m (0.8)" with the reasoning, and links out to OpenStreetMap; it never
  claims the true address. A clue-poor listing gets a wide-radius, low-confidence guess and a
  `fuzzed_pin` flag — honestly uncertain beats confidently wrong.
- **The ranker's score is a deterministic blend the model explains, not model arithmetic**:
  `functions/blendScore.ts` takes (hard-constraint fits, taste-note weights × listing features,
  commute-vs-max penalties, flag penalties) → 0..100; the ranker's contribution is *mapping* listing
  evidence onto the taste dimensions and *writing* `scoreSummary` citing the notes ("+ bright
  corner unit [light note, w0.8]; − 41 min to office vs 30 max"). `learn` distills signals — above
  all dismissal *reasons* — into `taste_notes` statements with `supportCount`, merging rather than
  duplicating dimensions, then re-scores. **The taste model stays inspectable**: the taste page
  shows every statement + its citations, and the user can chat-correct it ("no, ground floor is
  fine if there's a garden") — the ranker updates the note and cites the correction.
- **The `learn-taste` tasklist** (modelled on the sibling patterns): `load_signals`
  (`role: explore` — read-only scan of unfolded signals + current notes) → `update_notes` (single
  non-`forEach` write loop — the proven-reliable pattern for writes) → `rescore_affected` (single
  loop re-running the blend for listings the changed notes touch). Fan-out `forEach` is reserved
  for read-only analysis sweeps; **writes stay in single loops**.
- **The `deep-sweep` tasklist** (the read-only `forEach` fan-out — the "second look" before a
  viewing decision, invocable from chat or by round 2's counsel): `pick_targets` (`role: plan` —
  choose the shortlisted listings worth re-verifying; emits `listingIds`) → `reverify_each`
  (**`forEach: "pick_targets.listingIds"`**, `role: explore` — the host runs one read-only
  re-check **per listing in parallel** within the fork cap, injecting the id as `item`: stale
  price? unresolved flags? guess still consistent? the task's frontmatter adds
  `canDelegateTo: scout/appraiser#appraise` back in, the task-level delegation-allowlist pattern) →
  `write_findings` (`role: general` — a single write loop landing the findings as
  `listing_analyses` rows + alerts where something changed). Orchestrator-fork **salvage
  semantics** apply: one listing's slow re-check salvages partial rather than sinking the sweep.
- **The `TasteQuiz` ask component** (`components/ask/TasteQuiz.tsx`, token-gated) — in a chat
  session the ranker can run a quick A/B ("which of these two would you rather view?" with the two
  listing cards side-by-side); the answer lands as a `'note'` taste signal and feeds `learn`.
  Like all `ask` surfaces it is **top-level-chat-only** — never used in hooks/forks, where `ask`
  doesn't exist.
- **`charter.md` vs `instruct.md`**: every agent ships a short fork-safe `charter.md` — the shared
  guardrails are "never invent a fact about a listing; cite every finding; a guess is labelled a
  guess; never contact anyone" — injected into every fork; `instruct.md` (routing/orchestration) is
  top-level only (parent plan gotcha).
- **No authoring caps anywhere** — these agents *operate* the app. Adding a table or page is a
  THING → `system-appbuilder` request.

## Chat (interactive refinement)

Drop-in `<Chat agent="…">` widgets on the always-available multisession WS endpoint (parent plan
§Chat) — the binding is a runtime prop, no `chats/` dir:

- **`/searches/:searchId/taste`** → `<Chat agent="scout/ranker" />` — interrogate and steer the
  taste model: "why did the Graça flat score 82?", "stop penalizing 4th-floor walk-ups", "gardens
  matter more than balconies". The ranker runs with full caps, so corrections land as `taste_notes`
  writes + a re-rank, and the feed updates live — the parent plan's **chat as a live control
  surface**.
- **`/listings/:id`** → `<Chat agent="scout/analyst" />` — dig into one place: "what would you check
  at the viewing?", "is the price fair for the street?", "re-read the floor plan".
- **`/searches/:searchId/inbox`** → `<Chat agent="intake/clipper" />` — ingest by conversation
  ("here's another alert email: …") and debug parses ("why did capture 12 only yield one listing?").
- History persists at `homes/spaces/<space>/sessions/<id>` (project-session snapshot form,
  resumable). This is **the one place the catalog descriptor renderer re-enters the app** — pages
  stay real React.

## Serving & domains

- **Local CLI**: `localhost:8080/app/homes/…` (pages) and `localhost:8080/app/homes/api/<name>` —
  exactly the parent plan's mount, `<project>` = `homes`.
- **Prod**: served under the **generic authenticated `lmthing.app` domain** at `lmthing.app/homes/*`
  → the authenticated user's pod `/app/homes/*` (Envoy JWT + per-user routing). There is **no
  pre-existing SPA to replace and no friendly product alias in v1** (`lmthing.casa` belongs to the
  unrelated Home-Assistant product) — homes rides the generic app plane; a friendly alias is an
  optional later edge-alias, not required to ship.
- **Admin/dev**: `lmthing.studio` manages it via `/api/projects/homes/app` (manifest, data browser,
  manual hook run, build status, live preview iframe of `…/app/homes/`).

**No public/shared surface** — every route and endpoint is an authenticated, per-user pod
read/write; the app stays fully within per-user pod isolation (no v1 deviation from the parent
plan's authz model).

## Additional features (rounds 2–6 — more user value)

Beyond the core paste → canonical-record → analyzed-ranked-feed loop, expansion proceeds in
**rounds** (the app-builder's round model): each round adds a new full-format project-scoped
specialist space plus the tables/endpoints/hooks/pages behind it, **strictly additively** — earlier
rounds are never regressed. The arc follows the hunt itself: find it (round 1) → **act on it**
(round 2) → **know the ground** (round 3) → **afford it** (round 4) → **decide together** (round 5)
→ **win it** (round 6) → **don't get burned** (round 7) → **keep the hunt on track** (round 8) →
**sign with confidence** (round 9) → **see the whole board** (round 10). End state after round 10:
**11 spaces, 32 agents, 40 tables, ~99 endpoints, 32 hooks, 50+ routes**, all sharing the one
project-rooted db. Each round closes with its honest engine reconciliation under
§Engine reconciliation.

### Round 2 — the `advisor` space: act before someone else does
The core loop finds the right place; round 2 helps you **win** it, and gives every listing a
memory. A new project-scoped space (`advisor`: `counsel`, `inspector`) joins `intake`/`scout`, plus
a new **`scout/appraiser`** for price fairness.

- **Data**:
  - `inquiries` — a drafted contact message: `id`, `listingId` FK → `listings` (`cascade`), `body`
    (md draft, personalized from the listing + facts the user provided), `channel`
    (`'portal_form' | 'email' | 'phone_script'`), `status` (`'draft' | 'approved' | 'sent'`,
    default `draft`), `sentAt?`, `createdAt`. **The app never sends anything** — drafts are
    copy-paste artifacts the user approves and sends themselves; `status:'sent'` is user-recorded.
  - `viewings` — a scheduled visit: `id`, `listingId` FK (`cascade`), `scheduledAt`, `checklist`
    (json — per-listing verification items **generated from that listing's analyses, flags, and
    open low-confidence questions**: "measure the living room — plan sums to 71 m² vs 85 stated",
    "check light at the hour you'd be home", "ask about the €120 condo fee"), `notes` (md — what
    the user found), `outcome` (`'pending' | 'passed' | 'rejected' | 'offer'`, default `pending`),
    `outcomeRecorded` (bool, default false — the outcome hook's idempotence cursor), `createdAt`.
  - `listing_events` — the listing's timeline: `id`, `listingId` FK (`cascade`), `kind`
    (`'first_seen' | 'price_change' | 'gone' | 'back_online' | 'relisted'`), `detail` (md — old/new
    price, gap length), `createdAt`. Written by `intake/clipper` (`parse` writes `first_seen`;
    `refresh` writes the rest alongside its alerts) — the memory that turns a relisting into
    negotiation evidence.
  - **Additive enum values**: `listing_analyses.kind` gains `'comps'`; `alerts.kind` gains
    `'digest'`.
- **Agents** (least-privilege):
  - `advisor/counsel` — the conversational orchestrator: `db:read` wide (core tables + `inquiries`,
    `viewings`, `listing_events`), `db:write [inquiries, taste_signals, alerts]`,
    `canDelegateTo: [advisor/inspector#checklist, scout/appraiser#appraise, scout/ranker#rank]`.
    Actions: `draft-inquiry` (personalized draft citing only stated facts), `digest` (the daily
    cron delegate — one coalesced `'digest'` alert: top new matches, price drops, stale to-dos),
    `advise` (chat: "which should I visit first?" answered with evidence).
  - `advisor/inspector` — `db:read [listings, listing_analyses, location_guesses, commutes,
    viewings]`, `db:write [viewings]`. Action `checklist`: generate/refresh the per-listing viewing
    checklist from the flags and unresolved low-confidence findings.
  - `scout/appraiser` — `db:read [searches, listings, listing_analyses, listing_events, commutes]`,
    `db:write [listing_analyses]`. Action `appraise`: a `'comps'` analysis comparing the listing's
    price/m² (true cost over best-known size) against the *other listings in the same search and
    area band* — **the db is the comp set, no external data** — plus timeline evidence ("gone 3
    weeks, back at −5%"), all cited ("12% above the median €/m² of the 14 comparable 2-beds you're
    tracking").
- **API** (9): `draftInquiry` `POST api/listings/:id/inquiry` (spawns counsel, returns
  immediately); `listInquiries` `GET api/searches/:id/inquiries`; `updateInquiry`
  `PATCH api/inquiries/:id` (approve / mark sent); `scheduleViewing`
  `POST api/listings/:id/viewings` (fires the checklist hook); `listViewings`
  `GET api/searches/:id/viewings` (upcoming first); `updateViewing` `PATCH api/viewings/:id`
  (notes + outcome); `pipeline` `GET api/searches/:id/pipeline` (listings grouped by `status` —
  the kanban read view); `listingHistory` `GET api/listings/:id/events`; `listingComps`
  `GET api/listings/:id/comps` (the latest `'comps'` analysis + the comp rows behind it).
- **Hooks** (3, plus one additive edit): `checklist-on-viewing` (**database** insert on `viewings`
  → `advisor/inspector#checklist`; idempotent — skip if `checklist` non-empty);
  `record-viewing-outcome` (**database** update on `viewings` — guarded: return unless
  `outcome !== 'pending' && !outcomeRecorded`; delegates counsel to write a `'viewed'` taste signal
  carrying the outcome + notes as reason and flip `outcomeRecorded` — a viewing verdict is the
  strongest taste evidence there is); `daily-digest` (**cron** daily → `advisor/counsel#digest`,
  declarative). **Additive edit**: `enrich-new-listing` gains a fifth sequential delegate —
  `scout/appraiser#appraise` after `rank` (same hook session, same depth — the round-1 depth
  accounting still holds); the digest also re-runs `appraise`, so comps sharpen as the comp set
  grows.
- **Pages** (5): `/searches/:searchId/pipeline` (kanban new → shortlisted → contacted → viewing →
  applied, with `<Chat agent="advisor/counsel">`), `/listings/:id/visit` (checklist check-offs +
  notes + outcome), `/listings/:id/inquiry` (draft view/edit/approve + copy button),
  `/searches/:searchId/inquiries` (all drafts by status), `/searches/:searchId/activity` (the
  merged `listing_events` timeline). The listing detail page gains a `PriceHistory` strip + a
  fairness panel.
- **Safety**: inquiries are **drafts only** — no send capability exists, no email/portal
  integration; the counsel's charter forbids impersonation, invented urgency, and pressure tactics;
  drafted text contains only facts the user provided or the listing states. Fairness reads are
  advisory and cite their comp set.

### Round 3 — the `district` space: know the ground
A home is a place *in* a place. Round 3 gives the app a model of the neighbourhoods themselves — a
new project-scoped space (`district`: `geographer`, `profiler`, `matchmaker`) that builds cited
area dossiers, pins listings to areas, scores each area against the user's taste and commutes, and
suggests areas they aren't searching but should be.

- **Data**:
  - `areas` — a canonical neighbourhood: `id`, `label` (req, e.g. 'Arroios'), `city`,
    `centroidLat`/`centroidLng`, `radiusM`, `summary` (md — the dossier lede, cited), `createdAt`.
    Deduped by normalized label+city (space function), never duplicated per listing.
  - `area_notes` — one cited finding: `id`, `areaId` FK (`cascade`), `topic` (`'transit' | 'noise'
    | 'green' | 'services' | 'safety_pointers' | 'prices' | 'character'`), `body` (md, cited via
    `webSearch`), `confidence` (0..1), `createdAt`.
  - `area_scores` — per-search fit: `id`, `areaId` FK (`cascade`), `searchId` FK (`cascade`),
    `score` (0..100 — the deterministic blend of taste notes × area notes + commute targets),
    `rationale` (md, cited), `computedAt`.
  - **New column on `listings`**: `areaId` FK → `areas` (`setNull`) — assigned by the profiler from
    the best location guess. `alerts.kind` gains `'area_suggestion'`.
- **Agents** (least-privilege):
  - `district/geographer` — `db:read [areas, area_notes, listings, location_guesses]`,
    `db:write [areas, area_notes]`; universal `webSearch`/`webFetch`. Actions: `survey` (build or
    extend an area's dossier — every note cited), `refresh` (the weekly cron delegate — re-verify
    stale notes).
  - `district/profiler` — `db:read [areas, listings, location_guesses]`, `db:write [listings]`.
    Action `assign`: link listings to areas (haversine of the best guess vs area centroids, a space
    function); a listing whose guess is too weak/wide **stays unassigned** — never force a match.
  - `district/matchmaker` — `db:read [areas, area_notes, area_scores, searches, taste_notes,
    listings, commutes]`, `db:write [area_scores, alerts]`. Actions: `fit` (score every known area
    for a search), `discover` (suggest areas the user *isn't* searching that fit their taste +
    commute — the "have you considered Penha de França?" `'area_suggestion'` alert).
- **API** (8): `listAreas` `GET api/areas`; `getArea` `GET api/areas/:id` (include notes);
  `areaListings` `GET api/areas/:id/listings`; `surveyArea` `POST api/areas/:id/survey` (spawns the
  geographer); `areaFit` `GET api/searches/:id/areas` (fit-ranked `area_scores` + rationale);
  `compareAreas` `GET api/searches/:id/areas/compare` (`{ids}` → one normalized row per topic);
  `suggestAreas` `POST api/searches/:id/areas/discover` (spawns the matchmaker);
  `assignListingArea` `PATCH api/listings/:id/area` (manual correction — also inserts a `'note'`
  taste signal, since a correction is preference-grade evidence).
- **Hooks** (3): `survey-new-area` (**database** insert on `location_guesses` — ONE imperative
  hook, two sequential delegates, the round-1 depth-shaping pattern: `district/profiler#assign`,
  then `district/geographer#survey` idempotently — skip when the assigned area already has a fresh
  dossier; per-hook cooldown coalesces guess bursts); `refit-areas-on-taste` (**database** insert
  on `taste_notes` → `district/matchmaker#fit`; cooldown-coalesced — taste edits arrive in bursts);
  `refresh-area-dossiers` (**cron** `every:'7d'` → `district/geographer#refresh`, declarative).
- **Pages** (5): `/areas` (all known areas), `/areas/:areaId` (the dossier: notes by topic + your
  tracked listings there), `/searches/:searchId/areas` (fit-ranked areas + rationale),
  `/searches/:searchId/areas/compare`, `/searches/:searchId/discover` (matchmaker suggestions +
  `<Chat agent="district/matchmaker">`). Feed cards and the listing detail gain an **area chip**
  linking into the dossier.
- **Safety**: area notes describe the *place*, never the people — no demographic profiling;
  `'safety_pointers'` cites official/statistical sources only and is phrased as things to check on
  a visit, not verdicts; every note carries its citation and confidence; a thin dossier says it's
  thin.

### Round 4 — the `finance` space: what it actually costs to say yes
Money is what greenlights or kills a home. Round 4 adds a `finance` space (`underwriter`,
`strategist`) plus an **`advisor/negotiator`** — turning the round-1 `trueCostMonthly` into full
scenario modelling, affordability guardrails, rent-vs-buy framing, and evidence-based negotiation
briefs.

- **Data**:
  - `finance_profiles` — the user's coarse numbers (typed by them, one per search): `id`,
    `searchId` FK (`cascade`), `grossIncomeMonthly`, `savingsAvailable`, `monthlyDebts`,
    `targetDownPaymentPct`, `maxComfortableMonthly` (their own ceiling, distinct from `budgetMax`),
    `notes`, `createdAt`.
  - `finance_scenarios` — one what-if: `id`, `searchId` FK (`cascade`), `listingId` FK (`setNull`;
    null = search-generic), `label`, `kind` (`'purchase' | 'rent_vs_buy'`), `downPayment`,
    `ratePct`, `rateSource` (cited — which `rate_snapshots` row + date), `termYears`,
    `monthlyTotal` (computed by the deterministic amortization function), `breakdown` (json — every
    line `stated`/`estimated`), `createdAt`.
  - `rate_snapshots` — the cited reference-rate cache: `id`, `product` (e.g.
    `'mortgage_fixed_20y'`), `ratePct`, `source` (cited URL/name), `fetchedAt`.
  - `negotiation_briefs` — an evidence-based angle: `id`, `listingId` FK (`cascade`), `angle` (md,
    cited), `evidence` (json — the `listing_events`/comps rows it rests on), `suggestedOpening`
    (md — a draft line the user may fold into an inquiry), `status` (`'draft' | 'used'`, default
    `draft`), `createdAt`.
- **Agents** (least-privilege):
  - `finance/underwriter` — `db:read [searches, listings, finance_profiles, finance_scenarios,
    rate_snapshots]`, `db:write [finance_scenarios, rate_snapshots, alerts]`; universal `webSearch`
    for reference rates. Actions: `scenarios` (self-scans shortlisted buy-mode listings lacking
    scenarios → builds labelled ones off the profile + freshest rate), `refresh-rates` (the daily
    cron delegate — re-search reference rates, write cited snapshots, alert on a material move).
  - `finance/strategist` — `db:read [searches, listings, finance_profiles, finance_scenarios,
    rate_snapshots, commutes, taste_notes, listing_events]`, `db:write [finance_scenarios]`.
    Actions: `rent-vs-buy` (a `'rent_vs_buy'` scenario framing total-cost-over-horizon for a
    listing or the search band), `advise` (chat — trade-offs in plain language, information not
    advice).
  - `advisor/negotiator` — `db:read [listings, listing_analyses, listing_events, inquiries,
    finance_scenarios]`, `db:write [negotiation_briefs, inquiries]`. Action `brief`: distill the
    listing's timeline + comps + days-on-market into a cited negotiation angle and a suggested
    opening the user may merge into their inquiry draft.
- **API** (10): `getFinanceProfile` `GET api/searches/:id/finance/profile`; `setFinanceProfile`
  `PUT api/searches/:id/finance/profile`; `listRates` `GET api/finance/rates`; `refreshRates`
  `POST api/finance/rates/refresh` (spawns the underwriter); `listScenarios`
  `GET api/searches/:id/scenarios`; `createScenario` `POST api/searches/:id/scenarios`;
  `removeScenario` `DELETE api/scenarios/:id`; `listingAffordability`
  `GET api/listings/:id/affordability` (profile + freshest rate → monthly, stress margin,
  share-of-income — all deterministic); `rentVsBuy` `GET api/searches/:id/rent-vs-buy`;
  `draftNegotiation` `POST api/listings/:id/negotiation` (spawns the negotiator; `listBriefs` rides
  `getListing`'s include).
- **Hooks** (3): `refresh-rates` (**cron** daily → `finance/underwriter#refresh-rates`,
  declarative); `scenario-on-shortlist` (**database** update on `listings` — guarded:
  `status === 'shortlisted'`, buy-mode search, no scenario for this listing yet →
  `finance/underwriter#scenarios`); `negotiate-on-price-drop` (**database** insert on
  `listing_events` — guarded: `kind ∈ {price_change↓, relisted}`, no fresh brief →
  `advisor/negotiator#brief`).
- **Pages** (5): `/searches/:searchId/finance` (profile editor + current cited rates),
  `/searches/:searchId/affordability` (shortlist × scenarios grid + stress margins +
  `<Chat agent="finance/strategist">`), `/listings/:id/scenarios`, `/listings/:id/negotiation`
  (brief + evidence + merge-into-inquiry), `/searches/:searchId/rent-vs-buy`.
- **Safety**: **information, not advice** — every figure carries its cited rate + date and a
  labelled breakdown; stress margins are shown, a doubtful number is a range; the charter says
  "verify with your bank/broker" and forbids requesting documents or account details. The
  negotiator never fabricates competing offers or market claims — every angle cites a db row.

### Round 5 — the `household` space: decide together
Most homes are chosen by more than one person, and disagreement is data. Round 5 adds a
`household` space (`host`, `mediator`, `chronicler`): named stakeholders with their own briefs and
votes, per-person taste, explicit conflict surfacing, and a decision journal that remembers *why*
each place advanced or died.

- **Data**:
  - `stakeholders` — a person in the decision: `id`, `searchId` FK (`cascade`), `name` (req),
    `role` (`'decider' | 'companion' | 'advisor'`), `brief` (their own free-text wants), `notes`,
    `createdAt`.
  - `stakeholder_votes` — one person's verdict on a listing: `id`, `stakeholderId` FK (`cascade`),
    `listingId` FK (`cascade`), `vote` (`'yes' | 'no' | 'maybe'`, req), `reason`, `folded` (bool,
    default false — the reconcile cursor), `createdAt`. A re-vote **updates** the person's existing
    row (handler upsert), so the matrix stays one cell per person×listing.
  - `decision_entries` — the journal: `id`, `searchId` FK (`cascade`), `listingId` FK (`setNull`),
    `kind` (`'advanced' | 'dismissed' | 'viewed' | 'applied' | 'note'`), `body` (md — what moved
    and why, cited to votes/signals/analyses), `createdAt`.
  - **New column on `taste_notes`**: `stakeholderId` FK → `stakeholders` (`setNull`; null = the
    shared household taste — all round-1 notes remain valid unchanged). `alerts.kind` gains
    `'household_conflict'`.
- **Agents** (least-privilege):
  - `household/host` — `db:read [searches, stakeholders, taste_notes, taste_signals]`,
    `db:write [stakeholders, taste_notes]`. Action `onboard`: fold a new stakeholder's brief into
    stakeholder-tagged taste notes (cited to the brief), so the ranker sees them immediately.
  - `household/mediator` — `db:read [searches, stakeholders, stakeholder_votes, listings,
    taste_notes, taste_signals]`, `db:write [taste_notes, taste_signals, alerts]`. Actions:
    `reconcile` (self-scans unfolded votes → distill reasons into per-person notes; raise a
    `'household_conflict'` alert when a shortlisted listing splits), `conflicts` (chat — narrate
    where and *why* the household disagrees, neutrally).
  - `household/chronicler` — `db:read [listings, stakeholder_votes, taste_signals,
    decision_entries]`, `db:write [decision_entries]`. Action `journal`: record pipeline moves with
    their evidence — the retrospective memory ("we passed on Graça over the stairs, not the
    price").
- **API** (9): `addStakeholder` `POST api/searches/:id/stakeholders` (fires the onboard hook);
  `listStakeholders` `GET api/searches/:id/stakeholders`; `updateStakeholder`
  `PATCH api/stakeholders/:id`; `removeStakeholder` `DELETE api/stakeholders/:id`; `castVote`
  `POST api/listings/:id/votes` (`{stakeholderId, vote, reason?}` — upsert per person); `listingVotes`
  `GET api/listings/:id/votes`; `conflicts` `GET api/searches/:id/conflicts` (the disagreement
  matrix: split listings + the dimension driving each split); `decisionLog`
  `GET api/searches/:id/journal`; `addDecisionNote` `POST api/searches/:id/journal`.
- **Hooks** (3): `onboard-stakeholder` (**database** insert on `stakeholders` →
  `household/host#onboard`; idempotent — skip when the brief is already reflected in a tagged
  note); `reconcile-vote` (**database** insert on `stakeholder_votes` →
  `household/mediator#reconcile`; self-scans `folded === false`); `journal-pipeline-moves`
  (**database** update on `listings` → `household/chronicler#journal` — guarded: the chronicler
  compares `row.status` to the last journal entry for that listing and returns when unchanged, so
  the ranker's frequent score writes never produce journal spam; per-hook cooldown backs it).
- **Pages** (5): `/searches/:searchId/household` (people + briefs +
  `<Chat agent="household/mediator">`), `/searches/:searchId/conflicts` (the listings × people
  matrix), `/listings/:id/votes` (vote panel + reasons), `/searches/:searchId/journal` (the
  decision log), `/searches/:searchId/taste/:stakeholderId` (one person's cited taste notes). Feed
  and compare cards gain vote chips.
- **Ranker updates (additive)**: `db:read` gains `[stakeholders, stakeholder_votes]`; `rank`
  surfaces splits explicitly in `scoreSummary` ("84 for Ana, 41 for Rui — the garden vs the
  commute") instead of averaging them away; `learn` attributes a signal to a stakeholder when the
  vote/reason names one.
- **Safety**: stakeholders are **rows, not accounts** — the pod stays single-user and the household
  shares one screen/session; no auth change, no cross-user access. The mediator reports
  disagreement neutrally and never manufactures consensus.

### Round 6 — the `closer` space: win the place
The hunt ends in paperwork and deadlines. Round 6 adds a `closer` space (`applicant`,
`coordinator`, `settler`): application/offer tracking with per-locale document checklists, a mini
contact book of agents and landlords, deadline nudges, and a move-in runbook once a place is won.

- **Data**:
  - `applications` — one application or offer on a listing: `id`, `listingId` FK (`cascade`, req),
    `kind` (`'rental_application' | 'offer'`), `status` (`'draft' | 'submitted' | 'accepted' |
    'rejected' | 'withdrawn'`, default `draft`), `terms` (json — offered price/rent, move-in date,
    conditions), `submittedAt?`, `decidedAt?`, `notes` (md), `createdAt`.
  - `application_items` — the dossier checklist: `id`, `applicationId` FK (`cascade`), `label`
    (req — e.g. 'proof of income (last 3 payslips)'), `category` (`'document' | 'task' |
    'movein'`), `done` (bool, default false), `note` (md — user notes, **never document
    contents**), `dueAt?`, `createdAt`.
  - `contacts` — the mini-CRM: `id`, `searchId` FK (`cascade`), `listingId` FK (`setNull`), `name`
    (req), `role` (`'agent' | 'landlord' | 'property_manager' | 'other'`), `channel` (how to reach
    them), `lastContactAt`, `notes` (md — responsiveness, quirks), `createdAt`.
  - `deadlines` — what's due: `id`, `searchId` FK (`cascade`), `listingId` FK (`setNull`),
    `applicationId` FK (`setNull`), `label` (req), `dueAt` (req), `done` (bool, default false),
    `source` (md — where the deadline came from, cited), `createdAt`.
  - **Additive enum values**: `alerts.kind` gains `'followup_due'` and `'deadline_soon'`.
- **Agents** (least-privilege):
  - `closer/applicant` — `db:read [searches, listings, applications, application_items,
    contacts]`, `db:write [applications, application_items]`; universal `webSearch` for locale
    norms. Action `checklist`: build the per-application dossier item list for the mode + locale
    ("typical Lisbon rental dossier: …", cited in item notes); idempotent per application.
  - `closer/coordinator` — `db:read [applications, application_items, contacts, deadlines,
    listings, inquiries, viewings]`, `db:write [deadlines, contacts, alerts]`. Actions: `nudge`
    (the daily cron delegate — scan overdue deadlines, stale submitted applications, long-silent
    contacts → coalesced `'followup_due'`/`'deadline_soon'` alerts), `track` (chat — "where does
    everything stand?").
  - `closer/settler` — `db:read [applications, application_items, listings, deadlines]`,
    `db:write [application_items, deadlines]`. Action `movein`: when an application is accepted,
    build the move-in runbook — `'movein'` checklist items + deadline rows (utilities transfer,
    address changes, condition report at handover, deposit paperwork).
- **API** (10): `createApplication` `POST api/listings/:id/applications` (fires the checklist
  hook); `listApplications` `GET api/searches/:id/applications`; `getApplication`
  `GET api/applications/:id` (include items + the listing + its contacts); `updateApplication`
  `PATCH api/applications/:id` (status/terms — `accepted` fires the move-in hook);
  `toggleApplicationItem` `PATCH api/application-items/:id`; `addContact`
  `POST api/searches/:id/contacts`; `listContacts` `GET api/searches/:id/contacts`;
  `updateContact` `PATCH api/contacts/:id`; `listDeadlines` `GET api/searches/:id/deadlines`
  (soonest first, `done` filtered); `completeDeadline` `PATCH api/deadlines/:id`.
- **Hooks** (3): `checklist-on-application` (**database** insert on `applications` →
  `closer/applicant#checklist`; idempotent — skip if items exist); `followup-nudges` (**cron**
  daily → `closer/coordinator#nudge`, declarative — coalesces to at most one nudge alert per
  search per day); `prepare-movein` (**database** update on `applications` — guarded:
  `status === 'accepted'` and no `'movein'` items yet → `closer/settler#movein`).
- **Pages** (5): `/searches/:searchId/applications` (status board),
  `/applications/:id` (the dossier: checklist + terms + contacts + linked viewing/inquiry history +
  `<Chat agent="closer/coordinator">`), `/searches/:searchId/contacts` (the mini-CRM),
  `/searches/:searchId/deadlines` (what's due, soonest first), `/applications/:id/movein` (the
  accepted-place runbook).
- **Safety**: the app tracks documents as **labels + done flags + user notes, never contents** — no
  blob store exists and the charter forbids pasting sensitive document contents (ID numbers,
  payslips, statements) into the db; nothing is submitted anywhere by the app; nudges are in-app
  alerts only.

### Round 7 — the `guardian` space: don't get burned
Rental fraud is endemic where housing is tight, illegal fees are routine, and by the time you're
wiring a deposit it's too late. Round 7 adds a `guardian` space (`screener`, `rights`, `vetter`)
that screens every listing for scam patterns, audits fees against local tenant-rights rules, and
vets the counterparty *before* you contact them — all advisory, all cited, never an accusation.

- **Data**:
  - `screenings` — one scam-pattern read per listing: `id`, `listingId` FK (`cascade`, req),
    `riskScore` (0..1 — a deterministic signal blend, NOT an assertion of fraud), `signals` (json —
    which patterns fired: `below_comps_outlier`, `deposit_before_viewing_language`,
    `urgency_pressure`, `webmail_only_contact`, `recycled_content`, `no_viewing_offered`), `body`
    (md — each signal cited to the exact listing text/comps rows), `createdAt`.
  - `rights_notes` — a cited local-rules note per search locale: `id`, `searchId` FK (`cascade`,
    req), `topic` (`'deposit_cap' | 'agency_fees' | 'notice_period' | 'rent_control' |
    'habitability' | 'other'`), `body` (md — the rule as sourced, cited to official/statutory
    pages), `sourceQuality` (`'official' | 'reputable' | 'unverified'`), `createdAt`.
  - `vetting_notes` — a public-record read on a counterparty: `id`, `listingId` FK (`cascade`,
    req), `subject` (the agency/landlord name AS STATED in the listing), `kind`
    (`'agency' | 'landlord' | 'unknown'`), `body` (md — quoted public reviews/mentions with links,
    presented as quotes, never as the app's own claims), `confidence` (0..1), `createdAt`.
  - **Additive enum values**: `alerts.kind` gains `'scam_risk'` and `'questionable_fee'`;
    `listings.flags` vocabulary gains `scam_signals` and `questionable_fee`.
- **Agents** (least-privilege):
  - `guardian/screener` — `db:read [searches, listings, listing_analyses, listing_events,
    screenings]`, `db:write [screenings, listings, alerts]`. Action `screen`: run the deterministic
    signal functions over the listing + its comps/history, write the cited screening, merge the
    flag, and raise a `'scam_risk'` alert past a threshold. Cross-listing reuse (same photos/near-
    identical description under a different address/price) is checked **against the db itself**.
  - `guardian/rights` — `db:read [searches, listings, rights_notes]`, `db:write [rights_notes,
    listings, alerts]`; universal `webSearch`/`webFetch`. Actions: `brief` (build the search
    locale's cited rights notes), `audit-fees` (cross-check every listing's `costBreakdown` lines
    against the cited caps — an over-cap line gets a `'questionable_fee'` flag + alert, citing both
    the line and the rule), `refresh` (the weekly cron delegate — re-verify aging notes).
  - `guardian/vetter` — `db:read [listings, inquiries, vetting_notes]`, `db:write [vetting_notes]`;
    universal `webSearch`/`webFetch`. Action `vet`: look up the counterparty's public footprint
    (agency register entries, review sites) and write a quoted, linked, confidence-scored note —
    run **before** the user sends an inquiry.
- **API** (8): `getScreening` `GET api/listings/:id/screening`; `rescreen`
  `POST api/listings/:id/screening` (spawns the screener); `listRisks`
  `GET api/searches/:id/risks` (all listings with `riskScore` or `questionable_fee`, worst first);
  `rightsBriefing` `GET api/searches/:id/rights`; `refreshRights`
  `POST api/searches/:id/rights/refresh`; `feeAudit` `GET api/listings/:id/fees`
  (`costBreakdown` lines annotated legal/over-cap/unknown, each citing its rule); `getVetting`
  `GET api/listings/:id/vetting`; `vetContact` `POST api/listings/:id/vetting` (spawns the
  vetter).
- **Hooks** (3, plus one additive edit): `rights-for-search` (**database** insert on `searches` →
  `guardian/rights#brief`; idempotent per locale); `vet-before-contact` (**database** insert on
  `inquiries` → `guardian/vetter#vet` — the vetting lands while the draft is still unapproved, so
  the user reads it before sending; idempotent — skip if a fresh note exists);
  `weekly-rights-refresh` (**cron** `every:'7d'` → `guardian/rights#refresh`, declarative).
  **Additive edit**: `enrich-new-listing` gains a sixth sequential delegate —
  `guardian/screener#screen` — after `appraise` (same session, same depth; screening *needs* the
  comps that appraise just wrote).
- **Pages** (5): `/searches/:searchId/risks` (the risk board, worst first),
  `/listings/:id/safety` (screening signals, each linked to its evidence),
  `/searches/:searchId/rights` (the cited rights briefing + `<Chat agent="guardian/rights">`),
  `/listings/:id/vetting` (the quoted public-record read), `/searches/:searchId/fees` (search-wide
  fee audit: every questionable line across the shortlist). Feed cards and the listing detail gain
  a `RiskBadge` (token-gated, `text-destructive` past threshold).
- **Safety**: the guardian never asserts fraud or wrongdoing — a screening is "signals consistent
  with common scam patterns; verify before paying anything", cited to the exact text; vetting
  notes are **quotes with links**, clearly attributed, confidence-scored, never the app's own
  claims about a person; rights notes are "information, not legal advice" with `sourceQuality`
  labelled; fee audits cite both the fee line and the rule. All of it is advisory input to the
  user's judgement.

### Round 8 — the `coach` space: keep the hunt on track
The hunt itself is a project with a deadline, a cold-start problem, and regret. Round 8 adds a
`coach` space (`interviewer`, `pacer`, `reviewer`) plus quality-of-life data the earlier rounds
make immediately useful: a move-by date driving urgency, a day-one taste interview, second-chance
resurfacing of dismissed listings whose circumstances changed, cash-to-move-in, amenities/energy
extraction, and a printable viewing-day pack.

- **Data**:
  - `hunt_reports` — the weekly hunt-health snapshot: `id`, `searchId` FK (`cascade`, req),
    `metrics` (json — new listings/wk, save ratio, viewing conversion, days to `moveInBy`,
    projected viewings remaining), `body` (md — the pacer's read: what's working, what to widen),
    `createdAt`.
  - `resurfacings` — a second chance: `id`, `listingId` FK (`cascade`, req), `trigger`
    (`'price_drop' | 'taste_shift' | 'back_online'`), `reason` (md, cited — "dismissed at €1,750;
    now €1,590, inside budget; your 'light' note strengthened since"), `status`
    (`'suggested' | 'accepted' | 'declined'`, default `suggested`), `createdAt`. Accepting moves
    the listing back to `'new'` **and** writes a taste signal; declining writes a `'dismiss'`
    signal reinforcing the original call — either way the taste model learns.
  - `viewing_packs` — the printable day-of sheet: `id`, `viewingId` FK (`cascade`, req), `content`
    (md — address + best location guess, the checklist, open questions, the fee/rights flags to
    ask about, contact + votes so far), `builtAt`.
  - **New columns**: `searches.moveInBy` (date — the hard deadline urgency derives from);
    `listings.amenities` (json — extracted inclusions: elevator, AC, heating type, washer,
    furnished, pets, parking, balcony…), `listings.energyClass` (as stated; feeds a seasonal-cost
    line in `costBreakdown`), `listings.cashToMoveIn` (deposit + advance months + agency fee +
    estimated moving cost — the up-front number renters actually need, every line labelled).
    `alerts.kind` gains `'pace_warning'` and `'second_chance'`.
- **Agents** (least-privilege):
  - `coach/interviewer` — `db:read [searches, taste_notes, taste_signals, listings]`,
    `db:write [taste_notes, taste_signals, searches]`. Action `interview` (**chat-only**, built on
    ask components): a structured day-one interview (budget honesty, dealbreakers, light/noise/
    layout trade-offs, `moveInBy`, must-have amenities) that seeds cited `taste_notes` and updates
    the search — solving the cold-start before the first save/dismiss exists.
  - `coach/pacer` — `db:read [searches, listings, taste_signals, viewings, applications,
    hunt_reports]`, `db:write [hunt_reports, alerts]`. Actions: `checkup` (the weekly cron
    delegate — compute the deterministic metrics, write the report, raise a `'pace_warning'` when
    the projection misses `moveInBy`: "at 2 viewings/week you'll see ~6 more before March 1 —
    widen the area or relax a must-have?"), `plan` (chat — replan the remaining weeks).
  - `coach/reviewer` — `db:read [searches, listings, listing_events, taste_signals, taste_notes,
    resurfacings]`, `db:write [resurfacings, listings, taste_signals, alerts]`. Action `rescan`
    (the daily cron delegate — scan dismissed listings for price drops into range, `back_online`
    events, and taste-note shifts that now clear the blend threshold → cited `resurfacings` +
    `'second_chance'` alerts; never resurface the same listing twice for the same trigger).
- **API** (8): `huntReport` `GET api/searches/:id/report` (latest + history); `runCheckup`
  `POST api/searches/:id/report` (spawns the pacer); `listResurfacings`
  `GET api/searches/:id/second-chances`; `resolveResurfacing` `PATCH api/resurfacings/:id`
  (accept/decline — writes the taste signal and, on accept, flips the listing to `'new'`);
  `viewingPack` `GET api/viewings/:id/pack`; `buildPack` `POST api/viewings/:id/pack` (spawns the
  builder); `upfrontCost` `GET api/listings/:id/upfront` (the labelled cash-to-move-in breakdown);
  `interviewStatus` `GET api/searches/:id/interview-status` (has the day-one interview run — the
  interview page's gate); plus `listingFeed` gains an `amenity?` filter (additive Input field,
  JS-filtered).
- **Hooks** (3): `weekly-checkup` (**cron** `every:'7d'` → `coach/pacer#checkup`, declarative);
  `second-chance-scan` (**cron** daily → `coach/reviewer#rescan`, declarative);
  `pack-on-checklist` (**database** update on `viewings` — guarded: `checklist` non-empty and no
  pack yet → `coach/reviewer` builds the `viewing_packs` row from the checklist + flags + rights
  questions; runs after round 2's checklist hook by construction, since it triggers on the
  checklist write itself).
- **Pages** (5): `/searches/:searchId/report` (hunt-health dashboard: metric tiles + the pacer's
  read + `<Chat agent="coach/pacer">`), `/searches/:searchId/interview` (the day-one interview —
  `<Chat agent="coach/interviewer">` with its ask flow), `/searches/:searchId/second-chances`
  (accept/decline cards with the cited reason), `/viewings/:id/pack` (print-CSS page — the sheet
  you take to the viewing), `/searches/:searchId/upfront` (cash-to-move-in compared across the
  shortlist). The feed gains amenity filter chips; `updateSearch` already carries `moveInBy`.
- **Surveyor/clipper/ranker updates (additive)**: the clipper extracts `amenities`/`energyClass`
  during parse (functions, not prose); the surveyor writes `cashToMoveIn` + the seasonal-energy
  `costBreakdown` line; `blendScore` gains amenity-mustHave matching and a `moveInBy`-proximity
  urgency term (deterministic inputs, as ever).
- **Safety**: pace advice is descriptive math plus suggestions, never nagging by default (one
  `'pace_warning'` per report cycle); resurfacing respects the user's original call — a decline is
  final for that trigger; the viewing pack contains only data already in the db.

### Round 9 — the `diligence` space: sign with confidence
The most expensive mistakes happen in the last mile: a lease clause you didn't read, a renovation
bill you didn't price, a "bright and quiet" you never actually verified. Round 9 adds a
`diligence` space (`reader`, `estimator`, `verifier`) that reviews the contract you're about to
sign, prices the works the place actually needs, and **closes the loop the analyst opened in round
1** — every low-confidence finding becomes a verification you resolve at the viewing, and the
resolution flows back into flags, confidence, and taste.

- **Data**:
  - `contracts` — a pasted contract text: `id`, `listingId` FK → `listings` (`cascade`, req),
    `applicationId` FK → `applications` (`setNull` — linked when it's the actual lease/offer
    paperwork), `kind` (`'lease' | 'reservation' | 'agency_terms' | 'purchase'`), `content` (the
    pasted text, sanitized — untrusted content), `status` (`'pending' | 'reviewed' | 'error'`,
    default `pending`), `summary` (md — the plain-language read: what you're agreeing to, in one
    screen), `createdAt`.
  - `contract_findings` — one clause-level finding: `id`, `contractId` FK (`cascade`, req),
    `clause` (the **verbatim quoted excerpt** it rests on), `category` (`'deposit' |
    'termination' | 'fees' | 'repairs' | 'privacy' | 'missing_term' | 'other'`), `severity`
    (`'info' | 'caution' | 'red_flag'`), `body` (md — what it means and why it matters, cited to
    the clause AND the matching `rights_notes` rule where one exists), `createdAt`.
  - `renovation_estimates` — one scoped line of works: `id`, `listingId` FK (`cascade`, req),
    `scope` (`'cosmetic' | 'kitchen' | 'bathroom' | 'electrics' | 'windows' | 'heating' |
    'structural_question'`), `rationale` (md — cited to the analyses/verifications/viewing notes
    that motivated it), `costLow`, `costHigh` (a **range**, never a point), `currency`, `basis`
    (md — the cited per-m²/per-job ballpark source), `createdAt`.
  - `verifications` — the ledger that closes the analyst's loop: `id`, `listingId` FK (`cascade`,
    req), `viewingId` FK → `viewings` (`setNull`), `question` (req — from a low-confidence finding
    or flag: "plan sums to 71 m² vs 85 stated — measure the living room"), `topic` (`'size' |
    'light' | 'noise' | 'damp' | 'heating' | 'condition' | 'location' | 'other'`), `status`
    (`'open' | 'confirmed' | 'refuted' | 'unclear'`, default `open`), `evidence` (md — what the
    user actually observed), `applied` (bool, default false — the apply hook's cursor),
    `resolvedAt?`, `createdAt`.
  - **Additive enum values**: `alerts.kind` gains `'contract_red_flag'`; `listings.flags`
    vocabulary gains `works_needed`.
- **Agents** (least-privilege):
  - `diligence/reader` — `db:read [contracts, contract_findings, rights_notes, listings,
    applications]`, `db:write [contracts, contract_findings, alerts]`,
    `canDelegateTo: [guardian/rights#brief]` (a contract arriving before the rights briefing
    exists pulls the briefing in first — cross-space delegation on the shared db). Action
    `review`: split the pasted text into clauses (`clauseSplit.ts`), check them against the cited
    rights rules and the locale's mandatory-terms checklist (`mandatoryTerms.ts` — a missing
    mandatory term is itself a finding), quote every finding verbatim, and write the
    plain-language `summary` + the questions to ask before signing. A `red_flag` raises a
    `'contract_red_flag'` alert.
  - `diligence/estimator` — `db:read [listings, listing_analyses, verifications, viewings,
    renovation_estimates, searches]`, `db:write [renovation_estimates, listings]`; universal
    `webSearch` for cited cost ballparks. Action `scope`: turn condition evidence (dated-kitchen
    flags, confirmed damp, viewing notes) into ranged, cited works lines; merge the
    `works_needed` flag; the total feeds `totalCostWithWorks` and the negotiator's angles ("€9–14k
    of scoped works → open lower, cite the lines").
  - `diligence/verifier` — `db:read [listings, listing_analyses, viewings, verifications]`,
    `db:write [verifications, listing_analyses, listings, taste_signals]`. Actions: `collect`
    (turn a listing's open low-confidence findings + flags into `verifications` rows when a
    viewing is scheduled — the structured sibling of round 2's checklist json), `apply` (fold a
    resolution back in **deterministically** via `verificationDelta.ts`: confirmed ⇒ flag stays +
    confidence → 1.0; refuted ⇒ flag removed + the analysis annotated; either way a taste-grade
    signal is written — ground truth beats inference).
- **API** (9): `uploadContract` `POST api/listings/:id/contracts` (paste; fires the review hook);
  `getContract` `GET api/contracts/:id` (include findings, worst severity first);
  `reviewContract` `POST api/contracts/:id/review` (re-run after an edit); `renovationEstimate`
  `GET api/listings/:id/renovation` (the scoped lines + total range); `scopeRenovation`
  `POST api/listings/:id/renovation` (spawns the estimator); `totalCostWithWorks`
  `GET api/listings/:id/total-cost` (price/rent + the amortized works midpoint — the number that
  actually compares two listings, every line labelled); `listVerifications`
  `GET api/listings/:id/verifications`; `resolveVerification` `PATCH api/verifications/:id`
  (record status + evidence; fires the apply hook); `openVerifications`
  `GET api/searches/:id/verifications` (every open question across the shortlist — what to check
  next, grouped by viewing).
- **Hooks** (3): `review-new-contract` (**database** insert on `contracts` →
  `diligence/reader#review`; idempotent — skip unless `status === 'pending'`);
  `collect-verifications` (**database** insert on `viewings` → `diligence/verifier#collect`;
  runs alongside round 2's checklist hook on the same insert — different hooks may share a
  trigger; idempotent — skip if open verifications already exist for the listing);
  `apply-verification` (**database** update on `verifications` — guarded:
  `status !== 'open' && !applied` → `diligence/verifier#apply`, then `diligence/estimator#scope`
  when the resolved topic is condition-grade (damp/heating/condition) — the two-delegate
  imperative pattern).
- **Pages** (5): `/listings/:id/contract` (paste box + findings by severity, each showing its
  quoted clause + cited rule + `<Chat agent="diligence/reader">`), `/contracts/:id` (the
  plain-language summary + full findings), `/listings/:id/renovation` (scoped lines + the
  total-cost-with-works comparison), `/listings/:id/verifications` (the ledger: open questions →
  record what you saw; the post-viewing companion), `/searches/:searchId/diligence` (the shortlist
  diligence board: contract status, red flags, works totals, open verifications per listing).
- **Safety**: contract review is **information, not legal advice** (the guardian charter framing,
  shared) — findings quote the clause verbatim and cite the rule; the reader never paraphrases a
  clause into a stronger claim than its text supports, and an unmatched rule ⇒ `'caution'` with
  "verify with a local expert", never a fabricated `red_flag`. Works estimates are cited ranges;
  a scope the evidence can't support becomes a `structural_question` to raise at the viewing, not
  a number. Contract text is sanitized like every capture and never leaves the pod.

### Round 10 — the `lookout` space: see the whole board
Every hunter carries two quiet anxieties — "am I even seeing all the listings?" and "is now a good
time?" — and every finished hunt throws away what it learned. Round 10 adds a `lookout` space
(`spotter`, `economist`, `archivist`): source-coverage auditing, a market pulse computed from the
pod's **own accumulating data** with small-sample honesty, and a cross-hunt playbook so the next
search starts where this one ended.

- **Data**:
  - `coverage_reports` — the "are my sources enough?" audit: `id`, `searchId` FK (`cascade`, req),
    `gaps` (json — machine-readable findings: `stale_source` (an alert email that used to produce
    and went quiet), `missing_portal` (a major local portal with no source configured, cited),
    `filter_mismatch` (saved-search params vs the brief/must-haves), `budget_band_gap`), `body`
    (md — the narrative, cited), `createdAt`.
  - `market_snapshots` — the periodic pulse: `id`, `areaId` FK → `areas` (`setNull` — null = the
    search-city scope), `scope` (a label: area/rooms-band), `metrics` (json — the deterministic
    output of `marketStats.ts`: median asking €/m², days-on-market distribution, price-cut
    frequency, inventory in/out, **sampleSize**), `body` (md — the economist's cited read; below
    the minimum sample it says "too few data points" and claims nothing), `computedAt`.
  - `playbook_notes` — what transfers to the next hunt: `id`, `sourceSearchId` FK → `searches`
    (`setNull` — the hunt it was distilled from; the note itself is pod-durable), `scope`
    (`'sources' | 'taste' | 'process' | 'areas'`), `body` (md, cited — "the winner came from the
    OLX alert in week 2; the 'must see light in person' rule saved three wasted viewings"),
    `createdAt`.
  - **Additive enum values**: `searches.status` gains `'completed'` and `'abandoned'`;
    `alerts.kind` gains `'coverage_gap'` and `'market_shift'`.
- **Agents** (least-privilege):
  - `lookout/spotter` — `db:read [searches, sources, raw_captures, listings, coverage_reports]`,
    `db:write [coverage_reports, alerts]`; universal `webSearch` (the locale's portal landscape,
    cited). Action `scan`: staleness math over `sources.lastIngestedAt`/capture history, portal
    coverage vs the cited landscape, saved-search filters vs the brief — one `'coverage_gap'`
    alert per new gap, never repeated for a known one.
  - `lookout/economist` — `db:read [areas, listings, listing_events, market_snapshots,
    searches]`, `db:write [market_snapshots, alerts]`; universal `webSearch` (rate moves, new
    regulation — context only, cited). Actions: `pulse` (the weekly cron delegate — compute
    snapshots per area/rooms band from the pod's own listings + events), `timing` (the
    when-to-offer read for a listing: its days-on-market + cut history vs the snapshot
    distribution — "top-quartile stale with one cut already; waiting is cheap here"). A material
    inter-snapshot move raises one `'market_shift'` alert.
  - `lookout/archivist` — `db:read [searches, sources, listings, listing_events, taste_notes,
    taste_signals, decision_entries, hunt_reports, playbook_notes]`, `db:write [playbook_notes]`.
    Action `distill`: when a hunt completes (or is abandoned), write the cited playbook — which
    sources produced, which taste notes survived contact with reality (verification outcomes!),
    what the journal says actually killed each finalist — so `coach/interviewer` seeds the next
    search from evidence, not folklore.
- **API** (9): `coverageReport` `GET api/searches/:id/coverage` (latest + gaps); `runCoverage`
  `POST api/searches/:id/coverage` (spawns the spotter); `areaMarket` `GET api/areas/:id/market`
  (snapshot history for an area); `searchMarket` `GET api/searches/:id/market` (the search-scoped
  pulse across its areas); `runPulse` `POST api/searches/:id/market` (spawns the economist);
  `offerTiming` `GET api/listings/:id/timing` (the cited when-to-offer read); `playbook`
  `GET api/playbook` (pod-wide notes, newest first); `addPlaybookNote` `POST api/playbook` (the
  user's own lessons join the agents'); `retrospective` `GET api/searches/:id/retrospective` (the
  whole hunt assembled: timeline from events + journal + reports, the winner's provenance, the
  distilled notes). Completing a hunt rides the existing `updateSearch` (`status:'completed'`).
- **Hooks** (3): `coverage-checkup` (**cron** `every:'7d'` → `lookout/spotter#scan`,
  declarative); `market-pulse` (**cron** `every:'7d'` → `lookout/economist#pulse`, declarative);
  `archive-completed-search` (**database** update on `searches` — guarded:
  `status ∈ {completed, abandoned}` and no playbook notes distilled from it yet →
  `lookout/archivist#distill`).
- **Pages** (5): `/searches/:searchId/coverage` (the gap audit + fix-it actions: add the missing
  source, fix the filter), `/market` (the pod-wide pulse dashboard: snapshot tiles per area/band,
  sample sizes always visible), `/listings/:id/timing` (the when-to-offer read beside the
  negotiation brief), `/playbook` (the durable lessons, agent- and user-written),
  `/searches/:searchId/retrospective` (the hunt's story — also the emotional close-out screen).
- **Cross-agent updates (additive)**: `scout/appraiser` and `advisor/negotiator` gain
  `db:read [market_snapshots]` (comps get market context; angles cite the pulse); `coach/pacer`
  reads them too ("inventory rising — waiting is cheap" enters the pace advice);
  `coach/interviewer` gains `db:read [playbook_notes]` (the next hunt's day-one interview opens
  with last hunt's lessons).
- **Safety**: market claims are **deterministic stats over the pod's own rows with the sample size
  always attached** — below the minimum n the economist explicitly declines to see a trend
  (small-sample honesty is a charter rule, not a hope); web context is cited and never blended
  silently into the numbers. Coverage advice names portals, never disparages them. The playbook
  contains lessons about *the hunt*, not personal data about counterparties.

## Engine reconciliation (round-1 build notes)

Grounded in the **shipped** engine (`sdk/org/libs/{core,cli}`, built through Phase 8;
`system-appbuilder` is not built, so `homes` is **hand-authored** under `store/projects/homes/`, no
THING/appbuilder delegation to scaffold it). Honest reconciliation of the spec against the real
runtime:

- **Ingest is pasted text, not email infrastructure.** There is no inbound-email endpoint, no IMAP,
  and no multipart upload in the api runtime (JSON `Input` validated by ajv) — so "forwarded alert
  emails" means the user **pastes the email body** into the inbox (`ingestCapture.content`), the
  same reconciliation the trips document-upload made. A bare pasted URL is a capture whose `content`
  is the URL; the clipper `webFetch`es it. True mail-in ingestion is deferred with the platform.
- **Scraping is text-fetch + deterministic parsing, not a headless browser.** The universal
  `webFetch` returns the page as text — there is no browser binding, no JS execution, no
  form/login automation. The scraping `functions/` (`parsePortalHtml.ts`, `paginateSavedSearch.ts`,
  …) therefore work on server-rendered HTML and embedded JSON-LD; a portal that renders listings
  only client-side degrades gracefully to the paste/alert-email path (the clipper notes it in the
  source's `notes`). Politeness is deterministic, not promised: `robotsAllowed.ts` +
  `politeFetchPlan.ts` gate every poll, auth walls are never circumvented, and a block page sets
  `blockedReason` and stops the source.
- **`ask` components are top-level-chat-only** (the standing engine fact: `ask` is stripped from
  fork/delegate DTS) — `ConfirmMerge` and `TasteQuiz` fire only in chat sessions; every
  hook-driven path has a stated headless fallback (borderline dedupe ⇒ keep separate +
  `possible_duplicate` flag; no quiz ⇒ learn from ordinary signals).
- **"Reads the photos" is staged — the shipped engine has no image-input pipeline.** `webFetch`
  returns text; there is no vision binding. Round-1 photo/floor-plan analysis therefore works from
  **text evidence**: photo captions/alt text captured with the URLs, per-room dimensions printed in
  the listing or floor-plan caption (summed by the deterministic `sumRoomAreas.ts` vs stated m²),
  description-vs-structured-field contradictions, and counts ("2 photos for a 5-room flat" →
  flag). Findings that would need real pixel access are out of round-1 scope and the analyst's
  charter forbids inferring them; a genuine vision pass arrives with an image-capable model binding
  (aspirational, alongside the external-binding registry). The spec's photo-forensics knowledge
  files are written now so the analyst uses vision the day it exists.
- **No external geocoding/directions/rates bindings** — `mapsSearch`/`weatherLookup`-style named
  bindings don't exist (no external-binding registry; the standing sibling reconciliation). The
  locator and surveyor use the **universal `webSearch`/`webFetch`** (gated only by `functions:`
  frontmatter) for coordinates, transit estimates, and reference rates — always cited
  (`commutes.basis`, `location_guesses.method`), always approximate (±). Their `api:call` allow
  stays reserved for the app's own typed endpoints.
- **No map tiles in pages** — no map library dependency in v1; the location guess renders as
  coordinates + radius + confidence + the cited method, with an outbound OpenStreetMap link
  (token-gated styling; no embedded tile raster).
- **`db.query` `where` is equality-only** (+ `include`/`orderBy`/`limit`/`offset`) — feed
  filtering/sorting, comp sets, and the compare assembly query-all then filter/sort in JS. The
  denormalized `raw_captures.searchId` / signal `searchId` columns exist exactly so self-scanning
  agents can scan without join gymnastics.
- **Hook `delegate(ref, action, {input})` drops the input** (the sibling-established engine fact) —
  so every hook-invoked action **self-scans**: `clipper#parse` scans `pending` captures,
  `surveyor#normalize` scans listings with `trueCostMonthly === 0`, `analyst#analyze` scans listings
  without analyses, `locator#locate` scans listings without guesses, `ranker#rank` scans
  `score === 0` or changed listings, `ranker#learn` scans `folded === false` signals. Idempotence
  markers live in the rows themselves (`status`, `folded`, existence checks).
- **Named delegate actions need an `actions:` frontmatter entry** (empty tasklist ⇒ model-driven);
  every `#action` above is declared.
- **Deterministic work lives in space `functions/`, never model prose** — math (`trueCost.ts`,
  `sumRoomAreas.ts`, `haversine.ts`, `blendScore.ts`, `formatMoney.ts`, `parseMoney.ts`), identity
  (`dedupeKey.ts`), and the whole scraping toolkit (`parseAlertEmail.ts`, `parsePortalHtml.ts`,
  `extractListingFields.ts`, `paginateSavedSearch.ts`, `robotsAllowed.ts`, `politeFetchPlan.ts`)
  — the sibling "avoid fragile model math" lesson extended to parsing and throttling. Writes happen
  in **single non-`forEach` task loops** (the proven-reliable pattern); `forEach` fan-out is
  read-only (`deep-sweep`'s `reverify_each`).
- **Row-type singularizer**: `searches→Search`, `sources→Source`, `raw_captures→RawCapture`,
  `listings→Listing`, `listing_analyses→ListingAnalysis`, `location_guesses→LocationGuess`,
  `commutes→Commute`, `taste_signals→TasteSignal`, `taste_notes→TasteNote`, `alerts→Alert`.
- **Both project-scoped spaces are built in the FULL space format from round 1** (not
  `agents/`-only), deliberately exercising **every surface of the format**: every agent ships
  `charter.md` + `instruct.md` with config-bearing `capabilities:`, declared `actions:` and a
  `defaultAction`; the spaces ship tasklists covering all three roles plus a `forEach` fan-out and
  a task-level `canDelegateTo` (`intake/parse-captures`, `scout/learn-taste`, `scout/deep-sweep`);
  typed `functions/` (math + the scraping toolkit); catalog `components/` of **both kinds** —
  `view/` (CaptureSummary, TasteNoteCard, LocationGuessCard) and `ask/` (ConfirmMerge, TasteQuiz),
  token-gated; and **extensive `knowledge/`** — each field an `index.md` overview + ≥2
  `<aspect>.md` deep-dives:
  - `intake`: `listing-parsing/` (`portals-and-alert-emails.md`, `dedupe-and-canonicalization.md`,
    `polling-and-politeness.md`), `true-cost/` (`rent-fees-and-utilities.md`,
    `buyer-costs-and-mortgage.md`), `commute-estimation/` (`transit-heuristics.md`,
    `mode-tradeoffs.md`).
  - `scout`: `photo-forensics/` (`condition-and-dating-cues.md`, `light-and-orientation.md`,
    `staging-and-wide-angle-tricks.md`), `floorplan-measurement/` (`dimensions-and-scale.md`,
    `layout-red-flags.md`), `listing-mismatch/` (`text-vs-evidence-contradictions.md`,
    `too-good-to-be-true.md`), `location-triangulation/` (`fuzzed-pin-strategies.md`,
    `clue-extraction-and-intersection.md`), `taste-learning/` (`signals-to-preferences.md`,
    `scoring-and-explanations.md`).

### Round-2 reconciliation (advisor, appraiser, listing events)
Round 2 folds "act before someone else does" in as **shipped** implementations, reconciled against
the same engine (engine *usage*, no engine changes):

- **Hook `delegate(ref, action, {input})` drops the input** (the standing engine fact) — every
  round-2 hook action **self-scans**: `inspector#checklist` scans viewings with an empty
  `checklist`, `counsel`'s outcome pass scans `outcome !== 'pending' && !outcomeRecorded`, `digest`
  scans the day's rows. **Database hooks on `update` events see the row, not a field diff** — so
  idempotence markers live in the rows themselves (`outcomeRecorded`), the same pattern as round
  1's `folded`.
- **The enrich edit is additive and depth-neutral** — `scout/appraiser#appraise` is appended as the
  fifth sequential delegate inside the SAME `enrich-new-listing` session; the round-1 depth
  accounting holds unchanged.
- **Comps are db-only** — the search's own listings are the comp set (`db.query` equality-only →
  query-all + JS banding in `functions/compsBand.ts`); there is no external market-data binding.
  Every fairness read cites its comp rows.
- **No send channel exists** — `inquiries.status:'sent'` is user-recorded; the digest is an in-app
  `alerts` row, not an email/push (no outbound messaging capability, and none is invented).
- **Row-type singularizer (new tables)**: `inquiries→Inquiry`, `viewings→Viewing`,
  `listing_events→ListingEvent`.
- **`advisor` is born full-format**: charter+instruct per agent; `tasklists/draft-inquiry/` +
  `tasklists/build-checklist/`; typed `functions/` (`compsBand.ts`, `checklistFromFlags.ts`,
  `daysOnMarket.ts`); catalog `components/` (InquiryDraftCard, ChecklistCard — token-gated);
  knowledge fields each `index.md` + ≥2 aspects: `inquiries/` (`what-landlords-respond-to.md`,
  `tone-and-facts.md`), `viewings/` (`what-to-verify-on-site.md`, `reading-a-building.md`),
  `market-timing/` (`relistings-and-price-cuts.md`, `acting-fast-safely.md`).

### Round-3 reconciliation (district)
- **No geocoding binding** — area centroids and clue coordinates come from the universal
  `webSearch`/`webFetch`, cited in `areas.summary`/`area_notes.body`; the profiler's
  listing→area assignment is the deterministic `haversine.ts` against centroids, and a weak/wide
  guess **stays unassigned** rather than force-matched.
- **Area fit is the deterministic-blend pattern again** — `functions/areaFit.ts` (taste-note
  weights × area-note topics + commute-target reachability) computes the 0..100; the matchmaker
  *writes the cited rationale*, never the arithmetic.
- **`survey-new-area` is one imperative hook with two sequential delegates** (profiler → geographer)
  — the round-1 depth-shaping rationale; its per-hook cooldown coalesces the guess bursts a
  multi-listing capture produces.
- **`'safety_pointers'` is charter-constrained** to cited official/statistical sources phrased as
  visit check-items — the no-demographic-profiling rule is a guardrail in every `district` charter,
  not prose in a prompt.
- **Row-type singularizer**: `areas→Area`, `area_notes→AreaNote`, `area_scores→AreaScore`.
- **`district` is born full-format** — `tasklists/survey-area/` + `tasklists/fit-areas/`; functions
  (`areaFit.ts`, `areaKey.ts` label+city dedupe, `haversine.ts` shared via space copy); components
  (AreaDossierCard, FitBar); knowledge: `area-research/` (`sources-and-verification.md`,
  `what-makes-a-dossier-useful.md`), `neighbourhood-fit/` (`taste-to-place-mapping.md`,
  `commute-vs-character-tradeoffs.md`).

### Round-4 reconciliation (finance, negotiator)
- **No rates API binding** — reference rates come from `webSearch`, cached as cited
  `rate_snapshots` (source + date), and every scenario figure carries its `rateSource`. A rate the
  underwriter can't verify becomes a clearly-labelled assumption, never a fabricated number.
- **All money math is typed functions** — `amortize.ts`, `afford.ts` (share-of-income + stress
  margin), `rentVsBuyHorizon.ts`, reusing round-1 `formatMoney.ts`/`parseMoney.ts`; the model maps
  evidence and writes labelled breakdowns, the functions compute (the standing "no model
  arithmetic" lesson).
- **`finance_profiles` hold coarse user-typed numbers only** — the charter forbids requesting
  documents, statements, or account details; "information, not advice; verify with your
  bank/broker" is charter text injected into every fork.
- **Update-event guards live in row state** — `scenario-on-shortlist` checks
  `status === 'shortlisted'` + search mode + an existing-scenario query (update hooks see the row,
  not the diff); `negotiate-on-price-drop` guards on `listing_events.kind` + a fresh-brief check.
- **Row-type singularizer**: `finance_profiles→FinanceProfile`, `finance_scenarios→FinanceScenario`,
  `rate_snapshots→RateSnapshot`, `negotiation_briefs→NegotiationBrief`.
- **`finance` is born full-format** — `tasklists/build-scenarios/`; functions above; components
  (ScenarioCard, StressGauge — token-gated, `text-destructive` for over-ceiling); knowledge:
  `mortgages/` (`rates-terms-and-amortization.md`, `closing-and-recurring-costs.md`),
  `affordability/` (`stress-testing.md`, `rent-vs-buy-framing.md`), `negotiation/`
  (`evidence-based-angles.md`, `what-not-to-claim.md`) — the last shared with
  `advisor/negotiator`'s charter.

### Round-5 reconciliation (household)
- **Stakeholders are rows, not users** — the pod stays single-user (one screen, one session); no
  auth change, no cross-user routing, no deviation from the parent plan's authz model.
- **The vote upsert is handler logic** — the schema language has no compound-unique constraint, so
  `castVote` queries by `stakeholderId`+`listingId` (equality-only) and inserts-or-updates; the
  matrix invariant is enforced in one place.
- **`journal-pipeline-moves` fires on every `listings` update** — including the ranker's frequent
  score writes — so the chronicler's compare-to-last-journal-entry guard (query the listing's
  latest `decision_entries` row; return when `status` unchanged) is what keeps the journal quiet;
  the per-hook cooldown backs it. Self-write exclusion already prevents the chronicler re-firing
  itself.
- **`taste_notes.stakeholderId` is an additive column** — null = shared household taste, so every
  round-1 note remains valid unchanged and the ranker's round-1 behaviour is preserved when no
  stakeholders exist.
- **Row-type singularizer**: `stakeholders→Stakeholder`, `stakeholder_votes→StakeholderVote`,
  `decision_entries→DecisionEntry`.
- **`household` is born full-format** — `tasklists/reconcile-votes/`; functions
  (`voteMatrix.ts`, `splitDetector.ts` — deterministic conflict detection the mediator narrates);
  components (VoteChips, ConflictMatrix); knowledge: `group-decisions/`
  (`surfacing-disagreement-neutrally.md`, `briefs-to-preferences.md`), `decision-memory/`
  (`what-to-journal.md`, `retrospectives-that-help.md`).

### Round-6 reconciliation (closer)
- **No blob store / multipart** (the standing round-1 fact) — `application_items` track documents
  as labels + `done` flags + user notes, **never contents**; the charter forbids pasting sensitive
  document contents (ID numbers, payslips, statements) into the db — reference by name only.
- **Locale dossier norms via `webSearch`, cited** in item notes; where norms can't be verified the
  applicant writes a generic checklist and says so.
- **`prepare-movein` guards on row state** — `status === 'accepted'` + a no-`'movein'`-items query
  (update hooks see rows, not diffs); a second `accepted` write is a no-op.
- **Nudges are in-app only** — there is no push/email channel; `followup-nudges` coalesces to at
  most one `'followup_due'`/`'deadline_soon'` alert per search per day (the digest lesson).
- **Row-type singularizer**: `applications→Application`, `application_items→ApplicationItem`,
  `contacts→Contact`, `deadlines→Deadline`.
- **`closer` is born full-format** — `tasklists/build-dossier/` + `tasklists/movein-runbook/`;
  functions (`dueSoon.ts`, `staleness.ts`); components (DossierChecklist, DeadlineRow); knowledge:
  `applications/` (`rental-dossiers-by-locale.md`, `offers-and-terms.md`), `closing/`
  (`deadline-discipline.md`, `movein-runbook.md`).

### Round-7 reconciliation (guardian)
- **Risk is a deterministic signal blend, narrated — never model-declared fraud.** The scam
  signals are typed functions (`scamSignals.ts` — pattern tests over the listing's own text +
  price-vs-comps outlier math; `textSimilarity.ts` + shared-photo-URL checks for
  `recycled_content`, run **against the db only** — equality-only `where`, query-all + JS). The
  screener maps evidence to the fired signals and writes the cited body; `riskScore` comes out of
  the function.
- **Vetting and rights ride the universal `webSearch`/`webFetch`, cited** — no registry/review-site
  API bindings exist. Vetting notes are **quotes with links** (defamation-safe framing enforced by
  charter: attributed quotes, confidence, never the app's own claim about a person); rights notes
  carry `sourceQuality` and the "information, not legal advice" charter framing. An unverifiable
  rule stays `'unverified'` and the fee audit marks the line `unknown`, not `over-cap`.
- **Fee legality is a deterministic cross-check** — `feeAudit.ts` compares `costBreakdown` lines
  against the numeric caps parsed from cited `rights_notes`; the model writes the explanation,
  the function does the comparison.
- **The enrich edit is additive and depth-neutral** — screener appended as the sixth sequential
  delegate in the SAME hook session, deliberately **after** `appraise` (it consumes the comps
  analysis for the below-comps outlier signal); the round-1 depth accounting still holds.
- **Row-type singularizer**: `screenings→Screening`, `rights_notes→RightsNote`,
  `vetting_notes→VettingNote`.
- **`guardian` is born full-format** — `tasklists/screen-listing/` + `tasklists/rights-brief/`;
  functions (`scamSignals.ts`, `textSimilarity.ts`, `feeAudit.ts`); components (RiskBadge,
  SignalRow — token-gated); knowledge: `scam-patterns/` (`classic-rental-scams.md`,
  `pressure-and-payment-red-flags.md`), `tenant-rights/` (`researching-local-rules.md`,
  `fees-deposits-and-caps.md`), `vetting/` (`public-footprint-reads.md`,
  `quoting-not-accusing.md`).

### Round-8 reconciliation (coach)
- **The interview is ask-driven, therefore chat-only** (the standing `ask` fact) — the interviewer
  runs its structured flow through ask components in a top-level session; there is no headless
  interview. A search created without one simply cold-starts from the brief (round-1 behaviour,
  preserved).
- **Pace math is deterministic** — `huntMetrics.ts` (rates, conversion, days-left projection)
  computes; the pacer narrates and suggests. The urgency term is a `blendScore` **input**
  (`moveInBy` proximity), not model arithmetic; with no `moveInBy` set the term is zero and
  round-1 scores are unchanged.
- **The viewing pack is markdown rendered client-side with print CSS** — there is no PDF/binary
  generation pipeline (the standing no-blob fact); "printable" means a print-styled page, and the
  pack contains only rows already in the db.
- **Resurfacing is evidence-gated and idempotent** — `rescan` triggers only off concrete rows
  (`listing_events` price/`back_online`, recomputed blend clearing the threshold), writes one
  `resurfacings` row per (listing, trigger), and both resolutions write taste signals — the
  learn loop closes either way. Amenity/energy extraction lands in `parseAlertEmail`/
  `parsePortalHtml`/`extractListingFields` (functions, per round 1), so the clipper's charter
  ("never invent a field") covers them automatically.
- **Row-type singularizer**: `hunt_reports→HuntReport`, `resurfacings→Resurfacing`,
  `viewing_packs→ViewingPack`.
- **`coach` is born full-format** — `tasklists/day-one-interview/` + `tasklists/weekly-checkup/`;
  functions (`huntMetrics.ts`, `packContent.ts`); components (`ask/InterviewStep.tsx` — the
  third ask component, MetricTile, SecondChanceCard — token-gated); knowledge: `hunt-craft/`
  (`pacing-a-deadline-hunt.md`, `when-to-widen-criteria.md`), `taste-elicitation/`
  (`interview-questions-that-work.md`, `tradeoffs-not-wishlists.md`).

### Round-9 reconciliation (diligence)
- **Contracts are pasted text** (the standing no-blob/no-multipart fact) — `contracts.content` is
  the pasted lease/terms text, sanitized like every capture; a scanned-PDF lease means the user
  pastes the text they can copy. Clause segmentation (`clauseSplit.ts`) and the mandatory-terms
  checklist (`mandatoryTerms.ts` — matched against cited `rights_notes`) are deterministic
  functions; the reader quotes and explains, the functions segment and match.
- **Severity is rule-bound, not vibes** — `red_flag` requires a matched cited rule (or a
  contradiction with the listing's own stated terms); an unmatched concern is `caution` with
  "verify with a local expert". This is the guardian framing extended to contracts:
  information, not legal advice; quote, don't paraphrase-and-escalate.
- **Works estimates are ranged and cited** — `worksCost.ts` does the per-scope range math and the
  amortize-into-monthly for `totalCostWithWorks` (reusing round 4's amortization); ballpark rates
  come from `webSearch`, cited in `basis`; evidence that can't support a scope yields a
  `structural_question`, never a number.
- **Verification application is deterministic** — `verificationDelta.ts` maps
  confirmed/refuted/unclear onto flag/confidence updates; the `applied` cursor makes the
  update-event hook idempotent (rows, not diffs — the standing pattern). Two hooks share the
  `viewings` insert trigger (round 2's checklist + round 9's collect) — legal, both idempotent,
  and self-write exclusion keeps each from re-firing itself.
- **Row-type singularizer**: `contracts→Contract`, `contract_findings→ContractFinding`,
  `renovation_estimates→RenovationEstimate`, `verifications→Verification`.
- **`diligence` is born full-format** — `tasklists/review-contract/` + `tasklists/scope-works/`;
  functions (`clauseSplit.ts`, `mandatoryTerms.ts`, `worksCost.ts`, `verificationDelta.ts`);
  components (`view/ClauseFinding.tsx`, `view/WorksEstimate.tsx`, `ask/VerifyAtViewing.tsx` — the
  post-viewing record-what-you-saw chat flow, ask = chat-only as ever, with the page form as the
  headless-equivalent path); knowledge: `contracts/` (`lease-red-flags.md`,
  `mandatory-terms-by-locale.md`), `works/` (`cost-ballparks-and-ranges.md`,
  `spotting-hidden-work.md`), `verification/` (`observation-vs-inference.md`,
  `resolving-findings.md`).

### Round-10 reconciliation (lookout)
- **The market data is the pod's own db** — `marketStats.ts` computes medians/percentiles,
  days-on-market distributions, and cut frequencies over the pod's accumulated `listings` +
  `listing_events` (equality-only `where` → query-all + JS, as ever), with a **minimum-sample
  gate baked into the function**: below n the metrics carry `insufficient: true` and the
  economist's charter forbids trend claims over them. `webSearch` context (rates, regulation) is
  cited prose, never silently blended into the numbers.
- **Coverage math is deterministic** — `coverageGaps.ts` computes source staleness (capture
  cadence vs history) and filter/brief mismatches; the portal-landscape comparison is the
  spotter's cited `webSearch` read. Gap alerts dedupe against the previous report's `gaps` (one
  alert per NEW gap — the digest lesson).
- **The playbook is the db-backed durable-memory pattern again** — `playbook_notes` is a table,
  NOT a runtime write into any space's `knowledge/` (the standing rule: runtime agents hold no
  `knowledge:write`; promoting a playbook lesson into space knowledge stays a THING →
  `system-appbuilder` authoring action). `coach/interviewer` reads the table — memory flows
  through the db, exactly like `taste_notes`.
- **`archive-completed-search` guards on row state** — `status ∈ {completed, abandoned}` + a
  no-notes-distilled-yet query (update hooks see rows, not diffs); re-saving a completed search
  is a no-op. `searches.status` gains values additively — round-1 `'active'`/`'paused'` behaviour
  is untouched, and the pollers/crons already skip non-`active` searches.
- **Row-type singularizer**: `coverage_reports→CoverageReport`,
  `market_snapshots→MarketSnapshot`, `playbook_notes→PlaybookNote`.
- **`lookout` is born full-format** — `tasklists/market-pulse/` + `tasklists/distill-playbook/`;
  functions (`marketStats.ts`, `coverageGaps.ts`, `retroTimeline.ts` — the retrospective's
  deterministic assembly); components (`view/MarketTiles.tsx` — sample size always rendered,
  `view/CoverageGapCard.tsx`); knowledge: `market-reading/` (`small-sample-honesty.md`,
  `timing-signals.md`), `coverage/` (`portal-landscapes.md`, `tuning-saved-searches.md`),
  `hunt-memory/` (`what-transfers-between-hunts.md`, `distilling-a-playbook.md`).

## Phases & order

Assumes the parent plan's engine (db + capability globals, api runtime, typed-contract build, pages
build, hooks runtime, chat) exists. Homes-specific work on top:

1. **Schemas** — the ten `database/*.json`; verify FK/relations resolve (search → listing →
   analyses/guesses/commutes; signals/alerts `setNull`), `dedupeKey` unique, required descriptions
   pass the fail-loud loader; row + relation types generate (`Listing.analyses`, `Search.listings`).
2. **Spaces** — `intake` (clipper, surveyor) + `scout` (analyst, locator, ranker) in full format:
   config-bearing `capabilities:` per the tables above, `actions:` declared, charters with the
   no-invention/citation guardrails, tasklists, the deterministic `functions/`, knowledge fields.
3. **API** — the 19 endpoints; `ingestCapture` inserts-and-returns (hook does the rest);
   `saveListing`/`dismissListing` write the taste signal.
4. **Hooks** — `parse-new-capture`, `enrich-new-listing` (the one-hook sequential scout pipeline),
   `learn-from-signal`, `refresh-tracked-listings`, `poll-saved-searches`; confirm the depth
   accounting (refresh/poll-path ingest still fully enriches) and idempotence guards.
5. **Pages** — feed (ranked cards, save/dismiss, alert strip), inbox (paste + live parse status),
   listing detail (analyses/guess/commutes + chat), compare, taste page; wire `useApi`/
   `useApiMutation` + the three `<Chat>` widgets; live-poll while captures pend; design-token gate
   (no raw colors).
6. **Serving** — seed each pod's `homes` project from the checked-in template; serve under generic
   `lmthing.app/homes/*`; Studio manages it under `/api/projects/homes/app`. (Store install +
   friendly alias are later phases.)
7. **Expansion rounds 2–10** (§Additional features), in order: `advisor` (inquiries, viewings,
   pipeline, digest, events + comps) → `district` (area dossiers, listing↔area assignment, fit +
   discovery) → `finance` (profiles, scenarios, cited rates, negotiation briefs) → `household`
   (stakeholders, votes, conflicts, journal, per-person taste) → `closer` (applications, dossier
   checklists, contacts, deadlines, move-in) → `guardian` (scam screening, rights + fee audit,
   counterparty vetting) → `coach` (deadline pacing, day-one interview, second chances,
   cash-to-move-in, viewing packs) → `diligence` (contract review, works scoping, the
   verification ledger) → `lookout` (coverage audit, market pulse, the cross-hunt playbook).
   Each round is strictly additive — a new full-format space + its tables/endpoints/hooks/pages —
   and lands with its own reconciliation (§Engine reconciliation) and verification pass before
   the next begins.
8. **Docs** — fold into `org/format/project/` as a worked example.

## Verification (end-to-end, local)

1. Load the `homes` project → schemas validate (descriptions/FK/relations/unique `dedupeKey`),
   `types/generated.d.ts` has all ten row types with relation fields
   (`Listing.analyses: ListingAnalysis[]`, `Search.listings: Listing[]`).
2. `lmthing serve`; `GET localhost:8080/app/homes/` renders the searches list (client-side), which
   calls `GET …/app/homes/api/searches`.
3. `createSearch { title:'Lisbon 2-bed', mode:'rent', budgetMax:1600, commuteTargets:[office] }`,
   then `ingestCapture` with a pasted alert-email fixture containing 3 listings (live model):
   `parse-new-capture` fires → clipper writes 3 `listings` (sanitized, deduped) →
   `enrich-new-listing` fires per insert → surveyor writes `trueCostMonthly`+`costBreakdown`+
   `commutes`, analyst writes `listing_analyses` (+ a `size_overstated` flag on the fixture whose
   room dims sum below the stated m²), locator writes a `location_guesses` row (radius +
   confidence + cited method), ranker writes `score`/`scoreSummary` — the feed shows ranked cards
   growing chips live.
4. **Dedupe**: re-ingest a second capture containing one of the same units from another portal →
   no new row; the existing listing's `portal` unions, `lastSeenAt` bumps, capture summary says
   "1 merged".
5. **Taste loop**: `dismissListing { reason:'too dark' }` → `learn-from-signal` fires →
   `taste_notes` gains/strengthens a cited `light` statement (`folded` flips) → re-rank visibly
   demotes another dark-flagged listing; `saveListing` on a bright one strengthens the opposite.
   The taste page lists the statements with citations.
6. **Alerts**: a subsequent ingest containing a strong match (fits constraints + taste) →
   `alerts` row of kind `new_match` appears on the bell + feed strip; `markAlertRead` clears it.
7. **Refresh + poll**: run the `refresh-tracked-listings` hook manually
   (`POST /api/projects/homes/hooks/refresh-tracked-listings/run`) against a fixture where one
   tracked URL 404s and one shows a lower price → `status:'gone'` on the first (+ `gone` alert),
   price + `price_drop` alert on the second; restart → one boot catch-up run, no double-run.
   Enable polling on a `saved_search` source pointed at a fixture results page → `pollSource` →
   `paginateSavedSearch`/`parsePortalHtml` yield `raw_captures` → the normal pipeline runs; a
   fixture whose `robots.txt` disallows the path → `blockedReason` set, polling auto-disabled, no
   fetch made; a not-due source is skipped by `politeFetchPlan`.
7b. **forEach + ask**: run `scout/deep-sweep` from chat with 3 shortlisted listings →
   `reverify_each` fans out one read-only fork per listing (parallel; one forced-slow fork
   salvages partial, the sweep completes) → `write_findings` lands rows in one loop. A borderline
   dedupe in a chat session raises `ConfirmMerge` and honors the answer; the same fixture through
   the headless hook path keeps both rows + `possible_duplicate` flags.
8. `apiCall('dismissListing', { id, reason: 42 })` with `reason` as a number **fails the agent
   typecheck** (DTS overload); an un-allowlisted `apiCall` name → host error naming allowed names;
   a `db.write` to a table outside an agent's `tables` scope → host error naming the allowed
   tables.
9. Chat: `<Chat agent="scout/ranker">` "stop penalizing 4th-floor walk-ups" → a `taste_notes`
   update + re-rank, feed reflects it; history under `homes/spaces/scout/sessions/`.
10. Backup: `app.sql` + schemas + pages + api + hooks + both spaces committed; `**/sessions/` not;
    restore rebuilds `app.db` from `app.sql`.

**Expansion-round verification** (each round re-runs 1–10 green, plus its own pass):

- **R2**: `scheduleViewing` → checklist hook → items derived from that listing's real flags; set
  `outcome:'rejected'` + notes → exactly one `'viewed'` taste signal (`outcomeRecorded` flips; a
  second update is a no-op); enrich now ends with a cited `'comps'` analysis; `daily-digest` run →
  one coalesced `'digest'` alert; a `refresh` price drop lands a `listing_events` row + the
  timeline page shows it. Inquiry drafts contain only stated facts; nothing sends.
- **R3**: a new location guess → profiler assigns `areaId` (weak guess stays unassigned) →
  geographer writes a cited dossier once (second guess in the same area is a no-op); a taste-note
  insert → `refit-areas-on-taste` recomputes `area_scores` (coalesced under burst); `discover`
  raises an `'area_suggestion'` alert for a fitting un-searched area.
- **R4**: shortlisting a buy-mode listing → `scenario-on-shortlist` builds labelled scenarios off
  the profile + freshest cited rate (rent-mode: no-op); a price-drop event → one negotiation brief
  citing the event/comp rows; `listingAffordability` figures match the deterministic functions
  exactly; every figure carries `rateSource` + date.
- **R5**: `addStakeholder` with a brief → tagged taste notes appear; two opposing votes on a
  shortlisted listing → `'household_conflict'` alert + the conflicts matrix shows the split + the
  ranker's `scoreSummary` names it; a re-vote updates (not duplicates) the cell; score-only writes
  produce **zero** journal entries, a status move produces exactly one.
- **R6**: `createApplication` → cited dossier checklist; `status:'accepted'` → move-in items +
  deadlines exactly once; overdue deadline + stale submitted application → one coalesced nudge
  alert per search per day; no `application_items.note` contains document contents.
- **R7**: a scam-bait fixture (below-comps price + "wire deposit, viewing impossible" language +
  photos duplicated from another db listing) → screening fires the expected signals, cited to the
  exact text/rows, `'scam_risk'` alert past threshold; the same fixture minus the language scores
  lower (signals are independent); a fee line over a cited cap → `questionable_fee` flag citing
  BOTH the line and the rule (uncited rule ⇒ `unknown`, no flag); `draftInquiry` → vetting note
  (quotes + links) lands before the draft is approved; enrich now ends screener-last and the
  round-1 depth accounting still passes.
- **R8**: interview in chat seeds cited taste notes + `moveInBy` (headless session: no interview,
  brief-only cold start — no error); `weekly-checkup` writes a report whose metrics equal
  `huntMetrics.ts` output and raises at most one `'pace_warning'`; dismissing a listing then
  ingesting its price drop into range → exactly one `resurfacings` row; accept flips it to
  `'new'` + writes a signal, decline reinforces the dismissal and never re-suggests that trigger;
  checklist write → one viewing pack; `upfrontCost` lines are all labelled; amenity filter narrows
  the feed without a schema change.
- **R9**: paste a lease fixture with an over-cap deposit clause and a missing mandatory term →
  one `red_flag` finding quoting the clause + citing the rights rule, one `missing_term` finding,
  a `'contract_red_flag'` alert, and a plain-language summary; a concern with no matched rule ⇒
  `caution`, never `red_flag`. Scheduling a viewing → checklist (R2) AND open `verifications`
  (R9) from the same insert, each exactly once; `resolveVerification { status:'refuted' }` on the
  poor-light question → the flag is removed, the analysis annotated, a taste signal written, and
  a second resolve is a no-op (`applied`); a confirmed damp resolution → the estimator scopes a
  ranged, cited works line and `totalCostWithWorks` equals the deterministic function output.
- **R10**: with fewer than the minimum comparable rows the snapshot carries
  `insufficient: true` and the economist's body claims no trend; seeding 20+ listings across two
  areas → snapshot medians equal `marketStats.ts` golden output and `offerTiming` cites the
  listing's own days-on-market vs the distribution; silencing a previously-producing alert-email
  source for 14 days → exactly one `'coverage_gap'` alert (the next scan does not re-alert the
  same gap); `updateSearch { status:'completed' }` → the archivist distills cited playbook notes
  exactly once (a re-save is a no-op), and a new search's day-one interview surfaces them.

## Notes

- **Reuses the parent engine wholesale** — no homes-specific runtime; this is data + agents + pages
  + hooks on the shared layer. If a mechanism is missing here, it belongs in
  [the project-as-application model](../org/format/project/README.md), not a homes fork.
- **Why it's a good AI-assisted app** — listing triage is exactly the work models are for: reading
  many messy documents against a personal, partly-tacit preference set, cross-checking claims
  against evidence, and explaining a ranking. A static app can't learn that you'll trade size for
  light; a person can't re-read forty listings a day without going numb. The agents do the reading;
  the user makes the calls.
- **No blind crawling, by design** — paste-first is the default: the app ingests content the user
  already receives and explicitly hands it (their alert emails, their saved searches, their
  links). The only fetching it does on its own is **opt-in, per source, and self-limiting**: the
  refresh cron re-checks individual listing URLs already captured, and the poll cron fetches only
  the saved-search URLs the user enabled — both through the deterministic politeness gates
  (`robotsAllowed.ts`, `politeFetchPlan.ts`: robots respected, per-host throttling + jitter, hard
  page caps, auto-stop on a block page or disallow). No auth-wall circumvention, no bulk
  collection, personal scale only — a filing assistant for one user's own house hunt, inside their
  own pod.
- **The spec deliberately exercises the full format surface** (a builder checklist, not an
  accident): space format — charters + instructs, config-bearing `capabilities:` with per-verb
  `tables` scope, `actions:` + `defaultAction`, `canDelegateTo` (agent- and task-level), tasklists
  with `role: plan/explore/general` and a `forEach` fan-out, typed `functions/`, `view/` **and**
  `ask/` components, multi-field multi-aspect `knowledge/`; app format — db FKs (`cascade` +
  `setNull`), `relations`, `unique`, `generated` uuid/now, json columns, additive evolution; api
  with all five HTTP methods, dynamic + nested segments, spawn-and-return, `HttpError`; hooks of
  both types in both shapes (declarative `trigger` + imperative `handler`) with budgets and every
  loop-guard rule; pages with `_app`/`_layout`, nested dynamic routes,
  `useApi`/`useApiMutation`/bare `apiCall`, and `<Chat>`.
- **Honesty is the product** — every derived value carries its basis (`costBreakdown` line items,
  `commutes.basis`, `location_guesses.method`, cited analyses and taste notes). A guess is a
  labelled guess with a confidence; a low-confidence finding is a viewing question, not a fact.
  The charter rule that enforces this is shared by every agent in the project.
- **The user acts, the app assists** — no send capability, no auto-contact, no auto-apply;
  inquiries are drafts, alerts are in-app. Everything stays within per-user pod isolation, so no
  v1 deviation from the parent plan's authz model.
