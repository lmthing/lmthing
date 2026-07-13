# Chat — route tree

The `/chat` surface of the unified SPA (`sdk/org/apps/web`). It is the smallest surface in the app: **two route files**, no path params, and no `/chat/*` children. Everything the user sees is `<ChatShell/>` from `@lmthing/ui/chat`.

See also: [views.md](./views.md) (what each pane renders) · [features.md](./features.md) (behaviour + the endpoints each feature calls).

---

## 1. Router setup

Routing is **TanStack Router with file-based route generation**. The Vite plugin scans `./src/routes` and emits `./src/routeTree.gen.ts` `sdk/org/libs/utils/src/vite.mjs:105-108`:

```js
tanstackRouter({
  routesDirectory: './src/routes',
  generatedRouteTree: './src/routeTree.gen.ts',
}),
```

`apps/web` uses that shared factory verbatim (`export default createViteConfig(__dirname)`) `sdk/org/apps/web/vite.config.ts`, and depends on `@tanstack/react-router` + `@tanstack/router-plugin` `sdk/org/apps/web/package.json:35,59`.

The router is created once in the app entry from the generated tree `sdk/org/apps/web/src/main.tsx:66-71`:

```tsx
const hostname = typeof window !== 'undefined' ? window.location.hostname : ''
const history = DOMAIN_HOSTS.has(hostname)
  ? createPrefixedHistory(surfaceForHost(hostname))
  : createBrowserHistory()

const router = createRouter({ routeTree, history })
```

### The prefixed history (why lmthing.chat shows a clean `/`)

`DOMAIN_HOSTS = {lmthing.computer, lmthing.chat, lmthing.studio, lmthing.app}` `sdk/org/apps/web/src/main.tsx#DOMAIN_HOSTS`. On those hosts the surface prefix is implicit in the hostname, so `createPrefixedHistory('/chat')` wraps the browser history: it **adds** `/chat` to every pathname the router observes (`location`, `subscribe`) and **strips** it from every pathname pushed to the browser (`push`/`replace`/`createHref`) `sdk/org/apps/web/src/main.tsx#createPrefixedHistory`. Net effect on `lmthing.chat`: the router matches `/chat/` while the address bar reads `/`. `RESERVED_TOPLEVEL = {'/install'}` is exempt from prefixing `sdk/org/apps/web/src/main.tsx#RESERVED_TOPLEVEL,29`.

On any other host (localhost, the `*.test` proxy) a plain `createBrowserHistory()` is used, so chat lives at the literal `/chat` `sdk/org/apps/web/src/main.tsx#history`.

### Getting to /chat from `/`

The index route redirects by hostname `sdk/org/apps/web/src/routes/index.tsx#HOST_SURFACE,22-24,31-42`:

```ts
const HOST_SURFACE: Record<string, '/chat' | '/studio' | '/computer' | '/apps'> = {
  'lmthing.chat': '/chat',
  'lmthing.studio': '/studio',
  'lmthing.computer': '/computer',
  'lmthing.app': '/apps',
}
export function surfaceForHost(host: string) { return HOST_SURFACE[host] ?? '/studio' }
```

`beforeLoad` throws `redirect({ to: surfaceForHost(host), replace: true })` — **except** during an SSO callback (`/?code=…`), where it renders a waiter instead, because navigating away would drop `?code` before `@lmthing/auth` can exchange it `sdk/org/apps/web/src/routes/index.tsx:26-42,44-75`.

---

## 2. Route files → URLs

| Route file | URL | Component | Role |
|---|---|---|---|
| `sdk/org/apps/web/src/routes/__root.tsx` | — (root layout) | `RootComponent` | `AuthProvider(appName="studio")` → `AuthGate` → `PinGate` → `<Outlet/>` `sdk/org/apps/web/src/routes/__root.tsx:15-29` |
| `sdk/org/apps/web/src/routes/index.tsx` | `/` | `RootRedirect` | hostname → surface redirect; `lmthing.chat` → `/chat` `sdk/org/apps/web/src/routes/index.tsx#Route` |
| `sdk/org/apps/web/src/routes/chat/route.tsx` | `/chat` | `ChatLayout` | layout route: `<PodEnsureGate><Outlet/></PodEnsureGate>` `sdk/org/apps/web/src/routes/chat/route.tsx:4-14` |
| `sdk/org/apps/web/src/routes/chat/index.tsx` | `/chat/` | `ChatPage` | renders `<ChatShell/>` `sdk/org/apps/web/src/routes/chat/index.tsx:5-11` |

Those **two files are the entire `routes/chat/` directory** — there are no other route files under it, and no `$param` segments anywhere in the chat subtree.

The generated tree confirms the parent/child wiring: `ChatRouteRoute` is `id:'/chat', path:'/chat'` under the root `sdk/org/apps/web/src/routeTree.gen.ts#ChatRouteRoute`, and `ChatIndexRoute` is `id:'/', path:'/'` with `getParentRoute: () => ChatRouteRoute` `sdk/org/apps/web/src/routeTree.gen.ts#ChatIndexRoute` — i.e. `fullPath: '/chat/'` `sdk/org/apps/web/src/routeTree.gen.ts#FileRoutesByFullPath./chat/`.

