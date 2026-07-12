# `/studio` — the authoring surface

Studio is the project & space IDE of the unified SPA (`sdk/org/apps/web`). It is where you **browse the projects on your pod**, **author spaces** (agents, tasklists, knowledge, functions, components), **administer a project's app layer** (data model, pages, endpoints, hooks, build), and **configure installed integrations** — with a **THING chat dock** available on the right of every space route.

It is not a separate app: `/studio` is a client-side route tree of the same Vite SPA that serves `/chat` and `/computer`; the hostname `lmthing.studio` simply redirects `/` → `/studio` (`sdk/org/apps/web/src/routes/index.tsx:L5-L24`). Unknown hosts (localhost, the `*.test` proxy) also fall back to `/studio` (`sdk/org/apps/web/src/routes/index.tsx:L23`).

The same route tree additionally hosts the two **app-distribution** routes — the `/apps` launcher (lmthing.app) and the top-level `/install` installer — because they share Studio's shell (pod gate + pod transport) and hand off to Studio for configuration (`sdk/org/apps/web/src/routes/apps/route.tsx:L24-L67`, `sdk/org/apps/web/src/routes/install.tsx:L24-L44`).

- Full file→URL map: **[routes.md](./routes.md)**
- What each screen does, endpoint by endpoint: **[features.md](./features.md)**
- The shells, editors and panels it renders: **[views.md](./views.md)**
- Everything else: **[../README.md](../README.md)**

---

## What Studio is made of

| Layer | Where | Notes |
|---|---|---|
| Route tree | `sdk/org/apps/web/src/routes/studio/**` | Thin TanStack routes; almost all UI is imported from `@lmthing/ui`. |
| Shell + editors | `sdk/org/libs/ui/src/studio/**` | `StudioShell`, `StudioSidebar`, `AgentBuilder`, `TasklistEditor`, `FunctionsEditor`, `ComponentEditor`, `ProjectSettingsView`. |
| THING dock | `sdk/org/libs/ui/src/chat/components/AgentChatPanel.tsx` | The same panel the `/chat` surface exports — reused, not reimplemented. |
| Pod transport | `sdk/org/libs/state/src/lib/pod/transport.ts` | `PodTransport` — bearer token + one 401→refresh retry over the pod REST API. |

---

## The shell and its navigation

`/studio` is a layout route: it wraps the whole subtree in `PodEnsureGate` (pod cold-wake / upgrade / keep-warm) and an `AppProvider` carrying the pod base URL and access token (`sdk/org/apps/web/src/routes/studio/route.tsx:L11-L30`). The landing route then redirects into the default project — `user`, else the first project returned (`sdk/org/apps/web/src/routes/studio/index.tsx:L15-L19`, path built by `buildProjectPath`, `sdk/org/libs/ui/src/lib/space-path.ts:L22-L25`).

Navigation is a three-level drill-down, all rooted at the `/studio` prefix (`sdk/org/libs/ui/src/lib/space-path.ts:L15-L41`):

```
/studio                          → redirect to the default project
/studio/<projectId>              → project landing (spaces list)
/studio/<projectId>/<spaceId>    → the space editor (agents, tasklists, knowledge, functions, components, raw, settings)
/studio/<projectId>/app          → project-app admin (Manifest · Data · Files · Preview)
/studio/<projectId>/settings     → project settings (Integrations)
/studio/thing                    → full-page THING chat
```

