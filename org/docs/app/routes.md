# Project-app routes — the served URL surface

A project-app is served by the pod's CLI server (`sdk/org/libs/cli/src/server/serve.ts`) at two kinds of URL: **api endpoints** (Node handlers, worker-isolated) and **pages** (a pre-built client-side React bundle). This page is the URL contract: the exact mount points, how files map to URLs, and how the page bundle is built and served.

Authoring formats live elsewhere: [`../format/project/pages/README.md`](../format/project/pages/README.md) (page files, `@app/runtime` imports) and [`../format/project/api/README.md`](../format/project/api/README.md) (handler files, `Input`/`Output`, `HttpError`). Store install/rebuild endpoints: [`../cli-api/rest/apps.md`](../cli-api/rest/apps.md).

## Mount points

The router registers four app routes (first-match-wins, registration order matters):

| Pattern | Handler | When |
|---|---|---|
| `* /app/:projectId/api/*` | `createAppApiHandler` | always `sdk/org/libs/cli/src/server/serve.ts:218` |
| `* /app/:projectId/*` | `createPageServeHandler(getOutDirForProject)` (mountPrefix `/app`) | always `sdk/org/libs/cli/src/server/serve.ts:306` |
| `* /:projectId/api/*` | the SAME `appApiHandler` | always registered; a reserved first segment falls through to the SPA `sdk/org/libs/cli/src/server/serve.ts:337-340` |
| `* /:projectId/*` | `createPageServeHandler(getOutDirForProject, '', webFallback)` (mountPrefix `''`) | always registered; a first segment that is not a project with a built app falls through to the SPA `sdk/org/libs/cli/src/server/serve.ts:336-344` |

Order is load-bearing. The api route is registered **before** the page catch-all, so `…/api/*` is consumed first and never reaches the page server `sdk/org/libs/cli/src/app/pages-serve.ts:6-12`. The root-mount pair is registered **last**, so the literal `/api/*` and `/app/*` routes always win over the `:projectId` param `sdk/org/libs/cli/src/server/serve.ts:320-326`.

**The root mount is always on, and falls through.** The bare `/<project>/*` mount is registered unconditionally, and what makes that safe is the fallback: when the first path segment is not a project with a built app — or is one of the `RESERVED_ROOT_SEGMENTS` (`api`, `app`, `assets`, `favicon.ico`, `install`, `chat`, `studio`, `computer`) that this same server answers itself — the request falls through to the SPA handler untouched `sdk/org/libs/cli/src/server/serve.ts#RESERVED_ROOT_SEGMENTS` · `sdk/org/libs/cli/src/app/pages-serve.ts#createPageServeHandler`. So the clean URL works locally (`localhost:8080/<project>/`) as well as behind Envoy, and the SPA's own routes keep working.

It used to be gated on `LMTHING_GATEWAY_URL` (injected by the gateway into every per-user pod), and that gate is how **every app came to render blank in production**: a pod whose `user-env` Secret predated the variable never received it, so `/<project>/` matched no route at all, fell to the SPA catch-all, and answered **200 with the pod's own shell** — whose bundle is root-absolute `/assets/index-*.js` and 404s under the app's mount. The app built, served and rendered empty, while `/<project>/api/<route>` returned that same HTML instead of JSON. Serving must not depend on an env var that can go missing; the route table is now tested directly `sdk/org/libs/cli/src/server/serve-app-mounts.test.ts`.

The client mirrors this: `APP_PATH_PREFIX` is `''` on hostname `lmthing.app` and `'/app'` everywhere else `sdk/org/apps/web/src/lib/config.ts#APP_PATH_PREFIX`.

Resulting public URLs for a project `blog`:

```
# reserved-prefix mount (local `lmthing serve`)
http://localhost:8080/app/blog/                 → page bundle (index.html)
http://localhost:8080/app/blog/feed/a-1         → SPA fallback → client router
http://localhost:8080/app/blog/api/feed-list    → GET endpoint `feedList`

# root mount (prod pod behind Envoy, LMTHING_GATEWAY_URL set)
https://lmthing.app/blog/
https://lmthing.app/blog/api/feed-list
```

Not part of the app's own surface: the reserved top-level `/api/projects/:projectId/app/*` **management** routes (manifest, data browser, app-file editor, build status/rebuild) — see [`../cli-api/rest/apps.md`](../cli-api/rest/apps.md) and `sdk/org/libs/cli/src/server/serve.ts:240-246`. Any unmatched path that starts with `/api/` 404s as JSON before the SPA catch-all `sdk/org/libs/cli/src/server/serve.ts:360-366`.

## API routes — file → URL

Discovery walks `<projectRoot>/api/`. **The route is the directory; the HTTP method is the filename** — one of `GET|POST|PUT|PATCH|DELETE` (`.ts`) `sdk/org/libs/cli/src/app/api/loader.ts:30-32`, `sdk/org/libs/cli/src/app/api/loader.ts:114-116`. A `[id]` directory segment becomes a `:id` param `sdk/org/libs/cli/src/app/api/loader.ts:130-142`. Non-method `.ts` files in a route dir (helpers, `types.ts`) are ignored `sdk/org/libs/cli/src/app/api/loader.ts:115`. The api root dir has no segments, so its pattern is `/` `sdk/org/libs/cli/src/app/api/loader.ts#patternFromSegments`.

