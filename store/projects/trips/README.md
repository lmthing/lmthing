# lmthing.trips — the `trips` project-application

An AI trip planner built on the shared pod runtime (`project-as-application.md`). You describe a
trip in free text; a project-scoped **`concierge`** space of agents (`planner` → `researcher` +
`scheduler`) researches destinations and drafts a day-by-day itinerary you refine by chat. The
itinerary stays a living document — drag items, adjust dates, watch the budget roll-up.

- **database/** — `trips`, `destinations`, `itinerary_items`, `bookings`, `research` (project-rooted SQLite).
- **api/** — named, typed Node handlers (`createTrip` delegates the planner fire-and-forget; `tripBudget`
  rolls up cost; timeline/booking CRUD).
- **hooks/** — `research-new-destination` (database:insert → researcher dive) + `watch-booking-prices` (cron).
- **spaces/concierge/** — the specialists, in **full space format** (charter+instruct per agent,
  `plan-trip` tasklist, `functions/`, `components/`, extensive `knowledge/`).
- **pages/** — client-side React: trips list, new-trip form, itinerary timeline (+ budget strip), planner
  chat, per-destination research chat. Design tokens only.

## Run locally
Materialize this dir into a pod root (`<root>/trips/`), then `lmthing serve` and open
`localhost:8080/app/trips/`. See `automation/app-builder/PROGRESS.trips.md` for the exact harness.
