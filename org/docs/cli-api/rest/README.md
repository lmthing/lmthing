# Pod REST API — full route index

Every HTTP route and WebSocket upgrade served by the pod's CLI server (`lmthing serve` / bare `lmthing`). The one entry point is `startSessionServer(opts)` `sdk/org/libs/cli/src/server/serve.ts#startSessionServer`; it builds a `Router`, dispatches, and falls through to the unified SPA. See [../commands.md](../commands.md) for how the server is started and [../README.md](../README.md) for the CLI package overview.

---

## The dispatcher

Routing is a hand-rolled first-match-wins table, not a framework `sdk/org/libs/cli/src/server/router.ts#Router`:

- `Router.add(method, pattern, handler)` compiles the pattern to a RegExp `sdk/org/libs/cli/src/server/router.ts#Router.add`.
- `:param` matches exactly one non-slash segment `sdk/org/libs/cli/src/server/router.ts#compilePattern`.
- A trailing `/*` captures the remainder of the path (slashes included) as `params.rest` `sdk/org/libs/cli/src/server/router.ts#compilePattern`.
- Method `'*'` matches any verb `sdk/org/libs/cli/src/server/router.ts#Router.dispatch`.
- `dispatch()` walks the routes **in registration order** and returns on the first match `sdk/org/libs/cli/src/server/router.ts#Router.dispatch`; a handler rejection is turned into a `500 {error}` JSON body `sdk/org/libs/cli/src/server/router.ts#Router.dispatch`.
- Every handler has the shape `(req, res, params, ctx) => Promise<void>` with `ctx = { manager, spacesRoot, effectiveLmthingRoot, broadcastUiControl }` `sdk/org/libs/cli/src/server/router.ts:L6-L18`.

Two shared helpers back nearly every module: `readBody(req)` and `sendJson(res, status, obj)` `sdk/org/libs/cli/src/server/routes/utils.ts`.

**Fallbacks** (`sdk/org/libs/cli/src/server/serve.ts:L358-L370`): if nothing matched and the path starts with `/api/`, the server answers `404 {"error":"unknown API route <METHOD> <path>"}`; anything else goes to the Vite dev middleware (only when `LM_DEV_WEB` is set) or to the static unified SPA (`createStaticApps(resolveAppDist())`) `sdk/org/libs/cli/src/server/serve.ts:L123`, `sdk/org/libs/cli/src/server/static-apps.ts`.

**Route-order facts that matter** (first match wins):

- `* /app/:projectId/api/*` is registered at `serve.ts:L218`, the page catch-all `* /app/:projectId/*` at `serve.ts:L306` — so an app's own API always beats its page server.
- The app-admin sub-routes (`/app/build`, `/app/data/…`, `/app/files/*`) are registered **before** the bare manifest route `GET /api/projects/:projectId/app` `sdk/org/libs/cli/src/server/serve.ts:L240-L246`.
- The root mounts `* /:projectId/api/*` and `* /:projectId/*` are registered **last** so every literal `/api/*` and `/app/*` route wins over the `:projectId` param `sdk/org/libs/cli/src/server/serve.ts:L322-L326`.

---

## Auth & gating conventions

**The pod server has no authentication of its own.** There is no token check and no auth middleware in `router.ts` or `serve.ts` — the request handler goes straight from activity tracking to `router.dispatch` `sdk/org/libs/cli/src/server/serve.ts:L343-L370`. The pod is protected by its network position (one pod per user namespace, behind the gateway/Envoy edge). Exactly three routes touch auth, and all three **relay or verify**, never mint:

| Route | What it does with auth |
|---|---|
| `GET /api/budget` | Relays the caller's `Authorization` header to the gateway's `/api/billing/budget`; **no header ⇒ 404** `sdk/org/libs/cli/src/server/routes/budget.ts#handleBudget` |
| `POST /api/report-bug` | Relays the caller's `Authorization` header to the gateway's issue broker `sdk/org/libs/cli/src/server/routes/report-bug.ts:L48`, `sdk/org/libs/cli/src/server/report-bug.ts:L38` |
| `POST /api/inbound/:path` | Per-provider **HMAC signature verification** (401 on failure) — this is the one endpoint reachable from the public internet `sdk/org/libs/cli/src/server/routes/webhooks.ts:L191`, `L288` |

