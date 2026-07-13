# `kitchen` — lmthing.kitchen as a project-application

A pantry + meal planner: the `kitchen` project owns an app that knows what's in your pantry, plans a
week of meals from your recipes, and generates a shopping list for exactly what you're missing. Its
project-scoped `chef` space keeps the plan, the shopping gaps and the pantry stock in sync. It is the
relations-heavy catalog example (a many-to-many join plus a plan → meals → recipes chain).

- The model it's built on (`database/ api/ pages/ hooks/ components/ spaces/`) →
  [org/docs/format/project/](../../../org/docs/format/project/README.md); how an app is built, served and
  executed → [org/docs/app/](../../../org/docs/app/README.md).
- The full behavioral spec → [`app-specifications/kitchen-application.md`](../../../app-specifications/kitchen-application.md).
- **The authoritative inventory of tables, endpoints, pages, hooks and agents is the tree itself.**

## Run locally

Materialize this template into a pod root's `<root>/kitchen/`, then
`node sdk/org/libs/cli/dist/cli/bin.js serve --port 8080` and open `localhost:8080/app/kitchen/`.
`types/` and `.data/` are generated/runtime (git-ignored).

## Tests

```bash
node --test store/projects/kitchen/tests/
```

(Schemas validated with the real engine `validateSchemaSet`; handlers/hooks/agents asserted
structurally. Requires the built `@lmthing/core` in `sdk/org`.)
