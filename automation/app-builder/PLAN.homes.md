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
  pasted_link|manual), label(req), url, **pollEnabled(bool def false)**, **pollIntervalHours(def
  12, min 6)**, **lastPolledAt**, **blockedReason**, notes, lastIngestedAt, createdAt(now);
  relations search(belongsTo), captures(hasMany raw_captures via sourceId).
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

## api/ (19 endpoints) — each name/description/Input/Output + default async handler; `@app/runtime` HttpError
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
- `sources/[id]/PATCH.ts` → `updateSource` `{id, label?, pollEnabled?, pollIntervalHours?, notes?}`
  → `Source` (clears blockedReason on re-enable).
- `sources/[id]/poll/POST.ts` → `pollSource` `{id}` → `{ok, status:'polling'}` — spawn
  intake/clipper#poll fire-and-forget; HttpError 404 when the source has no url.

## hooks/ (5)
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
- `poll-saved-searches.ts` — cron `every:'6h'`, `trigger:'intake/clipper#poll'` (self-scans
  pollEnabled sources due per pollIntervalHours via politeFetchPlan; results enter as ordinary
  raw_captures → the normal parse→enrich pipeline), budget.

## spaces/intake/ (project-scoped space — FULL space format, 2 agents)
- `agents/clipper/{charter.md,instruct.md}` — caps: `db:read {tables:[searches,sources,raw_captures,
  listings]}`, `db:write {tables:[raw_captures,sources,listings,alerts]}`. actions: `parse`
  (self-scan pending captures → extract, sanitize, dedupeKey-check, insert-or-merge listings; write
  capture summary/listingsFound/status), `refresh` (self-scan active searches' tracked listing URLs
  via webFetch → lastSeenAt / status gone + `gone` alert / price change + `price_drop` alert +
  spec-round-2 note), `poll` (self-scan due pollEnabled sources → robotsAllowed + politeFetchPlan
  gate every fetch → paginateSavedSearch/parsePortalHtml → raw_captures; block page / disallow /
  repeated failure ⇒ blockedReason + auto-disable). Universal webSearch/webFetch (omit
  `functions:`). Charter: never invent a field; sanitize; missing stays null; robots respected,
  no auth-wall circumvention. Borderline dedupe in chat → ask ConfirmMerge; headless → keep
  separate + `possible_duplicate` flags.
