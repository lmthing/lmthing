# Studio — route tree

Every URL of the `/studio` surface, plus the `/apps` launcher and the top-level `/install` route, mapped to the file that declares it. Studio is not its own SPA: it is a subtree of the one unified Vite app at `sdk/org/apps/web`, whose routes are TanStack file routes generated into `sdk/org/apps/web/src/routeTree.gen.ts`. The generated tree is the authoritative file → URL mapping and confirms every path below (`sdk/org/apps/web/src/routeTree.gen.ts:747-985`).

- What each page renders → [./views.md](./views.md)
- What each page *does* (persistence, pod calls, gates) → [./features.md](./features.md)

---

## 1. Ancestors (shared by every surface)

| File | URL | Role |
|---|---|---|
| `src/routes/__root.tsx` | *(root layout)* | `AuthProvider(appName="studio")` → `AuthGate` → `PinGate` → `<Outlet/>` `sdk/org/apps/web/src/routes/__root.tsx:15-29` |
| `src/routes/index.tsx` | `/` | hostname → surface redirect; SSO-callback waiter; pending-install resume `sdk/org/apps/web/src/routes/index.tsx:31-75` |

Login and the PIN gate are **not** owned by Studio — they live once in the root, because `@lmthing/auth` stores one session for all surfaces `sdk/org/apps/web/src/routes/__root.tsx:7-14`.

`/` never renders content of its own: `beforeLoad` throws a redirect to `surfaceForHost(window.location.hostname)` `sdk/org/apps/web/src/routes/index.tsx:31-42`, using this map `sdk/org/apps/web/src/routes/index.tsx:5-10`:

```ts
const HOST_SURFACE: Record<string, '/chat' | '/studio' | '/computer' | '/apps'> = {
  'lmthing.chat': '/chat',
  'lmthing.studio': '/studio',
  'lmthing.computer': '/computer',
  'lmthing.app': '/apps',
}
```

Unknown hosts (localhost, the `*.test` proxy) fall back to `/studio` `sdk/org/apps/web/src/routes/index.tsx:22-24`. The one exception to the redirect is an OAuth callback (`/?code=…`): redirecting would drop `?code` before `@lmthing/auth` can exchange it, so the route renders a "Signing you in…" waiter that forwards *after* auth settles `sdk/org/apps/web/src/routes/index.tsx:32-42,47-75`.

---

## 2. The `/studio` tree

