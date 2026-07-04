# PLAN — `trips` project-application (round 1, CORE BUILD)

File-by-file plan. Output root: **`store/projects/trips/`** (monorepo). `types/` + `.data/`
git-ignored. All contracts grounded in the shipped engine (see PROGRESS "Environment"). Mirrors
the sibling `blog` build patterns exactly.

## Root files
- `package.json` — name `@lmthing/app-trips`, private, type module, deps: `react`, `react-dom`,
  `@lmthing/ui`, `@lmthing/css` (workspace:*).
- `tsconfig.json` — the blog default (react-jsx, strict, bundler moduleRes, include pages/components/
  lib/api/hooks/types).
- `.gitignore` — `types/ .data/ node_modules/ dist/`.
- `README.md` — one-paragraph what/how.

## database/ (5 tables — descriptions mandatory, FK/relations resolve) — per spec §Database
- `trips.json` — id(pk uuid), title(req), brief, startDate, endDate, status(def planning),
  budgetUsd(def 0), createdAt(now); relations destinations(hasMany via tripId), bookings(hasMany via tripId).
- `destinations.json` — id(pk), tripId→trips(cascade,req), name(req), arrivalDate, departureDate,
  orderIndex(def 0), notes; relations trip(belongsTo), items(hasMany itinerary_items via destinationId),
  research(hasMany via destinationId).
- `itinerary_items.json` — id(pk), destinationId→destinations(cascade,req), day(date,req), startTime,
  endTime, kind(req), title(req), location, notes, **estimatedCost(def 0)**, **currency(def USD)**,
  bookingId→bookings(setNull); relations destination(belongsTo), booking(belongsTo).
- `bookings.json` — id(pk), tripId→trips(cascade,req), kind(req), provider, confirmation, cost(def 0),
  startAt, endAt, url; relations trip(belongsTo), items(hasMany itinerary_items via bookingId).
- `research.json` — id(pk), tripId→trips(cascade,req), destinationId→destinations(cascade, nullable),
  topic(req), body, status(def pending), createdAt(now); relations destination(belongsTo), trip(belongsTo).

## api/ (11 endpoints) — each name/description/Input/Output + default async handler; `@app/runtime` HttpError
- `trips/GET.ts` → `tripList` `{}` → `Trip[]` (orderBy createdAt desc).
- `trips/POST.ts` → `createTrip` `{title, brief, startDate?, endDate?, budgetUsd?}` →
  `{tripId, status:'planning'}` — insert then **delegate** `concierge/planner#plan-trip` fire-and-forget
  (use ctx.spawn if delegate not in ctx; per engine, api ctx has spawn). Returns immediately.
- `trips/[id]/GET.ts` → `getTrip` `{id}` → `Trip & {destinations:(Destination&{items})[]}` — two-hop
  include: query trips include destinations; then per destination query items in JS (or nested include if
  supported). Falls back to manual JS assembly (equality-only where).
- `trips/[id]/PATCH.ts` → `updateTrip` `{id, ...fields}` → `Trip`.
- `trips/[id]/DELETE.ts` → `deleteTrip` `{id}` → `{ok}` (cascade via FK).
- `trips/[id]/budget/GET.ts` → `tripBudget` `{id}` → `{budgetUsd, booked, estimated, remaining, byKind}`.
- `trips/[id]/destinations/POST.ts` → `addDestination` `{id, name, arrivalDate?, departureDate?}` →
  `Destination` (insert fires research-new-destination hook).
- `items/[id]/PATCH.ts` → `updateItem` `{id, day?, startTime?, endTime?, title?, notes?, location?,
  estimatedCost?}` → `ItineraryItem`.
- `items/[id]/DELETE.ts` → `removeItem` `{id}` → `{ok}`.
- `bookings/POST.ts` → `addBooking` `{tripId, kind, provider?, confirmation?, cost?, startAt?, endAt?,
  url?}` → `Booking`.
- `bookings/[id]/DELETE.ts` → `removeBooking` `{id}` → `{ok}`.
- `research/[destId]/GET.ts` → `getResearch` `{destId}` → `Research[]`.
  (12 files total incl. tripList; endpoint NAMES = 12 counting getResearch; spec "11" counts the core set.)