Other gates that change whether a route *exists* or what it returns:

| Gate | Effect |
|---|---|
| `effectiveLmthingRoot` (`manager.lmthingRoot ?? opts.lmthingRoot`) `sdk/org/libs/cli/src/server/serve.ts:L109` | Project/app/hook/store routes 404 or return empty without it (e.g. `{hooks: []}` `sdk/org/libs/cli/src/server/routes/hooks.ts:L500-L503`; `{integrations: []}` `sdk/org/libs/cli/src/server/routes/store-spaces.ts:L543-L546`; hook-run `404 no project root configured` `sdk/org/libs/cli/src/server/routes/hooks.ts:L409-L412`) |
| `LMTHING_GATEWAY_URL` | When set (prod pods only), the two **root mounts** `/:projectId/api/*` and `/:projectId/*` are additionally registered `sdk/org/libs/cli/src/server/serve.ts:L322-L326` |
| Memory pressure (`isUnderMemoryPressure()`) | `POST /api/sessions` answers `503` + `Retry-After: 5` `sdk/org/libs/cli/src/server/routes/sessions.ts:L15-L19` |
| `LM_ENABLE_CRONTAB=1` | The **only** way the system crontab is written; otherwise an in-process tick drives cron hooks `sdk/org/libs/cli/src/server/routes/hooks.ts#crontabUnavailable` |
| `LM_DEV_WEB` / `LM_APP_DIST` | Swap the SPA catch-all for Vite HMR / override the SPA dist `sdk/org/libs/cli/src/server/serve.ts:L368-L369`, `sdk/org/libs/cli/src/server/static-apps.ts` |

Mutating requests (anything not GET/HEAD/OPTIONS) bump `lastMutatingRequestAt` for the self-idle watchdog; GETs deliberately do not, so the K8s readiness probe (`GET /api/sessions`) can't keep an idle pod awake `sdk/org/libs/cli/src/server/serve.ts:L328-L357`.

---

## Full route table

Registration order, as built in `sdk/org/libs/cli/src/server/serve.ts:L134-L326`.