| File (under `sdk/org/apps/web/src/routes/`) | URL | Kind |
|---|---|---|
| `studio/route.tsx` | `/studio` | layout — `PodEnsureGate` + `AppProvider(pod)` `…/studio/route.tsx:11-30` |
| `studio/index.tsx` | `/studio/` | redirect to the default project `…/studio/index.tsx:11-30` |
| `studio/thing/index.tsx` | `/studio/thing` | full-page THING chat `…/studio/thing/index.tsx:13-45` |
| `studio/$projectId/route.tsx` | `/studio/$projectId` | layout — `ProjectProvider(projectId)` `…/$projectId/route.tsx:4-15` |
| `studio/$projectId/index.tsx` | `/studio/$projectId` | project landing `…/$projectId/index.tsx:4-6` |
| `studio/$projectId/settings/index.tsx` | `/studio/$projectId/settings` | project settings (Integrations) `…/$projectId/settings/index.tsx:4-6` |
| `studio/$projectId/app/route.tsx` | `/studio/$projectId/app` | layout — project-app admin chrome + TabBar `…/$projectId/app/route.tsx:28-69` |
| `studio/$projectId/app/index.tsx` | `/studio/$projectId/app` | Manifest tab `…/$projectId/app/index.tsx:337-339` |
| `studio/$projectId/app/data/index.tsx` | `/studio/$projectId/app/data` | Data browser `…/$projectId/app/data/index.tsx:280-282` |
| `studio/$projectId/app/files/index.tsx` | `/studio/$projectId/app/files` | App-file editor `…/$projectId/app/files/index.tsx:255-257` |
| `studio/$projectId/app/preview/index.tsx` | `/studio/$projectId/app/preview` | Same-origin iframe preview `…/$projectId/app/preview/index.tsx:62-64` |
| `studio/$projectId/$spaceId/route.tsx` | `/studio/$projectId/$spaceId` | layout — `SpaceProvider` + `StudioLayout` + THING dock `…/$spaceId/route.tsx:35-49` |
| `studio/$projectId/$spaceId/index.tsx` | `/studio/$projectId/$spaceId` | space overview `…/$spaceId/index.tsx:5-14` |
| `studio/$projectId/$spaceId/agent/index.tsx` | `…/$spaceId/agent` | agent list `…/$spaceId/agent/index.tsx:9-11` |
| `studio/$projectId/$spaceId/agent/new/index.tsx` | `…/$spaceId/agent/new` | `AgentBuilder` (create) `…/$spaceId/agent/new/index.tsx:4-6` |
| `studio/$projectId/$spaceId/agent/$agentId/index.tsx` | `…/$spaceId/agent/$agentId` | `AgentBuilder` (edit) `…/$spaceId/agent/$agentId/index.tsx:4-6` |
| `studio/$projectId/$spaceId/agent/$agentId/chat/index.tsx` | `…/agent/$agentId/chat` | sync-space + run the agent `…/agent/$agentId/chat/index.tsx:310-312` |
| `studio/$projectId/$spaceId/agent/$agentId/chat/$conversationId/index.tsx` | `…/agent/$agentId/chat/$conversationId` | stub `…/chat/$conversationId/index.tsx:18-22` |
| `studio/$projectId/$spaceId/agent/$agentId/workflow/$workflowId/index.tsx` | `…/agent/$agentId/workflow/$workflowId` | `TasklistEditor` (agent-scoped) `…/agent/$agentId/workflow/$workflowId/index.tsx:29-33` |
| `studio/$projectId/$spaceId/workflow/index.tsx` | `…/$spaceId/workflow` | tasklist list `…/$spaceId/workflow/index.tsx:59-61` |
| `studio/$projectId/$spaceId/workflow/new/index.tsx` | `…/$spaceId/workflow/new` | create-tasklist modal `…/$spaceId/workflow/new/index.tsx:35-37` |
| `studio/$projectId/$spaceId/workflow/$workflowId/index.tsx` | `…/$spaceId/workflow/$workflowId` | `TasklistEditor` `…/$spaceId/workflow/$workflowId/index.tsx:25-27` |
| `studio/$projectId/$spaceId/workflow/$workflowId/step/$stepId/index.tsx` | `…/workflow/$workflowId/step/$stepId` | **legacy redirect** → the tasklist editor `…/workflow/$workflowId/step/$stepId/index.tsx:8-33` |
| `studio/$projectId/$spaceId/knowledge/index.tsx` | `…/$spaceId/knowledge` | knowledge landing (domains → fields) `…/$spaceId/knowledge/index.tsx:199-201` |
| `studio/$projectId/$spaceId/knowledge/$fieldId/index.tsx` | `…/knowledge/$fieldId` | field detail `…/knowledge/$fieldId/index.tsx:298-300` |
| `studio/$projectId/$spaceId/knowledge/domain/$domainId/index.tsx` | `…/knowledge/domain/$domainId` | domain metadata `…/knowledge/domain/$domainId/index.tsx:4-11` |
| `studio/$projectId/$spaceId/knowledge/$fieldId/$subjectId/$topicId/index.tsx` | `…/knowledge/$fieldId/$subjectId/$topicId` | **legacy redirect** (3-level knowledge) `…/knowledge/$fieldId/$subjectId/$topicId/index.tsx:3-14` |
| `studio/$projectId/$spaceId/functions/index.tsx` | `…/$spaceId/functions` | `FunctionsEditor` `…/$spaceId/functions/index.tsx:8-10` |
| `studio/$projectId/$spaceId/components/index.tsx` | `…/$spaceId/components` | `ComponentEditor` `…/$spaceId/components/index.tsx:8-10` |
| `studio/$projectId/$spaceId/raw/index.tsx` | `…/$spaceId/raw` | raw VFS browser `…/$spaceId/raw/index.tsx:183-185` |
| `studio/$projectId/$spaceId/settings/index.tsx` | `…/$spaceId/settings` | space settings (auto-redirected, see below) `…/$spaceId/settings/index.tsx:4-6` |
| `studio/$projectId/$spaceId/settings/env/index.tsx` | `…/$spaceId/settings/env` | space settings — Environment `…/$spaceId/settings/env/index.tsx:4-6` |
| `studio/$projectId/$spaceId/settings/packages/index.tsx` | `…/$spaceId/settings/packages` | space settings — package.json `…/$spaceId/settings/packages/index.tsx:4-6` |

