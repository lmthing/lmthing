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
reconciliation. After this round: 27 tables / ~65 api / 20 hooks / 7 spaces / 20 agents.

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

---

# PLAN — round 7 (FEATURE EXPANSION: `guardian` — don't get burned)

Strictly additive to rounds 1–6 (27 tables / ~65 api / 20 hooks / 7 spaces). Floors met: 3 new
tables, 1 new space + 3 agents, 8 new api, 3 new hooks (+1 additive enrich edit), 5 new pages.
Spec: §Round 7 + §Round-7 reconciliation. Framing rules (charter-enforced): never assert fraud —
"signals consistent with…", cited; vetting = attributed quotes + links; rights = information not
legal advice, sourceQuality labelled.

## database/
- `screenings.json` — id(pk), listingId→listings(cascade,req), riskScore(def 0 — deterministic
  blend, not an assertion), signals(json: below_comps_outlier|deposit_before_viewing_language|
  urgency_pressure|webmail_only_contact|recycled_content|no_viewing_offered), body(md — each
  signal cited to exact text/rows), createdAt(now); relation listing(belongsTo).
- `rights_notes.json` — id(pk), searchId→searches(cascade,req), topic(req deposit_cap|agency_fees|
  notice_period|rent_control|habitability|other), body(req md cited), sourceQuality(def
  unverified: official|reputable|unverified), createdAt(now); relation search(belongsTo).
- `vetting_notes.json` — id(pk), listingId→listings(cascade,req), subject(req — the name AS
  STATED), kind(def unknown: agency|landlord|unknown), body(md — quotes + links, attributed),
  confidence(def 0), createdAt(now); relation listing(belongsTo).
- alerts.kind += scam_risk, questionable_fee; listings.flags vocabulary += scam_signals,
  questionable_fee.

## api/ — 8 NEW
- `listings/[id]/screening/GET.ts`→getScreening; `listings/[id]/screening/POST.ts`→rescreen
  (spawn guardian/screener#screen); `searches/[id]/risks/GET.ts`→listRisks (flagged listings,
  worst riskScore first, JS sort); `searches/[id]/rights/GET.ts`→rightsBriefing;
  `searches/[id]/rights/refresh/POST.ts`→refreshRights (spawn guardian/rights#refresh);
  `listings/[id]/fees/GET.ts`→feeAudit (costBreakdown lines annotated legal|over_cap|unknown via
  functions/feeAudit.ts, each citing its rights_notes rule); `listings/[id]/vetting/GET.ts`→
  getVetting; `listings/[id]/vetting/POST.ts`→vetContact (spawn guardian/vetter#vet).

## hooks/ — 3 NEW + 1 additive edit
- `rights-for-search.ts` — database insert searches → guardian/rights#brief (idempotent per
  locale: fresh rights_notes exist → skip).
- `vet-before-contact.ts` — database insert inquiries → guardian/vetter#vet (lands while the
  draft is unapproved; skip if a fresh vetting_note exists).
- `weekly-rights-refresh.ts` — cron '7d', trigger guardian/rights#refresh.
- EDIT `enrich-new-listing.ts` — append 6th sequential delegate guardian/screener#screen AFTER
  appraise (screening consumes the comps analysis; same session/depth).

## spaces/guardian/ — NEW full-format space (3 agents)
- screener: db:read [searches,listings,listing_analyses,listing_events,screenings], db:write
  [screenings,listings,alerts]; action screen. functions/scamSignals.ts (pattern tests + price-vs-
  comps outlier math), functions/textSimilarity.ts (+ shared photoUrls check → recycled_content,
  db-only). riskScore from the function; model writes cited narration only.
- rights: db:read [searches,listings,rights_notes], db:write [rights_notes,listings,alerts];
  universal webSearch/webFetch; actions brief/audit-fees/refresh; defaultAction brief. Uncited
  rule → sourceQuality 'unverified'; fee line w/o a cited cap → 'unknown', never over_cap.
- vetter: db:read [listings,inquiries,vetting_notes], db:write [vetting_notes]; universal
  webSearch/webFetch; action vet. Charter: quotes-not-accusations, links + confidence mandatory.
- tasklists/screen-listing/{index,01-run-signals(role:explore),02-write-screening}.md;
  tasklists/rights-brief/{index,01-research-rules(role:explore),02-write-notes,03-audit-fees}.md.
