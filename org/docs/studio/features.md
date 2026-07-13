# Studio — features

What the `/studio` surface of the unified SPA (`sdk/org/apps/web`) actually does, and which pod / gateway endpoint each feature calls. Route-to-URL mapping lives in [routes.md](./routes.md); the per-view breakdown in [views.md](./views.md).

Studio is an authoring IDE over **spaces** (agents, knowledge, tasklists, functions, components — see [../format/space/README.md](../format/space/README.md)) plus a project-app admin section. Every data call goes to the user's compute pod at `COMPUTER_BASE_URL` (same-origin in prod and under `pnpm thing`) `sdk/org/apps/web/src/lib/config.ts` — `COMPUTER_BASE_URL`; pod readiness/upgrade goes to the cloud gateway at `CLOUD_BASE_URL` `sdk/org/apps/web/src/lib/config.ts` — `CLOUD_BASE_URL`.

---

## 1. Pod readiness — `PodEnsureGate`

The `/studio` layout renders nothing until the user's pod is serving: it wraps the whole subtree in `PodEnsureGate` and then `AppProvider` (which owns the pod REST transport) `sdk/org/apps/web/src/routes/studio/route.tsx:11-30`.

The gate is shared verbatim with `/chat`, `/computer` and `/apps` `sdk/org/apps/web/src/lib/gates.tsx#PodEnsureGate`. Its sequence:

| Step | Call | Where |
|---|---|---|
| Wake the pod | `POST {CLOUD}/api/compute/ensure` | `sdk/org/apps/web/src/lib/gates.tsx#ensurePod` |
| Latest CI image tag | `GET {CLOUD}/api/compute/version` | `sdk/org/apps/web/src/lib/gates.tsx#fetchLatestTag` |
| Poll boot progress (~45 s cap) | `GET {CLOUD}/api/compute/status` | `sdk/org/apps/web/src/lib/gates.tsx#pollUntilReady` |
| Wait for the pod's own Envoy edge | `GET /api/sessions` (same-origin) until the status is not 503/504 | `sdk/org/apps/web/src/lib/gates.tsx#waitForPodEdge` |
| Offer an upgrade (blocking card on boot, banner while live, 60 s poll) | `POST {CLOUD}/api/compute/upgrade` then poll `status` for the expected tag (~2 min cap) | `sdk/org/apps/web/src/lib/gates.tsx#upgradePod`, `:161-185`, `:197` |
| Keep-warm while the tab is visible (every 5 min) | `POST /api/keepalive` | `sdk/org/apps/web/src/lib/gates.tsx:339`, `:202` |

The edge probe exists because the gateway reports `ready` on `readyReplicas>0`, which precedes Envoy actually routing to the woken pod — mounting Studio then would race its first `GET /api/projects` and render empty `sdk/org/apps/web/src/lib/gates.tsx:115-131`. Pod-embedded and local runs skip the gate entirely `sdk/org/apps/web/src/lib/gates.tsx:219`.

Endpoint reference: [../cli-api/rest/sessions.md](../cli-api/rest/sessions.md) (the `/api/sessions` probe), [../cli-api/rest/misc.md](../cli-api/rest/misc.md) (`/api/keepalive`).

---

## 2. Project list — including the synthetic `system` project

The sidebar's project list comes from `useProjects()` → `PodTransport.listProjects()` → `GET /api/projects` `sdk/org/libs/state/src/lib/pod/transport.ts#PodTransport.listProjects`, `sdk/org/libs/ui/src/studio/shell/studio-app-sidebar/index.tsx:33`. Create and delete are wired to the same transport `sdk/org/libs/ui/src/studio/shell/studio-app-sidebar/index.tsx:55-63`:

- create → `POST /api/projects {name}` → `{ id }` `sdk/org/libs/state/src/lib/pod/transport.ts#PodTransport.createProject`
- delete → `DELETE /api/projects/:id` (204) `sdk/org/libs/state/src/lib/pod/transport.ts#PodTransport.deleteProject`

**The `system` project is synthetic.** The pod's `listProjects` skips the on-disk `system/` directory in the normal scan and *prepends* `{ id: 'system', name: 'System', createdAt: 0 }` whenever `<root>/system/spaces/` is non-empty `sdk/org/libs/cli/src/server/projects.ts#listProjects`. It maps to `<root>/system/`, whose `spaces/` subdir holds the system spaces — because that matches the generic `<root>/<projectId>/spaces/<id>` shape, Studio browses and edits them through the *same* `/api/projects/:id/spaces/...` routes as any other project, with no client-side special case `sdk/org/libs/cli/src/server/projects.ts:10-16`.

