# lmthing.homes as a Project-Application — the `homes` project

> A concrete instantiation of [project-as-application.md](./project-as-application.md) for an
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
makes the calls. Crucially, the app **never scrapes portals**: it only ingests content the user
already receives and explicitly hands it (pasted alert-email bodies, pasted links, saved-search
pages they open themselves). (There is no `homes/` domain today — `lmthing.casa` is the unrelated
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
  shape). Round 2 adds the **`advisor`** space (§Additional features).
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
│   └── alerts/
│       └── [id]/PATCH.ts             # markAlertRead
├── hooks/
│   ├── parse-new-capture.ts          # database  raw_captures:insert → intake/clipper#parse
│   ├── enrich-new-listing.ts         # database  listings:insert → the whole scout pipeline (one hook)
│   ├── learn-from-signal.ts          # database  taste_signals:insert → scout/ranker#learn
│   └── refresh-tracked-listings.ts   # cron 6h → intake/clipper#refresh (gone / price-drop detection)
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
  "description": "A place captures come from — an alert email the user forwards, a saved search page they paste, or ad-hoc pasted links. The app ingests ONLY what the user hands it; it never crawls portals.",
  "columns": {
    "id":             { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "searchId":       { "type": "string", "description": "the search this source feeds", "required": true,
                        "references": { "table": "searches", "column": "id", "onDelete": "cascade" } },
    "kind":           { "type": "string", "description": "'alert_email' | 'saved_search' | 'pasted_link' | 'manual'", "required": true },
    "label":          { "type": "string", "description": "human name, e.g. 'Idealista daily alert'", "required": true },
    "url":            { "type": "string", "description": "the saved-search or portal URL, if any (opened by the USER; the refresh cron re-fetches only listing URLs already captured)" },
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

- **Depth accounting** (why this shape): user `ingestCapture` (depth 0) → `parse-new-capture`
  (depth-1 session) → clipper inserts `listings` → `enrich-new-listing` (depth-2 session) runs the
  entire scout pipeline as sequential delegates inside that one session; its writes (analyses,
  guesses, commutes, score, alerts) fire nothing further. The refresh cron re-ingests via new
  `raw_captures`, adding one level — the pipeline still completes because enrichment never relies on
  a *fourth* hook.
- The ranker's `rank` **writes the `alerts` row itself** when a score crosses the search's bar
  (strong `new_match`) — no separate alert hook, so alerting works even at max depth.
- Cron timing is the parent plan's **crond → hook-run endpoint** mechanism
  (`POST /api/projects/homes/hooks/refresh-tracked-listings/run`); a window missed while the pod was
  down runs once via boot catch-up; local dev uses the in-process fallback tick.

## The `intake` space (agents + capabilities)

The pipeline crew: everything between "user pasted something" and "a clean canonical row exists".

| Agent | `db:read` | `db:write` | universal fns | Role |
|---|---|---|---|---|
| **clipper** | `searches, sources, raw_captures, listings` | `raw_captures, sources, listings, alerts` | `webFetch`, `webSearch` | parse captures into listings (extract, sanitize, dedupe-merge); refresh tracked listings (gone / price-drop → alert) |
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
```

- **The clipper never invents a field** — a value absent from the capture stays at its default; a
  suspicious one (price wildly off the search's band) is kept but flagged in the capture `summary`.
  All extracted text is **sanitized** on write (captures are untrusted content — XSS surface, parent
  plan §Safety).
- **Dedupe is a function, not prose**: `functions/dedupeKey.ts` computes the canonical key
  (normalized address + rooms + size band + price band); the clipper queries by key before every
  insert and **merges** on a hit (union of portals/photos/fees, best URL, `lastSeenAt` bump) — the
  `unique` constraint backs it.
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
- **The `learn-taste` tasklist** (the one orchestrated decomposition, modelled on the sibling
  patterns): `load_signals` (`role: explore` — read-only scan of unfolded signals + current notes) →
  `update_notes` (single non-`forEach` write loop — the proven-reliable pattern for writes) →
  `rescore_affected` (single loop re-running the blend for listings the changed notes touch).
  Fan-out `forEach` is reserved for read-only analysis sweeps; **writes stay in single loops**.
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

## Additional features (more user value)

Beyond the core paste → canonical-record → analyzed-ranked-feed loop, these earn their place by
removing real house-hunting pain. Each is **additive** — new tables/endpoints/hooks + agent
capabilities on the same engine — so it ships after the core loop without reworking it.

### The `advisor` space — inquiries, viewings & the acting assistant *(round 2)*
The core loop finds the right place; the `advisor` space helps you **win** it. A new project-scoped
space (two specialists) sharing the project-rooted db.

- **Data**:
  - `inquiries` — a drafted contact message: `id`, `listingId` FK → `listings` (`cascade`), `body`
    (md draft, personalized from the listing + the user's situation), `channel`
    (`'portal_form' | 'email' | 'phone_script'`), `status` (`'draft' | 'approved' | 'sent'`,
    default `draft`), `sentAt?`, `createdAt`. **The app never sends anything** — drafts are
    copy-paste artifacts the user approves and sends themselves; `status:'sent'` is user-recorded.
  - `viewings` — a scheduled visit: `id`, `listingId` FK (`cascade`), `scheduledAt`, `checklist`
    (json — per-listing verification items **generated from that listing's analyses and flags**:
    "measure the living room — plan sums to 71 m² vs 85 stated", "check light at the hour you'd be
    home", "ask about the €120 condo fee"), `notes` (md — what the user found), `outcome`
    (`'pending' | 'passed' | 'rejected' | 'offer'`, default `pending`), `createdAt`.
- **Agents** (least-privilege):
  - `advisor/counsel` — the conversational orchestrator: `db:read` wide (all core tables +
    `inquiries`, `viewings`), `db:write [inquiries, taste_signals]`,
    `canDelegateTo: [scout/analyst#analyze, scout/ranker#rank, intake/surveyor#normalize]`. Drafts
    inquiries (action `draft-inquiry`), answers "which should I visit first?" with evidence, and
    turns viewing notes into taste signals. The chat dock on the pipeline page.
  - `advisor/inspector` — `db:read [listings, listing_analyses, location_guesses, viewings]`,
    `db:write [viewings]`. Action `checklist`: generates/refreshes the per-listing viewing
    checklist from the flags and open low-confidence questions.
- **API**: `draftInquiry` `POST api/listings/:id/inquiry` (spawns counsel, returns immediately);
  `updateInquiry` `PATCH api/inquiries/:id` (approve / mark sent); `scheduleViewing`
  `POST api/listings/:id/viewings` (fires the checklist hook); `updateViewing`
  `PATCH api/viewings/:id` (notes + outcome — an outcome writes a `'viewed'` taste signal);
  `pipeline` `GET api/searches/:id/pipeline` (listings grouped by `status`, the kanban read view).
- **Hooks**: `checklist-on-viewing` (**database** insert on `viewings` → `advisor/inspector#checklist`,
  idempotent); `daily-digest` (**cron** daily → `advisor/counsel#digest` — one `alerts` row of kind
  `'new_match'` summarizing the day: top new matches, price drops, expiring to-dos; coalesced, never
  spammy).
- **Pages**: `/searches/:searchId/pipeline` (kanban: new → shortlisted → contacted → viewing →
  applied, with `<Chat agent="advisor/counsel">`), `/listings/:id/visit` (checklist + notes +
  outcome), inquiry drawer on the listing page.
- **Safety**: inquiries are **drafts only** — no send capability exists, no email/portal
  integration; the charter forbids impersonation and pressure tactics; drafted text contains only
  facts the user provided or the listing states.

### Market context — price fairness & the listing's history *(round 2)*
"Is this a good price?" answered with evidence already in the db, plus a memory of how each listing
behaved.
- **Data**: `listing_events` — the timeline: `id`, `listingId` FK (`cascade`), `kind`
  (`'first_seen' | 'price_change' | 'gone' | 'back_online' | 'relisted'`), `detail` (md — old/new
  price, gap length), `createdAt`. Written by the clipper's `refresh` alongside its alerts.
- **Analysis**: a new analyst kind `'comps'` — compare the listing's €/m² (true cost / best-known
  size) against the *other listings in the same search and area band* (query-all + JS; the db is the
  comp set — no external data): output a fairness read ("12% above the median €/m² of the 14
  comparable 2-beds you're tracking"), cited. A long-idle relisting ("gone 3 weeks, back at −5%")
  is negotiation evidence the counsel folds into inquiry drafts.
- **API/Pages**: `listingHistory` `GET api/listings/:id/events`; a `PriceHistory` strip + fairness
  panel on the listing page.

### Neighbourhood dossiers *(round 2/3)*
The place around the place. A `scout/geographer` agent (or `district` space if it grows) writes
**cited** area notes.
- **Data**: `area_notes` — `id`, `searchId` FK (`cascade`), `areaLabel` (the neighbourhood),
  `topic` (`'transit' | 'noise' | 'green' | 'services' | 'prices' | 'character'`), `body` (md,
  cited via `webSearch`), `createdAt`.
- **Trigger**: on the first location guess landing in a new neighbourhood, the enrich pipeline adds
  a `geographer#survey` delegate (idempotent per area). The feed shows the area chip; the listing
  page shows the dossier beside the location guess.

### Buyer finance — what buying actually costs monthly *(round 3)*
For `mode:'buy'` searches, the surveyor's `trueCost` deepens into scenarios.
- **Data**: `finance_scenarios` — `id`, `searchId` FK (`cascade`), `label`, `downPayment`,
  `ratePct` (cited to a `webSearch`ed reference rate + date), `termYears`, `createdAt`; the compare
  page and feed recompute `trueCostMonthly` per scenario via the deterministic amortization
  function. **Advisory only** — labelled estimates with cited rates, never financial advice
  (charter framing), and a doubtful number is a range, not a point.

### Household decisions — two people, one shortlist *(round 3)*
Most homes are chosen by more than one person; disagreement is data.
- **Data**: `stakeholders` (`id`, `searchId` FK cascade, `name`, `notes`), `stakeholder_votes`
  (`id`, `stakeholderId` FK cascade, `listingId` FK cascade, `vote` (`'yes'|'no'|'maybe'`),
  `reason`, `createdAt`).
- **Agent**: the ranker's `learn` reconciles per-person signals into **per-stakeholder taste notes**
  (dimension-tagged), and `rank` surfaces conflicts explicitly ("scores 84 for Ana, 41 for Rui —
  the garden vs the commute") instead of averaging them away.
- **Pages**: vote chips on the feed and compare pages; a "where you disagree" panel on the pipeline.

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
- **Deterministic math lives in space `functions/`, never model prose** — `dedupeKey.ts`,
  `trueCost.ts`, `sumRoomAreas.ts`, `haversine.ts`, `blendScore.ts`, `formatMoney.ts` (the sibling
  "avoid fragile model math" lesson). Writes happen in **single non-`forEach` task loops** (the
  proven-reliable pattern); `forEach` fan-out is reserved for read-only sweeps.
- **Row-type singularizer**: `searches→Search`, `sources→Source`, `raw_captures→RawCapture`,
  `listings→Listing`, `listing_analyses→ListingAnalysis`, `location_guesses→LocationGuess`,
  `commutes→Commute`, `taste_signals→TasteSignal`, `taste_notes→TasteNote`, `alerts→Alert`.
- **Both project-scoped spaces are built in the FULL space format from round 1** (not
  `agents/`-only): every agent ships `charter.md` + `instruct.md`; the spaces ship tasklists
  (`intake/parse-captures`, `scout/learn-taste`), typed `functions/`, catalog `components/`
  (ListingProposal / TasteNoteCard ask-display components, token-gated), and **extensive
  `knowledge/`** — each field an `index.md` overview + ≥2 `<aspect>.md` deep-dives:
  - `intake`: `listing-parsing/` (`portals-and-alert-emails.md`, `dedupe-and-canonicalization.md`),
    `true-cost/` (`rent-fees-and-utilities.md`, `buyer-costs-and-mortgage.md`),
    `commute-estimation/` (`transit-heuristics.md`, `mode-tradeoffs.md`).
  - `scout`: `photo-forensics/` (`condition-and-dating-cues.md`, `light-and-orientation.md`,
    `staging-and-wide-angle-tricks.md`), `floorplan-measurement/` (`dimensions-and-scale.md`,
    `layout-red-flags.md`), `listing-mismatch/` (`text-vs-evidence-contradictions.md`,
    `too-good-to-be-true.md`), `location-triangulation/` (`fuzzed-pin-strategies.md`,
    `clue-extraction-and-intersection.md`), `taste-learning/` (`signals-to-preferences.md`,
    `scoring-and-explanations.md`).

## Phases & order

Assumes the parent plan's engine (db + capability globals, api runtime, typed-contract build, pages
build, hooks runtime, chat) exists. Homes-specific work on top:

1. **Schemas** — the ten `database/*.json`; verify FK/relations resolve (search → listing →
   analyses/guesses/commutes; signals/alerts `setNull`), `dedupeKey` unique, required descriptions
   pass the fail-loud loader; row + relation types generate (`Listing.analyses`, `Search.listings`).
2. **Spaces** — `intake` (clipper, surveyor) + `scout` (analyst, locator, ranker) in full format:
   config-bearing `capabilities:` per the tables above, `actions:` declared, charters with the
   no-invention/citation guardrails, tasklists, the deterministic `functions/`, knowledge fields.
3. **API** — the 17 endpoints; `ingestCapture` inserts-and-returns (hook does the rest);
   `saveListing`/`dismissListing` write the taste signal.
4. **Hooks** — `parse-new-capture`, `enrich-new-listing` (the one-hook sequential scout pipeline),
   `learn-from-signal`, `refresh-tracked-listings`; confirm the depth accounting (refresh-path
   ingest still fully enriches) and idempotence guards.
5. **Pages** — feed (ranked cards, save/dismiss, alert strip), inbox (paste + live parse status),
   listing detail (analyses/guess/commutes + chat), compare, taste page; wire `useApi`/
   `useApiMutation` + the three `<Chat>` widgets; live-poll while captures pend; design-token gate
   (no raw colors).
6. **Serving** — seed each pod's `homes` project from the checked-in template; serve under generic
   `lmthing.app/homes/*`; Studio manages it under `/api/projects/homes/app`. (Store install +
   friendly alias are later phases.)
7. **Additional features** — the `advisor` space (inquiries, viewings, pipeline, digest), market
   context (`listing_events`, comps), neighbourhood dossiers, buyer finance, household decisions
   (§Additional features); each additive, shippable after the core loop.
8. **Docs** — fold into `SPACE_DEVELOPMENT.md` "Project apps" as a worked example.

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
7. **Refresh**: run the `refresh-tracked-listings` hook manually
   (`POST /api/projects/homes/hooks/refresh-tracked-listings/run`) against a fixture where one
   tracked URL 404s and one shows a lower price → `status:'gone'` on the first (+ `gone` alert),
   price + `price_drop` alert on the second; restart → one boot catch-up run, no double-run.
8. `apiCall('dismissListing', { id, reason: 42 })` with `reason` as a number **fails the agent
   typecheck** (DTS overload); an un-allowlisted `apiCall` name → host error naming allowed names;
   a `db.write` to a table outside an agent's `tables` scope → host error naming the allowed
   tables.
9. Chat: `<Chat agent="scout/ranker">` "stop penalizing 4th-floor walk-ups" → a `taste_notes`
   update + re-rank, feed reflects it; history under `homes/spaces/scout/sessions/`.
10. Backup: `app.sql` + schemas + pages + api + hooks + both spaces committed; `**/sessions/` not;
    restore rebuilds `app.db` from `app.sql`.

## Notes

- **Reuses the parent engine wholesale** — no homes-specific runtime; this is data + agents + pages
  + hooks on the shared layer. If a mechanism is missing here, it belongs in
  [project-as-application.md](./project-as-application.md), not a homes fork.
- **Why it's a good AI-assisted app** — listing triage is exactly the work models are for: reading
  many messy documents against a personal, partly-tacit preference set, cross-checking claims
  against evidence, and explaining a ranking. A static app can't learn that you'll trade size for
  light; a person can't re-read forty listings a day without going numb. The agents do the reading;
  the user makes the calls.
- **Not a scraper, by design** — the app ingests only content the user already receives and
  explicitly pastes (their alert emails, their saved searches, their links); the refresh cron
  re-checks only individual listing URLs already captured, at a gentle cadence. No portal crawling,
  no auth-wall circumvention, no bulk collection. This is a personal filing assistant for one
  user's own house hunt, inside their own pod.
- **Honesty is the product** — every derived value carries its basis (`costBreakdown` line items,
  `commutes.basis`, `location_guesses.method`, cited analyses and taste notes). A guess is a
  labelled guess with a confidence; a low-confidence finding is a viewing question, not a fact.
  The charter rule that enforces this is shared by every agent in the project.
- **The user acts, the app assists** — no send capability, no auto-contact, no auto-apply;
  inquiries are drafts, alerts are in-app. Everything stays within per-user pod isolation, so no
  v1 deviation from the parent plan's authz model.