- `agents/surveyor/{charter.md,instruct.md}` — caps: `db:read {tables:[searches,listings,commutes]}`,
  `db:write {tables:[listings,commutes]}`. actions: `normalize` (self-scan trueCostMonthly===0 →
  functions/trueCost.ts breakdown, every line stated|estimated), `commute` (per commuteTargets label
  via webSearch, cited basis; folded into normalize's loop round 1).
- `tasklists/parse-captures/` — `index.md` goal + `01-scan-pending.md` (role:explore) +
  `02-extract-and-merge.md` (general; single non-forEach write loop) + `03-summarize.md`.
- `functions/` — `dedupeKey.ts` (normalized address+rooms+size-band+price-band), `trueCost.ts`
  (rent: rent+fees+per-m² utilities est; buy: amortized mortgage at cited rate + charges),
  `parseMoney.ts`, `formatMoney.ts`, **scraping toolkit** (typed, unit-tested, driven by the
  universal webFetch): `parseAlertEmail.ts` (email body → per-listing candidate blocks),
  `parsePortalHtml.ts` (boilerplate-strip + fields + photos/captions + JSON-LD
  RealEstateListing), `extractListingFields.ts` (candidate → canonical columns),
  `paginateSavedSearch.ts` (result cards + next-page URL, bounded pages), `robotsAllowed.ts`
  (parse robots.txt → path allowance), `politeFetchPlan.ts` (due sources → throttled plan:
  per-host min interval, jitter, hard page cap). Typed TS.
- `components/` — `view/CaptureSummary.tsx` (parse-result catalog card), `ask/ConfirmMerge.tsx`
  (borderline-dedupe merge/keep-separate prompt w/ side-by-side evidence; chat-only). Token-gated.
- `knowledge/` — 3 fields, each index.md + ≥2 aspects: `listing-parsing/`
  {portals-and-alert-emails, dedupe-and-canonicalization, polling-and-politeness}; `true-cost/`
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
- `tasklists/deep-sweep/` — the read-only **forEach** fan-out (spec §scout): `index.md` +
  `01-pick-targets.md` (role:plan; emits listingIds) + `02-reverify-each.md`
  (**forEach: "pick_targets.listingIds"**, role:explore, task-level
  `canDelegateTo: scout/appraiser#appraise`) + `03-write-findings.md` (general; single write
  loop). Salvage: one slow fork → partial, sweep completes.
- `functions/` — `blendScore.ts` (hard-constraint fits + note-weights×features − commute/flag
  penalties → 0..100), `sumRoomAreas.ts`, `haversine.ts`, `mergeFlags.ts`.
- `components/` — `view/TasteNoteCard.tsx`, `view/LocationGuessCard.tsx`, `ask/TasteQuiz.tsx`
  (A/B "which would you rather view?" → 'note' taste_signal; chat-only). Token-gated.
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
- All 19 api handlers exist + export name/description/Input/Output/default async handler; names match.
- Hooks: parse-new-capture + enrich-new-listing + learn-from-signal are database w/ idempotence
  guards; enrich delegates all four pipeline agents sequentially; refresh-tracked-listings +
  poll-saved-searches are cron w/ declarative triggers.
- Spaces: 2 present (intake, scout); 5 agents; least-privilege (no db:schema/pages:write/api:write/
  hooks:write anywhere); locator writes only location_guesses; per-agent capability tables match
  the spec's.
- Full-space-format assertions: each agent has charter.md + instruct.md; each space has tasklists/,
  functions/, components/, knowledge/ (each field index.md + ≥2 aspects).
- Function unit tests: dedupeKey (same unit two portals → same key; different unit → different),
  trueCost (rent + buy paths; every line labelled), sumRoomAreas, haversine, blendScore
  (dealbreaker caps score; commute over max penalizes); scraping toolkit — parseAlertEmail (3-block
  fixture → 3 candidates), parsePortalHtml (JSON-LD fixture wins over scraped fields),
  paginateSavedSearch (bounded pages), robotsAllowed (disallow fixture → false), politeFetchPlan
  (not-due source skipped; per-host interval + page cap respected).
- deep-sweep tasklist has a real forEach frontmatter (`forEach: "pick_targets.listingIds"`) +
  task-level canDelegateTo; both ask components exist under components/ask/ (chat-only surfaces).

## Build/verify sequence
1. Write foundation (database + root files + functions) — me.
2. Fan out (3 parallel Sonnet): api / pages+components / hooks+both-spaces.
3. Integrate; materialize into temp root; `lmthing serve`; verify manifest (10 tables / 19 api /
   5 hooks / 2 spaces) + types + pages build + api I/O.
4. 🔴 LIVE: ingestCapture w/ a 3-listing alert-email fixture → parse hook → clipper writes listings
   (dedupe fixture: re-ingest merges, no dupe) → enrich hook chains surveyor/analyst/locator/ranker
   → feed ranks; dismiss w/ reason → learn hook → taste_notes + re-rank (DeepSeek `LM_MODEL_S`).
   Capture trace. Fallback to mock streamFn only if keys empty.
5. Green gate (lint:tokens/typecheck/build/test) → push sdk/org then monorepo.

---

# PLAN — round 2 (FEATURE EXPANSION: `advisor` — act on it)

Strictly additive to round 1 (10 tables / 19 api / 5 hooks / 2 spaces / 7 routes). Never regress.
Floors met: 3 new tables, 1 new space + 3 new agents, 9 new api, 3 new hooks (+1 additive hook
edit), 5 new pages. Spec: §Round 2 + §Round-2 reconciliation.

## database/ — 3 NEW tables + enum notes
- `inquiries.json` — id(pk uuid), listingId→listings(cascade,req), body(md draft), channel(req
  portal_form|email|phone_script), status(def draft: draft|approved|sent), sentAt, createdAt(now);
  relation listing(belongsTo).
- `viewings.json` — id(pk), listingId→listings(cascade,req), scheduledAt, checklist(json),
  notes(md), outcome(def pending: pending|passed|rejected|offer), **outcomeRecorded(bool def
  false)**, createdAt(now); relation listing(belongsTo).
- `listing_events.json` — id(pk), listingId→listings(cascade,req), kind(req first_seen|
  price_change|gone|back_online|relisted), detail(md), createdAt(now); relation listing(belongsTo).
- Description updates (additive enum values): `listing_analyses.kind` += comps; `alerts.kind` +=
  digest. listings relations += events/viewings/inquiries (hasMany via listingId).

## api/ — 9 NEW endpoints (name/description/Input/Output + default async handler)
- `listings/[id]/inquiry/POST.ts` → draftInquiry (spawn advisor/counsel#draft-inquiry, return
  immediately); `searches/[id]/inquiries/GET.ts` → listInquiries; `inquiries/[id]/PATCH.ts` →
  updateInquiry (approve / user-recorded sent).
- `listings/[id]/viewings/POST.ts` → scheduleViewing (insert fires checklist hook);
  `searches/[id]/viewings/GET.ts` → listViewings (upcoming first, JS sort);
  `viewings/[id]/PATCH.ts` → updateViewing (notes/outcome).
- `searches/[id]/pipeline/GET.ts` → pipeline (group listings by status in JS);
  `listings/[id]/events/GET.ts` → listingHistory; `listings/[id]/comps/GET.ts` → listingComps
  (latest 'comps' analysis + comp rows via functions/compsBand.ts).

## hooks/ — 3 NEW + 1 additive edit
- `checklist-on-viewing.ts` — database insert viewings → delegate advisor/inspector#checklist
  (idempotent: skip if checklist non-empty).
- `record-viewing-outcome.ts` — database **update** viewings → guard `outcome!=='pending' &&
  !outcomeRecorded` → delegate advisor/counsel (writes 'viewed' taste_signal w/ outcome+notes as
  reason, flips outcomeRecorded; learn hook then fires on the signal — depth ok, user-initiated).
- `daily-digest.ts` — cron 24h, trigger advisor/counsel#digest (declarative; self-scans the day).
- EDIT `enrich-new-listing.ts` — append 5th sequential delegate scout/appraiser#appraise (same
  session/depth).
