# Chat — route tree

The `/chat` surface of the unified SPA (`sdk/org/apps/web`). **Every state the surface can be in has a URL**: which project is open, and which conversation inside it. Four route files, two path params, and one component — `<ChatShell/>` from `@lmthing/ui/chat` — behind all of them.

See also: [views.md](./views.md) (what each pane renders) · [features.md](./features.md) (behaviour + the endpoints each feature calls).

---

## 1. Router setup

Routing is **TanStack Router with file-based route generation**. The Vite plugin scans `./src/routes` and emits `./src/routeTree.gen.ts` `sdk/org/libs/utils/src/vite.mjs:249-254`:

```js
tanstackRouter({
  routesDirectory: './src/routes',
  generatedRouteTree: './src/routeTree.gen.ts',
}),
```

`apps/web` uses that shared factory (`export default createViteConfig(__dirname, undefined, { tailwind: false })`) `sdk/org/apps/web/vite.config.ts`, and depends on `@tanstack/react-router` + `@tanstack/router-plugin` `sdk/org/apps/web/package.json`.

The router is created once in the app entry from the generated tree `sdk/org/apps/web/src/main.tsx:68-73`:

```tsx
const hostname = typeof window !== 'undefined' ? window.location.hostname : ''
const history = DOMAIN_HOSTS.has(hostname)
  ? createPrefixedHistory(surfaceForHost(hostname))
  : createBrowserHistory()

const router = createRouter({ routeTree, history })
```

### The prefixed history (why lmthing.chat shows a clean `/`)

`DOMAIN_HOSTS = {lmthing.computer, lmthing.chat, lmthing.studio, lmthing.app, lmthing.team}` `sdk/org/apps/web/src/main.tsx#DOMAIN_HOSTS`. On those hosts the surface prefix is implicit in the hostname, so `createPrefixedHistory('/chat')` wraps the browser history: it **adds** `/chat` to every pathname the router observes (`location`, `subscribe`) and **strips** it from every pathname pushed to the browser (`push`/`replace`/`createHref`) `sdk/org/apps/web/src/main.tsx#createPrefixedHistory`. It rewrites the pathname only, so the params below survive it untouched: a conversation is `lmthing.chat/<project>/<conversation>` in the address bar and `/chat/<project>/<conversation>` to the router. `RESERVED_TOPLEVEL = {'/install'}` is exempt from prefixing `sdk/org/apps/web/src/main.tsx#RESERVED_TOPLEVEL`.

On any other host (localhost, the `*.test` proxy) a plain `createBrowserHistory()` is used, so chat lives at the literal `/chat` `sdk/org/apps/web/src/main.tsx:68-71`.

### Getting to /chat from `/`

The index route redirects by hostname `sdk/org/apps/web/src/routes/index.tsx#surfaceForHost`:

```ts
const HOST_SURFACE: Record<string, Surface> = {
  'lmthing.chat': '/chat',
  'lmthing.studio': '/studio',
  'lmthing.computer': '/computer',
  'lmthing.app': '/apps',
  'lmthing.team': '/team',
}
export function surfaceForHost(host: string): Surface { return HOST_SURFACE[host] ?? '/studio' }
```

`beforeLoad` throws `redirect({ to: surfaceForHost(host), replace: true })` — **except** during an SSO callback (`/?code=…`), where it renders a waiter instead, because navigating away would drop `?code` before `@lmthing/auth` can exchange it `sdk/org/apps/web/src/routes/index.tsx#Route`.

---

## 2. Route files → URLs

| Route file | URL | Component | Role |
|---|---|---|---|
| `sdk/org/apps/web/src/routes/__root.tsx` | — (root layout) | `RootComponent` | `AuthProvider(appName="studio")` → `AuthGate` → `PinGate` → `<Outlet/>` `sdk/org/apps/web/src/routes/__root.tsx:15-29` |
| `sdk/org/apps/web/src/routes/index.tsx` | `/` | `RootRedirect` | hostname → surface redirect; `lmthing.chat` → `/chat` `sdk/org/apps/web/src/routes/index.tsx#Route` |
| `sdk/org/apps/web/src/routes/chat/route.tsx` | `/chat` | `ChatLayout` | layout route: `<PodEnsureGate><Outlet/></PodEnsureGate>` `sdk/org/apps/web/src/routes/chat/route.tsx:4-14` |
| `sdk/org/apps/web/src/routes/chat/index.tsx` | `/chat/` | — | no project named yet; the shell resolves the default one and **replaces** this entry `sdk/org/apps/web/src/routes/chat/index.tsx#Route` |
| `sdk/org/apps/web/src/routes/chat/$projectId/index.tsx` | `/chat/<project>` | `ChatProject` | a project is open, no conversation is `sdk/org/apps/web/src/routes/chat/$projectId/index.tsx#ChatProject` |
| `sdk/org/apps/web/src/routes/chat/$projectId/$sessionId.tsx` | `/chat/<project>/<conversation>` | `ChatConversation` | an open conversation `sdk/org/apps/web/src/routes/chat/$projectId/$sessionId.tsx#ChatConversation` |

