# REST — store spaces (`/api/store/spaces*`)

The pod endpoints that browse the store's **space** catalog and install one space into a project's own `spaces/` dir. Implemented in one module, `sdk/org/libs/cli/src/server/routes/store-spaces.ts` (`handleListStoreSpaces`, `handleInstallStoreSpace`, `handleListProjectIntegrations`), mounted by `sdk/org/libs/cli/src/server/serve.ts:271-287`.

The `/api/spaces` prefix is already taken by the space-sync route, which is why these live under `/api/store/spaces*` `sdk/org/libs/cli/src/server/routes/store-spaces.ts:14-16`. Unlike a project **app** install (`./apps.md`), a space install does no db boot and no page build — it is a single directory materialization `sdk/org/libs/cli/src/server/routes/store-spaces.ts:18-22`.

Index of all pod routes → [`./README.md`](./README.md).

## Routes

| Method | Path | Handler | Returns |
|---|---|---|---|
| `GET` | `/api/store/spaces` | `handleListStoreSpaces` `sdk/org/libs/cli/src/server/routes/store-spaces.ts:126-135` | `200 { spaces: CatalogSpace[] }` (`{ spaces: [] }` when the store is unreachable) |
| `POST` | `/api/store/spaces/install` | `handleInstallStoreSpace` `sdk/org/libs/cli/src/server/routes/store-spaces.ts:293-356` | `200 { ok:true, projectId, spaceId }` · `200 { ok:false, diverged:true, … }` · `400` · `404` |
| `GET` | `/api/projects/:projectId/integrations` | `handleListProjectIntegrations` `sdk/org/libs/cli/src/server/routes/store-spaces.ts:535-587` | `200 { integrations: InstalledIntegration[] }` |

Registration (`sdk/org/libs/cli/src/server/serve.ts:271-287` for the two store routes; `sdk/org/libs/cli/src/server/serve.ts:187` for `/integrations`).

## `GET /api/store/spaces`

Fetches `${storeUrl}/projects/manifest.json` and returns its `spaces[]` array `sdk/org/libs/cli/src/server/routes/store-spaces.ts:84-89`. The store base is `LM_STORE_URL` or `https://lmthing.store` `sdk/org/libs/cli/src/server/routes/store-spaces.ts:42-45` — **there is no local catalog in the pod** `sdk/org/libs/cli/src/server/routes/store-spaces.ts:40-41`. A failed fetch degrades to `{ spaces: [] }` rather than erroring the request `sdk/org/libs/cli/src/server/routes/store-spaces.ts:128-133`.

A `CatalogSpace` carries `id/title/description/icon/tags/kind/settings`, the full download list `files[]`, and the lifted producer/consumer surface `events`/`functions`/`agents`/`inbound` (generated at store build time so an agent can fit-check an install from catalog data alone) `sdk/org/libs/cli/src/server/routes/store-spaces.ts:63-81`.

The same module exports the agent-facing halves of the catalog readers: `searchCatalog(query?)` (case-insensitive substring over id/title/description/tags/kind; empty query ⇒ whole catalog) and `inspectCatalogSpace(spaceId)` `sdk/org/libs/cli/src/server/routes/store-spaces.ts:100-120`. These **throw** when the store is unreachable (the shared `fetchStoreSpaces` throws on a non-OK manifest response) — unlike the listing route, so the agent's yield surfaces a clear retryable error `sdk/org/libs/cli/src/server/routes/store-spaces.ts:85-86,96-99`.

## `POST /api/store/spaces/install`

Body: `{ spaceId: string, projectId?: string, force?: boolean }` `sdk/org/libs/cli/src/server/routes/store-spaces.ts:171-175`.

