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

## Page routes — file → URL

Route discovery walks `pages/`; every non-`_`-prefixed `.tsx`/`.jsx` file is a route. An `index` basename collapses to its directory's path and a `[id]` segment becomes `:id` `sdk/org/libs/cli/src/app/build/pages.ts:155-194`. Directories named `components/` or `lib/` under `pages/` (and any `_`-prefixed dir) hold shared code and are skipped `sdk/org/libs/cli/src/app/build/pages.ts#walkPages`. `_app.tsx` and `_layout.tsx` are wrappers, not routes `sdk/org/libs/cli/src/app/build/pages.ts#WRAPPERS`, `sdk/org/libs/cli/src/app/build/pages.ts#findWrappers`.

Real pages from the shipped `blog` app:

```
store/projects/blog/pages/index.tsx                     →  /app/blog/
store/projects/blog/pages/discover.tsx                  →  /app/blog/discover
store/projects/blog/pages/briefings/index.tsx           →  /app/blog/briefings
store/projects/blog/pages/briefings/[briefingId].tsx    →  /app/blog/briefings/:briefingId
store/projects/blog/pages/feed/[articleId].tsx          →  /app/blog/feed/:articleId
store/projects/blog/pages/feed/[articleId]/research.tsx →  /app/blog/feed/:articleId/research
store/projects/blog/pages/_app.tsx                      →  (wrapper — not a route)
store/projects/blog/pages/_layout.tsx                   →  (wrapper — not a route)
```

The same patterns are matched **client-side** at runtime: `matchRoutes` splits pattern and path into segments and captures `:param`s `sdk/org/libs/cli/src/app/runtime/router.tsx#matchRoutes`; the matched page renders inside `_layout` inside `_app` `sdk/org/libs/cli/src/app/runtime/router.tsx#AppRoot`; an unmatched path renders a minimal `No page for <path>` `sdk/org/libs/cli/src/app/runtime/router.tsx#NotFound`. There is no pod-side page routing beyond the SPA fallback below.

A route is NEVER mounted under `/pages/…` — route paths are derived relative to the `pages/` dir, which is stripped. But the on-disk folder is literally `pages/`, so an author (typically the app-builder) routinely links a sibling page as `/pages/park-fees` instead of the route `/park-fees`. As a fallback — after the literal match pass fails, so a genuine route always wins — `matchRoutes` retries with the stray `/pages` prefix removed, and `toHref` normalizes it out of a pushed link so the URL bar stays clean `sdk/org/libs/cli/src/app/runtime/router.tsx#stripPagesPrefix`.

### Base resolution (why the same bundle works on both mounts)

The route table is authored base-agnostically (`/`, `/discover`, `/feed/:articleId`). The client computes the app's server root at call time: `resolveAppBase(pathname)` returns the first `…/app/<project>` prefix in the pathname, unless `window.__APP_BASE__` overrides it (the `/app`-stripped root mount, where the prefix is not in the path at all) `sdk/org/libs/cli/src/app/runtime/client.ts:70-83`. `clientPath()` strips that base before matching `sdk/org/libs/cli/src/app/runtime/router.tsx#clientPath`, and `toHref()` re-applies it on `navigate` `sdk/org/libs/cli/src/app/runtime/router.tsx#toHref` and on `Link` `sdk/org/libs/cli/src/app/runtime/router.tsx#Link`, so an in-app link never escapes to the origin root.