All three leaves render the same `ChatRouteShell`, which is a `-`-prefixed file and therefore **not** itself a route `sdk/org/apps/web/src/routes/chat/-shell.tsx#ChatRouteShell`.

The generated tree confirms the wiring: `ChatRouteRoute` is `id:'/chat', path:'/chat'` under the root `sdk/org/apps/web/src/routeTree.gen.ts#ChatRouteRoute`, with `ChatIndexRoute` `sdk/org/apps/web/src/routeTree.gen.ts#ChatIndexRoute`, `ChatProjectIdIndexRoute` `sdk/org/apps/web/src/routeTree.gen.ts#ChatProjectIdIndexRoute` and `ChatProjectIdSessionIdRoute` `sdk/org/apps/web/src/routeTree.gen.ts#ChatProjectIdSessionIdRoute` as children — i.e. `fullPath` `/chat/`, `/chat/$projectId/` and `/chat/$projectId/$sessionId`.

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

`PodEnsureGate` (shared verbatim with `/studio`, `/computer`, `/apps`) short-circuits for pod-embedded / local runs (`if (isPodEmbedded() || isLocalRun()) return <>{children}</>`) `sdk/org/apps/web/src/lib/gates.tsx#PodEnsureGate`; otherwise it ensures the pod, waits for its Envoy edge, offers an image upgrade, and keeps the pod warm before children mount. The endpoints it calls are listed in [features.md](./features.md).

Because it is the **layout**, it wraps all three leaves: a pasted conversation link waits for a cold pod exactly as `/chat` does. Unlike `/studio` (which also mounts `AppProvider`/`ProjectProvider`), the chat layout mounts **no data providers** — chat owns its own Zustand store and fetches directly.

### Why the id in the URL is stable

`POST /api/sessions {projectId, resumeSessionId}` returns **the same id** it was given — an already-live session is returned as-is (`if (this.sessions.has(resumeId)) return { sessionId: resumeId }`), and a persisted one is rehydrated from `<project>/sessions/<id>/snapshot.json` under that same id `sdk/org/libs/cli/src/server/session-manager.ts:1244-1305`. That is what makes `/chat/<project>/<conversation>` worth bookmarking and worth sharing: it survives the pod scaling to zero, and it is what the session list already keys on.

---

## 3. Params & URL state

### The location: two params, one direction

`projectId` and `sessionId` are the surface's **location**, modelled as `ChatLocation` `sdk/org/libs/ui/src/chat/app/chat-nav.tsx#ChatLocation`. Both are nullable because both nulls are states a user sits in — "no project resolved yet" (`/chat`) and "no conversation open" (`/chat/<project>`).

`@lmthing/ui` cannot import a router: the same `ChatShell` mounts under TanStack Router on web, in a plain hidden/shown pane on desktop `sdk/org/apps/desktop/src/HomeShell.tsx:230`, and in a React Native app with no history stack at all `sdk/org/apps/mobile/App.tsx:425`. So the surface declares what it needs from a host — where am I, and take me there — as `ChatNavHost` `sdk/org/libs/ui/src/chat/app/chat-nav.tsx#ChatNavHost`, and `useChatNav()` hands every component the same verbs whether or not one is wired `sdk/org/libs/ui/src/chat/app/chat-nav.tsx#useChatNav`. With no host the **store** is the location, so desktop and mobile keep working through the identical code path.

The web host is `ChatRouteShell`, which maps a `ChatLocation` onto one of the three routes `sdk/org/apps/web/src/routes/chat/-shell.tsx#ChatRouteShell`.