`studio/$projectId/app/-lib/{appApi.ts, manifest.ts}` are **not routes** — the leading `-` excludes a directory from TanStack's file-route scan; they hold the management-API client and the manifest types/path helpers `sdk/org/apps/web/src/routes/studio/$projectId/app/-lib/appApi.ts:1-19`.

### Layout nesting

```
__root                              AuthProvider → AuthGate → PinGate
└── /studio                         PodEnsureGate → AppProvider(pod)
    ├── /studio/                    → redirect to the default project
    ├── /studio/thing               full-page AgentChatPanel (agentOnly, 'thing')
    └── /studio/$projectId          ProjectProvider(projectId)
        ├── (index)                 StudioProjectView
        ├── /settings               ProjectSettingsView  (Integrations)
        ├── /app                    own chrome + TabBar  (NO sidebar, NO THING dock)
        │   ├── (index) Manifest · /data · /files · /preview
        └── /$spaceId               SpaceProvider(spaceId) → StudioLayout(rightPanel=ThingDock)
            ├── agent/ · workflow/ · knowledge/ · functions/ · components/ · raw/ · settings/
```

The pod-readiness gate and the pod REST transport are mounted once, at the `/studio` layout `sdk/org/apps/web/src/routes/studio/route.tsx:11-25`:

```tsx
function StudioLayout() {
  const { getAccessTokenSync, refreshAuth } = useAuth()
  return (
    <PodEnsureGate>
      <AppProvider pod={{ podBaseUrl: COMPUTER_BASE_URL, getAccessToken: getAccessTokenSync, refresh: refreshAuth }}>
        <Outlet />
      </AppProvider>
    </PodEnsureGate>
  )
}
```

### Params

| Param | Where it comes from | Notes |
|---|---|---|
| `$projectId` | `GET /api/projects` on the pod | the id, not the display name. Includes the synthetic `system` project, which the pod prepends when `<root>/system/spaces/` is non-empty `sdk/org/libs/cli/src/server/projects.ts` `listProjects` / `SYSTEM_PROJECT_ID` — so `/studio/system/<space>` edits the system spaces through the ordinary routes. See [../cli-api/rest/projects.md](../cli-api/rest/projects.md). |
| `$spaceId` | `GET /api/projects/:id/spaces` | the space directory name. |
| `$agentId` | the space VFS (`agents/<slug>/`) | agent slug; navigation encodes it (`encodeURIComponent`) `…/$spaceId/agent/index.tsx:51`. See [../format/space/agents/README.md](../format/space/agents/README.md). |
| `$workflowId` | the space VFS (`tasklists/<name>/`) | the tasklist *name*, passed straight to `<TasklistEditor name={workflowId}/>` `…/$spaceId/workflow/$workflowId/index.tsx:20-22`. See [../format/space/tasklists/README.md](../format/space/tasklists/README.md). |
| `$fieldId` | encoded `"<domain>---<field>"` | split on the first `---`: `domain = fieldId.slice(0, i)`, `field = fieldId.slice(i + 3)` `…/knowledge/$fieldId/index.tsx:29-32`. See [../format/space/knowledge/README.md](../format/space/knowledge/README.md). |
| `$domainId` | knowledge domain slug | `<DomainMetadataPanel domain={domainId}/>` `…/knowledge/domain/$domainId/index.tsx:4-7`. |
| `$conversationId` | — | rendered as text only (stub) `…/chat/$conversationId/index.tsx:5-15`. |
| `$stepId` | — | ignored; the route redirects `…/workflow/$workflowId/step/$stepId/index.tsx:15-24`. |

