---
id: api
dependsOn:
  - scaffold
output:
  endpoints: array
---

Author the endpoints. Load `project/layout/api` first. Route = directory, method = filename (`items/[id]/GET.ts`); `export const name` unique per project; `Input`/`Output` are the contract the views will bind against, so type them structurally — a list the page maps is a named item interface, never a display string, and `any` in or out is rejected at write time. Throw `HttpError(status, message)` for a controlled 4xx. For plain list/get/create/update/delete prefer `writeProjectQuery` (declarative IR validated against the real tables) over a hand-written handler. A detail endpoint carries its `[param]` — never a flat `*-detail/GET`. Every endpoint should be one some `views/` page will read. Record each `{ route, name }` as `endpoints`.