Guards worth knowing:

- `system` cannot be deleted (`deleteProject` throws) `sdk/org/libs/cli/src/server/projects.ts#deleteProject`, and the default `user` project is refused at the route layer with 400 `sdk/org/libs/cli/src/server/routes/projects.ts#handleDeleteProject`.
- `RESERVED_PROJECT_IDS = { system, api, assets, install }` — ids that would shadow reserved lmthing.app URL paths `sdk/org/libs/cli/src/server/projects.ts#RESERVED_PROJECT_IDS`.
- Studio's landing route redirects to the project with id `user`, falling back to `projects[0]` `sdk/org/apps/web/src/routes/studio/index.tsx#StudioIndex`.
- The `/install` space-installer filters `system` out of its target-project picker `sdk/org/apps/web/src/routes/install.tsx:252`.

Endpoint reference: [../cli-api/rest/projects.md](../cli-api/rest/projects.md).

---

## 3. Space editing — the VFS + debounced whole-space PUT

**No Studio editor calls a save endpoint.** Entering a space mounts `SpaceProvider`, which hydrates the space's whole file map once and then writes it back on a debounce:

- hydrate: `GET /api/projects/:id/spaces/:spaceId/files` → `Record<relPath, content>`, merged into the in-memory `AppFS` (never wiping newer local edits) `sdk/org/libs/state/src/lib/contexts/SpaceContext.tsx:91-105`
- write-back: every change under the space prefix is coalesced into a single **wipe-and-rewrite** `PUT /api/projects/:id/spaces/:spaceId/files { files }` after `SAVE_DEBOUNCE_MS = 1500` (plus a best-effort flush on unmount) `sdk/org/libs/state/src/lib/contexts/SpaceContext.tsx#SAVE_DEBOUNCE_MS`, `:122-170`
- both directions filter with `isRunnableSpaceFile` — anything under a `conversations/` dir and any `.env*` basename is never round-tripped `sdk/org/libs/state/src/lib/pod/transport.ts#isRunnableSpaceFile`, `:150-159`

The space list in the sidebar comes from `ProjectProvider` → `GET /api/projects/:id/spaces` `sdk/org/libs/state/src/lib/pod/transport.ts#PodTransport.listSpaces`.

So every editor below is just "write a path into `spaceFS`":

| Editor | Files it writes | Source |
|---|---|---|
| Agent builder | `agents/<slug>/instruct.md` only — title, body, `actions[]`, `defaultAction`, `functions[]`, `components[]`, `knowledge[]`, `canDelegateTo[]` | `sdk/org/libs/ui/src/studio/agent/builder/agent-builder/index.tsx:3-4` |
| New agent (sidebar `+`) | prompts for a name, writes `agents/agent-<slug>/instruct.md` via `serializeAgentInstruct`, then navigates to the agent page | `sdk/org/libs/ui/src/studio/shell/studio-layout/index.tsx:60-76` |
| Knowledge | discovers fields from `knowledge/*/*/index.md`; the field route id is encoded `<domain>---<field>` | `sdk/org/apps/web/src/routes/studio/$projectId/$spaceId/knowledge/index.tsx:77`, `:91`, `:109-117` |
| New knowledge domain | writes `knowledge/<slug>/<slug>/index.md` with a `type`/`variable` frontmatter | `sdk/org/libs/ui/src/studio/shell/studio-layout/index.tsx:78-91` |
| Tasklists | form editor over `tasklists/<name>/…` (VFS-only, no pod calls) | `sdk/org/libs/ui/src/studio/workflow/workflow-editor/index.tsx` — `TasklistEditor` |
| Functions | `functions/<name>.ts` create/rename/delete/edit; flags the `@consent` pragma with a browser-safe mirror of core's `functionRequiresConsent` | `sdk/org/libs/ui/src/studio/functions/functions-editor/index.tsx#functionRequiresConsent`, `:177`, `:259` |
| Components | `components/view/<Name>.tsx` (for `display()`) and `components/form/<Name>.tsx` (for `ask()`) | `sdk/org/libs/ui/src/studio/component-editor/index.tsx:5-6` |
| Raw | read-only tree over `useGlobRead('**/*')` + a `<pre>` viewer | `sdk/org/apps/web/src/routes/studio/$projectId/$spaceId/raw/index.tsx:95-97` |

