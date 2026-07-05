# PLAN — `homes` project-application (round 1, CORE BUILD)

File-by-file plan. Output root: **`store/projects/homes/`** (monorepo). `types/` + `.data/`
git-ignored. All contracts grounded in the shipped engine (see the sibling PROGRESS files'
"Environment" sections). Mirrors the sibling `blog`/`trips` build patterns exactly. Spec:
`app-specifications/homes-application.md` (read §Engine reconciliation first — pasted-text ingest,
no vision, no external bindings, self-scanning hook actions, deterministic math in functions).

## Root files
- `package.json` — name `@lmthing/app-homes`, private, type module, deps: `react`, `react-dom`,
  `@lmthing/ui`, `@lmthing/css` (workspace:*).
- `tsconfig.json` — the blog default (react-jsx, strict, bundler moduleRes, include pages/components/
  lib/api/hooks/types).
- `.gitignore` — `types/ .data/ node_modules/ dist/`.
- `README.md` — one-paragraph what/how.

## database/ (10 tables — descriptions mandatory, FK/relations resolve) — per spec §Database
- `searches.json` — id(pk uuid), title(req), brief, mode(req rent|buy), area, budgetMax(req),
  budgetMin(def 0), currency(def USD), minRooms(def 0), minAreaSqm(def 0), mustHaves(json),
  commuteTargets(json), status(def active), createdAt(now); relations sources/listings/signals/
  notes/alerts (hasMany via searchId).
- `sources.json` — id(pk), searchId→searches(cascade,req), kind(req alert_email|saved_search|
  pasted_link|manual), label(req), url, notes, lastIngestedAt, createdAt(now); relations
  search(belongsTo), captures(hasMany raw_captures via sourceId).
- `raw_captures.json` — id(pk), sourceId→sources(cascade,req), searchId→searches(cascade,req —
  denormalized for equality-only scans), content(req), sourceUrl, status(def pending), summary,
  error, listingsFound(def 0), capturedAt(now); relations source/search(belongsTo).
- `listings.json` — id(pk), searchId→searches(cascade,req), **dedupeKey(req, unique)**, title(req),
  url, portal, priceAmount(req), currency(def USD), trueCostMonthly(def 0), costBreakdown(json),
  address, claimedLat, claimedLng, areaSqm(def 0), measuredAreaSqm(def 0), rooms(def 0),
  bedrooms(def 0), floor, yearBuilt(def 0), description(sanitized md), photoUrls(json {url,caption}),
  flags(json), score(def 0), scoreSummary, status(def new), dismissedReason, firstSeenAt(now),
  lastSeenAt; relations search(belongsTo), analyses/guesses/commutes/signals(hasMany via listingId).
- `listing_analyses.json` — id(pk), listingId→listings(cascade,req), kind(req photos|floorplan|
  mismatch), body(req md cited), flags(json), confidence(def 0), createdAt(now); relation
  listing(belongsTo).
- `location_guesses.json` — id(pk), listingId→listings(cascade,req), lat(req), lng(req),
  radiusM(req), confidence(req), method(req md cited), createdAt(now); relation listing(belongsTo).
- `commutes.json` — id(pk), listingId→listings(cascade,req), targetLabel(req), mode(req), minutes(req),
  basis(req md cited), computedAt(now); relation listing(belongsTo).
- `taste_signals.json` — id(pk), searchId→searches(cascade,req), listingId→listings(setNull),
  action(req save|dismiss|contact|viewed|note), reason, folded(bool def false), createdAt(now);
  relations search/listing(belongsTo).
- `taste_notes.json` — id(pk), searchId→searches(cascade,req), dimension(req style|light|layout|
  location|building|dealbreaker|other), statement(req md cited), weight(def 0.5),
  supportCount(def 1), createdAt(now); relation search(belongsTo).
- `alerts.json` — id(pk), searchId→searches(cascade,req), listingId→listings(setNull), kind(req
  new_match|price_drop|gone|back_online), title(req), body, read(bool def false), createdAt(now);
  relations search/listing(belongsTo).

## api/ (17 endpoints) — each name/description/Input/Output + default async handler; `@app/runtime` HttpError
- `searches/GET.ts` → `searchList` `{}` → `(Search & {unreadAlerts,newListings})[]` (query-all,
  counts assembled in JS, orderBy createdAt desc).