- functions/ — scamSignals.ts, textSimilarity.ts, feeAudit.ts.
- components/ — view/RiskBadge.tsx (text-destructive past threshold), view/SignalRow.tsx.
- knowledge/ — scam-patterns/{index,classic-rental-scams,pressure-and-payment-red-flags};
  tenant-rights/{index,researching-local-rules,fees-deposits-and-caps};
  vetting/{index,public-footprint-reads,quoting-not-accusing}.

## pages/ — 5 NEW
- searches/[searchId]/risks.tsx (risk board, worst first), listings/[id]/safety.tsx (signals →
  evidence links), searches/[searchId]/rights.tsx (briefing + <Chat agent="guardian/rights">),
  listings/[id]/vetting.tsx (quoted public-record read), searches/[searchId]/fees.tsx
  (search-wide fee audit). RiskBadge onto ListingCard + listing detail (additive). SearchTabs +=
  Risks·Rights.

## tests/
- 30 tables; EXPECTED_ENDPOINTS += 8; enrich has 6 delegates (screener last); rights-for-search/
  vet-before-contact idempotence; guardian full-format; scamSignals unit tests (bait fixture →
  expected signals; language-free fixture scores lower — independence), textSimilarity (duplicate
  description/photos → recycled_content), feeAudit (over-cap w/ cited rule → over_cap; uncited →
  unknown); no vetting_note body without a link.

## Build/verify
1. me: database + functions (signal fixtures first). 2. fan out: api / guardian space / pages.
3. hooks + enrich edit + integrate. 4. LIVE: scam-bait fixture through ingest → screening w/
cited signals + scam_risk alert; fee-over-cap fixture → questionable_fee citing line + rule;
draftInquiry → vetting note before approval. 5. green gate → push both repos.

---

# PLAN — round 8 (FEATURE EXPANSION: `coach` — keep the hunt on track)

Strictly additive to rounds 1–7 (30 tables / ~73 api / 23 hooks / 8 spaces). Floors met: 3 new
tables (+4 columns), 1 new space + 3 agents, 8 new api (+1 filter extension), 3 new hooks, 5 new
pages. Spec: §Round 8 + §Round-8 reconciliation. After this round: 33 tables / ~81 api /
26 hooks / 9 spaces / 26 agents.

