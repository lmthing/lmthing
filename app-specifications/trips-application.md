# lmthing.trips as a Project-Application — the `trips` project

> A concrete instantiation of [project-as-application.md](./project-as-application.md) for a
> **trip planner**: you describe a trip, a **`concierge`** space of agents researches destinations
> and drafts a day-by-day itinerary, and you refine it by chat. The `trips` project owns the app —
> `database/` (trips, destinations, itinerary, bookings, research), `pages/` (client React timeline /
> planner), `api/` (named typed Node endpoints), `hooks/` (mostly chat/api-driven, one optional cron
> price-watch), and a project-scoped **`concierge`** space that researches and drafts the trip for you.
> Read the parent plan first for the shared mechanisms (capability globals, typed-contract pipeline,
> serving); this file is the trips-specific shape. Paths are relative to the org repo root.

## Context

Planning a trip is hours of tab-juggling — reading up on places, weighing what's worth it, fitting it
all into the days you have. A user writes *"5 days in Portugal, mid-October, mid-budget, we like food
and walking"* and the app does that work: it researches Lisbon/Sintra/Porto, proposes destinations with
dates, and builds a per-day itinerary the user drags and refines by chat ("make day 3 slower", "add a
day trip to Óbidos"). **The value is turning open-ended travel research into a conversation** — you get
a personalized, source-backed itinerary in minutes, and it stays a living document you adjust as dates,
budget, or plans change. It's a travel agent that never sleeps, living in your pod. (There is no
`trips/` domain today — it's a net-new project-application, served under the generic
`lmthing.app/<project>/` mount.)

## The project

- **Project id**: `trips`. One per user pod (personal trips = per-user data). A user can hold many
  trips as rows; the *project* is the planner app, not a single trip.
- **Project-scoped space**: `trips/spaces/concierge/` — the specialists that maintain the app
  (`planner`, `researcher`, `scheduler`). Because the db is **project-rooted**, all three read/write
  the **same** tables and feed the **same** pages (the multi-agent-application shape).
- **THING** builds/evolves the app by delegating to `system-appbuilder` (parent plan
  §"system-appbuilder"); **runtime** work is the `concierge` agents, driven by api handlers and chat —
  not THING. The `planner` is itself an *in-app* orchestrator (a runtime analog of `app-architect`),
  distinct from THING.
- **Provisioning**: v1 seeds the `trips` project from a checked-in template materialized into the
  pod's `<root>/trips/`. In a **later phase** it becomes **installable from lmthing.store** as a
  project app (parent plan §Risks "Distribution"), where update/divergence semantics are decided.

## Directory layout