- `searches/POST.ts` → `createSearch` `{title, brief?, mode, budgetMax, currency?, area?, minRooms?,
  minAreaSqm?, mustHaves?, commuteTargets?}` → `Search`.
- `searches/[id]/GET.ts` → `getSearch` `{id}` → `Search & {sources: Source[]}` (include sources).
- `searches/[id]/PATCH.ts` → `updateSearch` `{id, ...fields}` → `Search`.
- `searches/[id]/DELETE.ts` → `deleteSearch` `{id}` → `{ok}` (cascade via FK).
- `searches/[id]/sources/POST.ts` → `addSource` `{id, kind, label, url?, notes?}` → `Source`.
- `searches/[id]/captures/POST.ts` → `ingestCapture` `{id, content, sourceUrl?, sourceId?}` →
  `{captureId, status:'pending'}` — auto-create a `'manual'` source when sourceId absent; the
  raw_captures insert fires the parse hook. Returns immediately.
- `searches/[id]/captures/GET.ts` → `listCaptures` `{id}` → `RawCapture[]` (newest first).
- `searches/[id]/listings/GET.ts` → `listingFeed` `{id, status?, minScore?}` → `Listing[]` —
  query-all then JS filter/sort (score desc, firstSeenAt desc; equality-only where).
- `searches/[id]/compare/GET.ts` → `compareListings` `{id, ids}` (comma-joined) → `{rows}` — one
  normalized row per attribute (true cost, price/m² off best-known size, measured vs stated size,
  commutes per target, flags, score); assemble in JS.
- `searches/[id]/taste/GET.ts` → `tasteProfile` `{id}` → `{notes: TasteNote[], recentSignals}`.
- `searches/[id]/alerts/GET.ts` → `listAlerts` `{id, unreadOnly?}` → `Alert[]`.
- `listings/[id]/GET.ts` → `getListing` `{id}` → `Listing & {analyses,guesses,commutes,signals}`
  (include all four; JS assembly fallback).
- `listings/[id]/PATCH.ts` → `updateListing` `{id, status?, ...}` → `Listing` (a manual status
  change also inserts a `'note'` taste_signal).
- `listings/[id]/save/POST.ts` → `saveListing` `{id, reason?}` → `{ok}` — set status shortlisted +
  insert `'save'` taste_signal (fires learn hook).
- `listings/[id]/dismiss/POST.ts` → `dismissListing` `{id, reason?}` → `{ok}` — set status
  dismissed + dismissedReason + insert `'dismiss'` signal with reason.
- `alerts/[id]/PATCH.ts` → `markAlertRead` `{id}` → `{ok}`.

## hooks/ (4)
- `parse-new-capture.ts` — database `on:{table:'raw_captures',event:'insert'}`, imperative handler:
  skip unless `row.status==='pending'`, then `delegate('intake/clipper','parse',{input:{captureId}})`
  (input dropped by engine — clipper self-scans pending captures).
- `enrich-new-listing.ts` — database `on:{table:'listings',event:'insert'}`, imperative handler:
  idempotence (skip if listing_analyses exist for row.id), then **sequential delegates in ONE hook
  session** (depth-cap design, spec §Hooks): `intake/surveyor#normalize` → `scout/analyst#analyze` →
  `scout/locator#locate` → `scout/ranker#rank`. budget `{maxEpisodes:12, maxWallClockMs:900000}`.
- `learn-from-signal.ts` — database `on:{table:'taste_signals',event:'insert'}`: skip if
  `row.folded`, then `delegate('scout/ranker','learn',…)` (self-scans folded===false).
- `refresh-tracked-listings.ts` — cron `every:'6h'`, `trigger:'intake/clipper#refresh'`, budget.

## spaces/intake/ (project-scoped space — FULL space format, 2 agents)
- `agents/clipper/{charter.md,instruct.md}` — caps: `db:read {tables:[searches,sources,raw_captures,
  listings]}`, `db:write {tables:[raw_captures,sources,listings,alerts]}`. actions: `parse`
  (self-scan pending captures → extract, sanitize, dedupeKey-check, insert-or-merge listings; write
  capture summary/listingsFound/status), `refresh` (self-scan active searches' tracked listing URLs
  via webFetch → lastSeenAt / status gone + `gone` alert / price change + `price_drop` alert +
  spec-round-2 note). Universal webSearch/webFetch (omit `functions:`). Charter: never invent a
  field; sanitize; missing stays null.