Real endpoints from the shipped `blog` app:

```
store/projects/blog/api/feed-list/GET.ts        → GET    /app/blog/api/feed-list       (name "feedList")
store/projects/blog/api/mark-read/POST.ts       → POST   /app/blog/api/mark-read       (name "markRead")
store/projects/blog/api/articles/[id]/GET.ts    → GET    /app/blog/api/articles/:id    (name "getArticle")
store/projects/blog/api/collections/[id]/PATCH.ts → PATCH /app/blog/api/collections/:id
```

(`export const name` is required and unique per project — a missing or duplicate name is a fail-loud throw at load `sdk/org/libs/cli/src/app/api/loader.ts#loadApiRoutes`, `sdk/org/libs/cli/src/app/api/loader.ts:119-124`; `feedList`/`markRead`/`getArticle` are the real values in `store/projects/blog/api/feed-list/GET.ts#name`, `store/projects/blog/api/mark-read/POST.ts#name`, `store/projects/blog/api/articles/[id]/GET.ts:16`.)

**Dual addressing.** The browser addresses an endpoint by route; the agent addresses the same endpoint by `name` through the `apiCall` global — both enter the same runtime (`handle(method, path, input)` vs `callByName(name, input)`) `sdk/org/libs/cli/src/app/api/runtime.ts:305-320`, `sdk/org/libs/cli/src/server/routes/app-api.ts:7-20`.

### Request handling

The HTTP adapter resolves the project's cached `ApiRuntime` (a project with no `api/` dir 404s every endpoint with `{error:{status:404,message:'project "<id>" has no app api'}}`), then reads input method-aware: `GET`/`DELETE` from the query string, everything else from the JSON body (invalid JSON → 400 `invalid JSON body`), and delegates to `runtime.handle(method, '/' + rest, input)` `sdk/org/libs/cli/src/server/routes/app-api.ts#createAppApiHandler`.

Inside the runtime, `Input` is assembled as **one object**: the method's source (query for `GET`/`DELETE`, JSON body for `POST`/`PATCH`/`PUT`) with the route's path params merged **last**, so a path param wins on key clash `sdk/org/libs/cli/src/app/api/input.ts:1-17`, `sdk/org/libs/cli/src/app/api/input.ts#assembleInput`. Matching is exact segment-count + `:param` capture with `decodeURIComponent` `sdk/org/libs/cli/src/app/api/loader.ts#matchRoute`; no route match → 404 `{error:{status:404,message:'not found'}}` `sdk/org/libs/cli/src/app/api/runtime.ts:305-310`.

```bash
# same endpoint, both mounts
curl 'http://localhost:8080/app/blog/api/feed-list?unreadOnly=true'
curl -X POST http://localhost:8080/app/blog/api/mark-read \
     -H 'content-type: application/json' -d '{"articleId":"a-1"}'
curl -X PATCH http://localhost:8080/app/blog/api/collections/c-1 \
     -H 'content-type: application/json' -d '{"title":"Reading list"}'   # :id merges into Input as {id:'c-1'}
```

Error contract (`{ error: { status, message, details? } }`), validation and worker isolation → [`../format/project/api/README.md`](../format/project/api/README.md).

## Page routes — specs, not files

There is no per-project page build anymore. A project's pages are `.view.json` **specs**
(`sdk/org/libs/cli/src/app/view-spec/schema.ts#ViewSpec`) under `views/`, fetched whole over
`GET /api/apps/:id/views` and rendered by the shared `ViewRenderer` — one prebuilt SPA,
**AppHost**, serves every project's specs; there is no per-project bundle to build or cache.
Route/file conventions for the spec format → [`./views.md`](./views.md) ·
[`../format/project/pages/view-spec.md`](../format/project/pages/view-spec.md).

## How pages are served — the shared app-shell

The prebuilt `@lmthing/app-shell` dist is resolved **once at boot**, not per project
`sdk/org/libs/cli/src/server/serve.ts:149-169`. `LM_APP_SHELL=0` disables it; an invalid or
absent dist leaves every project unserveable (there is no per-project bundle left to fall back
to) `sdk/org/libs/cli/src/server/serve.ts:154-169`.

`createPageServeHandler(getOutDirForProject, mountPrefix)` serves that ONE dist under either
mount, keyed by whether the project actually has view specs (`branchAppShell`, the same
discriminator native uses — `views.length > 0`) `sdk/org/libs/cli/src/server/serve.ts:399-419`, `sdk/org/libs/cli/src/app/pages-serve.ts#createPageServeHandler`:

- **No specs, or the shell dist is unavailable** → `404 project "<id>" has no page app` (plain text) on the reserved mount, or falls through to the pod's own SPA on the root mount `sdk/org/libs/cli/src/app/pages-serve.ts:98-113`.
- **Path-traversal guard** — the sub-path must resolve inside the shell's `outDir`, else `400 bad request` `sdk/org/libs/cli/src/app/pages-serve.ts:128-135`.
- **Asset-manifest match** (not filesystem probing) — a sub-path present in the manifest is served as a static file; anything else falls back to `index.html`. Matching on the manifest is what lets a dynamic param containing a `.` (e.g. `/items/my.v2.id`) route client-side instead of 404-ing as a missing asset `sdk/org/libs/cli/src/app/pages-serve.ts:136-158`.
- **A missing ASSET is a 404, not the shell.** A sub-path whose extension is one this server serves (`.js`, `.css`, `.ico`, … — the `MIME` table, `.html` excepted) but which is *not* in the manifest returns `404`, rather than 200 + `index.html` `sdk/org/libs/cli/src/app/pages-serve.ts#isAssetRequest`. Answering an asset request with HTML is how a stale bundle becomes `Unexpected token '<'` (the browser executes `index.html` as a module) and why a served app can log a CSP console error for its favicon — it asked for an icon and got the SPA shell. A dot in a *route param* still reaches the client router, because `.id` is not an extension we serve.
- **Caching** — hashed assets are `public, max-age=31536000, immutable`; `index.html` is `no-cache` `sdk/org/libs/cli/src/app/pages-serve.ts:150-157`. An in-manifest file missing on disk degrades to the SPA fallback rather than erroring `sdk/org/libs/cli/src/app/pages-serve.ts:141-147`.

Since ONE dist serves every project, there is nothing to invalidate on install/rebuild — the
shell only changes when `@lmthing/app-shell` itself ships a new build, and every project picks
that up together. Contrast with the old per-project cache this replaced, which had to be
explicitly dropped on install — see [`../cli-api/rest/apps.md`](../cli-api/rest/apps.md).

### The SPA shell injection

The fallback rewrites `<head>` (idempotently — never doubles an existing `<base>`) with three things `sdk/org/libs/cli/src/app/pages-serve.ts:183-229`:

```html
<head>
    <base href="/app/blog/">
    <script nonce="…">window.__APP_BASE__ = "/app/blog";window.__APP_PROJECT_ID__ = "blog";</script>
```

`<base>` makes the shell's *relative* asset URLs (`./assets/…`) resolve at **any** route depth — without it, a deep route like `…/feed/a-1` would resolve `./assets/x` against `…/feed/`, 404 into this very fallback, and the browser would try to load `index.html` as a module. `window.__APP_BASE__` (the base without the trailing slash) is AppHost's basename override, and `window.__APP_PROJECT_ID__` its project-id override — both required on the root mount where there is no `/app/` segment to derive either from `sdk/org/libs/cli/src/app/pages-serve.ts:183-200`.

### CSP

Every response — assets and the SPA shell — carries `sdk/org/libs/cli/src/app/pages-serve.ts#CSP`:

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
connect-src 'self'; img-src 'self' data: https:; base-uri 'self'; frame-ancestors 'self'
```

Rationale (LLM-authored pages render fetched third-party content, an XSS surface): no inline script, so injected markup cannot execute; `connect-src 'self'` means even a self-XSS cannot exfiltrate or reach the top-level admin `/api/*` — the page can only talk to its own `…/app/<project>/api/*`; `frame-ancestors 'self'` allows the Studio same-origin preview iframe while blocking cross-origin framing `sdk/org/libs/cli/src/app/pages-serve.ts:1-46`. The shell response is the one exception: it adds a **per-request random nonce** to `script-src` purely so the `__APP_BASE__`/`__APP_PROJECT_ID__` bootstrap can run `sdk/org/libs/cli/src/app/pages-serve.ts#serveIndex`.

**The policy is fixed — a project cannot extend it.** `CSP` is a module-level constant `sdk/org/libs/cli/src/app/pages-serve.ts#CSP`; the only parameters `createPageServeHandler` takes are `getOutDirForProject`, `mountPrefix` and an optional `fallback` `sdk/org/libs/cli/src/app/pages-serve.ts#createPageServeHandler`, and the only per-response variation is the nonce substitution on the shell. Nothing in a view spec carries a CSP field — a project therefore cannot declare extra `connect-src`/`img-src` origins. A page that must reach a third-party origin goes through its own `api/` handler instead — that runs server-side in a plain `node:worker_threads` worker `sdk/org/libs/cli/src/app/api/runtime.ts:23`, `sdk/org/libs/cli/src/app/api/worker.ts:1-23`, where no browser CSP applies. Remote **images** are the one thing a page may load directly (`img-src … https:`).

## Related

- View-spec authoring, the shared `ViewRenderer` → [`./views.md`](./views.md) · [`../format/project/pages/view-spec.md`](../format/project/pages/view-spec.md)
- Endpoint authoring, `Input`/`Output`, `HttpError`, worker isolation → [`../format/project/api/README.md`](../format/project/api/README.md)
- Install / list / rebuild / manage an app over REST → [`../cli-api/rest/apps.md`](../cli-api/rest/apps.md)