### Redirects inside the tree

- `/studio/` → `buildProjectPath(projects.find(p => p.id === 'user') ?? projects[0])` — i.e. `/studio/user` on a normal pod `sdk/org/apps/web/src/routes/studio/index.tsx:11-19`, `sdk/org/libs/ui/src/lib/space-path.ts:22-25`.
- `…/$spaceId/settings` → `…/$spaceId/settings/env`. This is **not** in the route file — `StudioLayout` (the shell) does it on every render whose pathname ends in `/settings` `sdk/org/libs/ui/src/studio/shell/studio-layout/index.tsx:54-58`. Because the project-app subtree does not use `StudioLayout`, `/studio/$projectId/settings` is untouched by it.
- `…/workflow/$workflowId/step/$stepId` → `…/workflow/$workflowId` (or the tasklist list when `workflowId` is missing) `…/workflow/$workflowId/step/$stepId/index.tsx:15-24`.
- `…/knowledge/$fieldId/$subjectId/$topicId` → a `beforeLoad` `redirect()` back to the field page `…/knowledge/$fieldId/$subjectId/$topicId/index.tsx:6-12`.

> UNVERIFIED (behaviour at runtime): the legacy knowledge redirect targets `to: '/$projectId/$spaceId/knowledge/$fieldId'` — with **no `/studio` prefix** `…/knowledge/$fieldId/$subjectId/$topicId/index.tsx:9`. No such route exists in the generated tree (every studio path is `/studio/$projectId/…`, `sdk/org/apps/web/src/routeTree.gen.ts:929`), so this redirect looks broken. I did not exercise it in a browser; searched `routeTree.gen.ts` for a bare `/$projectId` route and found none.

---

## 3. `/apps` — the launcher (lmthing.app)

| File | URL | Role |
|---|---|---|
| `routes/apps/route.tsx` | `/apps` | layout — `PodEnsureGate` + `AppProvider(pod)` + pod-session cookie + pending-install resume `sdk/org/apps/web/src/routes/apps/route.tsx:24-67` |
| `routes/apps/index.tsx` | `/apps/` | app launcher — lists projects, opens the pod-served app `sdk/org/apps/web/src/routes/apps/index.tsx:15-69` |

Same shell shape as `/studio` (gate + pod transport), with one extra: it writes the platform JWT into a `path=/` cookie, because an app page navigation and its relative assets cannot send an `Authorization` header `sdk/org/apps/web/src/routes/apps/route.tsx:17-22,28-30` (`setPodSessionCookie`, `sdk/org/apps/web/src/lib/pod-session.ts`).

Opening an app leaves the SPA entirely and hits the pod's app mount `sdk/org/apps/web/src/routes/apps/index.tsx:19-22`:

```ts
function openApp(id: string) {
  setPodSessionCookie(getAccessTokenSync?.())
  window.open(`${COMPUTER_BASE_URL}${APP_PATH_PREFIX}/${encodeURIComponent(id)}/`, '_blank', 'noopener')
}
```

`APP_PATH_PREFIX` is `''` on `lmthing.app` (apps served at the root by the pod) and `'/app'` everywhere else `sdk/org/apps/web/src/lib/config.ts:28-40`. The served surface itself is documented in [../app/routes.md](../app/routes.md).