- `agents/surveyor/{charter.md,instruct.md}` — caps: `db:read {tables:[searches,listings,commutes]}`,
  `db:write {tables:[listings,commutes]}`. actions: `normalize` (self-scan trueCostMonthly===0 →
  functions/trueCost.ts breakdown, every line stated|estimated), `commute` (per commuteTargets label
  via webSearch, cited basis; folded into normalize's loop round 1).
- `tasklists/parse-captures/` — `index.md` goal + `01-scan-pending.md` (role:explore) +
  `02-extract-and-merge.md` (general; single non-forEach write loop) + `03-summarize.md`.
- `functions/` — `dedupeKey.ts` (normalized address+rooms+size-band+price-band), `trueCost.ts`
  (rent: rent+fees+per-m² utilities est; buy: amortized mortgage at cited rate + charges),
  `parseMoney.ts`, `formatMoney.ts`. Typed TS.
- `components/` — `view/CaptureSummary.tsx` (parse-result catalog card, token-gated).
- `knowledge/` — 3 fields, each index.md + ≥2 aspects: `listing-parsing/`
  {portals-and-alert-emails, dedupe-and-canonicalization}; `true-cost/`
  {rent-fees-and-utilities, buyer-costs-and-mortgage}; `commute-estimation/`
  {transit-heuristics, mode-tradeoffs}.

## spaces/scout/ (project-scoped space — FULL space format, 3 agents)
- `agents/analyst/{charter.md,instruct.md}` — caps: `db:read {tables:[listings,listing_analyses,
  searches]}`, `db:write {tables:[listing_analyses,listings]}` (flags merge). actions: `analyze`
  (self-scan listings w/o analyses → kinds photos|floorplan|mismatch from TEXT evidence only —
  captions, per-room dims via functions/sumRoomAreas.ts vs stated m², field contradictions; cited
  body; confidence; low-confidence = viewing question). Charter: observation ≠ inference; no
  pixel-claims (no vision in engine).
- `agents/locator/{charter.md,instruct.md}` — caps: `db:read {tables:[listings,listing_analyses]}`,
  `db:write {tables:[location_guesses]}`. actions: `locate` (self-scan listings w/o guesses →
  claimed pin + text clues + webSearch coords + functions/haversine.ts intersect → lat/lng/radiusM/
  confidence/method cited; clue-poor = wide radius low confidence + fuzzed_pin flag via analyst…
  round 1: locator writes only location_guesses; the fuzzed_pin flag rides analyst's mismatch pass).
- `agents/ranker/{charter.md,instruct.md}` — caps: `db:read {tables:[searches,listings,
  listing_analyses,location_guesses,commutes,taste_signals,taste_notes]}`, `db:write {tables:
  [listings,taste_notes,taste_signals,alerts]}`. actions: `rank` (self-scan score===0/changed →
  functions/blendScore.ts + scoreSummary citing notes; write `new_match` alert when the blend
  crosses the bar — no separate alert hook), `learn` (self-scan folded===false signals → merge into
  cited taste_notes, flip folded, re-rank affected). defaultAction rank.
- `tasklists/learn-taste/` — `index.md` + `01-load-signals.md` (role:explore) +
  `02-update-notes.md` (general; single write loop) + `03-rescore-affected.md` (single loop).
- `functions/` — `blendScore.ts` (hard-constraint fits + note-weights×features − commute/flag
  penalties → 0..100), `sumRoomAreas.ts`, `haversine.ts`, `mergeFlags.ts`.
- `components/` — `view/TasteNoteCard.tsx`, `view/LocationGuessCard.tsx` (token-gated).
- `knowledge/` — 5 fields, each index.md + ≥2 aspects: `photo-forensics/` {condition-and-dating-cues,
  light-and-orientation, staging-and-wide-angle-tricks}; `floorplan-measurement/`
  {dimensions-and-scale, layout-red-flags}; `listing-mismatch/` {text-vs-evidence-contradictions,
  too-good-to-be-true}; `location-triangulation/` {fuzzed-pin-strategies,
  clue-extraction-and-intersection}; `taste-learning/` {signals-to-preferences,
  scoring-and-explanations}.

## pages/ (7 routes + _app + _layout) + components/
- `_app.tsx` — passthrough (blog pattern).
- `_layout.tsx` — nav: Searches · New Search · alert bell (unread count).
- `index.tsx` — `/` → searchList (cards + unread badges).
- `new.tsx` — `/new` → describe-a-search form (brief, mode, budget, commute targets) → createSearch
  → navigate to /searches/:id/inbox.
- `searches/[searchId].tsx` — `/searches/:searchId` → listingFeed ranked cards (ScoreBadge,
  FlagChips, TrueCostBreakdown, commute chips; save/dismiss w/ reason prompt) + alerts strip;
  poll (refetchInterval) while any capture pending.
- `searches/[searchId]/inbox.tsx` — paste box → ingestCapture; sources list + addSource; captures
  w/ live status; `<Chat agent="intake/clipper">`.
- `searches/[searchId]/compare.tsx` — compareListings for checked rows → CompareTable.
- `searches/[searchId]/taste.tsx` — tasteProfile (TasteNoteCard list + recent signals) +
  `<Chat agent="scout/ranker">`.
- `listings/[id].tsx` — getListing nested: photos strip (urls+captions), analyses w/ confidence,
  LocationGuess panel (coords+radius+method + OSM link — no map lib), commutes, signals;
  save/dismiss/status; `<Chat agent="scout/analyst">`.
- components: `Spinner.tsx`, `MarkdownBody.tsx`, `SearchCard.tsx`, `ListingCard.tsx`,
  `ScoreBadge.tsx`, `FlagChips.tsx`, `TrueCostBreakdown.tsx`, `CommuteChips.tsx`,
  `CompareTable.tsx`, `TasteNoteCard.tsx`, `LocationGuessPanel.tsx`, `AlertStrip.tsx`,
  `CaptureRow.tsx`. Design tokens only (`text-destructive` for mismatch flags, `text-agent` score
  accent — never raw colors).

## tests/ (`tests/homes.test.mjs`, node --test)
- Schemas pass real `validateSchemaSet` (10 tables, names sorted); dedupeKey unique; every
  table/column/relation has a description; exactly-one PK each.
- All 17 api handlers exist + export name/description/Input/Output/default async handler; names match.
- Hooks: parse-new-capture + enrich-new-listing + learn-from-signal are database w/ idempotence
  guards; enrich delegates all four pipeline agents sequentially; refresh-tracked-listings is cron
  w/ declarative trigger.
- Spaces: 2 present (intake, scout); 5 agents; least-privilege (no db:schema/pages:write/api:write/
  hooks:write anywhere); locator writes only location_guesses; per-agent capability tables match
  the spec's.
- Full-space-format assertions: each agent has charter.md + instruct.md; each space has tasklists/,
  functions/, components/, knowledge/ (each field index.md + ≥2 aspects).
- Function unit tests: dedupeKey (same unit two portals → same key; different unit → different),
  trueCost (rent + buy paths; every line labelled), sumRoomAreas, haversine, blendScore
  (dealbreaker caps score; commute over max penalizes).

## Build/verify sequence
1. Write foundation (database + root files + functions) — me.
2. Fan out (3 parallel Sonnet): api / pages+components / hooks+both-spaces.
3. Integrate; materialize into temp root; `lmthing serve`; verify manifest (10 tables / 17 api /
   4 hooks / 2 spaces) + types + pages build + api I/O.
4. 🔴 LIVE: ingestCapture w/ a 3-listing alert-email fixture → parse hook → clipper writes listings
   (dedupe fixture: re-ingest merges, no dupe) → enrich hook chains surveyor/analyst/locator/ranker
   → feed ranks; dismiss w/ reason → learn hook → taste_notes + re-rank (DeepSeek `LM_MODEL_S`).
   Capture trace. Fallback to mock streamFn only if keys empty.
5. Green gate (lint:tokens/typecheck/build/test) → push sdk/org then monorepo.