## database/
- `hunt_reports.json` — id(pk), searchId→searches(cascade,req), metrics(json — huntMetrics.ts
  output verbatim), body(md — the pacer's read), createdAt(now); relation search(belongsTo).
- `resurfacings.json` — id(pk), listingId→listings(cascade,req), trigger(req price_drop|
  taste_shift|back_online), reason(req md cited), status(def suggested: suggested|accepted|
  declined), createdAt(now); relation listing(belongsTo). One row per (listing, trigger) —
  handler/agent enforced.
- `viewing_packs.json` — id(pk), viewingId→viewings(cascade,req), content(md — pack from db rows
  only), builtAt(now); relation viewing(belongsTo).
- COLUMN ADDS: searches.moveInBy(date); listings.amenities(json), listings.energyClass,
  listings.cashToMoveIn(def 0 — labelled breakdown line items ride costBreakdown). alerts.kind +=
  pace_warning, second_chance.

## api/ — 8 NEW (+1 extension)
- `searches/[id]/report/GET.ts`→huntReport (latest + history); `searches/[id]/report/POST.ts`→
  runCheckup (spawn coach/pacer#checkup); `searches/[id]/second-chances/GET.ts`→listResurfacings;
  `resurfacings/[id]/PATCH.ts`→resolveResurfacing (accept → listing status 'new' + 'save'-grade
  signal; decline → reinforcing 'dismiss' signal; both close the learn loop);
  `viewings/[id]/pack/GET.ts`→viewingPack; `viewings/[id]/pack/POST.ts`→buildPack;
  `listings/[id]/upfront/GET.ts`→upfrontCost (labelled cash-to-move-in);
  `searches/[id]/interview-status/GET.ts`→interviewStatus (has the day-one interview run — the
  interview page's gate). EXTEND listingFeed Input += amenity? (JS filter, additive).

## hooks/ — 3 NEW
- `weekly-checkup.ts` — cron '7d', trigger coach/pacer#checkup.
- `second-chance-scan.ts` — cron 24h, trigger coach/reviewer#rescan (evidence-gated: price into
  range / back_online event / blend now clears threshold; one row per listing+trigger).
- `pack-on-checklist.ts` — database **update** viewings → guard checklist non-empty && no pack →
  coach/reviewer builds viewing_packs from checklist + flags + rights questions (runs after the
  round-2 checklist hook by construction — it triggers on the checklist write itself).

## spaces/coach/ — NEW full-format space (3 agents)
- interviewer: db:read [searches,taste_notes,taste_signals,listings], db:write [taste_notes,
  taste_signals,searches]; action interview (CHAT-ONLY — ask-driven; headless = brief-only cold
  start, no error). Uses components/ask/InterviewStep.tsx.
- pacer: db:read [searches,listings,taste_signals,viewings,applications,hunt_reports], db:write
  [hunt_reports,alerts]; actions checkup/plan; defaultAction plan. ≤1 pace_warning per cycle.
- reviewer: db:read [searches,listings,listing_events,taste_signals,taste_notes,resurfacings],
  db:write [resurfacings,listings,taste_signals,alerts]; action rescan. Never re-suggest a
  declined (listing,trigger).
- ranker/clipper/surveyor additive updates: clipper extracts amenities/energyClass in parse
  (extractListingFields.ts extension); surveyor writes cashToMoveIn + seasonal-energy breakdown
  line; blendScore += amenity-mustHave match + moveInBy-proximity urgency term (zero when unset —
  round-1 scores unchanged).
- tasklists/day-one-interview/{index,01-ask-tradeoffs,02-seed-notes}.md;
  tasklists/weekly-checkup/{index,01-compute-metrics(role:explore),02-write-report}.md.
- functions/ — huntMetrics.ts, packContent.ts.
- components/ — ask/InterviewStep.tsx, view/MetricTile.tsx, view/SecondChanceCard.tsx.
- knowledge/ — hunt-craft/{index,pacing-a-deadline-hunt,when-to-widen-criteria};
  taste-elicitation/{index,interview-questions-that-work,tradeoffs-not-wishlists}.

## pages/ — 5 NEW
- searches/[searchId]/report.tsx (MetricTiles + read + <Chat agent="coach/pacer">),
  searches/[searchId]/interview.tsx (<Chat agent="coach/interviewer"> + ask flow),
  searches/[searchId]/second-chances.tsx (accept/decline cards),
  viewings/[id]/pack.tsx (print-CSS sheet — md rendered client-side, no PDF pipeline),
  searches/[searchId]/upfront.tsx (cash-to-move-in across shortlist). Feed += amenity filter
  chips. SearchTabs += Report·Second chances.

## tests/
- 33 tables; searches has moveInBy, listings have amenities/energyClass/cashToMoveIn;
  EXPECTED_ENDPOINTS += 8; spaces list = [advisor,closer,coach,district,finance,guardian,
  household,intake,scout]; coach full-format (3rd ask component present); huntMetrics golden
  numbers; blendScore urgency term zero when moveInBy unset; resurfacing idempotence
  (listing+trigger), decline never re-suggests; pack-on-checklist guard (checklist write → 1 pack;
  score-style unrelated viewing updates → none).

## Build/verify
1. me: database + functions (huntMetrics/blendScore golden tests first). 2. fan out: api / coach
space + clipper/surveyor/ranker edits / pages. 3. hooks + integrate. 4. LIVE: interview in chat
seeds cited notes + moveInBy; dismiss → ingest price-drop fixture → one resurfacing; accept →
status 'new' + signal; checkup → report + ≤1 pace_warning; checklist write → one pack.
5. green gate → push both repos. Phase 6 prod install + AI test per prompt protocol.

---

# PLAN — round 9 (FEATURE EXPANSION: `diligence` — sign with confidence)

Strictly additive to rounds 1–8 (33 tables / ~81 api / 26 hooks / 9 spaces). Floors met: 4 new
tables, 1 new space + 3 agents, 9 new api, 3 new hooks, 5 new pages. Spec: §Round 9 + §Round-9
reconciliation. Framing (charter): information not legal advice; quote clauses verbatim, never
paraphrase-and-escalate; works estimates are cited RANGES; ground truth (verifications) beats
inference.

## database/
- `contracts.json` — id(pk), listingId→listings(cascade,req), applicationId→applications(setNull),
  kind(req lease|reservation|agency_terms|purchase), content(req — pasted text, sanitized),
  status(def pending: pending|reviewed|error), summary(md plain-language), createdAt(now);
  relations listing/application(belongsTo), findings(hasMany contract_findings).
- `contract_findings.json` — id(pk), contractId→contracts(cascade,req), clause(req — VERBATIM
  quoted excerpt), category(req deposit|termination|fees|repairs|privacy|missing_term|other),
  severity(req info|caution|red_flag), body(req md — cited to clause + matching rights_notes
  rule), createdAt(now); relation contract(belongsTo).
- `renovation_estimates.json` — id(pk), listingId→listings(cascade,req), scope(req cosmetic|
  kitchen|bathroom|electrics|windows|heating|structural_question), rationale(req md cited to
  analyses/verifications/viewing notes), costLow(def 0), costHigh(def 0), currency(def USD),
  basis(req md — cited ballpark source), createdAt(now); relation listing(belongsTo).
- `verifications.json` — id(pk), listingId→listings(cascade,req), viewingId→viewings(setNull),
  question(req), topic(req size|light|noise|damp|heating|condition|location|other), status(def
  open: open|confirmed|refuted|unclear), evidence(md — the user's observation), **applied(bool
  def false — apply-hook cursor)**, resolvedAt, createdAt(now); relations listing/viewing(belongsTo).
- alerts.kind += contract_red_flag; listings.flags vocabulary += works_needed.

## api/ — 9 NEW
- `listings/[id]/contracts/POST.ts`→uploadContract (paste; insert fires review hook);
  `contracts/[id]/GET.ts`→getContract (include findings, worst severity first);
  `contracts/[id]/review/POST.ts`→reviewContract (re-run after edit);
  `listings/[id]/renovation/GET.ts`→renovationEstimate (lines + total range);
  `listings/[id]/renovation/POST.ts`→scopeRenovation (spawn diligence/estimator#scope);
  `listings/[id]/total-cost/GET.ts`→totalCostWithWorks (price/rent + amortized works midpoint via
  worksCost.ts — every line labelled); `listings/[id]/verifications/GET.ts`→listVerifications;
  `verifications/[id]/PATCH.ts`→resolveVerification (status+evidence; fires apply hook);
  `searches/[id]/verifications/GET.ts`→openVerifications (shortlist-wide open questions,
  grouped by viewing).

## hooks/ — 3 NEW
- `review-new-contract.ts` — database insert contracts → diligence/reader#review (skip unless
  status==='pending').
- `collect-verifications.ts` — database insert viewings → diligence/verifier#collect (runs
  ALONGSIDE round-2 checklist-on-viewing on the same insert — different hooks may share a
  trigger; idempotent: skip if open verifications exist for the listing).
- `apply-verification.ts` — database **update** verifications → guard status!=='open' &&
  !applied → sequential delegates: diligence/verifier#apply, then diligence/estimator#scope when
  the topic is condition-grade (damp|heating|condition) — the two-delegate imperative pattern.

## spaces/diligence/ — NEW full-format space (3 agents)
- reader: db:read [contracts,contract_findings,rights_notes,listings,applications], db:write
  [contracts,contract_findings,alerts]; canDelegateTo [guardian/rights#brief] (pull the rights
  briefing in when absent — cross-space delegation); action review. red_flag REQUIRES a matched
  cited rule (or self-contradiction with the listing's stated terms); unmatched concern ⇒
  caution + "verify with a local expert".
- estimator: db:read [listings,listing_analyses,verifications,viewings,renovation_estimates,
  searches], db:write [renovation_estimates,listings]; universal webSearch (cited ballparks);
  action scope. Un-evidenced scope ⇒ structural_question, never a number.
- verifier: db:read [listings,listing_analyses,viewings,verifications], db:write [verifications,
  listing_analyses,listings,taste_signals]; actions collect/apply; defaultAction collect.
  apply is deterministic via verificationDelta.ts (confirmed ⇒ flag stays + confidence 1.0;
  refuted ⇒ flag removed + analysis annotated; both write a taste signal).
- tasklists/review-contract/{index,01-split-clauses(role:explore),02-check-terms,
  03-write-findings}.md; tasklists/scope-works/{index,01-collect-evidence(role:explore),
  02-estimate-ranges}.md.
- functions/ — clauseSplit.ts, mandatoryTerms.ts (locale checklist matched vs cited rights_notes),
  worksCost.ts (range math + amortize-into-monthly, reusing R4 amortization), verificationDelta.ts.
- components/ — view/ClauseFinding.tsx, view/WorksEstimate.tsx, ask/VerifyAtViewing.tsx (the
  post-viewing record-what-you-saw chat flow — chat-only; the verifications page form is the
  headless-equivalent path). Token-gated.
- knowledge/ — contracts/{index,lease-red-flags,mandatory-terms-by-locale};
  works/{index,cost-ballparks-and-ranges,spotting-hidden-work};
  verification/{index,observation-vs-inference,resolving-findings}.

## pages/ — 5 NEW
- listings/[id]/contract.tsx (paste + findings by severity, quoted clause + cited rule +
  <Chat agent="diligence/reader">), contracts/[id].tsx (summary + full findings),
  listings/[id]/renovation.tsx (scoped lines + total-cost-with-works comparison),
  listings/[id]/verifications.tsx (the ledger: open questions → record observations),
  searches/[searchId]/diligence.tsx (shortlist board: contract status, red flags, works totals,
  open verifications). SearchTabs += Diligence.

## tests/
- 37 tables; verifications has applied cursor; EXPECTED_ENDPOINTS += 9; two hooks share the
  viewings insert trigger (both idempotent); apply-verification guard (second resolve → no-op);
  diligence full-format (4th ask component present); clauseSplit/mandatoryTerms unit tests
  (over-cap deposit fixture → red_flag w/ rule citation; unmatched concern → caution; missing
  mandatory term → missing_term finding); worksCost golden numbers (totalCostWithWorks ===
  function output); verificationDelta (confirmed/refuted paths; taste signal written both ways).

## Build/verify
1. me: database + functions (clause/works/delta fixtures first). 2. fan out: api / diligence
space / pages. 3. hooks + integrate. 4. LIVE: paste lease fixture → red_flag quoting clause +
citing rule + alert; schedule viewing → checklist AND verifications once each; resolve refuted →
flag removed + signal + idempotent re-resolve; confirmed damp → ranged cited works line.
5. green gate → push both repos.

---

# PLAN — round 10 (FEATURE EXPANSION: `lookout` — see the whole board)

Strictly additive to rounds 1–9 (37 tables / ~90 api / 29 hooks / 10 spaces). Floors met: 3 new
tables, 1 new space + 3 agents, 9 new api, 3 new hooks, 5 new pages. Spec: §Round 10 + §Round-10
reconciliation. End state: 40 tables / ~99 api / 32 hooks / 11 spaces / 32 agents. Framing
(charter): small-sample honesty — below the minimum n the economist claims NO trend; web context
cited, never blended into the numbers; playbook = lessons about the hunt, no personal data about
counterparties.

## database/
- `coverage_reports.json` — id(pk), searchId→searches(cascade,req), gaps(json: stale_source|
  missing_portal|filter_mismatch|budget_band_gap entries), body(md cited), createdAt(now);
  relation search(belongsTo).
- `market_snapshots.json` — id(pk), areaId→areas(setNull — null = search-city scope), scope(req
  label: area/rooms-band), metrics(json — marketStats.ts output verbatim incl. sampleSize +
  insufficient flag), body(md cited — no trend claims when insufficient), computedAt(now);
  relation area(belongsTo).
- `playbook_notes.json` — id(pk), sourceSearchId→searches(setNull — pod-durable beyond the hunt),
  scope(req sources|taste|process|areas), body(req md cited), createdAt(now);
  relation sourceSearch(belongsTo).
- searches.status += completed|abandoned (additive values; pollers/crons already skip
  non-active); alerts.kind += coverage_gap, market_shift.

## api/ — 9 NEW
- `searches/[id]/coverage/GET.ts`→coverageReport (latest + gaps);
  `searches/[id]/coverage/POST.ts`→runCoverage (spawn lookout/spotter#scan);
  `areas/[id]/market/GET.ts`→areaMarket (snapshot history);
  `searches/[id]/market/GET.ts`→searchMarket (search-scoped pulse across its areas);
  `searches/[id]/market/POST.ts`→runPulse (spawn lookout/economist#pulse);
  `listings/[id]/timing/GET.ts`→offerTiming (DOM + cut history vs the snapshot distribution,
  cited); `playbook/GET.ts`→playbook (pod-wide, newest first); `playbook/POST.ts`→addPlaybookNote
  (user lessons join the agents'); `searches/[id]/retrospective/GET.ts`→retrospective
  (retroTimeline.ts assembly: events + journal + reports + winner provenance + distilled notes).
  Completing a hunt rides existing updateSearch (status:'completed').

## hooks/ — 3 NEW
- `coverage-checkup.ts` — cron '7d', trigger lookout/spotter#scan (gap alerts dedupe vs the
  previous report's gaps — one alert per NEW gap).
- `market-pulse.ts` — cron '7d', trigger lookout/economist#pulse (material inter-snapshot move ⇒
  one market_shift alert).
- `archive-completed-search.ts` — database **update** searches → guard status∈{completed,
  abandoned} && no playbook notes distilled from it → lookout/archivist#distill.

## spaces/lookout/ — NEW full-format space (3 agents)
- spotter: db:read [searches,sources,raw_captures,listings,coverage_reports], db:write
  [coverage_reports,alerts]; universal webSearch (portal landscape, cited); action scan.
  Staleness/filter math via coverageGaps.ts; names portals, never disparages.
- economist: db:read [areas,listings,listing_events,market_snapshots,searches], db:write
  [market_snapshots,alerts]; universal webSearch (context only, cited); actions pulse/timing;
  defaultAction pulse. marketStats.ts computes (medians/percentiles, DOM distribution, cut
  frequency, min-sample gate baked in); model narrates.
- archivist: db:read [searches,sources,listings,listing_events,taste_notes,taste_signals,
  decision_entries,hunt_reports,playbook_notes], db:write [playbook_notes]; action distill.
  Playbook = db-backed durable memory (NOT a runtime knowledge/ write — the standing rule;
  promotion into space knowledge stays THING→appbuilder).
- Cross-agent additive updates: scout/appraiser + advisor/negotiator + coach/pacer db:read +=
  [market_snapshots]; coach/interviewer db:read += [playbook_notes] (day-one interview opens
  with last hunt's lessons).
- tasklists/market-pulse/{index,01-compute-stats(role:explore),02-write-snapshot}.md;
  tasklists/distill-playbook/{index,01-gather-hunt(role:explore),02-write-notes}.md.
- functions/ — marketStats.ts, coverageGaps.ts, retroTimeline.ts.
- components/ — view/MarketTiles.tsx (sampleSize ALWAYS rendered), view/CoverageGapCard.tsx.
- knowledge/ — market-reading/{index,small-sample-honesty,timing-signals};
  coverage/{index,portal-landscapes,tuning-saved-searches};
  hunt-memory/{index,what-transfers-between-hunts,distilling-a-playbook}.

## pages/ — 5 NEW
- searches/[searchId]/coverage.tsx (gaps + fix-it actions: add source / fix filter),
  market.tsx (/market — pod-wide pulse dashboard, MetricTiles w/ sample sizes),
  listings/[id]/timing.tsx (when-to-offer beside the negotiation brief),
  playbook.tsx (/playbook — durable lessons, agent- + user-written),
  searches/[searchId]/retrospective.tsx (the hunt's story — close-out screen).
  SearchTabs += Coverage·Market.

## tests/
- 40 tables; searches.status accepts completed/abandoned; EXPECTED_ENDPOINTS += 9 (≈99 total);
  spaces list = [advisor,closer,coach,diligence,district,finance,guardian,household,intake,
  lookout,scout]; lookout full-format; marketStats golden numbers + min-sample gate
  (insufficient:true below n → economist body asserts no trend); coverageGaps (14d-silent
  producing source → stale_source; gap dedupe: second scan same gap → no new alert);
  archive guard (re-save completed → no-op; distill exactly once); retroTimeline assembly.

## Build/verify
1. me: database + functions (marketStats/coverageGaps golden tests first). 2. fan out: api /
lookout space + cross-agent cap edits / pages. 3. hooks + integrate. 4. LIVE: seed 20+ listings
across 2 areas → pulse snapshots match golden medians; sparse area → insufficient, no trend
claim; silence a producing source 14d (fixture clock) → one coverage_gap alert; complete the
search → playbook distilled once; new search interview cites it. 5. green gate → push both
repos. Phase 6 prod install + AI test per prompt protocol.