- `projectId` defaults to `DEFAULT_PROJECT_ID` = `'user'` `sdk/org/libs/cli/src/server/routes/store-spaces.ts:312-314` · `sdk/org/libs/cli/src/server/projects.ts:22`.
- `spaceId` and `projectId` are both validated with `safeProjectId` (non-empty, ≤200 chars, no `/`, `\`, NUL, not `.`/`..`, and `^[a-zA-Z0-9_-]+$`) `sdk/org/libs/cli/src/server/projects.ts:58-65`, and `projectId` must not be in `RESERVED_PROJECT_IDS` (`system`, `api`, `assets`, `install`) `sdk/org/libs/cli/src/server/routes/store-spaces.ts:307-318` · `sdk/org/libs/cli/src/server/projects.ts:39-44`.
- Invalid JSON body ⇒ `400 { error: 'invalid JSON body' }` `sdk/org/libs/cli/src/server/routes/store-spaces.ts:299-305`; no project root configured ⇒ `404 { error: 'no project root configured' }` `sdk/org/libs/cli/src/server/routes/store-spaces.ts:320-323`.

The route is a thin face over the **pure** engine `installStoreSpace(opts)` `sdk/org/libs/cli/src/server/routes/store-spaces.ts:215-280`, which returns a discriminated result the route maps to statuses `sdk/org/libs/cli/src/server/routes/store-spaces.ts:192-198,333-346`.

```bash
curl -sX POST http://localhost:8080/api/store/spaces/install \
  -H 'content-type: application/json' \
  -d '{"spaceId":"telegram","projectId":"user"}'
# → {"ok":true,"projectId":"user","spaceId":"telegram"}
```

### Install engine (`installStoreSpace`)

1. **Validate** ids; a missing target project dir ⇒ `{ ok:false, status:404 }` `sdk/org/libs/cli/src/server/routes/store-spaces.ts:217-227`.
2. **Download into staging** — `mkdtemp` + `downloadStoreSpace`, which fetches every path in the catalog entry's `files[]` from `${store}/spaces/<id>/<rel>`; unsafe (`..`, absolute, NUL, empty segment) paths and any resolved escape from the staging dir are rejected, and any non-OK fetch throws `sdk/org/libs/cli/src/server/routes/store-spaces.ts:145-167,234-245`. A catalog miss / download failure ⇒ `{ ok:false, status:404 }`.
3. **Divergence guard** — see below.
4. **Materialize** into `<lmthingRoot>/<projectId>/spaces/<spaceId>/` by `rm -rf` + `cpSync` of the staging dir; nothing outside that single space dir is touched `sdk/org/libs/cli/src/server/routes/store-spaces.ts:229,363-367`. A materialize failure ⇒ `{ ok:false, status:400 }` `sdk/org/libs/cli/src/server/routes/store-spaces.ts:269-274`.
5. **Write the install marker** `.installed.json` = `{ spaceId, sourceHash, installedAt }` inside the space dir `sdk/org/libs/cli/src/server/routes/store-spaces.ts:271,415-435`.
6. Staging is always cleaned up in `finally` `sdk/org/libs/cli/src/server/routes/store-spaces.ts:277-279`.

The engine **validates its own inputs and never throws** (agent-supplied ids reach it directly) and deliberately does **not** republish or notify — each caller owns its post-install effects `sdk/org/libs/cli/src/server/routes/store-spaces.ts:212-214`.

### Pristine vs diverged (the overwrite guard)

`hashSpaceDir(dir)` is a sha256 over sorted `relpath + bytes`, excluding `.data`/`types`/`node_modules` and the `.installed.json` marker itself `sdk/org/libs/cli/src/server/routes/store-spaces.ts:369-411`. On an existing destination:

- destination hash **equals** the freshly-staged (shipped) hash ⇒ silent re-sync;
- destination hash differs but **matches the marker's `sourceHash`** (pristine — unchanged since the last install) ⇒ re-sync;
- otherwise the copy has **local edits** ⇒ held back with `{ ok:false, diverged:true, projectId, spaceId, message }` unless `force:true` `sdk/org/libs/cli/src/server/routes/store-spaces.ts:248-267`.

The HTTP route returns divergence as **`200`**, not an error status, so it is a UI branch rather than a failure `sdk/org/libs/cli/src/server/routes/store-spaces.ts:337-346`:

```json
{
  "ok": false,
  "diverged": true,
  "projectId": "user",
  "spaceId": "telegram",
  "message": "\"telegram\" in project \"user\" has local edits that diverge from the store template — pass force:true to overwrite them."
}
```

The web installer relies on exactly that shape: `POST {pod}/api/store/spaces/install { spaceId, projectId, force }` `sdk/org/apps/web/src/routes/install.tsx:269-285` and `classifyInstallResponse(res.ok, res.status, body)` turns a 200 + `diverged:true` into the "Upgrade & replace files" branch (a re-POST with `force:true`) `sdk/org/apps/web/src/routes/install.tsx:71-79`.

### Post-install effects

Two layers, deliberately split:

- **In the route** — on success it calls `onInstalled(projectId, spaceId)` and then best-effort `republishWebhookManifest(lmthingRoot)` (awaited, error-swallowed, and a no-op without `LMTHING_GATEWAY_URL` + `LMTHING_COMPUTE_JWT`) so a bundled `triggers:` agent registers with the gateway `sdk/org/libs/cli/src/server/routes/store-spaces.ts:348-354,439-456`.
- **In the integrator's callback** (`serve.ts`) — drop the project's cached page build, fire `manager.republish()` (regenerates the webhook manifest + crontab and drops the emitter scan cache so new `events/*.ts` go live without a pod restart), and emit the internal `space.installed` signal `sdk/org/libs/cli/src/server/serve.ts:272-287`.

## Relation to the `installSpace()` global

The agent can install a space itself. **Both paths run the same pure engine** — `installStoreSpace` was factored out of the route closure precisely so the HTTP route and the agent's yield resolver share one code path `sdk/org/libs/cli/src/server/routes/store-spaces.ts:200-205`.

```
agent  installSpace(spaceId)  ──yield──▶ routeCommonYield
                                          │ consent gate (host)
                                          ▼
                                       StoreResolver.install ──▶ installStoreSpace ◀── POST /api/store/spaces/install
                                          │                                              (handleInstallStoreSpace)
                                          ├─ live-register into dynamicSpaces (loadSpace)
                                          └─ storeResolver.republish?()
```

- The global is created in `sdk/org/libs/core/src/globals/store.ts:109-122` (`createInstallSpaceGlobal`, yield kind `installSpace`) and gated on the bare capability `store:install` at injection `sdk/org/libs/core/src/exec/bootstrap.ts:195-198` · `sdk/org/libs/core/src/spaces/capabilities.ts:37-38`, with a matching DTS fragment (`STORE_INSTALL_DTS`, registered under `store:install` in `CAPABILITY_DTS_FRAGMENTS`) so an ungranted call fails typecheck `sdk/org/libs/core/src/typecheck/library-dts.ts:262-263,286`.
- The pod resolver is `createStoreResolver` `sdk/org/libs/cli/src/server/store-resolver.ts:39-74`, folded into `AppGlobalImpls.store` per project by the SessionManager `sdk/org/libs/cli/src/server/session-manager.ts:404-425`. It calls `installStoreSpace` **without `force`** — the agent path always respects the divergence guard; overwriting local edits stays a deliberate HTTP/UI action `sdk/org/libs/cli/src/server/store-resolver.ts:43-51`.
- The router then does what the HTTP route does not: **live-registers** the installed dir into the shared `dynamicSpaces` map (`registerSpace` mechanics) so `delegate(spaceKey, agentSlug, …)` reaches it in the same session, then calls `republish()`. Order is `consent → install → register → republish` `sdk/org/libs/core/src/eval/yield-router.ts:279-331`. If registration fails the files are still installed and the result is `ok:true` with the registration error attached `sdk/org/libs/core/src/eval/yield-router.ts:312-317`.
- Divergence is returned to the agent as a **value**, not a throw, so it can relay the message verbatim `sdk/org/libs/core/src/eval/yield-router.ts:290-302`.
- Missing resolver (no store wiring / no project) ⇒ `installSpace is not available here: no store resolver configured` `sdk/org/libs/core/src/eval/yield-router.ts:285-287`.

Global-side detail → [`../../runtime-globals/store-and-consent.md`](../../runtime-globals/store-and-consent.md).

## The consent gate

`installSpace` is the **only** consent-marked yield kind today `sdk/org/libs/core/src/globals/consent.ts:54`:

```ts
export const CONSENT_MARKED_YIELD_KINDS: ReadonlySet<string> = new Set(['installSpace']);
```

`routeCommonYield` runs `enforceConsent` **before the switch**, so no resolver can execute unapproved `sdk/org/libs/core/src/eval/yield-router.ts:135-145`. `enforceConsent` **fails closed**: no prompter ⇒ throw `"<fn>" requires user consent — run it from an interactive session (this context has no user to ask, so the call is refused)`; a declined card ⇒ `consent denied: the user declined "<fn>" — do not retry it unless the user explicitly asks for it` `sdk/org/libs/core/src/globals/consent.ts:75-100`. The prompter rides `renderHost.ask` as a `ConsentCard` descriptor `sdk/org/libs/core/src/globals/consent.ts:180-193` and is wired **only for interactive sessions** — headless runs, forks, delegates and hooks get none `sdk/org/libs/cli/src/server/session-manager.ts:448-452`.

Consequence for this endpoint: **the HTTP route has no consent gate of its own** — it is the human's own action (the `/install` page, `sdk/org/apps/web/src/routes/install.tsx:269-285`), whereas the agent's `installSpace()` must first surface a card the user approves. In the shipped system spaces this is the split between discovery and install: `system-store`'s `finder` agent holds only `store:read` and explicitly "does NOT install — you recommend; THING installs behind a consent card" `sdk/org/libs/core/system-spaces/system-store/agents/finder/instruct.md:1-16`, while THING holds both `store:read` and `store:install` `sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md:6-8`.

### Auth: none in the pod, JWT at the edge

Neither this route module nor the pod server authenticates the caller — `createServer` hands every request straight to the `Router`, with no auth middleware anywhere in the chain `sdk/org/libs/cli/src/server/serve.ts:343-370`. Authentication lives at the **Envoy edge**, which is also what makes the request reach *your* pod at all:

- the `computer.*` host's `/api` prefix is an `HTTPRoute` (`computer-api-proxy`) onto a `DynamicResolver` per-user backend `devops/argocd/envoy/computer-routes.yaml:27-58`;
- a `SecurityPolicy` on that route validates the gateway-issued HS256 JWT (local JWKS from the `gateway-jwt-jwks` ConfigMap) and projects its `sub` claim into an `x-user-id` header `devops/argocd/envoy/computer-policies.yaml:120-152`;
- a Lua `EnvoyExtensionPolicy` then **401s** a request with no `x-user-id` claim, rejects a non-slug id with 400, and rewrites the upstream host to `lmthing.user-<id>.svc.cluster.local:8080` `devops/argocd/envoy/computer-policies.yaml:38-59`.

So a caller can only ever reach the pod of the user its token names; the browser attaches that token via `@lmthing/auth`'s `authFetch` (`Authorization: Bearer <token>`, with a 401-refresh retry) `sdk/org/libs/auth/src/client.ts:174-193`, which is what the `/install` page uses for this POST `sdk/org/apps/web/src/routes/install.tsx:269-285`. Under local `lmthing serve` there is no edge and therefore no auth — the pod is protected only by its network position.

## `GET /api/projects/:projectId/integrations`

Scans `<root>/<projectId>/spaces/*/package.json` and returns the entries whose `lmthing.kind === 'integration'`, each as `{ spaceId, title, icon, tags, settings, readme, missingRequired, configured }`, id-sorted `sdk/org/libs/cli/src/server/routes/store-spaces.ts:462-475,535-587`. A missing/malformed `package.json` is skipped, not fatal `sdk/org/libs/cli/src/server/routes/store-spaces.ts:552-559`.

`missingRequired` is the settings-schema's `required[]` env-var **NAMES** that are unset or empty in `process.env` — **names only, never values** `sdk/org/libs/cli/src/server/routes/store-spaces.ts:479-491`; `configured` is just `missingRequired.length === 0` `sdk/org/libs/cli/src/server/routes/store-spaces.ts:572-581`. The same logic backs the agent-facing `integrationStatus(spaceId)` global via `integrationStatusFor`, so the agent's view and the UI badge cannot diverge `sdk/org/libs/cli/src/server/routes/store-spaces.ts:493-518`.

Secrets themselves are written to pod env through the gateway, not here — see the chat/studio Integrations tab ([`../../chat/features.md`](../../chat/features.md)).

## Tests

`sdk/org/libs/cli/src/server/store-spaces.test.ts` covers the catalog listing (including the unreachable-store `[]` degradation), the install route (404 for an unknown space, path-traversal refusal, 404 for a missing project, default-project install, pristine re-sync, `diverged:true` hold-back preserving the edit, `force:true` overwrite, `onInstalled` firing) and the pure engine + catalog helpers (incl. `searchCatalog` throwing on an unreachable store) `sdk/org/libs/cli/src/server/store-spaces.test.ts:206-418`, plus the integrations listing + `integrationStatusFor` (missing-required names, `configured:true` once the env var is set, unsafe-id rejection) `sdk/org/libs/cli/src/server/store-spaces.test.ts:420-527`.