- clipper additions: #parse writes a first_seen listing_events row; #refresh writes price_change/
  gone/back_online/relisted events alongside its alerts (db:write += listing_events).

## spaces/advisor/ — NEW full-format space (2 agents) + scout/appraiser
- agents/counsel/{charter.md,instruct.md} — db:read wide (searches,listings,listing_analyses,
  location_guesses,commutes,taste_signals,taste_notes,alerts,inquiries,viewings,listing_events),
  db:write [inquiries,taste_signals,alerts]; canDelegateTo [advisor/inspector#checklist,
  scout/appraiser#appraise, scout/ranker#rank]; actions draft-inquiry/digest/advise; defaultAction
  advise. Charter: drafts only, stated facts only, no impersonation/urgency/pressure.
- agents/inspector/{charter.md,instruct.md} — db:read [listings,listing_analyses,location_guesses,
  commutes,viewings], db:write [viewings]; action checklist.
- scout/agents/appraiser/{charter.md,instruct.md} — db:read [searches,listings,listing_analyses,
  listing_events,commutes], db:write [listing_analyses]; action appraise (kind 'comps', db-only
  comp set, cited).
- tasklists/draft-inquiry/{index,01-gather-facts(role:explore),02-write-draft}.md;
  tasklists/build-checklist/{index,01-collect-open-questions,02-write-items}.md.
- functions/ — compsBand.ts (same-search area+size banding + median €/m²), checklistFromFlags.ts,
  daysOnMarket.ts.
- components/ — view/InquiryDraftCard.tsx, view/ChecklistCard.tsx (token-gated).
- knowledge/ — inquiries/{index,what-landlords-respond-to,tone-and-facts};
  viewings/{index,what-to-verify-on-site,reading-a-building};
  market-timing/{index,relistings-and-price-cuts,acting-fast-safely}.

## pages/ — 5 NEW routes + components + SearchTabs sub-nav
- searches/[searchId]/pipeline.tsx (kanban by status + <Chat agent="advisor/counsel">).
- listings/[id]/visit.tsx (checklist toggles + notes + outcome select).
- listings/[id]/inquiry.tsx (draft view/edit/approve + copy button).
- searches/[searchId]/inquiries.tsx (drafts by status).
- searches/[searchId]/activity.tsx (listing_events timeline).
- components: SearchTabs.tsx (Feed·Inbox·Pipeline·Compare·Taste·Activity — wire into existing
  pages, additive), KanbanColumn, ViewingChecklist, InquiryDraft, EventRow, PriceHistoryStrip,
  FairnessPanel (into listings/[id].tsx). Design tokens only.

## tests/ — extend tests/homes.test.mjs
- 13 tables validate; viewings has outcomeRecorded; EXPECTED_ENDPOINTS += 9; hooks: 2 database +
  1 cron new, enrich has 5 delegates; advisor full-format assertions + appraiser; counsel has no
  send-ish capability (db:write ⊄ anything beyond [inquiries,taste_signals,alerts]); 3 spaces? no —
  2 spaces + advisor = 3 total; compsBand/daysOnMarket unit tests.

## Build/verify
1. me: database + enrich edit + clipper caps/events. 2. fan out 3 Sonnet: api / advisor space +
appraiser / pages+components. 3. me: hooks + tests + integrate. 4. serve; LIVE: scheduleViewing →
checklist from real flags; outcome update → exactly one 'viewed' signal; digest run → one 'digest'
alert; refresh fixture → price_drop event + timeline. 5. green gate → push both repos.

---

# PLAN — round 3 (FEATURE EXPANSION: `district` — know the ground)

Strictly additive to rounds 1–2 (13 tables / 28 api / 8 hooks / 3 spaces). Floors met: 3 new
tables (+1 column), 1 new space + 3 agents, 8 new api, 3 new hooks, 5 new pages. Spec: §Round 3 +
§Round-3 reconciliation.

## database/
- `areas.json` — id(pk), label(req), city, centroidLat, centroidLng, radiusM, summary(md cited),
  createdAt(now); relations notes(hasMany area_notes), scores(hasMany area_scores),
  listings(hasMany via areaId).
- `area_notes.json` — id(pk), areaId→areas(cascade,req), topic(req transit|noise|green|services|
  safety_pointers|prices|character), body(req md cited), confidence(def 0), createdAt(now).
- `area_scores.json` — id(pk), areaId→areas(cascade,req), searchId→searches(cascade,req),
  score(def 0), rationale(md cited), computedAt(now).
- `listings.json` — ADD column areaId→areas(setNull); relation area(belongsTo). alerts.kind +=
  area_suggestion.

## api/ — 8 NEW
- `areas/GET.ts`→listAreas; `areas/[id]/GET.ts`→getArea (include notes);
  `areas/[id]/listings/GET.ts`→areaListings; `areas/[id]/survey/POST.ts`→surveyArea (spawn
  geographer); `searches/[id]/areas/GET.ts`→areaFit (ranked area_scores);
  `searches/[id]/areas/compare/GET.ts`→compareAreas ({ids} → row per topic);
  `searches/[id]/areas/discover/POST.ts`→suggestAreas (spawn matchmaker#discover);
  `listings/[id]/area/PATCH.ts`→assignListingArea (manual fix + 'note' taste_signal).

## hooks/ — 3 NEW
- `survey-new-area.ts` — database insert location_guesses, imperative: delegate
  district/profiler#assign then district/geographer#survey (skip when the assigned area has a
  fresh dossier); cooldown coalesces bursts.
- `refit-areas-on-taste.ts` — database insert taste_notes → district/matchmaker#fit (coalesced).
- `refresh-area-dossiers.ts` — cron '7d', trigger district/geographer#refresh.

## spaces/district/ — NEW full-format space (3 agents)
- geographer: db:read [areas,area_notes,listings,location_guesses], db:write [areas,area_notes];
  actions survey/refresh; charter: cite everything, place-not-people, no demographic profiling;
  safety_pointers = official/statistical sources phrased as check-items.
- profiler: db:read [areas,listings,location_guesses], db:write [listings]; action assign
  (haversine vs centroid; weak guess stays unassigned).
- matchmaker: db:read [areas,area_notes,area_scores,searches,taste_notes,listings,commutes],
  db:write [area_scores,alerts]; actions fit/discover; defaultAction fit.
- tasklists/survey-area/{index,01-scope(role:explore),02-research-topics,03-write-dossier}.md;
  tasklists/fit-areas/{index,01-load-taste,02-score-and-rationale}.md.
- functions/ — areaFit.ts (deterministic blend), areaKey.ts (label+city dedupe), haversine.ts.
- components/ — view/AreaDossierCard.tsx, view/FitBar.tsx.
- knowledge/ — area-research/{index,sources-and-verification,what-makes-a-dossier-useful};
  neighbourhood-fit/{index,taste-to-place-mapping,commute-vs-character-tradeoffs}.

## pages/ — 5 NEW + chips
- areas/index.tsx (/areas), areas/[areaId].tsx (dossier + tracked listings there),
  searches/[searchId]/areas.tsx (fit ranking + rationale),
  searches/[searchId]/areas/compare.tsx, searches/[searchId]/discover.tsx (suggestions +
  <Chat agent="district/matchmaker">). AreaChip on ListingCard + listing detail (additive edits).
  SearchTabs += Areas·Discover.

## tests/
- 16 tables; listings has areaId; EXPECTED_ENDPOINTS += 8; survey-new-area imperative 2-delegate;
  district full-format (3 agents, charter+instruct, tasklists/functions/components/knowledge each
  field ≥2 aspects); profiler writes only listings; areaFit/areaKey unit tests (weak guess →
  unassigned).

## Build/verify
1. me: database + hooks. 2. fan out: api / district space / pages. 3. integrate + tests.
4. LIVE: guess insert → assign+survey once (idempotent re-run); taste insert → refit coalesced;
discover → area_suggestion alert. 5. green gate → push.

---

# PLAN — round 4 (FEATURE EXPANSION: `finance` — afford it)

Strictly additive to rounds 1–3 (16 tables / 36 api / 11 hooks / 4 spaces). Floors met: 4 new
tables, 1 new space + 3 new agents (underwriter, strategist, advisor/negotiator), 10 new api,
3 new hooks, 5 new pages. Spec: §Round 4 + §Round-4 reconciliation.

## database/
- `finance_profiles.json` — id(pk), searchId→searches(cascade,req), grossIncomeMonthly(def 0),
  savingsAvailable(def 0), monthlyDebts(def 0), targetDownPaymentPct(def 20),
  maxComfortableMonthly(def 0), notes, createdAt(now).
- `finance_scenarios.json` — id(pk), searchId→searches(cascade,req), listingId→listings(setNull),
  label(req), kind(req purchase|rent_vs_buy), downPayment(def 0), ratePct(def 0), rateSource(md
  cited), termYears(def 30), monthlyTotal(def 0), breakdown(json stated|estimated lines),
  createdAt(now).
- `rate_snapshots.json` — id(pk), product(req), ratePct(req), source(req cited), fetchedAt(now).
- `negotiation_briefs.json` — id(pk), listingId→listings(cascade,req), angle(req md cited),
  evidence(json row refs), suggestedOpening(md), status(def draft: draft|used), createdAt(now).

## api/ — 10 NEW
- `searches/[id]/finance/profile/GET.ts`→getFinanceProfile; `…/profile/PUT.ts`→setFinanceProfile;
  `finance/rates/GET.ts`→listRates; `finance/rates/refresh/POST.ts`→refreshRates (spawn
  underwriter#refresh-rates); `searches/[id]/scenarios/GET.ts`→listScenarios;
  `searches/[id]/scenarios/POST.ts`→createScenario (computes via functions);
  `scenarios/[id]/DELETE.ts`→removeScenario; `listings/[id]/affordability/GET.ts`→
  listingAffordability (deterministic: profile + freshest rate → monthly/stress/share-of-income);
  `searches/[id]/rent-vs-buy/GET.ts`→rentVsBuy; `listings/[id]/negotiation/POST.ts`→
  draftNegotiation (spawn advisor/negotiator#brief; briefs ride getListing include).

## hooks/ — 3 NEW
- `refresh-rates.ts` — cron 24h, trigger finance/underwriter#refresh-rates.
- `scenario-on-shortlist.ts` — database **update** listings → guard status==='shortlisted' &&
  search.mode==='buy' && no scenario for listing → underwriter#scenarios.
- `negotiate-on-price-drop.ts` — database insert listing_events → guard kind∈{price_change(drop),
  relisted} && no fresh brief → advisor/negotiator#brief.

## spaces/finance/ — NEW full-format space (2 agents) + advisor/negotiator
- underwriter: db:read [searches,listings,finance_profiles,finance_scenarios,rate_snapshots],
  db:write [finance_scenarios,rate_snapshots,alerts]; actions scenarios/refresh-rates. Charter:
  information-not-advice, cited rates, labelled estimates, ranges over false precision, never ask
  for documents.
- strategist: db:read [+commutes,taste_notes,listing_events], db:write [finance_scenarios];
  actions rent-vs-buy/advise; defaultAction advise.
- advisor/agents/negotiator: db:read [listings,listing_analyses,listing_events,inquiries,
  finance_scenarios], db:write [negotiation_briefs,inquiries]; action brief. Charter: every angle
  cites a db row; no fabricated competing offers/market claims; no pressure tactics.
- tasklists/build-scenarios/{index,01-load-profile-and-rates(role:explore),02-write-scenarios}.md.
- functions/ — amortize.ts, afford.ts (stress margin + share-of-income), rentVsBuyHorizon.ts.
- components/ — view/ScenarioCard.tsx, view/StressGauge.tsx (text-destructive over-ceiling).
- knowledge/ — mortgages/{index,rates-terms-and-amortization,closing-and-recurring-costs};
  affordability/{index,stress-testing,rent-vs-buy-framing};
  negotiation/{index,evidence-based-angles,what-not-to-claim}.

## pages/ — 5 NEW
- searches/[searchId]/finance.tsx (profile editor + cited rates),
  searches/[searchId]/affordability.tsx (shortlist × scenarios grid + StressGauge +
  <Chat agent="finance/strategist">), listings/[id]/scenarios.tsx,
  listings/[id]/negotiation.tsx (brief + evidence + merge-into-inquiry),
  searches/[searchId]/rent-vs-buy.tsx. SearchTabs += Finance·Affordability.

## tests/
- 20 tables; EXPECTED_ENDPOINTS += 10; scenario-on-shortlist/negotiate-on-price-drop guards
  asserted (update-event row-state pattern); finance full-format; negotiator in advisor space;
  amortize/afford/rentVsBuyHorizon unit tests (golden numbers); every scenario breakdown line
  labelled.

## Build/verify
1. me: database + functions (golden-number tests first). 2. fan out: api / finance space +
negotiator / pages. 3. hooks + integrate. 4. LIVE: shortlist buy listing → scenarios w/ cited
rate (rent-mode no-op); price-drop event → one brief citing rows; affordability figures ===
function output. 5. green gate → push.

---

# PLAN — round 5 (FEATURE EXPANSION: `household` — decide together)

Strictly additive to rounds 1–4 (20 tables / 46 api / 14 hooks / 5 spaces). Floors met: 3 new
tables (+1 column), 1 new space + 3 agents, 9 new api, 3 new hooks, 5 new pages. Spec: §Round 5 +
§Round-5 reconciliation.

## database/
- `stakeholders.json` — id(pk), searchId→searches(cascade,req), name(req), role(def companion:
  decider|companion|advisor), brief, notes, createdAt(now).
- `stakeholder_votes.json` — id(pk), stakeholderId→stakeholders(cascade,req),
  listingId→listings(cascade,req), vote(req yes|no|maybe), reason, folded(bool def false),
  createdAt(now). One row per person×listing — castVote upserts (no compound-unique in schema
  language; handler-enforced).
- `decision_entries.json` — id(pk), searchId→searches(cascade,req), listingId→listings(setNull),
  kind(req advanced|dismissed|viewed|applied|note), body(md cited), createdAt(now).
- `taste_notes.json` — ADD stakeholderId→stakeholders(setNull; null = shared household taste).
  alerts.kind += household_conflict.

## api/ — 9 NEW
- `searches/[id]/stakeholders/POST.ts`→addStakeholder (fires onboard hook); `…/GET.ts`→
  listStakeholders; `stakeholders/[id]/PATCH.ts`→updateStakeholder; `stakeholders/[id]/DELETE.ts`→
  removeStakeholder; `listings/[id]/votes/POST.ts`→castVote (upsert by stakeholderId+listingId);
  `listings/[id]/votes/GET.ts`→listingVotes; `searches/[id]/conflicts/GET.ts`→conflicts
  (functions/splitDetector.ts over votes+scores); `searches/[id]/journal/GET.ts`→decisionLog;
  `searches/[id]/journal/POST.ts`→addDecisionNote.

## hooks/ — 3 NEW
- `onboard-stakeholder.ts` — database insert stakeholders → household/host#onboard (idempotent:
  brief already reflected in a tagged note → skip).
- `reconcile-vote.ts` — database insert stakeholder_votes → household/mediator#reconcile
  (self-scans folded===false; conflict on a shortlisted split → 'household_conflict' alert).
- `journal-pipeline-moves.ts` — database **update** listings → household/chronicler#journal
  (guard: last decision_entries status for the listing unchanged → return; cooldown; ranker score
  writes produce zero entries).

## spaces/household/ — NEW full-format space (3 agents)
- host: db:read [searches,stakeholders,taste_notes,taste_signals], db:write [stakeholders,
  taste_notes]; action onboard.
- mediator: db:read [searches,stakeholders,stakeholder_votes,listings,taste_notes,taste_signals],
  db:write [taste_notes,taste_signals,alerts]; actions reconcile/conflicts; defaultAction
  conflicts. Charter: neutral reporting, never manufacture consensus.
- chronicler: db:read [listings,stakeholder_votes,taste_signals,decision_entries], db:write
  [decision_entries]; action journal.
- ranker (additive): db:read += [stakeholders,stakeholder_votes]; scoreSummary names splits;
  learn attributes signals to named stakeholders.
- tasklists/reconcile-votes/{index,01-scan-unfolded(role:explore),02-write-notes,03-flag-conflicts}.md.
- functions/ — voteMatrix.ts, splitDetector.ts.
- components/ — view/VoteChips.tsx, view/ConflictMatrix.tsx.
- knowledge/ — group-decisions/{index,surfacing-disagreement-neutrally,briefs-to-preferences};
  decision-memory/{index,what-to-journal,retrospectives-that-help}.

## pages/ — 5 NEW + chips
- searches/[searchId]/household.tsx (people + briefs + <Chat agent="household/mediator">),
  searches/[searchId]/conflicts.tsx (matrix), listings/[id]/votes.tsx,
  searches/[searchId]/journal.tsx, searches/[searchId]/taste/[stakeholderId].tsx. VoteChips on
  ListingCard + CompareTable (additive). SearchTabs += Household·Journal.

## tests/
- 23 tables; taste_notes has stakeholderId; EXPECTED_ENDPOINTS += 9; castVote upsert (two casts →
  one row); journal guard (score update → 0 entries, status move → 1); household full-format;
  splitDetector/voteMatrix unit tests.

## Build/verify
1. me: database + functions. 2. fan out: api / household space + ranker edits / pages.
3. hooks + integrate. 4. LIVE: addStakeholder w/ brief → tagged notes; opposing votes on
shortlisted → conflict alert + matrix + scoreSummary names it; re-vote updates in place.
5. green gate → push.

---

# PLAN — round 6 (FEATURE EXPANSION: `closer` — win it)

Strictly additive to rounds 1–5 (23 tables / 55 api / 17 hooks / 6 spaces). Floors met: 4 new
tables, 1 new space + 3 agents, 10 new api, 3 new hooks, 5 new pages. Spec: §Round 6 + §Round-6
reconciliation. End state: 27 tables / ~65 api / 20 hooks / 7 spaces / 20 agents.

## database/
- `applications.json` — id(pk), listingId→listings(cascade,req), kind(req rental_application|
  offer), status(def draft: draft|submitted|accepted|rejected|withdrawn), terms(json),
  submittedAt, decidedAt, notes(md), createdAt(now); relations listing(belongsTo),
  items(hasMany application_items).
- `application_items.json` — id(pk), applicationId→applications(cascade,req), label(req),
  category(def document: document|task|movein), done(bool def false), note(md — labels + user
  notes, NEVER document contents), dueAt, createdAt(now).
- `contacts.json` — id(pk), searchId→searches(cascade,req), listingId→listings(setNull),
  name(req), role(def agent: agent|landlord|property_manager|other), channel, lastContactAt,
  notes(md), createdAt(now).
- `deadlines.json` — id(pk), searchId→searches(cascade,req), listingId→listings(setNull),
  applicationId→applications(setNull), label(req), dueAt(req), done(bool def false), source(md
  cited), createdAt(now). alerts.kind += followup_due, deadline_soon.

## api/ — 10 NEW
- `listings/[id]/applications/POST.ts`→createApplication (fires checklist hook);
  `searches/[id]/applications/GET.ts`→listApplications; `applications/[id]/GET.ts`→getApplication
  (include items + listing + contacts); `applications/[id]/PATCH.ts`→updateApplication (accepted →
  movein hook); `application-items/[id]/PATCH.ts`→toggleApplicationItem;
  `searches/[id]/contacts/POST.ts`→addContact; `searches/[id]/contacts/GET.ts`→listContacts;
  `contacts/[id]/PATCH.ts`→updateContact; `searches/[id]/deadlines/GET.ts`→listDeadlines
  (functions/dueSoon.ts sort); `deadlines/[id]/PATCH.ts`→completeDeadline.

## hooks/ — 3 NEW
- `checklist-on-application.ts` — database insert applications → closer/applicant#checklist
  (idempotent: items exist → skip).
- `followup-nudges.ts` — cron 24h, trigger closer/coordinator#nudge (coalesce: ≤1 nudge alert per
  search per day).
- `prepare-movein.ts` — database **update** applications → guard status==='accepted' && no
  'movein' items → closer/settler#movein.

## spaces/closer/ — NEW full-format space (3 agents)
- applicant: db:read [searches,listings,applications,application_items,contacts], db:write
  [applications,application_items]; action checklist (locale norms via webSearch, cited in item
  notes; generic + say-so when unverifiable). Charter: reference documents by name, never
  contents; nothing is submitted by the app.
- coordinator: db:read [applications,application_items,contacts,deadlines,listings,inquiries,
  viewings], db:write [deadlines,contacts,alerts]; actions nudge/track; defaultAction track.
- settler: db:read [applications,application_items,listings,deadlines], db:write
  [application_items,deadlines]; action movein.
- tasklists/build-dossier/{index,01-locale-norms(role:explore),02-write-items}.md;
  tasklists/movein-runbook/{index,01-scope,02-write-items-and-deadlines}.md.
- functions/ — dueSoon.ts, staleness.ts.
- components/ — view/DossierChecklist.tsx, view/DeadlineRow.tsx.
- knowledge/ — applications/{index,rental-dossiers-by-locale,offers-and-terms};
  closing/{index,deadline-discipline,movein-runbook}.

## pages/ — 5 NEW
- searches/[searchId]/applications.tsx (status board), applications/[id].tsx (dossier + terms +
  contacts + linked history + <Chat agent="closer/coordinator">),
  searches/[searchId]/contacts.tsx, searches/[searchId]/deadlines.tsx,
  applications/[id]/movein.tsx. SearchTabs += Applications·Deadlines.

## tests/
- 27 tables; EXPECTED_ENDPOINTS += 10 (≈65 total); prepare-movein guard (second accepted write →
  no-op); closer full-format; spaces list = [advisor,closer,district,finance,household,intake,
  scout]; dueSoon/staleness unit tests; grep-style assertion: no application_items fixture note
  contains document-content markers.

## Build/verify
1. me: database + functions. 2. fan out: api / closer space / pages. 3. hooks + integrate.
4. LIVE: createApplication → cited checklist once; accepted → movein items + deadlines exactly
once; overdue fixture → one coalesced nudge alert. 5. green gate → push both repos. Phase 6 prod
install + AI test per prompt protocol.