| Method | Path | Purpose | Handler | Doc |
|---|---|---|---|---|
| GET | `/api/prices/azure` | Serve `libs/cli/prices/azure.json` (per-token pricing); 404 when absent | `handlePricesAzure` `routes/prices.ts:L8-L23` | [misc](./misc.md) |
| GET | `/api/budget` | Relay to gateway `/api/billing/budget` (rolling 1d/7d/30d remaining) | `handleBudget` `routes/budget.ts:L20-L38` | [budget](./budget.md) |
| POST | `/api/restart` | `200 {ok:true}`, then `process.exit(0)` after 100 ms | inline `serve.ts:L143-L147` | [misc](./misc.md) |
| POST | `/api/keepalive` | Keep-warm heartbeat (POST so it bumps the idle clock) | inline `serve.ts:L154-L157` | [misc](./misc.md) |
| GET | `/api/env` | Read the pod's `.env` at `process.cwd()` → `{content}` | `handleEnvGet` `routes/env.ts:L23-L35` | [env](./env.md) |
| PUT | `/api/env` | **Replace** the whole `.env` + apply to `process.env` | `handleEnvPut` `routes/env.ts:L37-L53` | [env](./env.md) |
| POST | `/api/sessions` | Create a session → `201 {sessionId}`; `503`+`Retry-After` under memory pressure | `handleCreateSession` `routes/sessions.ts:L7-L40` | [sessions](./sessions.md) |
| GET | `/api/sessions` | List live sessions (also the K8s readiness probe) | `handleListSessions` `routes/sessions.ts:L42-L49` | [sessions](./sessions.md) |
| GET | `/api/session-ledger` | Pod-global session/delegate ledger with cost accounting (newest-first, cap 200) | `handleListSessionLedger` `routes/session-ledger.ts:L10-L17` | [sessions](./sessions.md) |
| GET | `/api/projects` | List projects (prepends the synthetic `system` project) | `handleListProjects` `routes/projects.ts:L6-L18` | [projects](./projects.md) |
| POST | `/api/projects` | Create a project → `201 {id}` | `handleCreateProject` `routes/projects.ts:L20-L41` | [projects](./projects.md) |
| DELETE | `/api/projects/:projectId` | Delete a project; `400` for the default `user` project | `handleDeleteProject` `routes/projects.ts:L43-L59` | [projects](./projects.md) |
| GET | `/api/projects/:projectId/instructions` | Read `instructions.md` → `{content}` | `handleGetProjectInstructions` `routes/projects.ts:L61-L74` | [projects](./projects.md) |
| PUT | `/api/projects/:projectId/instructions` | Write `instructions.md` | `handlePutProjectInstructions` `routes/projects.ts:L76-L96` | [projects](./projects.md) |
| GET | `/api/projects/:projectId/documents` | List project documents | `handleListDocuments` `routes/projects.ts:L98-L111` | [projects](./projects.md) |
| POST | `/api/projects/:projectId/documents` | Create a document `{name, content?}` → `201` | `handleCreateDocument` `routes/projects.ts:L113-L136` | [projects](./projects.md) |
| GET | `/api/projects/:projectId/sessions` | Persisted sessions of a project | `handleListProjectSessions` `routes/projects.ts:L138-L151` | [projects](./projects.md) |
| GET | `/api/projects/:projectId/spaces/:spaceId/sessions` | Persisted sessions of one space | `handleListSpaceSessions` `routes/projects.ts:L153-L170` | [projects](./projects.md) |
| GET | `/api/projects/:projectId/spaces/:spaceId/files` | Whole runnable file map → `{files}` | `handleGetProjectSpaceFiles` `routes/projects.ts:L172-L189` | [projects](./projects.md) |
| PUT | `/api/projects/:projectId/spaces/:spaceId/files` | **Wipe-and-rewrite** the space dir from `{files}` | `handlePutProjectSpaceFiles` `routes/projects.ts:L191-L225` | [projects](./projects.md) |
| POST | `/api/projects/:projectId/spaces/:spaceId/files` | Create one file `{path, content}` → `201` | `handlePostProjectSpaceFile` `routes/projects.ts:L227-L254` | [projects](./projects.md) |
| PUT | `/api/projects/:projectId/spaces/:spaceId/files/*` | Write one file — `{content}` JSON **or a raw body** | `handlePutProjectSpaceFile` `routes/projects.ts:L255-L282` | [projects](./projects.md) |
| DELETE | `/api/projects/:projectId/spaces/:spaceId/files/*` | Delete one file → `204`; `404` on ENOENT | `handleDeleteProjectSpaceFile` `routes/projects.ts:L284-L309` | [projects](./projects.md) |
| GET | `/api/projects/:projectId/spaces` | Space metadata list | `handleListProjectSpaces` `routes/projects.ts:L311-L324` | [projects](./projects.md) |
| GET | `/api/projects/:projectId/completions` | `@`-autocomplete words | `handleGetProjectCompletions` `routes/projects.ts:L326-L339` | [projects](./projects.md) |
| GET | `/api/projects/:projectId/integrations` | Installed integration spaces + settings schema + `missingRequired` | `handleListProjectIntegrations` `routes/store-spaces.ts:L535-L560` | [store-spaces](./store-spaces.md) |
| POST | `/api/spaces` | Write an edited space under `ctx.spacesRoot` (wipe-first) → `{spaceDir}` | `handleCreateSpace` `routes/spaces.ts:L22-L45` | [spaces](./spaces.md) |
| DELETE | `/api/sessions/:id` | Dispose a session; `404` when unknown | `handleDeleteSession` `routes/sessions.ts:L51-L62` | [sessions](./sessions.md) |
| `*` | `/api/sessions/:id/*` | Per-session catch-all → remaps to `/api/<rest>` and delegates to `handleAgentApi` | `handleSessionSubRoute` `routes/sessions.ts:L69-L86` | [sessions](./sessions.md) |
| POST | `/api/uploads` | Store a base64/data-URL attachment → `201 AttachmentRef`; `413` over 25 MB | `handleUpload` `routes/uploads.ts:L16-L45` | [uploads](./uploads.md) |
| GET | `/api/uploads/:id` | Serve raw bytes + `Content-Type`, immutable cache | `handleServeUpload` `routes/uploads.ts:L48-L60` | [uploads](./uploads.md) |
| GET | `/api/fs/tree` | Walk `effectiveLmthingRoot` (skips `.git`/`node_modules`/`.cache`) → `{files}` | `handleFsTree` `routes/fs.ts:L8-L34` | [fs](./fs.md) |
| GET | `/api/fs/read?path=` | Read one file → `{content}`; `400` traversal, `404` missing | `handleFsRead` `routes/fs.ts:L36-L54` | [fs](./fs.md) |
| PUT | `/api/fs/write` | Write one file `{path, content}` (mkdir -p) | `handleFsWrite` `routes/fs.ts:L56-L70` | [fs](./fs.md) |
| POST | `/api/backup` | Run a manual GitHub backup | `handleBackupNow` `routes/backup.ts:L20-L34` | [misc](./misc.md) |
| GET | `/api/backup/status` | Read backup status | `handleBackupStatus` `routes/backup.ts:L36-L46` | [misc](./misc.md) |
| POST | `/api/restore` | Restore the workspace (200 ok / 409 conflict) | `handleRestore` `routes/backup.ts:L48` | [misc](./misc.md) |
| POST | `/api/report-bug` | Attach the session trace + relay to the gateway's issue broker | `handleReportBug` `routes/report-bug.ts:L11-L60` | [misc](./misc.md) |
| `*` | `/app/:projectId/api/*` | **Project-app API runtime** (worker-isolated Node handlers) | `createAppApiHandler` `routes/app-api.ts:L22-L50` | [apps](./apps.md) |
| POST | `/api/projects/:projectId/hooks/:slug/run` | The one authoritative hook-run path (Studio, crond, boot catch-up, tick) | `createHookRunHandler` `routes/hooks.ts:L400-L456` | [hooks](./hooks.md) |
| GET | `/api/hooks` | Pod-global hook list across every project + installed space | `createHooksListHandler` `routes/hooks.ts:L495-L533` | [hooks](./hooks.md) |
| POST | `/api/projects/:projectId/hooks/:slug/disabled` | Write the `.data/hooks-state.json` disable overlay + republish | `createHookDisableHandler` `routes/hooks.ts:L542-L575` | [hooks](./hooks.md) |
| POST | `/api/inbound/:path` | External webhook ingress (verify → preflight → dedupe → emit/run) | `createInboundHandler` `routes/webhooks.ts:L111-L200` | [webhooks](./webhooks.md) |
| GET | `/api/projects/:projectId/app/build` | Build status → `{built, stale, assetManifest}` | `handleBuildStatus` `routes/app-admin.ts:L414-L433` | [apps](./apps.md) |
| POST | `/api/projects/:projectId/app/build` | Force a page rebuild | `handleRebuild` `routes/app-admin.ts:L435` | [apps](./apps.md) |
| POST | `/api/projects/:projectId/app/check` | **Authoritative** verdict — typecheck THEN bundle → `{ok, built, routes, errors}` | `handleAppCheck` `routes/app-admin.ts#handleAppCheck` | [apps](./apps.md) |
| GET | `/api/projects/:projectId/app/data/:table` | Data browser — paged rows | `handleListRows` `routes/app-admin.ts:L327-L363` | [apps](./apps.md) |
| PATCH | `/api/projects/:projectId/app/data/:table/:id` | Update one row | `handleUpdateRow` `routes/app-admin.ts:L365-L412` | [apps](./apps.md) |
| GET | `/api/projects/:projectId/app/files/*` | Path-scoped app-file read | `handleGetAppFile` `routes/app-admin.ts:L248-L283` | [apps](./apps.md) |
| PUT | `/api/projects/:projectId/app/files/*` | Path-scoped app-file write | `handlePutAppFile` `routes/app-admin.ts:L285-L325` | [apps](./apps.md) |
| GET | `/api/projects/:projectId/app` | App manifest — tables/pages/endpoints/hooks/build | `handleAppManifest` `routes/app-admin.ts:L120` | [apps](./apps.md) |
| GET | `/api/apps` | Public store APP catalog; `{apps: []}` when unreachable | `handleListApps` `routes/apps.ts:L103-L112` | [apps](./apps.md) |
| POST | `/api/apps/install` | Install a catalog app (`{ok:false, diverged:true}` unless `force`) | `handleInstallApp` `routes/apps.ts:L185` | [apps](./apps.md) |
| GET | `/api/store/spaces` | Public store SPACE catalog; `{spaces: []}` when unreachable | `handleListStoreSpaces` `routes/store-spaces.ts:L126-L135` | [store-spaces](./store-spaces.md) |
| POST | `/api/store/spaces/install` | Install a space into `<root>/<projectId>/spaces/<spaceId>/` | `handleInstallStoreSpace` `routes/store-spaces.ts:L293` | [store-spaces](./store-spaces.md) |
| `*` | `/app/:projectId/*` | **Project-app pages** — built bundle + asset-manifest SPA fallback + CSP | `createPageServeHandler` `sdk/org/libs/cli/src/app/pages-serve.ts` (mounted `serve.ts:L306`) | [apps](./apps.md) |
| `*` | `/:projectId/api/*` | Root-mounted app API — **only when `LMTHING_GATEWAY_URL` is set** | `createAppApiHandler` (`serve.ts:L324`) | [apps](./apps.md) |
| `*` | `/:projectId/*` | Root-mounted app pages — **only when `LMTHING_GATEWAY_URL` is set** | `createPageServeHandler(…, '')` (`serve.ts:L325`) | [apps](./apps.md) |
| — | any other `/api/*` | `404 {"error":"unknown API route …"}` | inline `serve.ts:L361-L366` | — |
| — | anything else | Vite dev middleware (`LM_DEV_WEB`) else the static unified SPA | `serve.ts:L367-L369` | — |