The space rail's collapsible sections are Knowledge / Agents / Tasklists / Functions / Components `sdk/org/libs/ui/src/studio/shell/studio-sidebar/index.tsx:171,199,227,255,282`.

File-format reference: [../format/space/README.md](../format/space/README.md). Endpoint reference: [../cli-api/rest/projects.md](../cli-api/rest/projects.md) (the `/spaces/:spaceId/files` routes) and [../cli-api/rest/spaces.md](../cli-api/rest/spaces.md) (`POST /api/spaces`).

---

## 4. Running a space (agent chat)

`…/agent/$agentId/chat` runs the space **as currently edited** — it does not wait for the debounced save. It reads the VFS with `useGlobRead('**/*')`, drops non-runnable files, then:

1. `POST {CLOUD}/api/compute/ensure` (phase `provisioning`) `sdk/org/apps/web/src/routes/studio/$projectId/$spaceId/agent/$agentId/chat/index.tsx:15-27`, `:76-77`
2. `ReplRpcClient.syncSpace` → `POST /api/spaces { name, files }` → `{ spaceDir }` (phase `syncing`) `sdk/org/libs/ui/src/chat/client/rpc-client.ts#ReplRpcClient.syncSpace`
3. `ReplRpcClient.createSession` → `POST /api/sessions { spaceDir, agentSlug }` (phase `starting`) `sdk/org/libs/ui/src/chat/client/rpc-client.ts#ReplRpcClient.createSession`
4. stream over `WS /api/ws?sessionId=…&access_token=…`; user actions go to `POST /api/sessions/:id/message` and `POST|DELETE /api/sessions/:id/ask/:askId` `sdk/org/libs/ui/src/chat/client/rpc-client.ts#ReplRpcClient.connect`, `:122`, `:130`, `:138`

The space name is slugified to a single safe segment because the sync endpoint rejects path separators `sdk/org/apps/web/src/routes/studio/$projectId/$spaceId/agent/$agentId/chat/index.tsx:54-59`. Auto-start waits until the VFS has actually hydrated, otherwise the first run would sync an empty space `…/chat/index.tsx:105-113`. A `↻ Re-sync & restart` button re-runs the whole sequence `…/chat/index.tsx:161-168`.

Endpoint reference: [../cli-api/rest/spaces.md](../cli-api/rest/spaces.md), [../cli-api/rest/sessions.md](../cli-api/rest/sessions.md).

---

## 5. The THING dock

Inside a **space** route, the layout passes a `ThingDock` as `StudioLayout`'s `rightPanel` `sdk/org/apps/web/src/routes/studio/$projectId/$spaceId/route.tsx:62-72`. The dock is an `AgentChatPanel` targeting `{ mode: 'agentOnly', agentSlug: 'thing' }` — no space sync is needed, because the pod merges the system spaces at session runtime `sdk/org/apps/web/src/routes/studio/$projectId/$spaceId/route.tsx:36-59`. Its token getter best-effort POSTs `{CLOUD}/api/compute/ensure` before handing over the bearer `…/$spaceId/route.tsx:39-50`.

It is a **toggle, not always-on**: the shell keeps `studio-shell.thing.open` (default `false`) and renders a 400 px right-hand dock only when both a `rightPanel` was supplied and the toggle is on `sdk/org/libs/ui/src/studio/shell/studio-shell/index.tsx:72`, `:129-145`. The toggle lives in the space rail's footer `sdk/org/libs/ui/src/studio/shell/studio-shell/index.tsx:106-107`.

> The root `CLAUDE.md` describes an "always-on right-side THING chat dock". Verified against the code: it is off by default and only exists on `/studio/$projectId/$spaceId/*` routes — the project landing and the project-app tabs have no dock. A standalone full-page THING chat exists at `/studio/thing` `sdk/org/apps/web/src/routes/studio/thing/index.tsx:133-161`.

The panel itself creates a session with `POST /api/sessions` and streams over `WS /api/ws` exactly like §4 `sdk/org/libs/ui/src/chat/components/AgentChatPanel.tsx` — `AgentChatPanel`.