API URLs are built the same way: `apiCall(name, input)` looks the name up in the injected manifest, fills `:param` segments from `input`, and fetches `<base>/api<routePath>` — query string for `GET`/`DELETE`, JSON body otherwise `sdk/org/libs/cli/src/app/runtime/client.ts:119-161`. The manifest (`name → { method, routePath }`) is put on `window.__APP_ENDPOINTS__` by `mountApp` `sdk/org/libs/cli/src/app/runtime/router.tsx#mountApp`, projected at build time from the typed endpoint contracts (`routePath` is exactly the loader's `pattern`) `sdk/org/libs/cli/src/app/build/pages.ts:203-208`, `sdk/org/libs/cli/src/app/build/schema.ts#buildContract`.

## How pages are built

`buildProjectPages(projectRoot)` runs **on save / boot / install, never per request** `sdk/org/libs/cli/src/app/build/pages.ts:1-10`:

1. No `pages/` dir → `{ built:false, routes:[], assetManifest:[] }` (a db/api-only project has no page surface) `sdk/org/libs/cli/src/app/build/pages.ts#buildProjectPages`.
2. Discover routes, hash the project's sources, and short-circuit on a cache hit (`.data/pages-cache.json` + an existing `index.html`) `sdk/org/libs/cli/src/app/build/pages.ts#buildProjectPages`.
3. Generate an entry in `<projectRoot>/.data/pages-build/` that imports the pages + wrappers and calls `mountApp` with the route table and the endpoint manifest `sdk/org/libs/cli/src/app/build/pages.ts:14-21`, `sdk/org/libs/cli/src/app/build/pages.ts:239-243`.
4. esbuild-bundle into `<projectRoot>/.data/pages-dist/` with hashed assets (`assets/[name]-[hash]`) and an `index.html` that references them with **relative** URLs `sdk/org/libs/cli/src/app/build/pages.ts#runBuild`, `sdk/org/libs/cli/src/app/build/pages.ts:417-432`. `@app/runtime` aliases to the CLI's own runtime source (`resolveEnv` walks up to the `@lmthing/cli` package root) `sdk/org/libs/cli/src/app/build/pages.ts:461-473`, and `@app/types` to the project's `types/generated.d.ts` `sdk/org/libs/cli/src/app/build/pages.ts:249-250`.
5. The **asset manifest** = every emitted file relative to `outDir`, including `index.html` `sdk/org/libs/cli/src/app/build/pages.ts:300-302`.

Builds are serialized process-wide and deferred under memory pressure (each build peaks ~100 MB) `sdk/org/libs/cli/src/app/build/pages.ts:96-118`, `sdk/org/libs/cli/src/app/build/pages.ts:279-285`.

`BUILDER_VERSION` (currently `'6'`) participates in the source hash, so a change to the builder or the bundled `@app/runtime` invalidates every cached bundle — the project-file hash alone would not `sdk/org/libs/cli/src/app/build/pages.ts#BUILDER_VERSION`, `sdk/org/libs/cli/src/app/build/pages.ts#sourceHash`.

The server caches the built bundle per project for its lifetime (`pageBuildCache`, populated lazily by `getOutDirForProject`; a build failure caches `null` and the route 404s) `sdk/org/libs/cli/src/server/serve.ts:248-305`. Installing an app or a store space **drops** that cache entry, so freshly-hashed assets are served instead of a stale manifest `sdk/org/libs/cli/src/server/serve.ts:258-287` — see [`../cli-api/rest/apps.md`](../cli-api/rest/apps.md).

## How pages are served (`pages-serve.ts`)

`createPageServeHandler(getOutDirForProject, mountPrefix = '/app')` serves every non-api path under the mount `sdk/org/libs/cli/src/app/pages-serve.ts#createPageServeHandler`:

- **No bundle** for the project → `404 project "<id>" has no page app` (plain text) `sdk/org/libs/cli/src/app/pages-serve.ts:100-104`.
- **Path-traversal guard** — the sub-path must resolve inside `outDir`, else `400 bad request`; nothing outside the bundle is ever served `sdk/org/libs/cli/src/app/pages-serve.ts:120-126`.
- **Asset-manifest match** (not filesystem probing) — a sub-path present in the manifest is served as a static file; anything else falls back to `index.html`. Matching on the manifest is what lets a dynamic param containing a `.` (e.g. `/items/my.v2.id`) route client-side instead of 404-ing as a missing asset `sdk/org/libs/cli/src/app/pages-serve.ts:13-21`, `sdk/org/libs/cli/src/app/pages-serve.ts:128-152`.
- **A missing ASSET is a 404, not the shell.** A sub-path whose extension is one this server serves (`.js`, `.css`, `.ico`, … — the `MIME` table, `.html` excepted) but which is *not* in the manifest returns `404`, rather than 200 + `index.html` `sdk/org/libs/cli/src/app/pages-serve.ts#isAssetRequest`. Answering an asset request with HTML is how a stale bundle becomes `Unexpected token '<'` (the browser executes `index.html` as a module) and why every served app logged a CSP console error for its favicon — it asked for an icon and got the SPA shell (scenario 07's browser pass). A dot in a *route param* still reaches the client router, because `.id` is not an extension we serve.
- **Caching** — hashed assets are `public, max-age=31536000, immutable`; `index.html` is `no-cache` `sdk/org/libs/cli/src/app/pages-serve.ts:139-146`, `sdk/org/libs/cli/src/app/pages-serve.ts#serveIndex`. An in-manifest file missing on disk (stale build) degrades to the SPA fallback rather than erroring `sdk/org/libs/cli/src/app/pages-serve.ts:134-137`.

### The SPA shell injection

The fallback rewrites `<head>` (idempotently — never doubles an existing `<base>`) with two things `sdk/org/libs/cli/src/app/pages-serve.ts:156-198`:

```html
<head>
    <base href="/app/blog/">
    <script nonce="…">window.__APP_BASE__ = "/app/blog";</script>
```

`<base>` makes the shell's *relative* asset URLs (`./assets/…`) resolve at **any** route depth — without it, a deep route like `…/feed/a-1` would resolve `./assets/x` against `…/feed/`, 404 into this very fallback, and the browser would try to load `index.html` as a module `sdk/org/libs/cli/src/app/pages-serve.ts:108-117`. `window.__APP_BASE__` (the base without the trailing slash) is the client router's basename override, required on the root mount where there is no `/app/` segment to derive from `sdk/org/libs/cli/src/app/pages-serve.ts:158-167`, `sdk/org/libs/cli/src/app/pages-serve.ts#serveIndex`.

### CSP

Every response — assets and the SPA shell — carries `sdk/org/libs/cli/src/app/pages-serve.ts#CSP`:

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
connect-src 'self'; img-src 'self' data: https:; base-uri 'self'; frame-ancestors 'self'
```

Rationale (LLM-authored pages render fetched third-party content, an XSS surface): no inline script, so injected markup cannot execute; `connect-src 'self'` means even a self-XSS cannot exfiltrate or reach the top-level admin `/api/*` — the page can only talk to its own `…/app/<project>/api/*`; `frame-ancestors 'self'` allows the Studio same-origin preview iframe while blocking cross-origin framing `sdk/org/libs/cli/src/app/pages-serve.ts:23-42`. The shell response is the one exception: it adds a **per-request random nonce** to `script-src` purely so the `__APP_BASE__` bootstrap can run `sdk/org/libs/cli/src/app/pages-serve.ts#serveIndex`.

**The policy is fixed — a project cannot extend it.** `CSP` is a module-level constant `sdk/org/libs/cli/src/app/pages-serve.ts#CSP`; the only parameters `createPageServeHandler` takes are `getOutDirForProject` and `mountPrefix` `sdk/org/libs/cli/src/app/pages-serve.ts#createPageServeHandler`, and the only per-response variation is the nonce substitution on the shell `sdk/org/libs/cli/src/app/pages-serve.ts#serveIndex`. Nothing in the build (`build/pages.ts`) or the app manifest carries a CSP field — a project therefore cannot declare extra `connect-src`/`img-src` origins. A page that must reach a third-party origin goes through its own `api/` handler instead — that runs server-side in a plain `node:worker_threads` worker `sdk/org/libs/cli/src/app/api/runtime.ts:23`, `sdk/org/libs/cli/src/app/api/worker.ts:1-23`, where no browser CSP applies. Remote **images** are the one thing a page may load directly (`img-src … https:`).

## Related

- Page authoring, `@app/runtime` hooks, `_app`/`_layout` → [`../format/project/pages/README.md`](../format/project/pages/README.md)
- Endpoint authoring, `Input`/`Output`, `HttpError`, worker isolation → [`../format/project/api/README.md`](../format/project/api/README.md)
- Install / list / rebuild / manage an app over REST → [`../cli-api/rest/apps.md`](../cli-api/rest/apps.md)