## hooks/ (2)
- `research-new-destination.ts` — database `on:{table:'destinations',event:'insert'}`, imperative handler:
  idempotence (query research by destinationId; return if exists) then
  `delegate('concierge/researcher','dive',{input:{destinationId:row.id}})`.
- `watch-booking-prices.ts` — cron `every:'12h'`, `trigger:'concierge/researcher#price-check'`, budget.

## spaces/concierge/ (project-scoped space — FULL space format, 3 agents)
- `agents/planner/{charter.md,instruct.md}` — orchestrator. caps: `db:read {tables:[trips,destinations]}`;
  `canDelegateTo: [concierge/researcher#dive, concierge/scheduler#lay-out]`. Backed by `plan-trip` tasklist.
- `agents/researcher/{charter.md,instruct.md}` — caps: `db:read {tables:[destinations,trips,research,
  bookings]}`, `db:write {tables:[research]}`. actions: `dive`, `price-check`. Uses universal webSearch/webFetch.
- `agents/scheduler/{charter.md,instruct.md}` — caps: `db:read {tables:[destinations,research]}`,
  `db:write {tables:[destinations,itinerary_items]}`. actions: `lay-out`.
- `tasklists/plan-trip/` — `index.md` goal + `propose_destinations.md` (role:plan; delegates scheduler to
  write destinations), `research_each.md` (forEach: propose_destinations.destinationIds; canDelegateTo
  researcher#dive), `lay_out.md` (canDelegateTo scheduler#lay-out).
- `functions/` — `groupByDay.ts` (group items by ISO day), `rollUpBudget.ts` (sum bookings+items by kind),
  `dedupeDestinations.ts` (case-insensitive name dedupe). Typed TS, default export or named.
- `components/` — `DestinationProposal.tsx` (ask/display component for proposed destinations, token-gated).
- `knowledge/` — 3 fields, each index.md + ≥2 aspect files:
  - `destination-research/` — index + `sources-and-method.md` + `evaluating-worth.md`.
  - `itinerary-pacing/` — index + `daily-rhythm.md` + `transit-and-logistics.md`.
  - `budgeting/` — index + `cost-estimation.md` + `trimming-to-fit.md`.

## pages/ (5 routes + _app + _layout) + components/
- `_app.tsx` — passthrough (blog pattern).
- `_layout.tsx` — nav: My Trips · New Trip.
- `index.tsx` — `/` → tripList (cards linking to timeline).
- `new.tsx` — `/new` → describe-a-trip form → createTrip → navigate to /trips/:id/plan.
- `trips/[tripId].tsx` — `/trips/:tripId` → getTrip (nested), BudgetStrip, DayColumn timeline;
  poll (refetchInterval) while status==='planning'.
- `trips/[tripId]/plan.tsx` — `/trips/:tripId/plan` → getTrip + `<Chat agent="concierge/planner">`.
- `trips/[tripId]/research/[destId].tsx` — getResearch + `<Chat agent="concierge/researcher">`.
- components: `Spinner.tsx`, `MarkdownBody.tsx`, `TripCard.tsx`, `DestinationHeader.tsx`, `DayColumn.tsx`,
  `ItineraryCard.tsx`, `BookingRow.tsx`, `BudgetStrip.tsx`. Design tokens only.

## tests/ (`tests/trips.test.mjs`, node --test)
- Schemas pass real `validateSchemaSet` (5 tables, names sorted).
- Every table/column/relation has a description; exactly-one PK each.
- All api handlers exist + export name/Input/Output/default async handler; names correct.
- Hooks: research-new-destination is database:insert w/ idempotence + delegate; watch-booking-prices is cron.
- concierge agents: 3, least-privilege (no db:schema/pages:write/api:write/hooks:write); planner has no db:write.
- Full-space-format assertions: each agent has charter.md + instruct.md; space has tasklists/, functions/,
  knowledge/ (each field index.md + ≥2 aspects), components/.

## Build/verify sequence
1. Write foundation (database + root) — me.
2. Fan out (3 parallel Sonnet): api / pages+components / hooks+concierge-space.
3. Integrate; materialize into temp root; `lmthing serve`; verify manifest + types + pages build + api I/O.
4. 🔴 LIVE: createTrip → planner plan-trip → propose destinations → research_each forEach → lay_out writes
   itinerary_items (DeepSeek `LM_MODEL_S`). Capture trace. Fallback to mock streamFn only if keys empty.
5. Green gate (lint:tokens/typecheck/build/test) → push sdk/org then monorepo.

---

# PLAN — round 2 (FEATURE EXPANSION)

Strictly additive to round 1 (never delete/regress). Same engine contracts (see PROGRESS
"Environment"). Floors met: 5 new tables, 2 new spaces (3 agents), 12 new api endpoints, 4 new hooks,
5 new pages. All grounded in the spec's "Additional features" + the round-2 reconciliation.

## database/ — 5 NEW tables + column adds
- `documents.json` — id(pk uuid), tripId→trips(cascade,req), kind(req: booking_pdf|ticket_image|
  itinerary|passport_visa|place_photo|other), filename, mime, content(the pasted text — see
  reconciliation), sourceUrl, status(def pending), summary, error, uploadedAt(now);
  relations trip(belongsTo), extractions(hasMany document_extractions via documentId).
- `document_extractions.json` — id(pk), documentId→documents(cascade,req), table(req: which domain
  table), rowId(req), confidence(number, def 0), createdAt(now); relation document(belongsTo).
- `knowledge_notes.json` — id(pk), tripId→trips(cascade, nullable), destinationId→destinations(setNull,
  nullable), topic(req), body(md), sourceKind(req: document|research|web|logistics), documentId→
  documents(setNull, nullable), createdAt(now); relations trip/destination/document(belongsTo).
- `packing_items.json` — id(pk), tripId→trips(cascade,req), label(req), category(def other:
  clothing|gear|documents|toiletries|electronics|other), reason, packed(bool def false),
  createdAt(now); relation trip(belongsTo).
- `transit_legs.json` — id(pk), tripId→trips(cascade,req), fromDestinationId→destinations(setNull,
  nullable), toDestinationId→destinations(cascade,req), mode(req: flight|train|bus|car|ferry|walk),
  departAt, arriveAt, durationMinutes, estimatedCost(def 0), currency(def USD), bookByDate,
  notes, status(def suggested); relations trip(belongsTo), from(belongsTo destinations via
  fromDestinationId), to(belongsTo destinations via toDestinationId).
- `itinerary_items.json` — ADD columns: needsBooking(bool def false), bookByDate(date), weatherNote(string).

## api/ — 12 NEW endpoints (name/description/Input/Output + default async handler; inline Db/Ctx types)
Documents: `trips/[id]/documents/POST.ts`→uploadDocument; `trips/[id]/documents/GET.ts`→listDocuments;
  `documents/[id]/GET.ts`→getDocument (include extractions + linked rows + notes).
Packing: `trips/[id]/packing/GET.ts`→packingList; `trips/[id]/packing/generate/POST.ts`→generatePacking
  (spawn logistics/packer#pack); `packing/POST.ts`→addPackingItem; `packing/[id]/PATCH.ts`→togglePacked;
  `packing/[id]/DELETE.ts`→removePackingItem.
Logistics: `trips/[id]/transit/GET.ts`→transitLegs (ordered); `trips/[id]/transit/plan/POST.ts`→
  planTransit (spawn logistics/navigator#plan-transit).
Reminders+notes: `trips/[id]/reminders/GET.ts`→tripReminders (items needsBooking && !bookingId, daysLeft+
  urgency); `trips/[id]/notes/GET.ts`→tripNotes (knowledge_notes for the trip).

## hooks/ — 4 NEW
- `analyze-document.ts` — database insert on documents → delegate records/analyst#analyze; idempotent
  (skip if status!=='pending' or extractions exist).
- `plan-transit-on-destination.ts` — database insert on destinations → delegate logistics/navigator#
  plan-transit; idempotent (skip if a transit_leg toDestinationId===row.id exists).
- `regenerate-packing.ts` — cron every 24h; imperative handler: for trips with startDate within ~10d,
  delegate logistics/packer#pack.
- `to-book-reminders.ts` — cron daily; imperative handler: scan itinerary_items needsBooking && !bookingId
  && bookByDate approaching → delegate logistics/navigator#booking-windows { input:{tripId} }.

## spaces/records/ — NEW full-format space
- agents/analyst/{charter.md,instruct.md} — caps: db:read [documents, document_extractions, trips,
  destinations, bookings, itinerary_items, knowledge_notes], db:write [documents, document_extractions,
  bookings, itinerary_items, destinations, knowledge_notes]; canDelegateTo concierge/researcher#dive.
  actions: analyze. Routes by documents.kind.
- tasklists/analyze-document/ — index + 01-classify + 02-extract (route by kind) + 03-research-followup
  (delegate researcher).
- knowledge/documents/{index, booking-confirmations.md, itineraries-and-tickets.md};
  knowledge/extraction/{index, confidence-and-provenance.md, no-fabrication-safety.md}.
- functions/ — classifyKind.ts, parseTripDates.ts, extractAmount.ts.
- components/view/ExtractionSummary.tsx (token-gated).

## spaces/logistics/ — NEW full-format space (2 agents)
- agents/navigator/{charter.md,instruct.md} — caps: db:read [trips, destinations, transit_legs, bookings,
  knowledge_notes], db:write [transit_legs, knowledge_notes]. actions: plan-transit, booking-windows,
  visa-currency.
- agents/packer/{charter.md,instruct.md} — caps: db:read [trips, destinations, itinerary_items,
  transit_legs], db:write [packing_items]. action: pack.
- tasklists/plan-transit/ — index + 01-order-destinations + 02-leg_each (forEach over pairs) delegate…
  (navigator single-agent; tasklist is model-driven within navigator). Keep simple: index + 2 tasks.
- tasklists/build-packing/ — index + tasks (packer).
- knowledge/transit/{index, modes-and-booking-windows.md, visas-and-currency.md};
  knowledge/packing/{index, climate-and-season.md, activity-and-gear.md}.
- functions/ — legDuration.ts, packingCategories.ts, formatMoney.ts.
- components/view/TransitLegCard.tsx, PackingChecklist.tsx.

## concierge caps updates (additive)
- researcher: db:write add knowledge_notes → [research, knowledge_notes]; db:read add knowledge_notes.
- planner: db:read add knowledge_notes.
- scheduler: db:read add knowledge_notes; db:write add needsBooking/bookByDate via itinerary_items (already writes items).

## pages/ — 5 NEW routes + components + TripTabs sub-nav
- trips/[tripId]/documents.tsx — upload form + document list (status).
- documents/[docId].tsx — source summary + extractions + linked rows + notes (poll while pending).
- trips/[tripId]/packing.tsx — packing checklist (toggle/add/regenerate).
- trips/[tripId]/logistics.tsx — transit legs + <Chat agent="logistics/navigator"> + visa/currency notes.
- trips/[tripId]/reminders.tsx — to-book reminders (tripReminders) + trip notes (tripNotes).
- components: TripTabs.tsx (sub-nav: Timeline·Plan·Packing·Logistics·Docs·Reminders), DocumentUploadForm,
  DocumentRow, ExtractionRow, PackingRow, TransitLegRow, ReminderRow, NoteCard. Design tokens only.
- Wire TripTabs into the existing trip pages (timeline/plan/research) header. Update _layout unchanged.

## tests/ — extend trips.test.mjs
- Schemas: now 10 tables (add documents, document_extractions, knowledge_notes, packing_items,
  transit_legs) still pass validateSchemaSet; itinerary_items has needsBooking/bookByDate/weatherNote.
- EXPECTED_ENDPOINTS += the 12 new; all export name/Input/Output/default async handler.
- Hooks: analyze-document + plan-transit database; regenerate-packing + to-book-reminders cron/imperative.
- records + logistics full-format assertions (charter+instruct per agent, tasklists/functions/components/
  knowledge each field index.md + ≥2 aspects); least-privilege (no authoring caps).
- ≥2 spaces present.

## Build/verify
1. me: database + concierge caps.
2. fan out 3 Sonnet: api / spaces(records+logistics) / pages+components.
3. me: hooks + tests + integrate.
4. serve locally, live DeepSeek: uploadDocument→analyze-document hook→analyst extracts; addDestination→
   plan-transit hook→navigator writes transit_legs; generatePacking→packer. Capture evidence.
5. green gate → push both repos.