Endpoint reference: [../cli-api/rest/sessions.md](../cli-api/rest/sessions.md).

---

## 6. Project settings — Integrations

`/studio/$projectId/settings` renders `ProjectSettingsView`, which currently hosts one section, **Integrations** — it *configures* already-installed integration spaces; installing happens from the store `sdk/org/libs/ui/src/studio/shell/project-settings-view/index.tsx:1-12`.

Flow:

1. `GET {POD}/api/projects/:id/integrations` → the installed integration spaces, each with a `settings` JSON Schema, icon, tags and README `sdk/org/libs/ui/src/studio/shell/project-settings-view/index.tsx:75-79`. Served by the pod's `handleListProjectIntegrations` `sdk/org/libs/cli/src/server/serve.ts:187`.
2. `GET {CLOUD}/api/compute/env` prefills the values — the schema's property keys **are** pod env-var names `sdk/org/libs/ui/src/studio/shell/project-settings-view/index.tsx:93-99`.
3. `SettingsSchemaForm` renders the fields (`format:'password'` masked) `sdk/org/libs/ui/src/studio/integrations/SettingsSchemaForm.tsx` — `SettingsSchemaForm`.
4. Save is a **GET-merge-PUT**: re-read `/api/compute/env`, overlay only this page's keys, `PUT { vars }` — because the PUT replaces the whole var set `sdk/org/libs/ui/src/studio/shell/project-settings-view/index.tsx:113-125`. Saving restarts the pod (the button is labelled "Save & Restart Pod").

The same mechanism backs the Chat surface's Integrations tab; see [../chat/features.md](../chat/features.md).

Endpoint reference: [../cli-api/rest/store-spaces.md](../cli-api/rest/store-spaces.md) (`/api/projects/:id/integrations`), [../cli-api/rest/env.md](../cli-api/rest/env.md).

---

## 7. Installing a catalog app (or an integration space)

Installing is done from the **top-level `/install` route** — not under `/studio` and not under `/apps`. It lives at the top level because on lmthing.app the gateway proxies `/app/*` straight to the pod, so only the static shell at `/` can serve a page that self-authenticates and calls the pod `sdk/org/apps/web/src/routes/install.tsx:7-23`. `beforeLoad` stashes the intent in `sessionStorage` (`lmthing_pending_install` / `lmthing_pending_install_space`) so a store → install → sign-in round trip is resumed after the SSO callback `sdk/org/apps/web/src/routes/install.tsx#Route`.

**`/install?appId=<id>` — a project-app.** Auto-POSTs `{POD}/api/apps/install { appId, force }` and, on success, opens `{COMPUTER}{APP_PATH_PREFIX}/<projectId>/` after setting the pod-session cookie `sdk/org/apps/web/src/routes/install.tsx:119-128`, `:141-146`. Pod-side: `POST /api/apps/install` (with `GET /api/apps` listing the catalog) `sdk/org/libs/cli/src/server/serve.ts:258-265`; on (re)install the server drops the cached page build so the freshly-hashed assets are served `sdk/org/libs/cli/src/server/serve.ts:255-265`.

**`/install?spaceId=<id>` — an integration space.** Loads `GET {POD}/api/projects` for the target picker (excluding `system`, defaulting to `user`) `sdk/org/apps/web/src/routes/install.tsx:249-256`, then `POST {POD}/api/store/spaces/install { spaceId, projectId, force }` `sdk/org/apps/web/src/routes/install.tsx:273-279` (pod route: `sdk/org/libs/cli/src/server/serve.ts:271-274`). On success it hands off to **Studio project settings** (`/studio/<project>/settings`, §6) to add the token `sdk/org/apps/web/src/routes/install.tsx#studioSettingsUrl`, `:345-351`.

**The divergence branch is not an error.** Both pod endpoints answer HTTP 200 with `{ ok:false, diverged:true }` when the destination already has local edits — the pod held the install back rather than clobber them. `classifyInstallResponse` (pure, exported, unit-tested) maps that to the "Upgrade & replace files" / "Reinstall & replace files" state, which re-POSTs with `force:true`:

```ts
export function classifyInstallResponse(
  httpOk: boolean, httpStatus: number,
  body: (InstalledInfo & { ok?: boolean }) | null,
): State {
  if (httpOk && body?.ok) return { status: 'done', info: body }
  if (httpOk && body?.diverged) return { status: 'diverged', info: body }
  return { status: 'error', message: body?.message ?? `Install failed (HTTP ${httpStatus}).` }
}
```
`sdk/org/apps/web/src/routes/install.tsx#classifyInstallResponse`