```
trips/
├── package.json              # react, @tanstack/react-router, @lmthing/{ui,css}, lucide-react …
├── database/
│   ├── trips.json            # a planned trip (top-level container)
│   ├── destinations.json     # a place within a trip, with arrival/departure
│   ├── itinerary_items.json  # a scheduled activity/meal/transit/lodging on a given day
│   ├── bookings.json         # a confirmed flight/hotel/car/activity reservation
│   └── research.json         # a deep-dive report the researcher produced (per destination or free topic)
├── pages/                    # client-side React SPA
│   ├── _app.tsx              # QueryClient + design-system theme provider
│   ├── _layout.tsx           # nav chrome: My Trips · New Trip
│   ├── index.tsx             # "/"                       → trips list
│   ├── new.tsx               # "/new"                    → describe-a-trip form (kicks the planner)
│   └── trips/
│       ├── [tripId].tsx      # "/trips/:tripId"          → the itinerary timeline
│       ├── [tripId]/plan.tsx # "/trips/:tripId/plan"     → planning chat + live itinerary
│       └── [tripId]/research/[destId].tsx  # "/trips/:tripId/research/:destId" → a destination deep dive
├── components/               # DayColumn, ItineraryCard, DestinationHeader, BookingRow, MarkdownBody…
├── api/
│   ├── trips/
│   │   ├── GET.ts                        # tripList
│   │   ├── POST.ts                       # createTrip   (delegates to the planner, returns immediately)
│   │   └── [id]/
│   │       ├── GET.ts                    # getTrip      (include destinations → itinerary_items)
│   │       ├── PATCH.ts                  # updateTrip
│   │       └── destinations/POST.ts      # addDestination  (fires the destination-research hook)
│   ├── items/
│   │   └── [id]/
│   │       ├── PATCH.ts                  # updateItem   (drag/reschedule/edit an itinerary item)
│   │       └── DELETE.ts                 # removeItem
│   ├── bookings/
│   │   ├── POST.ts                       # addBooking
│   │   └── [id]/DELETE.ts                # removeBooking
│   └── research/
│       └── [destId]/GET.ts               # getResearch
├── hooks/
│   ├── research-new-destination.ts       # database  destinations:insert → concierge/researcher#dive
│   └── watch-booking-prices.ts           # cron 12h → concierge/researcher#price-check (optional)
├── spaces/
│   └── concierge/            # project-scoped space (agents / tasklists / knowledge)
│       ├── agents/planner/{charter.md,instruct.md}
│       ├── agents/researcher/instruct.md
│       ├── agents/scheduler/instruct.md
│       └── tasklists/plan-trip/…         # the planner's fan-out decomposition
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
// database/trips.json
{ "title": "Trips",
  "description": "One trip the user is planning or has taken — the top-level container the concierge builds around.",
  "columns": {
    "id":         { "type": "string",  "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "title":      { "type": "string",  "description": "short trip name shown in the list, e.g. 'Portugal, October'", "required": true },
    "brief":      { "type": "string",  "description": "the user's original free-text description of what they want" },
    "startDate":  { "type": "date",    "description": "first day of the trip" },
    "endDate":    { "type": "date",    "description": "last day of the trip" },
    "status":     { "type": "string",  "description": "'planning' while the concierge builds it, 'booked', or 'complete'", "default": "planning" },
    "budgetUsd":  { "type": "number",  "description": "rough total budget the planner should respect", "default": 0 },
    "createdAt":  { "type": "date",    "description": "when the trip was created", "generated": "now" } },
  "relations": {
    "destinations": { "hasMany": "destinations", "via": "tripId", "description": "the places on this trip, in order" },
    "bookings":     { "hasMany": "bookings",     "via": "tripId", "description": "confirmed reservations for this trip" } } }
```

```json
// database/destinations.json
{ "title": "Destinations",
  "description": "A place the trip visits, with the dates the traveller is there. The unit the researcher and scheduler fan out over.",
  "columns": {
    "id":            { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "tripId":        { "type": "string", "description": "the trip this destination belongs to", "required": true,
                       "references": { "table": "trips", "column": "id", "onDelete": "cascade" } },
    "name":          { "type": "string", "description": "the place name, e.g. 'Lisbon'", "required": true },
    "arrivalDate":   { "type": "date",   "description": "day the traveller arrives here" },
    "departureDate": { "type": "date",   "description": "day the traveller leaves" },
    "orderIndex":    { "type": "number", "description": "position in the trip sequence; lower comes first", "default": 0 },
    "notes":         { "type": "string", "description": "planner notes about why this stop and what to prioritise" } },
  "relations": {
    "trip":     { "belongsTo": "trips",            "via": "tripId", "description": "the parent trip" },
    "items":    { "hasMany":   "itinerary_items",  "via": "destinationId", "description": "scheduled items while here" },
    "research": { "hasMany":   "research",          "via": "destinationId", "description": "deep-dive reports for this place" } } }
```

```json
// database/itinerary_items.json
{ "title": "Itinerary items",
  "description": "One scheduled thing on a specific day — an activity, a meal, a transit leg, or a lodging block.",
  "columns": {
    "id":            { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "destinationId": { "type": "string", "description": "the destination this item happens at", "required": true,
                       "references": { "table": "destinations", "column": "id", "onDelete": "cascade" } },
    "day":           { "type": "date",   "description": "the calendar day of this item", "required": true },
    "startTime":     { "type": "string", "description": "local start time 'HH:MM' (null = flexible)" },
    "endTime":       { "type": "string", "description": "local end time 'HH:MM' (null = flexible)" },
    "kind":          { "type": "string", "description": "'activity' | 'meal' | 'transit' | 'lodging'", "required": true },
    "title":         { "type": "string", "description": "what it is, e.g. 'Jerónimos Monastery'", "required": true },
    "location":      { "type": "string", "description": "address or area for the item" },
    "notes":         { "type": "string", "description": "tips, reservations needed, walking time" },
    "estimatedCost": { "type": "number", "description": "rough per-item cost the researcher/scheduler estimates, in the item's currency; feeds the budget roll-up", "default": 0 },
    "currency":      { "type": "string", "description": "ISO currency code for estimatedCost, e.g. 'USD'/'EUR'", "default": "USD" },
    "bookingId":     { "type": "string", "description": "the reservation backing this item, if any (kept when booking removed → set null)",
                       "references": { "table": "bookings", "column": "id", "onDelete": "setNull" } } },
  "relations": {
    "destination": { "belongsTo": "destinations", "via": "destinationId", "description": "where this happens" },
    "booking":     { "belongsTo": "bookings",      "via": "bookingId",     "description": "the reservation behind it" } } }
```

