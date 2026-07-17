# `api/<path…>/<METHOD>.ts` — HTTP handler

File-routed, worker-isolated Node handlers. Discovery walks `<projectRoot>/api/`; each `GET.ts`/`POST.ts`/`PUT.ts`/`PATCH.ts`/`DELETE.ts` under a route directory is one endpoint — **the endpoint route is the directory path, the HTTP method is the filename** `sdk/org/libs/cli/src/app/api/loader.ts:1-21`. The five method filenames are the only ones matched (`METHOD_FILE_RE`); any other `.ts` in a route dir (helpers, `types.ts`) is ignored `sdk/org/libs/cli/src/app/api/loader.ts#METHOD_FILE_RE,113-115`.

```
api/articles/[id]/GET.ts   →   GET  /articles/:id     (name "getArticle")
api/sources/POST.ts        →   POST /sources          (name "addSource")
```

A `[seg]` directory is a dynamic param — `[id]` becomes the route pattern segment `:id`, and its name is collected into `paramNames` `sdk/org/libs/cli/src/app/api/loader.ts:130-142`. At request time `matchRoute` matches the concrete path against each same-method pattern and extracts the params (URL-decoded) `sdk/org/libs/cli/src/app/api/loader.ts#matchRoute`.

Handlers are authored by the `api:write` capability's `writeProjectApi(route, src)` global, where the route's last segment is the uppercase method — it throws on an invalid method or a missing endpoint path before the method, and writes to `api/<segments…>/<METHOD>.ts` `sdk/org/libs/cli/src/app/authoring/globals.ts:198-216`. The set of valid methods is `GET | POST | PUT | PATCH | DELETE` `sdk/org/libs/cli/src/app/authoring/globals.ts:56`. Which agent may call `writeProjectApi` is gated by the `api:write` grant → see [`space/agents/capabilities.md`](../../space/agents/capabilities.md).

## Format — a full ESM module

Adapted from the real `store/projects/blog/api/articles/[id]/GET.ts`:

```ts
import { HttpError } from '@app/runtime';          // throw for 4xx/5xx

export const name = 'getArticle';                  // stable logical id (unique per project)
export const description = 'Get a single article by id, including its citations.';

export interface Input { id: string }              // → the endpoint request JSON Schema
export type Output = Article;                      // → the response JSON Schema

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = await ctx.db.query('articles', { where: { id: input.id }, include: ['citations'] });
  const article = rows[0];
  if (!article) throw new HttpError(404, 'article not found');
  return article;
}
```

The real example imports `HttpError` from `@app/runtime`, exports `name`/`description`/`Input`/`Output` and a default async `handler(input, ctx)`, and throws `new HttpError(404, 'article not found')` when the row is absent `store/projects/blog/api/articles/[id]/GET.ts:14-58`. (The on-disk example additionally declares its own local `Db`/`Ctx`/row types inline `store/projects/blog/api/articles/[id]/GET.ts:1-12`; in a built project those types come from the generated `@app/types` module rather than being hand-declared `sdk/org/libs/cli/src/app/build/schema.ts:1-12`.)

## Required exports

| Export | Purpose |
|---|---|
| `name` (`export const name`) | Stable agent-facing id, read by a **static parse** (not evaluation); **unique per project** — a duplicate is a fail-loud throw, and a missing `name` on a method file also throws `sdk/org/libs/cli/src/app/api/loader.ts:16-21,85-124`. |
| `description` (`export const description`) | Optional human/agent summary, likewise static-parsed `sdk/org/libs/cli/src/app/api/loader.ts:125,148-152`. |
| `Input` interface/type | Request contract — generated to a JSON Schema (empty-object schema when absent) `sdk/org/libs/cli/src/app/build/schema.ts#EndpointContract,159-198`. |
| `Output` type/interface | Response contract — generated to a JSON Schema (empty-object schema when absent) `sdk/org/libs/cli/src/app/build/schema.ts#EndpointContract,159-198`. |
| default `handler(input, ctx)` | The async function returning `Output`; loaded as the module's default export `sdk/org/libs/cli/src/app/api/handler-module.ts#loadHandlerFromCode`. |

`Input`/`Output` are turned into JSON Schema per endpoint by `generateEndpointContracts` via `ts-json-schema-generator` `sdk/org/libs/cli/src/app/build/schema.ts:11-12,179-198`.

The `name` + default/`handler` contract is now **enforced at write time**: `writeProjectApi` runs the loader's own name check plus a project-unique-name scan and rejects a violating write with a thrown, retryable error, instead of letting it fail later at load `sdk/org/libs/cli/src/app/authoring/lint.ts#lintApiHandler`.

## `Input` is one object, assembled by method

