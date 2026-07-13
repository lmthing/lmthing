# `trips` — lmthing.trips as a project-application

An AI trip planner. You describe a trip in free text; the project-scoped `concierge` space researches
destinations and drafts a day-by-day itinerary you refine by chat. The itinerary stays a living
document — reorder items, adjust dates, watch the budget roll up.

- The model it's built on (`database/ api/ pages/ hooks/ components/ spaces/`) →
  [org/docs/format/project/](../../../org/docs/format/project/README.md); how an app is built, served and
  executed → [org/docs/app/](../../../org/docs/app/README.md).
- The full behavioral spec → [`app-specifications/trips-application.md`](../../../app-specifications/trips-application.md).
- **The authoritative inventory of tables, endpoints, pages, hooks and agents is the tree itself.**

## Run locally

Materialize this dir into a pod root (`<root>/trips/`), then `lmthing serve` and open
`localhost:8080/app/trips/`.