```json
// database/bookings.json
{ "title": "Bookings",
  "description": "A confirmed reservation the traveller has made for the trip.",
  "columns": {
    "id":           { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "tripId":       { "type": "string", "description": "the trip this booking is for", "required": true,
                      "references": { "table": "trips", "column": "id", "onDelete": "cascade" } },
    "kind":         { "type": "string", "description": "'flight' | 'hotel' | 'car' | 'activity'", "required": true },
    "provider":     { "type": "string", "description": "airline / hotel / vendor name" },
    "confirmation": { "type": "string", "description": "confirmation / reference code" },
    "cost":         { "type": "number", "description": "amount paid, in the trip's budget currency", "default": 0 },
    "startAt":      { "type": "date",   "description": "when the booking begins (check-in, departure)" },
    "endAt":        { "type": "date",   "description": "when it ends (check-out, arrival)" },
    "url":          { "type": "string", "description": "link to the reservation" } },
  "relations": {
    "trip":  { "belongsTo": "trips",           "via": "tripId", "description": "the trip it belongs to" },
    "items": { "hasMany":   "itinerary_items", "via": "bookingId", "description": "itinerary items backed by this booking" } } }
```

```json
// database/research.json
{ "title": "Research reports",
  "description": "A deep-dive the researcher agent produced for a destination or a free topic (e.g. 'best pastéis de nata in Belém').",
  "columns": {
    "id":            { "type": "string", "description": "unique id", "primaryKey": true, "generated": "uuid" },
    "tripId":        { "type": "string", "description": "the trip this research is for", "required": true,
                       "references": { "table": "trips", "column": "id", "onDelete": "cascade" } },
    "destinationId": { "type": "string", "description": "the destination this expands (null for a trip-wide topic)",
                       "references": { "table": "destinations", "column": "id", "onDelete": "cascade" } },
    "topic":         { "type": "string", "description": "the question or theme researched", "required": true },
    "body":          { "type": "string", "description": "the report, markdown; empty while pending" },
    "status":        { "type": "string", "description": "'pending' while the researcher runs, 'ready' when done", "default": "pending" },
    "createdAt":     { "type": "date",   "description": "when the dive was requested", "generated": "now" } },
  "relations": {
    "destination": { "belongsTo": "destinations", "via": "destinationId", "description": "the place being expanded" },
    "trip":        { "belongsTo": "trips",         "via": "tripId",        "description": "the trip it belongs to" } } }
```

- **`getTrip` returns a nested tree** via `db.query('trips', { where:{id}, include: ['destinations'] })`
  where each destination itself `include`s `items` — the generated types give
  `Trip & { destinations: (Destination & { items: ItineraryItem[] })[] }`, so the timeline page reads
  one typed object, not five requests.
- **`onDelete` matters here**: deleting a trip cascades to destinations → itinerary items and bookings;
  deleting a booking `setNull`s the itinerary items that referenced it (the plan survives, it just
  loses its reservation link).

## Pages (client React, file-based routing)

Data comes from the generated typed client `useApi(name, input)` — no pod-side loaders.

| File | Route | Reads / writes |
|---|---|---|
| `pages/index.tsx` | `/` | `tripList` |
| `pages/new.tsx` | `/new` | `createTrip` (POST) → redirects to the trip's `/plan` |
| `pages/trips/[tripId].tsx` | `/trips/:tripId` | `getTrip` (include destinations → items); `updateItem` on drag |
| `pages/trips/[tripId]/plan.tsx` | `/trips/:tripId/plan` | `getTrip` + `<Chat agent="concierge/planner">` |
| `pages/trips/[tripId]/research/[destId].tsx` | `/trips/:tripId/research/:destId` | `getResearch`; `<Chat agent="concierge/researcher">` |

