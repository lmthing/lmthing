# Pod REST — apps: catalog, install, admin & the served app API

Three route families, all served by the pod CLI server (`lmthing serve`) — see [the REST index](./README.md) for the full route registry and the router's first-match-wins semantics.

| Family | Routes | Module |
|---|---|---|
| **Store catalog + install** | `GET /api/apps`, `POST /api/apps/install` | `sdk/org/libs/cli/src/server/routes/apps.ts` |
| **App admin** (Studio-facing, reserved `/api/*`) | `GET /api/projects/:projectId/app`, `.../app/files/*`, `.../app/data/*`, `.../app/build` | `sdk/org/libs/cli/src/server/routes/app-admin.ts` |
| **App API dispatcher** (the served app's own endpoints) | `* /app/:projectId/api/*` (+ root mount `* /:projectId/api/*`) | `sdk/org/libs/cli/src/server/routes/app-api.ts` |

The two `app` surfaces are deliberately distinct: the admin surface lives **under the reserved top-level `/api/*`**, the app's own runtime lives **outside it** at `/app/<project>/api/*` `sdk/org/libs/cli/src/server/routes/app-admin.ts:2-9` · `sdk/org/libs/cli/src/server/routes/app-api.ts:19-20`.

What an install materializes is the project app format: `database/ pages/ api/ hooks/ components/ lib/ spaces/` — see [../../format/project/README.md](../../format/project/README.md), and how it is served at runtime in [../../app/README.md](../../app/README.md).

---

## 1. `GET /api/apps` — public catalog proxy

Mounted with no store override `sdk/org/libs/cli/src/server/serve.ts:258`. **There is no local catalog in the pod** — the handler fetches the store's static manifest over HTTP `sdk/org/libs/cli/src/server/routes/apps.ts:44-49`:

```
GET ${LM_STORE_URL ?? https://lmthing.store}/projects/manifest.json  →  { apps: StoreCatalogApp[] }
```

`sdk/org/libs/cli/src/server/routes/apps.ts:91-96`. The base URL is trailing-slash-normalised and overridable via `LM_STORE_URL` (or the handler's `storeUrl` argument, used by tests) `sdk/org/libs/cli/src/server/routes/apps.ts:46-49`.

Response: `{ apps }`. If the store is unreachable or non-2xx, the route **degrades to `200 { apps: [] }`** rather than erroring `sdk/org/libs/cli/src/server/routes/apps.ts:103-112`.

A catalog entry (`StoreCatalogApp`) carries `id`, optional `title`/`description`/`icon`, the summary arrays `tables`/`pages`/`endpoints`/`hooks`, and `files` — the **full relative-path download list** used by the installer `sdk/org/libs/cli/src/server/routes/apps.ts:76-88`. Real example (`store/projects/manifest.json:1-8`):

```json
{
  "apps": [
    {
      "id": "blog",
      "title": "Blog",
      "description": "lmthing.blog — personalized AI news, as a project-application (database + pages + api + hooks + newsroom space).",
      "icon": null,
      "tables": ["alerts", "annotations", "..."],
      "pages": ["_app.tsx", "..."]
    }
  ]
}
```

---

## 2. `POST /api/apps/install` — materialize + boot + build

Body: `{ appId, projectId?, force? }` `sdk/org/libs/cli/src/server/routes/apps.ts:169-173`.

### Validation

| Condition | Response |
|---|---|
| body is not JSON | `400 { error: 'invalid JSON body' }` `apps.ts:198-203` |
| `appId` missing / fails `safeProjectId` / is a reserved id | `400 { error: 'invalid appId: …' }` `apps.ts:205-209` |
| `projectId` (defaults to `appId`) fails the same check | `400 { error: 'invalid projectId: …' }` `apps.ts:210-214` |
| the server has no runtime root | `404 { error: 'no project root configured' }` `apps.ts:217-220` |

Ids must match `^[a-zA-Z0-9_-]+$` `sdk/org/libs/cli/src/server/projects.ts:58-64`, and the reserved set is `system`, `api`, `assets`, `install` `sdk/org/libs/cli/src/server/projects.ts:39-43`.

### Steps

1. **Download to staging.** A temp dir is created (`mkdtempSync`) and every path in the catalog entry's `files[]` is fetched from `${store}/projects/<appId>/<rel>`, each path rejected if it contains `..`, a NUL, an empty segment, is absolute, or resolves outside the staging dir `sdk/org/libs/cli/src/server/routes/apps.ts:120-142,227-231`. A missing entry, an empty `files[]`, or any failed fetch → `404 { error: 'app not available in store catalog: …' }` `apps.ts:232-235`. Staging is always removed in `finally` `apps.ts:302-304`.
2. **Synthesize `project.json` if absent.** Apps authored by `system-appbuilder` ship only a `package.json`; a *deterministic* `{ id, title, description, icon }` is written from the catalog entry (deterministic because `project.json` is part of the install hash — a volatile `createdAt` would make every re-install look diverged) `apps.ts:144-165,236-239`.
3. **Pristine-vs-diverged guard.** `hashAppTemplate` is a sha256 over the **template subset only** (sorted relpath + bytes), so the destination's live `.data/` and generated `types/` never affect the classification `apps.ts:361-386`. If the destination exists and its hash differs from the shipped hash, the install manifest at `<dest>/.data/.installed.json` is consulted; a copy whose hash still equals `manifest.sourceHash` is **pristine** and re-syncs silently, otherwise the install is held back `apps.ts:241-261,399-420`:

   ```json
   { "ok": false, "diverged": true, "projectId": "blog", "appId": "blog",
     "message": "\"blog\" has local edits that diverge from the \"blog\" catalog template — pass force:true to overwrite them." }
   ```

   This is returned with HTTP **200**, not an error status — the installer UI treats it as the "Upgrade & replace files" branch, not a failure `apps.ts:249-258`.
4. **Materialize.** Each template dir (`database`, `pages`, `api`, `hooks`, `components`, `lib`, `spaces`) is fully replaced (rm-then-copy, so upstream deletions do not linger) and the root files `package.json`, `project.json`, `tsconfig.json` are copied verbatim. Nothing else in the destination is touched — `.data/` (live db, build caches) and `types/` (generated) are never in the copy set `apps.ts:66-73,336-359`. Then the install manifest is written `apps.ts:264-265`.
5. **Boot.** `manager.getProjectDb(root, projectId)` — boot goes *through* the SessionManager so the handle is cached and closed alongside every other project db `apps.ts:271-278` · `sdk/org/libs/cli/src/server/session-manager.ts:515-519`. A boot failure aborts the install with `500 { error: 'boot failed: …' }`.
6. **Best-effort builds.** Typed contracts (only if `api/` exists) and a forced page build (only if `pages/` exists); each records `{ ok, … }` or `{ ok:false, error }` and **never aborts the install** `apps.ts:280-285,308-334`.
7. **Drop the page cache.** `onInstalled(projectId)` — `serve.ts` deletes the project's entry in `pageBuildCache`, because the rebuild wrote assets with new content hashes and a stale in-memory asset manifest would fall back to `index.html` for `assets/entry-*.js` (MIME error → blank app) `apps.ts:188-194,291-293` · `sdk/org/libs/cli/src/server/serve.ts:259-265`.

### Success response

```json
{
  "ok": true,
  "projectId": "blog",
  "appId": "blog",
  "installed": { "tables": ["articles"], "pages": ["/", "/items/:id"], "endpoints": ["GET /items"], "hooks": ["digest"] },
  "built": { "contracts": { "ok": true, "endpointCount": 12 }, "pages": { "ok": true, "built": true, "assetCount": 4 } }
}
```

`sdk/org/libs/cli/src/server/routes/apps.ts:295-301`. The `installed` arrays come from cheap read-only scanners over the materialized tree — `database/*.json` basenames, `hooks/*.ts` basenames, page route patterns (`index` collapses, `[id]` → `:id`, `_`-prefixed and `components/`/`lib/` skipped), and `<METHOD> <routePath>` endpoint strings `apps.ts:422-502`. These mirror the file→route rules documented in [../../format/project/pages/README.md](../../format/project/pages/README.md) and [../../format/project/api/README.md](../../format/project/api/README.md).

> Store **spaces** (integrations) install through a separate pair of routes — see [./store-spaces.md](./store-spaces.md).

---

## 3. App admin — `/api/projects/:projectId/app/*`

Studio's management surface. Every handler is a factory `(manager, lmthingRoot) => handler`, mounted in `serve.ts` with the specific sub-routes registered **before** the bare manifest route so they win first-match `sdk/org/libs/cli/src/server/routes/app-admin.ts:1-21` · `sdk/org/libs/cli/src/server/serve.ts:240-246`.

Every handler 400s on an unsafe `:projectId` and 404s (`no project root configured`) when the server has no runtime root `app-admin.ts:122-130`.

### `GET /api/projects/:projectId/app` — manifest

Returns `{ project, hasApp, tables, pages, endpoints, hooks, build }` `app-admin.ts:164-172`. A **spaces-only** project (e.g. the synthetic `system` project) is tolerated: `hasApp:false` with empty arrays and `build:{built:false,assetCount:0,stale:false}` `app-admin.ts:143-155`.

- `tables` — `{ name, schema }` from `database/*.json` `app-admin.ts:141`.
- `pages` — `{ routePath, file }`, discovered by a **read-only** walk that mirrors the page build (so the manifest never triggers a rebuild) `app-admin.ts:462-510`.
- `endpoints` — `{ name, method, routePath, inputSchema, outputSchema }`, preferring the manager's cached contracts and falling back to a guarded `generateProjectContracts` (errors degrade to `[]`) `app-admin.ts:176-200`.
- `hooks` — `{ slug, type, on?, every?, trigger?, lastRunAt?, lastFiredAt?, pending }` merged from the hook loader and `.data/hooks-state.json` `app-admin.ts:202-240`.
- `build` — `{ built, assetCount, stale }`, where `built` = `.data/pages-dist/index.html` exists and `stale` compares the cached content hash against a fresh hash of `package.json` + `pages/` + `components/` + `lib/` `app-admin.ts:512-562`.

### `GET|PUT /api/projects/:projectId/app/files/*` — path-scoped file editor

`scopeAppFile` is the gate `app-admin.ts:77-109`:

| Path | Result |
|---|---|
| absolute / `..` / empty segment | `400 unsafe file path` `app-admin.ts:88-90` |
| under `.data/` or `types/` | `403` — `BLOCKED_DIRS` `app-admin.ts:63-64,92-95` |
| a root file other than `package.json` / `tsconfig.json` | `403` — `ROOT_FILES` `app-admin.ts:62,96-99` |
| a top dir outside `database`/`pages`/`api`/`hooks`/`components`/`lib` | `403` — `APP_DIRS` `app-admin.ts:60,100-102` |
| resolves outside the project root | `403 path escapes the project root` `app-admin.ts:103-107` |

`GET` → `{ path, content }`, `404` when the file is absent `app-admin.ts:244-277`. `PUT` writes **exactly one** file (`mkdir -p` its parent, never a bulk directory delete); the body is JSON `{ content }` or, if it does not parse, the raw body itself; response `{ ok, bytes }` `app-admin.ts:279-319`.

### `GET|PATCH /api/projects/:projectId/app/data/…` — data browser

- `GET .../app/data/:table?limit=&offset=` → `{ table, rows, limit, offset }` (defaults `limit=50`, `offset=0`); `404` when the project has no app database or the table is unknown `app-admin.ts:323-358,592-596`.
- `PATCH .../app/data/:table/:id` — JSON body is an object of column/value pairs (array/null/non-object → `400`); performs `db.update(table, { where: { id }, set })` → `{ ok, updated }` `app-admin.ts:360-406`.

> **Known drift:** Studio's client sends `page`/`pageSize` query params (`sdk/org/apps/web/src/routes/studio/$projectId/app/-lib/appApi.ts:25,79-83`) while the handler only reads `limit`/`offset` (`app-admin.ts:348-350`) — so the Studio data browser currently always receives the default first 50 rows regardless of the page it asks for.

### `GET|POST /api/projects/:projectId/app/build`

- `GET` → `{ built, stale, assetManifest }` — read-only, no rebuild `app-admin.ts:410-429`.
- `POST` → `buildProjectPages(projectRoot, { force: true })` → `{ built, assetManifest, routes: [{ routePath, file }] }`; a build failure is `400 { error }` `app-admin.ts:431-458`.

This is the explicit rebuild an agent's live page/api authoring must follow with: `onAppWrite` invalidates the contracts + api runtime caches but deliberately does **not** compile pages `sdk/org/libs/cli/src/server/session-manager.ts:591-598`.

---

## 4. App API dispatcher — `* /app/:projectId/api/*`

The browser-facing surface of a project's `api/` handlers, **dual-addressed** with the agent's `apiCall` global, which enters the *same* runtime by endpoint `name` `sdk/org/libs/cli/src/server/routes/app-api.ts:7-21` · `sdk/org/libs/cli/src/app/api/runtime.ts:103-105,312-321`.

```ts
// sdk/org/libs/cli/src/server/routes/app-api.ts:26-55 (abridged)
const runtime = lmthingRoot ? await manager.getApiRuntime(lmthingRoot, projectId) : null;
if (!runtime) { sendJson(res, 404, { error: { status: 404, message: `project "${projectId}" has no app api` } }); return; }
let input: unknown;
if (QUERY_METHODS.has(method)) {                       // QUERY_METHODS = { GET, DELETE }
  input = Object.fromEntries(new URL(req.url ?? '/', 'http://localhost').searchParams);
} else {
  const raw = await readBody(req);
  try { input = raw ? JSON.parse(raw) : {}; }
  catch { sendJson(res, 400, { error: { status: 400, message: 'invalid JSON body' } }); return; }
}
const result = await runtime.handle(method, '/' + rest, input);
sendJson(res, result.status, result.body);
```

- The runtime is built lazily per project and cached by `SessionManager.getApiRuntime`, which boots the db first and returns `null` when there is none — so a project with no app api 404s every endpoint `sdk/org/libs/cli/src/server/session-manager.ts:669-702`.
- Handlers run in a Node worker (a **crash boundary**, not a security boundary — the pod is the boundary) with `ctx.db` proxied back to the main process, and `spawn(ref, input)` wired to a real fire-and-forget headless agent run `sdk/org/libs/cli/src/server/session-manager.ts:676-698` · `sdk/org/libs/cli/src/server/routes/app-api.ts:12-17`.

### Error envelope (identical for browser and agent)

| Case | Status | Body |
|---|---|---|
| no route match | 404 | `{ error: { status: 404, message: 'not found' } }` `runtime.ts:305-308` |
| ajv input mismatch | 400 | `{ error: { status: 400, message: 'invalid input', details } }` `errors.ts:104-111` · `runtime.ts:213` |
| `throw new HttpError(status, message, details?)` | that status | `{ error: { status, message, details? } }` `errors.ts:57-61,96-100` |
| any other throw / worker crash | 500 | `{ error: { status: 500, message: 'internal error' } }` — the real message is logged pod-side, never leaked `errors.ts:101` · `runtime.ts:242-267` |

### Mount order & the root mount

Route order is load-bearing (the router is first-match-wins by registration order):

```
serve.ts:218   * /app/:projectId/api/*     → appApiHandler          (api wins over pages)
serve.ts:306   * /app/:projectId/*         → createPageServeHandler  (the built React bundle)
serve.ts:322   const rootMountApps = Boolean(process.env['LMTHING_GATEWAY_URL']);
serve.ts:324   * /:projectId/api/*         → appApiHandler           (only when set)
serve.ts:325   * /:projectId/*             → createPageServeHandler(…, '')  (only when set)
```

The bare `/:projectId/*` root mount serves the same app with **no `/app` prefix** (clean `lmthing.app/blog/…` URLs) and is gated on `LMTHING_GATEWAY_URL`, which the gateway injects into every per-user pod and nothing else sets. Locally (`lmthing serve` / `pnpm thing`) it is unset, because a bare `/:projectId/*` would shadow every SPA route — hence apps live at `localhost:8080/app/<project>` `sdk/org/libs/cli/src/server/serve.ts:309-325`.

Full serving behaviour of the page bundle (asset-manifest SPA fallback, `<base href>`, CSP) → [../../app/README.md](../../app/README.md).

---

## Auth

None of these routes authenticate. The pod server has no token check of its own — it is protected by its network position (one pod per user namespace, behind the gateway/Envoy which validates the JWT). See [./README.md](./README.md).