Flow is **one-way — location → state**. `ChatShell` is the only place that writes `activeProjectId`/`activeSessionId` or touches the socket, and it does so from the location `sdk/org/libs/ui/src/chat/app/ChatShell.tsx#ChatShell`. Nothing else in the surface sets those fields; components navigate instead (`Sidebar`'s project picker and conversation rows `sdk/org/libs/ui/src/chat/app/Sidebar.tsx#Sidebar`, `NoSessionPane`'s New chat `sdk/org/libs/ui/src/chat/app/NoSessionPane.tsx#NoSessionPane`, `AppShell`'s `Alt+N` `sdk/org/libs/ui/src/chat/app/AppShell.tsx#AppShell`). A click that wrote state and let the URL trail behind it is precisely what makes a back button misbehave.

### Push or replace

| Navigation | Entry | Why |
|---|---|---|
| Pick a project, open a conversation, start a new chat | **push** | the user asked; Back should undo it |
| `/chat` → `/chat/<default project>` | **replace** | the app answering the user's question; a push would make Back re-ask and bounce forward again |
| Leaving a conversation that was just deleted | **replace** | the entry would point at a dead id |
| Leaving a project that was just deleted | **replace** | same |

`replace` is a required field on `ChatNavHost.navigate`, and the verbs on `ChatNav` each fix it — `openProject`/`openSession` push, `closeSession`/`redirect` replace `sdk/org/libs/ui/src/chat/app/chat-nav.tsx#ChatNav`. Both deletes navigate **before** the DELETE lands, so the surface never renders "that project isn't here" for something the user removed on purpose `sdk/org/libs/ui/src/chat/app/Sidebar.tsx#Sidebar`.

### Reaching a conversation

Every route to an open conversation — a sidebar click, a fresh chat, a pasted link, a reload, Back, Forward — ends in the same effect, which calls `openSession` `sdk/org/libs/ui/src/chat/app/ChatShell.tsx#ChatShell`. That function is idempotent (the conversation already connected returns immediately, so re-renders cost nothing) and race-guarded: every call takes a token and only the newest one may touch the socket when its POST returns `sdk/org/libs/ui/src/chat/app/session-control.ts#openSession`. Holding Back walks several entries in a few hundred milliseconds, each starting a resume; without the token the surface would land on whichever POST answered last.

`closeActiveSession()` bumps the same token, so a resume in flight cannot resurrect a conversation the user has left `sdk/org/libs/ui/src/chat/app/session-control.ts#closeActiveSession`.

Two panes exist only because the location can be wrong or slow `sdk/org/libs/ui/src/chat/app/RoutePanes.tsx#MissingPane`:

- **opening** — a cold deep link rehydrating from a snapshot `sdk/org/libs/ui/src/chat/app/RoutePanes.tsx#OpeningPane`
- **not here** — the project or conversation the URL names does not exist (deleted, mistyped, another account)

Both render **inside** the shell, next to the sidebar, so the conversation list and project switcher stay on screen; a full-page error would be correct and impossible to leave `sdk/org/libs/ui/src/chat/app/AppShell.tsx#AppShell`.

### The querystring: a view of the open conversation

Distinct from the location, and owned by `url-state.ts` rather than the router. These name things **inside** the conversation, so they are deliberately not carried across a conversation switch `sdk/org/apps/web/src/routes/chat/-shell.tsx#ChatRouteShell`.

| Key | Values | Read at | Written by |
|---|---|---|---|
| `node` | a trace node id | mount → `selectNode(node, true)` `sdk/org/libs/ui/src/chat/app/url-state.ts#applyUrlToState` | store subscription `sdk/org/libs/ui/src/chat/app/url-state.ts#syncStateToUrl` |
| `tab` | an `InspectorTab` | mount → `setTab(tab)` `sdk/org/libs/ui/src/chat/app/url-state.ts#applyUrlToState` | always written `sdk/org/libs/ui/src/chat/app/url-state.ts#syncStateToUrl` |
| `follow` | `0` disables follow-mode | mount → `setFollow(false)` `sdk/org/libs/ui/src/chat/app/url-state.ts#applyUrlToState` | written only when `follow` is off `sdk/org/libs/ui/src/chat/app/url-state.ts#syncStateToUrl` |
| `inspect` | `1` opens the DevPanel | `AppShell` mount effect `sdk/org/libs/ui/src/chat/app/AppShell.tsx#AppShell` | never written back (also toggled by `Alt+I`) |

`syncStateToUrl()` subscribes to the store and **patches** the query through the platform seam — a replacement would drop keys the surface does not own `sdk/org/libs/ui/src/chat/app/url-state.ts#syncStateToUrl` `sdk/org/libs/ui/src/platform/deep-link.ts#writeLinkParams`. It is a `history.replaceState`, not a router navigation, so it never remounts the transcript.

### The document title

The open conversation's title is the tab's title, prefixed by run state (`⟳ 2 running · …`, `✓ done · …`, `⏵ replay · …`) `sdk/org/libs/ui/src/chat/app/AppShell.tsx#AppShell`. Once every conversation has its own history entry, the browser's own back-stack menu is labelled by this; "THING" on all of them makes it unreadable.

### Leaving the surface

The only cross-surface navigation from chat is a hard hop to Studio when a space is clicked in the sidebar `sdk/org/libs/ui/src/chat/app/Sidebar.tsx#Sidebar`:

```ts
openUrl(`${crossAppOrigin('studio')}/studio/${encodeURIComponent(activeProjectId)}/${encodeURIComponent(spaceId)}`);
```

---

## 4. Ancestry, in one line

```
__root.tsx                            AuthProvider("studio") → AuthGate → PinGate → Outlet
└── /chat                             PodEnsureGate → Outlet                    (chat/route.tsx)
    ├── /chat/                        <ChatRouteShell/>            → default project, replace
    ├── /chat/$projectId/             <ChatRouteShell projectId/>  → project open, no conversation
    └── /chat/$projectId/$sessionId   <ChatRouteShell …/>          → the conversation
```

Auth and the PIN gate are the root's job, not chat's `sdk/org/apps/web/src/routes/__root.tsx:15-29`; pod readiness is the layout's job `sdk/org/apps/web/src/routes/chat/route.tsx#ChatLayout`; everything else is `ChatShell`.

Covered by `sdk/org/libs/ui/src/chat/app/chat-route.test.tsx` (the location contract, push/replace, Back, the missing/opening panes, and the no-host desktop/mobile path) and `sdk/org/libs/ui/src/chat/app/session-control.test.ts` (idempotence and the two out-of-order races).