```tsx
// pages/trips/[tripId].tsx  → "/trips/:tripId"  (the timeline)
import type { Trip, Destination, ItineraryItem } from '../../types/generated'
import { useApi } from '@app/runtime'
import { DayColumn } from '../../components/DayColumn'

type FullTrip = Trip & { destinations: (Destination & { items: ItineraryItem[] })[] }

export default function TripTimeline({ params }: { params: { tripId: string } }) {
  const { data: trip, isLoading } = useApi('getTrip', { id: params.tripId })  // typed FullTrip
  if (isLoading) return <Spinner />
  return (
    <main>
      {trip.destinations.map((d) => (
        <section key={d.id}>
          <h2>{d.name}</h2>
          {groupByDay(d.items).map((day) => <DayColumn key={day.date} day={day} />)}
        </section>
      ))}
    </main>
  )
}
```

While `trip.status === 'planning'` and the planner is still filling things in, the page polls
`getTrip` (TanStack Query `refetchInterval`) so destinations and itinerary items **appear live** as
the scheduler writes them — the same "pages are a live read view of a background loop" property blog
has, but driven by delegation rather than cron.

## API (named, typed, Node handlers)

Endpoint = dir, method = filename; each exports `name`/`description`/`Input`/`Output` + default
handler `(input, { db, delegate, apiCall })`. Dual-addressed (HTTP for the browser, `name` for
agents via `apiCall`).

| name | method + route | I/O sketch |
|---|---|---|
| `tripList` | `GET api/trips` | `{}` → `Trip[]` |
| `createTrip` | `POST api/trips` | `{ title, brief, startDate?, endDate?, budgetUsd? }` → `{ tripId, status:'planning' }` |
| `getTrip` | `GET api/trips/:id` | `{ id }` → `Trip & { destinations: (Destination & { items })[] }` |
| `updateTrip` | `PATCH api/trips/:id` | `{ id, …fields }` → `Trip` |
| `deleteTrip` | `DELETE api/trips/:id` | `{ id }` → `{ ok }` (cascades destinations → items + bookings) |
| `tripBudget` | `GET api/trips/:id/budget` | `{ id }` → `{ budgetUsd, booked, estimated, remaining, byKind }` (budget roll-up, round-1 core) |
| `addDestination` | `POST api/trips/:id/destinations` | `{ id, name, arrivalDate?, departureDate? }` → `Destination` |
| `updateItem` | `PATCH api/items/:id` | `{ id, day?, startTime?, …}` → `ItineraryItem` |
| `removeItem` | `DELETE api/items/:id` | `{ id }` → `{ ok }` |
| `addBooking` | `POST api/bookings` | `{ tripId, kind, provider, cost, … }` → `Booking` |
| `removeBooking` | `DELETE api/bookings/:id` | `{ id }` → `{ ok }` |
| `getResearch` | `GET api/research/:destId` | `{ destId }` → `Research[]` |

```ts
// api/trips/POST.ts → POST .../api/trips ; name "createTrip"
/** Create a trip from a free-text brief and kick off the concierge planner (fire-and-forget). */
export const name = 'createTrip'
export const description = 'Create a trip and start the concierge planning it in the background; returns immediately with the trip id.'

export interface Input  {
  /** short trip name */ title: string
  /** the user's free-text description of what they want */ brief: string
  /** first day, ISO date */ startDate?: string
  /** last day, ISO date */ endDate?: string
  /** rough total budget in USD */ budgetUsd?: number
}
export interface Output { tripId: string; status: 'planning' }

export default function handler(
  input: Input,
  ctx: { db: DbApi; delegate: DelegateFn },
): Output {
  const trip = ctx.db.insert('trips', {
    title: input.title, brief: input.brief,
    startDate: input.startDate, endDate: input.endDate,
    budgetUsd: input.budgetUsd ?? 0, status: 'planning',
  })
  // Hand the whole trip to the orchestrator; it fans out research + scheduling itself.
  ctx.delegate('concierge/planner', 'plan-trip', { input: { tripId: trip.id } })  // returns immediately
  return { tripId: trip.id, status: 'planning' }
}
```

