# `api/<path…>/<METHOD>.ts` — HTTP handler

File-routed, worker-isolated Node handlers. The **last** path segment is the HTTP method; the rest
is the endpoint path. Written by `writeApi('<path>/<METHOD>', src)` (granted by `api:write`).

```
api/articles/[id]/GET.ts   →   GET  /app/<proj>/api/articles/:id
api/sources/POST.ts        →   POST /app/<proj>/api/sources
```

Method segment ∈ `GET | POST | PUT | PATCH | DELETE`. A `[seg]` in the path is a dynamic param.

## Format — a full ESM module

```ts
import { HttpError } from '@app/runtime';       // throw for 4xx/5xx

export const name = 'getArticle';                // stable logical name (used by useApi/apiCall)
export const description = 'Get a single article by id, including its citations.';

export interface Input { id: string }            // becomes the endpoint's request JSON-Schema
export type Output = Article;                    // becomes the response JSON-Schema

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const rows = await ctx.db.query('articles', { where: { id: input.id }, include: ['citations'] });
  if (!rows[0]) throw new HttpError(404, 'article not found');
  return rows[0];
}
```

## Required exports

| Export | Purpose |
|---|---|
| `name` | Stable logical id the client calls (`useApi('getArticle', …)`), decoupled from the URL path. |
| `description` | Human summary; surfaced in tooling. |
| `Input` interface | Request contract → generated JSON-Schema. |
| `Output` type/interface | Response contract → generated JSON-Schema. |
| default `handler(input, ctx)` | Async function returning `Output`. |

## The `ctx` object

- **`ctx.db`** — the async data API: `query(table, { where, include, orderBy, limit, offset })`,
  `insert`, `update`, `remove`, `tables()`. **`where` is equality-only** (no `LIKE`/ranges — filter
  in memory).
- **`ctx.apiCall(name, input)`** — call another endpoint by its `name`.
- **`ctx.spawn(ref, input?, opts?)`** — kick off an agent run (fire-and-forget, returns `{ runId }`).

Throw `HttpError(status, message)` (from `@app/runtime`) to signal a 4xx/5xx.

Real examples: `store/projects/blog/api/articles/[id]/GET.ts`, `store/projects/blog/api/sources/POST.ts`.