All route-module paths above are relative to `sdk/org/libs/cli/src/server/`.

### Per-session sub-routes (via `* /api/sessions/:id/*`)

`handleSessionSubRoute` rewrites the path to `/api/<rest>` and hands it to `handleAgentApi` with a session-bound context; an unknown session id is `404` before the handoff `sdk/org/libs/cli/src/server/routes/sessions.ts#handleSessionSubRoute`. `?format=json` switches every GET from the text renderer to JSON `sdk/org/libs/cli/src/web/agent-api.ts:L244-L245`.

| Method | Path | Purpose | Source |
|---|---|---|---|
| GET | `/api/sessions/:id/help` | Text help for the agent API | `web/agent-api.ts:L251` |
| GET | `/api/sessions/:id/state` | `{lastSeq, rootId, nodes, asks}` | `web/agent-api.ts:L257` |
| GET | `/api/sessions/:id/node/<nodeId>` | Trace-node detail (`?tab=&limit=&offset=`) | `web/agent-api.ts:L269` |
| GET | `/api/sessions/:id/events` | Trace events (`?since=&type=&node=&limit=`) → `{events, lastSeq}` | `web/agent-api.ts:L284` |
| GET | `/api/sessions/:id/asks` | Pending asks | `web/agent-api.ts:L303` |
| POST | `/api/sessions/:id/message` | Send a user message `{content}` | `web/agent-api.ts:L311` |
| POST | `/api/sessions/:id/ask/<askId>` | Submit an `ask()` form value `{value}` | `web/agent-api.ts:L321-L328` |
| DELETE | `/api/sessions/:id/ask/<askId>` | Cancel a pending ask | `web/agent-api.ts:L329-L334` |
| POST | `/api/sessions/:id/ui` | Broadcast a `ui_control` action (the agent driving the UI) | `web/agent-api.ts:L338-L344` |
| — | anything else | `404 {"error":"unknown API route …"}` | `web/agent-api.ts:L346` |