- `createTrip` **delegates and returns** — the parent plan's fire-and-forget api pattern. The user
  lands on `/trips/:id/plan` and watches the itinerary populate.
- `addDestination` inserts a row, which fires the `research-new-destination` **database** hook — so
  adding a stop by hand triggers the same per-destination research the planner runs.

## Hooks

Trips is **mostly api/chat-driven**, not a background loop like blog. It uses one `database` hook to
research a newly added destination and one optional `cron` price-watch:

```ts
// hooks/research-new-destination.ts — dive on each new destination
export default {
  type: 'database',
  on: { table: 'destinations', event: 'insert' },
  budget: { maxEpisodes: 8 },
  handler: async ({ row, db, delegate }) => {
    // Loop guard: the planner's own scheduler writes destinations too, but self-write exclusion
    // means the planner-triggered session won't re-fire this on its own inserts; a hand-added
    // destination (via addDestination) does fire it.
    const existing = db.query('research', { where: { destinationId: row.id } })
    if (existing.length) return                                  // idempotence
    await delegate('concierge/researcher', 'dive', { input: { destinationId: row.id } })
  },
}
```

```ts
// hooks/watch-booking-prices.ts — optional cron price re-check
export default {
  type: 'cron',
  every: '12h',
  trigger: 'concierge/researcher#price-check',                  // declarative
  budget: { maxEpisodes: 6, maxWallClockMs: 300000 },
}
```

- Cron timing is the parent plan's **crond → hook-run endpoint** mechanism
  (`POST /api/projects/trips/hooks/watch-booking-prices/run`); a window missed while the pod was down
  runs once via boot catch-up; local dev uses the in-process fallback tick.
- No hook cascades off `itinerary_items` inserts — the scheduler writes those, and the depth cap +
  self-write exclusion keep the plan bounded (parent plan §Safety).

## The `concierge` space (agents + capabilities)