The SPA route is deliberately `/apps`, never `/app` — `/app/<project>/` is the pod's app mount on localhost `sdk/org/apps/web/src/routes/apps/route.tsx:13-15`.

---

## 4. `/install` — the store installer

| File | URL | Role |
|---|---|---|
| `routes/install.tsx` | `/install?appId=…` / `/install?spaceId=…` | installs a store project-app or an integration space into the user's pod `sdk/org/apps/web/src/routes/install.tsx:24-44` |

It is **top-level, not under `/apps`**, on purpose: on lmthing.app the gateway proxies `/app/*` straight to the pod, so only the static shell can serve a page that self-authenticates and calls the pod `sdk/org/apps/web/src/routes/install.tsx:20-22`.

Search params are validated into two always-present strings `sdk/org/apps/web/src/routes/install.tsx:25-28`, and `beforeLoad` records the intent in `sessionStorage` **before** the auth gate can render the login screen, so a store → install → sign-in round-trip is resumed `sdk/org/apps/web/src/routes/install.tsx:29-42`:

```ts
beforeLoad: ({ search }) => {
  if (search.appId) sessionStorage.setItem('lmthing_pending_install', search.appId)
  if (search.spaceId) sessionStorage.setItem('lmthing_pending_install_space', search.spaceId)
}
```

Resume happens in **two** places, because on lmthing.app the SSO callback lands on the prefixed `/apps` and never runs the index route: `routes/index.tsx:52-66` and `routes/apps/route.tsx:36-48`.

Two branches, chosen by which param is present `sdk/org/apps/web/src/routes/install.tsx:96-99`:

| Branch | Pod endpoint | After success |
|---|---|---|
| `?appId=` → `AppInstall` | `POST /api/apps/install {appId, force}` `install.tsx:119-126` | "Open app" → `${COMPUTER_BASE_URL}${APP_PATH_PREFIX}/<projectId>/` `install.tsx:141-146`. See [../cli-api/rest/apps.md](../cli-api/rest/apps.md). |
| `?spaceId=` → `SpaceInstall` | `GET /api/projects` for the target picker (`system` filtered out, default `user`) `install.tsx:249-256`, then `POST /api/store/spaces/install {spaceId, projectId, force}` `install.tsx:273-277` | "Add your token in Studio" → `<studio origin>/studio/<projectId>/settings` `install.tsx:84-94`. See [../cli-api/rest/store-spaces.md](../cli-api/rest/store-spaces.md). |

The install response is classified by one pure, exported, unit-tested function — HTTP 200 with `{ok:false, diverged:true}` is *not* an error, it is the "app already installed with local edits" signal that offers a forced re-install `sdk/org/apps/web/src/routes/install.tsx:71-79`:

```ts
export function classifyInstallResponse(httpOk, httpStatus, body): State {
  if (httpOk && body?.ok) return { status: 'done', info: body }
  if (httpOk && body?.diverged) return { status: 'diverged', info: body }
  return { status: 'error', message: body?.message ?? `Install failed (HTTP ${httpStatus}).` }
}
```

Both "upgrade" actions simply re-run the same POST with `force: true` `sdk/org/apps/web/src/routes/install.tsx:108-110,196,365`.

---

## 5. Sibling surfaces in the same SPA

`/chat` ([../chat/routes.md](../chat/routes.md)) and `/computer` ([../computer/routes.md](../computer/routes.md)) are peers under the same `__root`, reached by hostname from `/` `sdk/org/apps/web/src/routes/index.tsx:5-10`. Studio links out to them through the shared sidebar footer; the reverse hop (clicking a space in the chat sidebar) lands on a `/studio/$projectId/$spaceId` path built by the same helpers `sdk/org/libs/ui/src/lib/space-path.ts:22-41`.
