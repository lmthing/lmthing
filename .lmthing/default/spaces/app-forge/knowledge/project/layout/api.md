## `api/` — file-routed HTTP handlers

The endpoint route is the DIRECTORY, the HTTP method is the FILENAME: `api/articles/[id]/GET.ts` → `GET /articles/:id`. Only `GET | POST | PUT | PATCH | DELETE` filenames match; any other `.ts` in a route dir is a helper and is ignored. `[seg]` is a dynamic param. A single-record endpoint is `recipes/[id]/GET`, never a flat `recipes-detail/GET` — a detail page needs `[param]` for `$route.id`.

Required exports: `export const name` (stable agent-facing id, UNIQUE per project — enforced at write time by `lintApiApiHandler`-style linting, retry on the thrown error), `description`, `Input` and `Output` (compiled to the endpoint's JSON-Schema contract), and a default async `handler(input, ctx): Promise<Output>`. The typed boundary is enforced: `any` in or out is rejected, and a list field the page maps must be a named item interface, never a display string. Author with `writeProjectApi(route, src)` (`api:write` capability) — or, for plain list/get/create/update/delete, `writeProjectQuery(name, ir)`, which validates the query IR against the real table schema and compiles the handler, so it cannot diverge.

`Input` is ONE object assembled by method: GET/DELETE read the query string, POST/PATCH/PUT read the JSON body, and `[param]` path values merge on top and WIN. `ctx.db` / `ctx.apiCall` / `ctx.spawn` are ASYNC proxies (await everything); `ctx.db.query`'s `where` is equality-only (filter in memory) and `include` expands declared relations. Throw `new HttpError(status, message)` from `@app/runtime` for a controlled status; any other throw becomes a generic 500.

Grounded: `org/docs/format/project/api/README.md`; real examples `store/projects/demo-feed/api/add-item/POST.ts`, `store/projects/blog/api/articles/[id]/GET.ts`.
