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