Three specialists split the work of being your travel agent. The `planner` is the one you talk to: it
reads your brief, decides the destinations and the shape of the trip, and directs the others — it holds
**delegation only** (no `db:write`), so it plans but never writes rows itself. The `researcher` does
the digging per destination; the `scheduler` turns that research and your dates into an ordered,
day-by-day plan. (Mechanically the planner is a delegating orchestrator with a `forEach` fan-out — see
the tasklist below — but to the user it's one concierge that hands off internally.)

| Agent | `db:read` | `db:write` | `api:call` | `canDelegateTo` | Role |
|---|---|---|---|---|---|
| **planner** | `trips, destinations` | *(none)* | — | `concierge/researcher`, `concierge/scheduler` | decompose the brief → destinations, fan out research, then schedule |
| **researcher** | `destinations, trips, research, bookings` | `research` | `webSearch`, `mapsSearch` | — | deep dives per destination (and price-checks); fill `research` rows |
| **scheduler** | `destinations, research` | `destinations, itinerary_items` | — | — | turn research + dates into ordered destinations and per-day items |

```yaml
# trips/spaces/concierge/agents/planner/instruct.md frontmatter — orchestrator, no db writes
title: Trip planner
capabilities:
  - db:read: { tables: [trips, destinations] }        # read-only: reads the brief, never mutates
canDelegateTo:
  - concierge/researcher#dive
  - concierge/scheduler#lay-out
```

```yaml
# trips/spaces/concierge/agents/scheduler/instruct.md frontmatter
capabilities:
  - db:read:  { tables: [destinations, research] }
  - db:write: { tables: [destinations, itinerary_items] }   # sets orderIndex/dates; writes the day plan
```

**The `plan-trip` tasklist (the fan-out).** Modelled on `system-architect`'s
`synthesize_and_run`/`iterate_space` decomposition (parent plan cites it as the template):

1. **`propose_destinations`** (`role: plan`, read-only) — the planner reads the brief and proposes a
   set of destinations with rough dates, writing them via a delegated scheduler call (planner itself
   can't write). Emits an array of destination ids.
2. **`research_each`** (`forEach: "propose_destinations.destinationIds"`) — the host runs one
   `concierge/researcher#dive` **per destination in parallel** (within the fork cap), injecting the id
   as `item`; each writes a `research` row. The model never writes the loop — the `forEach` map node
   does (parent plan gotcha).
3. **`lay_out`** (depends on both) — `concierge/scheduler#lay-out` reads the collected research +
   dates and writes `itinerary_items` day by day (its own inner `forEach` over days).

- **Salvage semantics apply**: the planner's fan-out forks carry **no timeout** (orchestrator forks),
  so a researcher that runs long still **salvages a partial report** rather than failing the whole
  trip (parent plan §"Forks always salvage a value unless hard-capped"). One flaky destination doesn't
  sink the itinerary.
- **`charter.md` vs `instruct.md`**: the planner ships a short `charter.md` (fork-safe identity — "you
  plan trips, you respect budget and pace, you never invent bookings") injected into every fan-out
  fork, and an `instruct.md` (the routing/orchestration prose) that is top-level only (parent plan
  gotcha). The researcher/scheduler run as delegatees, so `delegateRunner` is wired at both ForkEngine
  sites — the standard setup for a delegating orchestrator.
- **No authoring caps here** — the concierge *operates* the app. Adding a "packing list" table or a
  budget page is a THING → `system-appbuilder` request, not a concierge one.

## Chat (interactive refinement)

Two drop-in `<Chat agent="…">` widgets, reusing the always-available multisession WS endpoint (parent
plan §Chat) — the binding is a runtime prop, no `chats/` dir:

- **`/trips/:tripId/plan`** → `<Chat agent="concierge/planner" />`. The user refines interactively —
  "make day 3 slower", "swap Sintra for a Douro valley day", "we're vegetarian". The planner runs with
  full caps and **re-delegates** to researcher/scheduler, so its edits land as `db` writes and the
  timeline updates live. This is the parent plan's **"chat as a live control surface"** — a delegating
  orchestrator you can talk to.
- **`/trips/:tripId/research/:destId`** → `<Chat agent="concierge/researcher" />` for a deeper
  destination dive on demand.
- History persists at `trips/spaces/concierge/sessions/<id>` (project-session snapshot form,
  resumable). This is **the one place the catalog descriptor renderer re-enters the app** — pages stay
  real React.

## Serving & domains

- **Local CLI**: `localhost:8080/app/trips/…` (pages) and `localhost:8080/app/trips/api/<name>` —
  exactly the parent plan's mount, `<project>` = `trips`.
- **Prod**: served under the **generic authenticated `lmthing.app` domain** at `lmthing.app/trips/*`
  → the authenticated user's pod `/app/trips/*` (Envoy JWT + per-user routing). Unlike `blog`, there
  is **no pre-existing static SPA to replace and no friendly product alias in v1** — trips rides the
  generic app plane. A friendly `lmthing.trips` alias is an optional later edge-alias (the same thin
  Envoy alias `blog` uses), not required to ship.
- **Admin/dev**: `lmthing.studio` manages it via `/api/projects/trips/app` (manifest, data browser,
  manual hook run, build status, live preview iframe of `…/app/trips/`).

**No public/shared surface** — every route and endpoint is an authenticated, per-user pod read/write;
the app stays fully within per-user pod isolation, so no v1 deviation from the parent plan (no
cross-user routing to build).

## Additional features (more user value)

Beyond the core describe → researched-itinerary loop, these earn their place by removing real
trip-planning pain. Each is **additive** — new tables/endpoints/hooks + agent capabilities on the same
engine — so it ships after the core loop without reworking it.

### Budget roll-up — "will this blow my budget?"  *(promoted into round-1 core)*
Cost is the question that actually kills or greenlights a trip, and it's invisible in a plain itinerary.
Small enough and valuable enough that it ships **with the core loop** rather than as a later add-on.
- **Data**: `estimatedCost` + `currency` on `itinerary_items` (the researcher/scheduler write rough
  costs); `bookings.cost` already exists.
- **API**: `tripBudget` `GET api/trips/:id/budget` → `{ budgetUsd, booked, estimated, remaining, byKind }`
  — sums confirmed `bookings.cost` + item `estimatedCost` against `trips.budgetUsd`, grouped by item/booking
  `kind`.
- **Pages**: a `BudgetStrip` on `/trips/:id` (booked vs estimated vs cap; over-budget rendered in a
  `text-destructive`/warning design token). The planner reads the roll-up and, in chat, trims or swaps to
  fit ("keep it under €1,500").

### Packing list — weather- and activity-aware
A list generated from where you're going, when, and what you'll actually do beats a generic template.
- **Data**: `packing_items` table (`tripId` FK, `label`, `category`, `reason`, `packed` bool).
- **Agent**: a `packer` (`db:read trips,destinations,itinerary_items` / `db:write packing_items`,
  `api:call [weatherLookup]`) builds the list from destinations, season, planned activities, and the
  forecast — "rain days in Sintra → umbrella", "hiking day → boots".
- **API/Pages**: `packingList` `GET`, `togglePacked` `PATCH`; a `/trips/:id/packing` page with check-offs.
- **Hook**: `cron` fires ~3 days before `trips.startDate` → regenerate against the latest forecast.

### Weather-aware itinerary
- **Binding**: register a `weatherLookup` named binding (forecast API, hidden key); add it to the
  `researcher`/`scheduler` `api:call` allow.
- The scheduler consults the forecast per day and prefers indoor items on wet days (writes a
  `weatherNote` on affected items); the packer shares the binding. No new tables.

### To-book reminders — don't miss the reservation window
The itinerary should tell you *when to act*, not just what to do.
- **Data**: add `needsBooking` bool + `bookByDate` to `itinerary_items` (a restaurant that books out
  weeks ahead, timed-entry tickets).
- **Hook**: `cron daily` scans items with `needsBooking && !bookingId && bookByDate` approaching and
  surfaces a reminder ("book Jerónimos tickets — sells out ~2 weeks out"), using the parent plan's
  **user-facing hook deferral** surface.

## Engine reconciliation (round-1 build notes)

Grounded in the **shipped** engine (`sdk/org/libs/{core,cli}`, built through Phase 8; `system-appbuilder`
is not built, so `trips` is **hand-authored** under `store/projects/trips/`, no THING/appbuilder
delegation to scaffold it). Honest reconciliation of the spec against the real runtime:

- **`webSearch`/`webFetch`/`fetch` are universal system globals**, gated by an agent's `functions:`
  frontmatter (the space's own `functions/` dir), **not** `api:call` named bindings — there is no
  external-binding registry (`mapsSearch`/`weatherLookup` bindings are aspirational, deferred). The
  `researcher` therefore simply omits `functions:` (keeping the universal `webSearch`/`webFetch`) and its
  `api:call` allow is reserved for the app's own typed endpoints. Prices/maps come from `webSearch`.
- **`db.query` `where` is equality-only** (`Record<string,unknown>` + `include`/`orderBy`/`limit`/
  `offset`) — no `LIKE`/ranges; agents and handlers query-all then filter/sort in JS.
- **Row-type interface names** are the engine's deterministic singularizer: `trips→Trip`,
  `destinations→Destination`, `itinerary_items→ItineraryItem`, `bookings→Booking`, `research→Research`.
- **Named delegate actions need an `actions:` frontmatter entry** (empty tasklist ⇒ model-driven); the
  hook's `delegate('concierge/researcher','dive',…)` and the planner's `#plan-trip`/scheduler's `#lay-out`
  therefore each resolve to a declared action/tasklist.
- **The `concierge` space is built in the FULL space format from round 1** (not `agents/`-only): every
  agent ships a `charter.md` (fork-safe identity) **and** `instruct.md`; the space ships a `plan-trip`
  `tasklists/` decomposition (the `research_each` `forEach` fan-out), reusable `functions/` (day grouping,
  budget roll-up, dedupe), catalog `components/`, and **extensive `knowledge/`** (destination-research
  method, itinerary-pacing craft, budgeting) — each field an `index.md` overview + ≥2 `<aspect>.md`
  deep-dives.

## Phases & order

Assumes the parent plan's engine (db + capability globals, api runtime, typed-contract build, pages
build, hooks runtime, chat) exists. Trips-specific work on top:

1. **Schemas** — the five `database/*.json`; verify FK/relations resolve (the trip → destination →
   itinerary → booking chain, and the two-hop `include`), required descriptions pass the fail-loud
   loader; row + relation types generate (`Trip.destinations`, `Destination.items`).
2. **`concierge` space** — the three agents' `instruct.md`/`charter.md` (config-bearing
   `capabilities:` — planner read-only + `canDelegateTo`; scheduler write-narrow) plus the
   **`plan-trip` tasklist** with the `research_each` `forEach` fan-out and the scheduler's per-day
   `forEach`; `webSearch`/`mapsSearch` named bindings registered.
3. **API** — the ten endpoints; `createTrip`/`addDestination` delegate fire-and-forget.
4. **Hooks** — `research-new-destination` (database:insert) + optional `watch-booking-prices` (cron);
   confirm the destination-insert dive is bounded (self-write exclusion vs. planner-written rows).
5. **Pages** — timeline (nested `include`), planner chat page, new-trip form, research page; wire
   `useApi` + both `<Chat>` widgets; live-poll while `status==='planning'`; keep the design-system
   token gate (no raw colors).
6. **Serving** — seed each pod's `trips` project from the checked-in template; serve under generic
   `lmthing.app/trips/*`; Studio manages it under `/api/projects/trips/app`. (Store install + friendly
   alias are later phases.)
7. **Additional features** — budget roll-up, packing list, weather-aware itinerary, to-book reminders
   (see §"Additional features"); each is additive (new tables/endpoints/hook + agent caps + the
   `weatherLookup` binding), shippable after the core loop.
8. **Docs** — fold into `SPACE_DEVELOPMENT.md` "Project apps" as a worked example.

## Verification (end-to-end, local)

1. Load the `trips` project → schemas validate (descriptions/FK/relations), `types/generated.d.ts` has
   `Trip`/`Destination`/`ItineraryItem`/`Booking`/`Research` with relation fields
   (`Trip.destinations: Destination[]`, `Destination.items: ItineraryItem[]`).
2. `lmthing serve`; `GET localhost:8080/app/trips/` renders the trips list (client-side), which calls
   `GET …/app/trips/api/trips`.
3. `createTrip { title, brief:"5 days in Portugal, food + walking" }` (mock streamFn): the planner
   `plan-trip` runs → `propose_destinations` writes destinations → `research_each` `forEach` fans out
   one `dive` per destination (parallel, within the fork cap) → `lay_out` writes `itinerary_items`;
   the `/trips/:id/plan` page shows destinations then items appear live.
4. **Salvage**: force one destination's `dive` fork to run long/error → the trip still completes with
   the other destinations scheduled and that one's research salvaged/partial (no whole-trip failure).
5. `addDestination` by hand → `research-new-destination` fires once (a subsequent identical add is
   idempotent); a planner-written destination does **not** re-fire it (self-write exclusion).
6. `updateItem` (drag day 3 activity to day 4) via `PATCH …/app/trips/api/items/:id` → the timeline
   reflects it; `apiCall('updateItem', { id, day: 12 })` with `day` as a number **fails the agent
   typecheck** (DTS overload); an un-allowlisted `apiCall` name → host error naming allowed names.
7. Chat: `<Chat agent="concierge/planner">` "make day 3 slower" → the planner re-delegates the
   scheduler, `itinerary_items` for day 3 change, the page updates; history under
   `trips/spaces/concierge/sessions/`.
8. cron `watch-booking-prices` at `every:'12h'` (test `'5m'`, local fallback tick): restart → one boot
   catch-up run; immediate second restart → no double-run; budget-exhausted → single coalesced pending
   entry, runs on the next attempt after the window rolls.
9. Backup: `app.sql` + schemas + pages + api + hooks + concierge space committed; `**/sessions/` not;
   restore rebuilds `app.db` from `app.sql`.

## Notes

- **Reuses the parent engine wholesale** — no trips-specific runtime; this is data + agents + pages +
  hooks on the shared layer. If a mechanism is missing here, it belongs in
  [project-as-application.md](./project-as-application.md), not a trips fork.
- **Why it's a good AI-assisted app** — planning a trip is open-ended research + synthesis a static
  app can't do and a person finds tedious: it rewards continuous digging, adapts to soft constraints
  ("we like food and walking"), and improves through conversation. The agents do the legwork; the user
  makes the calls.
- **Itinerary ordering** (`destinations.orderIndex`, `itinerary_items.day`) is a scheduler concern,
  not a schema one — kept as plain columns the agent maintains.
- **Bookings are user-entered, never invented** — the planner's charter forbids fabricating
  confirmations; `addBooking` is the only write path to `bookings`, from the user/UI. The app stays
  within per-user pod isolation, so no v1 deviation from the parent plan's authz model.