Details and payload shapes → [./sessions.md](./sessions.md).

### WebSocket upgrades

WS endpoints are **not** in the `Router` — they are matched in the `upgrade` listener `sdk/org/libs/cli/src/server/serve.ts:L376-L387`:

| Endpoint | Purpose | Handler |
|---|---|---|
| `WS /api/terminals/:termId?command=` | One PTY per terminal tab; cwd = `effectiveLmthingRoot` | `handleTerminalWsUpgrade` `sdk/org/libs/cli/src/server/ws/terminal.ts:L24-L47` (matched by regex `serve.ts:L381-L385`) |
| `WS /api/ws?sessionId=<id>` | Agent event stream + RPC for one session | `handleAgentWsUpgrade` `sdk/org/libs/cli/src/server/ws/agent.ts#handleAgentWsUpgrade` |
| `WS /api/ws` (no `sessionId`) | Control socket (terminal multiplexing) used by `/computer` | `registerControlSocket` `sdk/org/libs/cli/src/server/ws/agent.ts#handleAgentWsUpgrade` |

Any other upgrade pathname is destroyed `sdk/org/libs/cli/src/server/ws/agent.ts#handleAgentWsUpgrade`.

---

## Worked example — create a session, drive it, read its trace

```bash
# 1. create (pod default port 8080)
curl -s -XPOST localhost:8080/api/sessions \
  -H 'content-type: application/json' \
  -d '{"projectId":"user","agentSlug":"thing"}'
# → 201 {"sessionId":"…"}                    routes/sessions.ts:L36

# 2. send a message (per-session catch-all → handleAgentApi POST /api/message)
curl -s -XPOST localhost:8080/api/sessions/<id>/message \
  -H 'content-type: application/json' -d '{"content":"hello"}'

# 3. read the trace as JSON
curl -s 'localhost:8080/api/sessions/<id>/events?format=json&since=0'

# 4. dispose
curl -s -XDELETE localhost:8080/api/sessions/<id>
```

