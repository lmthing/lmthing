# `homes` — lmthing.homes as a project-application

An **AI-assisted home finder** for renters and buyers. You describe a search in free text, then paste
what you already receive — forwarded alert emails, links, saved-search pages. Every capture is cleaned
into one canonical, comparable record (all-in true cost, stated vs. measured size, commute minutes) by
the project-scoped `intake` space; the `scout` space then reads each listing for what the description
hides, triangulates the fuzzed map pin into a confidence-scored location guess, and ranks everything by
a taste model learned from your own saves and dismisses. The best new match surfaces as an alert within
minutes of pasting.

- The model it's built on (`database/ api/ pages/ hooks/ components/ spaces/`) →
  [org/docs/format/project/](../../../org/docs/format/project/README.md); how an app is built, served and
  executed → [org/docs/app/](../../../org/docs/app/README.md).
- The full behavioral spec → [`app-specifications/homes-application.md`](../../../app-specifications/homes-application.md).
- **The authoritative inventory of tables, endpoints, pages, hooks and agents is the tree itself.**

## Run locally

Materialize this dir into a pod root (`<root>/homes/`), then `lmthing serve` and open
`localhost:8080/app/homes/`.

## Tests

```bash
node --test store/projects/homes/tests/homes.test.mjs
```