Inside a space route the shell is two sidebars plus a primary pane: the **outer** `StudioAppSidebar` (projects + that project's spaces, create/delete project) and the **inner** `StudioSidebar` rail listing the open space's contents — collapsible **Knowledge / Agents / Tasklists / Functions / Components** sections, with a footer for THING, Raw Files and Settings (`sdk/org/libs/ui/src/studio/shell/studio-shell/index.tsx:L91-L127`; sections at `sdk/org/libs/ui/src/studio/shell/studio-sidebar/index.tsx:L171`, `:L199`, `:L227`, `:L255`, `:L282`).

The **project-app tabs** (`/studio/<projectId>/app`) are deliberately *project*-scoped, not space-scoped: that route renders its own chrome and `TabBar` instead of `StudioLayout`, so it has no space rail and no THING dock (`sdk/org/apps/web/src/routes/studio/$projectId/app/route.tsx:L12-L69`).

---

## The THING dock

Every **space** route mounts the dock as `StudioLayout`'s `rightPanel` — an `AgentChatPanel` targeting the pod's `thing` agent with `{ mode: 'agentOnly', agentSlug: 'thing' }` (no space sync needed; the pod merges the system spaces at session runtime) (`sdk/org/apps/web/src/routes/studio/$projectId/$spaceId/route.tsx:L10-L45`).

It is a **toggle**, not permanently visible: `StudioShell` persists `studio-shell.thing.open` (default `false`) and renders the 400px dock only when the toggle is on and a `rightPanel` was passed (`sdk/org/libs/ui/src/studio/shell/studio-shell/index.tsx:L72`, `:L129-L145`). The toggle lives in the space rail's footer (`sdk/org/libs/ui/src/studio/shell/studio-sidebar/index.tsx:L336-L344`). Project landings and the app tabs therefore have **no** dock; `/studio/thing` is the standalone full-page equivalent (`sdk/org/apps/web/src/routes/studio/thing/index.tsx:L13-L45`).

> Correction to the older prose in `sdk/org/CLAUDE.md` ("The always-on THING chat dock is present on the right side"): the dock is space-scoped and off by default.

---

## How Studio saves — there is no Save button

No space editor calls a save endpoint. `SpaceProvider` hydrates the whole space file map on mount (`GET /api/projects/:id/spaces/:spaceId/files`) and writes it back as a **1500 ms-debounced whole-space `PUT`** (`sdk/org/libs/state/src/lib/contexts/SpaceContext.tsx:L35`, `:L92`, `:L124-L151`). Editors just write into the in-memory VFS (`spaceFS.writeFile` / `deletePath`); the bulk `PUT` is wipe-and-rewrite, so deletions propagate. Non-runnable files (`conversations/`, `.env*`) are stripped before the push (`sdk/org/libs/state/src/lib/pod/transport.ts` `isRunnableSpaceFile`).

That is why the space file formats documented in [../format/space/README.md](../format/space/README.md) are the real contract: Studio is a typed editor over those files, nothing more.

---

## The synthetic `system` project

Studio browses and edits the shipped system/user spaces with **no client-side special case**: the pod's `listProjects` prepends a synthetic `{ id: 'system', name: 'System' }` entry whenever `<root>/system/spaces/` is non-empty, and `<root>/system/spaces/<id>` already matches the generic `<root>/<projectId>/spaces/<id>` shape (`sdk/org/libs/cli/src/server/projects.ts:L305-L326`). `system` is reserved and cannot be created or deleted (`sdk/org/libs/cli/src/server/projects.ts:L31-L44`). The one place the client does filter it out is the `/install` project picker — you cannot install an integration space into `system` (`sdk/org/apps/web/src/routes/install.tsx:L252`).

---

## Installing apps and integrations

`/install` is a **top-level** route, not a child of `/apps`, because on lmthing.app the gateway proxies `/app/*` straight to the pod — only the static shell at `/` can serve a page that self-authenticates and calls the pod (`sdk/org/apps/web/src/routes/install.tsx:L7-L23`).

| Query | Pod call | Then |
|---|---|---|
| `/install?appId=<id>` | `POST /api/apps/install { appId, force }` (`sdk/org/apps/web/src/routes/install.tsx:L119-L128`) | "Open app" → `{COMPUTER_BASE_URL}{APP_PATH_PREFIX}/<project>/` (`:L141-L146`) |
| `/install?spaceId=<id>` | `POST /api/store/spaces/install { spaceId, projectId, force }` (`sdk/org/apps/web/src/routes/install.tsx:L273-L279`) | "Add your token in Studio" → `/studio/<project>/settings` (`:L84-L94`) |

Both endpoints share one response contract, classified by the pure, unit-tested `classifyInstallResponse`: HTTP 200 with `{ ok:false, diverged:true }` is **not an error** — it is the "already installed with local edits" signal that offers an upgrade, re-POSTing with `force:true` (`sdk/org/apps/web/src/routes/install.tsx:L71-L79`, `:L186-L210`).

```ts
// sdk/org/apps/web/src/routes/install.tsx:L71-L79
export function classifyInstallResponse(
  httpOk: boolean,
  httpStatus: number,
  body: (InstalledInfo & { ok?: boolean }) | null,
): State {
  if (httpOk && body?.ok) return { status: 'done', info: body }
  if (httpOk && body?.diverged) return { status: 'diverged', info: body }
  return { status: 'error', message: body?.message ?? `Install failed (HTTP ${httpStatus}).` }
}
```

An unauthenticated arrival (store → install → sign in) survives: `beforeLoad` records the intent in `sessionStorage` (`lmthing_pending_install` / `lmthing_pending_install_space`) and the resume runs both at `/` and in the `/apps` layout, because on lmthing.app the SSO callback lands on the prefixed surface, not the index route (`sdk/org/apps/web/src/routes/install.tsx:L33-L42`; `sdk/org/apps/web/src/routes/apps/route.tsx:L36-L48`).

`/apps` itself is just a launcher: it lists the pod's projects and opens each pod-served app in a new tab, first dropping the `access_token` `path=/` cookie so page navigations and relative assets (which cannot send a Bearer header) route to the right pod (`sdk/org/apps/web/src/routes/apps/index.tsx:L15-L22`; `sdk/org/apps/web/src/lib/pod-session.ts` `setPodSessionCookie`). `APP_PATH_PREFIX` is `''` on lmthing.app and `'/app'` everywhere else (`sdk/org/apps/web/src/lib/config.ts:L39`). The app being launched is documented in [../app/README.md](../app/README.md).

---

## Endpoints Studio calls

Same-origin **pod** REST unless noted; the **gateway** (`CLOUD_BASE_URL`) is only used for pod lifecycle, env and billing (`sdk/org/apps/web/src/lib/config.ts:L18-L26`).

| Purpose | Endpoint | Reference |
|---|---|---|
| Pod cold-wake / status / version / upgrade | gateway `POST /api/compute/ensure`, `GET /api/compute/status`, `GET /api/compute/version`, `POST /api/compute/upgrade` (`sdk/org/apps/web/src/lib/gates.tsx:L48`, `:L61`, `:L75`, `:L99`) | — |
| Pod edge probe + keep-warm | `GET /api/sessions` (`sdk/org/apps/web/src/lib/gates.tsx:L143`), `POST /api/keepalive` every 5 min (`:L202`, `:L339`) | [../cli-api/rest/sessions.md](../cli-api/rest/sessions.md) · [../cli-api/rest/misc.md](../cli-api/rest/misc.md) |
| Projects list / create / delete | `GET`/`POST /api/projects`, `DELETE /api/projects/:id` (`sdk/org/libs/state/src/lib/pod/transport.ts`; sidebar `sdk/org/libs/ui/src/studio/shell/studio-app-sidebar/index.tsx:L33-L60`) | [../cli-api/rest/projects.md](../cli-api/rest/projects.md) |
| Space list / hydrate / save | `GET /api/projects/:id/spaces`, `GET`/`PUT /api/projects/:id/spaces/:spaceId/files` (`sdk/org/libs/state/src/lib/contexts/SpaceContext.tsx:L92`, `:L151`) | [../cli-api/rest/projects.md](../cli-api/rest/projects.md) |
| Run an agent from a space (sync + session + WS) | `POST /api/spaces`, `POST /api/sessions`, `WS /api/ws?sessionId=…` (`sdk/org/libs/ui/src/chat/client/rpc-client.ts` `ReplRpcClient`) | [../cli-api/rest/spaces.md](../cli-api/rest/spaces.md) · [../cli-api/rest/sessions.md](../cli-api/rest/sessions.md) |
| Project-app admin (manifest, data, files, build, hook run) | `GET /api/projects/:id/app`, `…/app/data/:table`, `…/app/files/*`, `…/app/build`, `POST …/hooks/:slug/run` (`sdk/org/apps/web/src/routes/studio/$projectId/app/-lib/appApi.ts`) | [../cli-api/rest/projects.md](../cli-api/rest/projects.md) · [../cli-api/rest/hooks.md](../cli-api/rest/hooks.md) |
| Integrations config | pod `GET /api/projects/:id/integrations` + gateway `GET`/`PUT /api/compute/env` (GET-merge-PUT; a save restarts the pod) (`sdk/org/libs/ui/src/studio/shell/project-settings-view/index.tsx:L75`, `:L93`, `:L116-L119`) | [../cli-api/rest/store-spaces.md](../cli-api/rest/store-spaces.md) · [../cli-api/rest/env.md](../cli-api/rest/env.md) |
| Install an app / an integration space | `POST /api/apps/install`, `POST /api/store/spaces/install` | [../cli-api/rest/apps.md](../cli-api/rest/apps.md) · [../cli-api/rest/store-spaces.md](../cli-api/rest/store-spaces.md) |

Auth: pod REST goes through `PodTransport` (bearer + one 401→refresh retry) or `useAuth().authFetch`; the chat WS carries the token as `?access_token=` because a WebSocket cannot send headers (`sdk/org/libs/state/src/lib/pod/transport.ts`; `sdk/org/libs/ui/src/chat/client/rpc-client.ts`).

---

## Known gaps in this surface

Documented so nobody reads them as working features:

- **Space `SettingsView`** (Environment + `package.json` tabs) is a UI-only stub — its buttons set a status string and validate JSON, but write nothing to the VFS or the pod (`sdk/org/libs/ui/src/studio/shell/settings-view/index.tsx`).
- **"Create Tasklist"** in the space rail is wired to `onCreateAgent` (`sdk/org/libs/ui/src/studio/shell/studio-sidebar/index.tsx:L241-L243`) — it opens the agent-creation prompt, not a tasklist one.
- **Conversations** is hardcoded to `Conversations (0)` (`sdk/org/libs/ui/src/studio/shell/studio-sidebar/index.tsx:L308`), and `…/agent/$agentId/chat/$conversationId` renders only its ids (`sdk/org/apps/web/src/routes/studio/$projectId/$spaceId/agent/$agentId/chat/$conversationId/index.tsx`).
- **Legacy redirects**: `…/workflow/$workflowId/step/$stepId` and the 3-level knowledge route `…/knowledge/$fieldId/$subjectId/$topicId` exist only to redirect back to their editors.

See [features.md](./features.md) for the per-screen detail and [views.md](./views.md) for the component inventory.