---

## Gotchas

- **`PUT /api/env` is full-replace**, not a merge — it writes whatever `{content}` you send over the entire file and applies it to `process.env` `sdk/org/libs/cli/src/server/routes/env.ts#handleEnvPut`. Callers must GET-merge-PUT. Same for the bulk space-file `PUT`, which wipes the space dir first `sdk/org/libs/cli/src/server/routes/projects.ts#handlePutProjectSpaceFiles`.
- **`POST /api/restart` answers before it exits** — `200 {ok:true}` is written, then `process.exit(0)` fires 100 ms later `sdk/org/libs/cli/src/server/serve.ts:L143-L147`. Clients poll `GET /api/env` to detect the new process.
- **`GET /api/inbound/:path` is not routed.** Only `POST` is registered `sdk/org/libs/cli/src/server/serve.ts:L236`, yet the handler implements a provider `hub.challenge` GET branch `sdk/org/libs/cli/src/server/routes/webhooks.ts:L176`, `L275` and the gateway does forward GET handshakes to the pod at `${podBase}/api/inbound/${path}` `cloud/gateway/src/routes/inbound.ts:L194-L195`. As registered, such a GET falls into the unknown-`/api/*` JSON 404 `sdk/org/libs/cli/src/server/serve.ts:L361-L366` and never reaches the handshake branch.
- **Two anonymous inline handlers** (no module, no exported symbol): `POST /api/restart` and `POST /api/keepalive` `sdk/org/libs/cli/src/server/serve.ts:L143-L157`.
- **`routes/utils.ts` is not a route module** — it only exports `readBody` / `sendJson`. There is likewise no `routes/cron-emitter.ts`; `routes/cron-emitter.test.ts` tests emitter code that lives in `routes/hooks.ts`.
- **A `@emitter:<scope>:<name>` pseudo-slug** on the hook-run route is not a hook — it routes to `runNamedCronEmitter` `sdk/org/libs/cli/src/server/routes/hooks.ts:L418-L424`.
- **App-file routes are path-scoped**: only `database|pages|api|hooks|components|lib` dirs plus `package.json`/`tsconfig.json`; `.data/` and `types/` are `403` `sdk/org/libs/cli/src/server/routes/app-admin.ts:L60-L98`.
- **Store listing degrades to empty, never errors** — an unreachable store yields `{apps: []}` / `{spaces: []}` `sdk/org/libs/cli/src/server/routes/apps.ts#handleListApps`, `sdk/org/libs/cli/src/server/routes/store-spaces.ts#handleListStoreSpaces`.
- **`/api/projects/:projectId/app/*` (admin) is a different surface** from `/app/:projectId/api/*` (the app's own runtime). The first is Studio's management API; the second is what the browser and the agent's `apiCall` hit `sdk/org/libs/cli/src/server/routes/app-api.ts:L8-L20`.

---

## Sub-docs

[apps](./apps.md) · [projects](./projects.md) · [sessions](./sessions.md) · [spaces](./spaces.md) · [store-spaces](./store-spaces.md) · [hooks](./hooks.md) · [env](./env.md) · [fs](./fs.md) · [uploads](./uploads.md) · [budget](./budget.md) · [webhooks](./webhooks.md) · [misc](./misc.md)