Endpoint reference: [../cli-api/rest/apps.md](../cli-api/rest/apps.md), [../cli-api/rest/store-spaces.md](../cli-api/rest/store-spaces.md), [../cli-api/rest/projects.md](../cli-api/rest/projects.md).

---

## 8. Project-app admin (`/studio/$projectId/app`)

Project-scoped, **not** space-scoped: it renders its own chrome and tab bar (`Manifest · Data · Files · Preview`) instead of `StudioLayout`, so it has no space rail and no THING dock `sdk/org/apps/web/src/routes/studio/$projectId/app/route.tsx:12-25`.

All four tabs speak the pod's **reserved** management API under `/api/projects/<id>/app/*` (distinct from the app's *own* `/app/<project>/api/*`), through `authFetch` (bearer + 401-refresh retry) `sdk/org/apps/web/src/routes/studio/$projectId/app/-lib/appApi.ts:1-13`, `:40-42`:

| Tab | Calls | Client |
|---|---|---|
| Manifest (tables, pages, endpoints, hooks, build) | `GET …/app`; `POST …/app/build` (Rebuild); `POST /api/projects/:id/hooks/:slug/run` ("Run now") | `…/app/-lib/appApi.ts:75`, `:111`, `:113-116` |
| Data | `GET …/app/data/:table?page&pageSize`; `PATCH …/app/data/:table/:id` | `…/app/-lib/appApi.ts:77-92` |
| Files | `GET …/app/files/<path>`; `PUT …/app/files/<path> { content }` | `…/app/-lib/appApi.ts:94-107` |
| Preview | same-origin iframe of `{COMPUTER}/app/<project>/` | `sdk/org/apps/web/src/routes/studio/$projectId/app/preview/index.tsx:20-24` |

Server-side mounts: `sdk/org/libs/cli/src/server/serve.ts:240-246` (build/data/files/manifest) and `:222` (hook run). The Files tab is **path-scoped** on the pod: only `database|pages|api|hooks|components|lib` dirs plus `package.json`/`tsconfig.json` are writable, and `.data/` and `types/` are 403 `sdk/org/libs/cli/src/server/routes/app-admin.ts:60-64`, `:93-101` — a refused write surfaces as the save error.

The preview is deliberately **not** sandboxed away from same-origin: the served pages' strict CSP is the control, not the iframe boundary, and the preview must be byte-identical to prod serving `sdk/org/apps/web/src/routes/studio/$projectId/app/preview/index.tsx:8-19`.

App-layer file formats: [../format/project/api/README.md](../format/project/api/README.md) · [../format/project/pages/README.md](../format/project/pages/README.md). Endpoint reference: [../cli-api/rest/apps.md](../cli-api/rest/apps.md), [../cli-api/rest/hooks.md](../cli-api/rest/hooks.md).

---

## 9. Known gaps (do not document these as working features)

- **Space settings is a stub.** `/…/settings/env` and `/…/settings/packages` render forms whose buttons only set a status string / a timestamp — the Environment "Load"/"Save" buttons write nothing `sdk/org/libs/ui/src/studio/shell/settings-view/index.tsx:128-129`, and "Save package.json" only `JSON.parse`s the draft, it never writes to the VFS `sdk/org/libs/ui/src/studio/shell/settings-view/index.tsx:157-165`. (`StudioLayout` redirects a bare `…/settings` to `…/settings/env` `sdk/org/libs/ui/src/studio/shell/studio-layout/index.tsx:54-58`.)
- **Conversations section is hardcoded.** The space rail always shows `Conversations (0)` / "No conversations yet." `sdk/org/libs/ui/src/studio/shell/studio-sidebar/index.tsx:301-312`, and `…/agent/$agentId/chat/$conversationId` renders only the ids `sdk/org/apps/web/src/routes/studio/$projectId/$spaceId/agent/$agentId/chat/$conversationId/index.tsx` — `ConversationPage`.
- **"Create Tasklist" is mis-wired** — the sidebar button calls `onCreateAgent` `sdk/org/libs/ui/src/studio/shell/studio-sidebar/index.tsx:241`.