`Input` is a single object whose fields are sourced by the HTTP method, not declared per-field `sdk/org/libs/cli/src/app/api/input.ts:1-17`: `GET`/`DELETE` take the non-path fields from the **query string**, `POST`/`PATCH`/`PUT` from the **JSON body**, and path params (`[id]`) always merge on top so **path wins on a key clash** `sdk/org/libs/cli/src/app/api/input.ts#QUERY_METHODS,40-53`. A non-object body for a body method is handled leniently (base becomes `{}`, params merge on top) `sdk/org/libs/cli/src/app/api/input.ts#assembleInput`.

## The `ctx` object

Inside a Node handler `ctx.db`, `ctx.apiCall`, and `ctx.spawn` are **async proxies** to the main process — the worker holds no state and never touches the filesystem/db directly; every call posts a correlated message to the parent and awaits the reply `sdk/org/libs/cli/src/app/api/worker.ts:1-16,133-152`. The worker is a **crash boundary, not a security boundary** — a crashing handler takes down only its thread and the runtime maps it to a 500 `sdk/org/libs/cli/src/app/api/worker.ts:12-16`.

- **`ctx.db`** — the async data API (`AsyncDbApi`), the same method set as the agent-side synchronous `DbApi` but every method returns a `Promise` `sdk/org/libs/core/src/db/types.ts:112-120`. Methods: `query(table, { where, include, orderBy, limit, offset })`, `insert`, `update`, `remove`, `tables()` `sdk/org/libs/core/src/db/types.ts#DbApi`; proxied methods are enumerated in the worker `sdk/org/libs/cli/src/app/api/worker.ts:56-65,133-137`. **`where` is equality-only** — each key/value must exactly match the row's column value (no `LIKE`/ranges — filter in memory) `sdk/org/libs/core/src/db/types.ts#QueryOpts`; `include` expands named relations inline `sdk/org/libs/core/src/db/types.ts#QueryOpts`. Table/verb availability is itself capability-gated (`db:read`/`db:write`/`db:schema`) — see [`project/database/README.md`](../database/README.md) and [`space/agents/capabilities.md`](../../space/agents/capabilities.md) `sdk/org/libs/core/src/db/types.ts:51-54`.
- **`ctx.apiCall(name, input?)`** — call another named endpoint by its `name`; own-project endpoints resolve in-process, gated by the `api:call` allowlist `sdk/org/libs/core/src/db/types.ts:122-131`. In the worker it round-trips to the main process to resolve the named endpoint `sdk/org/libs/cli/src/app/api/worker.ts:139-141`.
- **`ctx.spawn(ref, input?, opts?)`** — fire-and-forget kick-off of an agent action shaped `'space/agent#action'`, returning `{ runId }`; a synchronous runner failure is delivered to `opts.onError` before the promise resolves `sdk/org/libs/core/src/db/types.ts:187-199` `sdk/org/libs/cli/src/app/api/worker.ts:39-53,143-150`.

## Errors — `HttpError`

Throw `new HttpError(status, message, details?)` (imported from `@app/runtime`) to control the HTTP status; the runtime maps it to that status with body `{ error: { status, message, details? } }`, and **any other throw becomes a generic `500`** with the real error logged pod-side and never leaked in the body `sdk/org/libs/cli/src/app/api/errors.ts:1-16,25-38`. Because handlers run in a worker, `HttpError` cannot cross the thread boundary as a class instance — the worker serializes it to a plain tag, posts it back, and the main runtime reconstructs the response `sdk/org/libs/cli/src/app/api/errors.ts:8-16` `sdk/org/libs/cli/src/app/api/worker.ts:166-172`. `@app/runtime` is resolved for handlers by a require shim that today exposes just `HttpError` `sdk/org/libs/cli/src/app/api/handler-module.ts:31-32,48-57`. A real handler uses status codes directly, e.g. `throw new HttpError(400, "kind must be 'rss' or 'search'")` and `throw new HttpError(402, 'Upgrade to add more sources')` `store/projects/blog/api/sources/POST.ts#handler`.

## See also

- [`project/database/README.md`](../database/README.md) — the tables `ctx.db` reads/writes.
- [`project/pages/README.md`](../pages/README.md) — the client React pages that call these endpoints.
- [`space/agents/capabilities.md`](../../space/agents/capabilities.md) — the `api:write` / `api:call` / `db:*` grants that gate authoring and calling.

Real examples: [`store/projects/blog/api/articles/[id]/GET.ts`](../../../../../store/projects/blog/api/articles/[id]/GET.ts), [`store/projects/blog/api/sources/POST.ts`](../../../../../store/projects/blog/api/sources/POST.ts).