### `/chat` — the layout route

The whole body is the shared pod-readiness gate `sdk/org/apps/web/src/routes/chat/route.tsx:4-14`:

```tsx
function ChatLayout() {
  return (
    <PodEnsureGate>
      <Outlet />
    </PodEnsureGate>
  )
}
export const Route = createFileRoute('/chat')({ component: ChatLayout })
```

`PodEnsureGate` (shared verbatim with `/studio`, `/computer`, `/apps`) short-circuits for pod-embedded / local runs (`if (isPodEmbedded() || isLocalRun()) return <>{children}</>`) `sdk/org/apps/web/src/lib/gates.tsx#PodEnsureGate`; otherwise it ensures the pod, waits for its Envoy edge, offers an image upgrade, and keeps the pod warm before children mount `sdk/org/apps/web/src/lib/gates.tsx:242-301,307-362`. The endpoints it calls are listed in [features.md](./features.md).

Unlike `/studio` (which also mounts `AppProvider`/`ProjectProvider`) and `/computer`, the chat layout mounts **no data providers** — chat owns its own Zustand store and fetches directly.

### `/chat/` — the index route

Eleven lines; the entire surface is one component `sdk/org/apps/web/src/routes/chat/index.tsx:1-11`:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { ChatShell } from '@lmthing/ui/chat'
import '@lmthing/ui/chat/css'

function ChatPage() {
  return <ChatShell />
}

export const Route = createFileRoute('/chat/')({ component: ChatPage })
```

Both imports are subpath exports of the ui lib: `"./chat" → ./src/chat/index.ts` and `"./chat/css" → ./src/chat/app/styles.css` `sdk/org/libs/ui/package.json` (`exports`). **The real chat source tree is `sdk/org/libs/ui/src/chat/`**, not `apps/web` — see [views.md](./views.md).

`ChatShell` boots by fetching `/api/projects`, default-selecting the project with id `user` (else `projects[0]`), then wiring URL ↔ store `sdk/org/libs/ui/src/chat/app/ChatShell.tsx#ChatShell`, and renders `<AppShell/>`.

---

## 3. Params & URL state

**There are no route params.** No chat route declares a `$segment`, and no chat route declares `validateSearch`/`loaderDeps` — TanStack Router is used here purely as a mount point. All in-surface navigation (project, session, selected trace node, panels) is **component state + querystring**, managed outside the router via `window.history.replaceState`.

Deep-linkable querystring keys:

| Key | Values | Read at | Written by |
|---|---|---|---|
| `node` | a trace node id | boot → `selectNode(node, true)` `sdk/org/libs/ui/src/chat/app/url-state.ts#applyUrlToState` | store subscription `sdk/org/libs/ui/src/chat/app/url-state.ts#syncStateToUrl` |
| `tab` | an `InspectorTab` | boot → `setTab(tab)` `sdk/org/libs/ui/src/chat/app/url-state.ts#applyUrlToState,13` | always written `sdk/org/libs/ui/src/chat/app/url-state.ts#syncStateToUrl` |
| `follow` | `0` disables follow-mode | boot → `setFollow(false)` `sdk/org/libs/ui/src/chat/app/url-state.ts#applyUrlToState,14` | written only when `follow` is off `sdk/org/libs/ui/src/chat/app/url-state.ts#syncStateToUrl` |
| `inspect` | `1` opens the DevPanel | `AppShell` mount effect `sdk/org/libs/ui/src/chat/app/AppShell.tsx:40-44` | never written back (also toggled by `Alt+I`) `sdk/org/libs/ui/src/chat/app/AppShell.tsx:68-75` |

`syncStateToUrl()` subscribes to the store and rewrites the query with `history.replaceState` (no router navigation, so no remount) `sdk/org/libs/ui/src/chat/app/url-state.ts#syncStateToUrl`:

```ts
const url = `${window.location.pathname}?${params.toString()}`;
window.history.replaceState(null, '', url);
```

The **active session id is not in the URL** — it lives in the store, and switching a session opens a new WebSocket rather than navigating (see [features.md](./features.md)).

### Leaving the surface

The only cross-surface navigation from chat is a hard `window.location.href` hop to Studio when a space is clicked in the sidebar `sdk/org/libs/ui/src/chat/app/Sidebar.tsx:181`:

```ts
window.location.href = `${crossAppOrigin('studio')}/studio/${encodeURIComponent(activeProjectId)}/${encodeURIComponent(spaceId)}`;
```

---

## 4. Ancestry, in one line

```
__root.tsx        AuthProvider("studio") → AuthGate → PinGate → Outlet
└── /chat         PodEnsureGate → Outlet                       (chat/route.tsx)
    └── /chat/    <ChatShell/> → <AppShell/>                   (chat/index.tsx)
```

Auth and the PIN gate are the root's job, not chat's `sdk/org/apps/web/src/routes/__root.tsx:15-29`; pod readiness is the layout's job `sdk/org/apps/web/src/routes/chat/route.tsx#ChatLayout`; everything else is `ChatShell`.
