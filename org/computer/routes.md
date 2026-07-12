# /computer — route tree

Every route of the Computer surface lives in `sdk/org/apps/web/src/routes/computer/`. The surface is part of the ONE unified Vite SPA (`sdk/org/apps/web`); `/computer` is a client-side route, and the hostname `lmthing.computer` is redirected to it at `/` by `HOST_SURFACE` `sdk/org/apps/web/src/routes/index.tsx:5-10` (unknown hosts fall back to `/studio` — `:23`).

The authoritative file → URL mapping is the generated TanStack route tree `sdk/org/apps/web/src/routeTree.gen.ts:660-741` (`ComputerRouteRouteImport`, `ComputerIndexRouteImport`, `ComputerDashboardRouteImport`, `ComputerTerminalRouteImport`, `ComputerSettingsRouteImport`, `ComputerLoginRouteImport`, `ComputerSpacesIndexRouteImport`, `ComputerSpacesSpaceIdIndexRouteImport`, `ComputerSpacesSpaceIdConfigRouteImport`, `ComputerSpacesSpaceIdLogsRouteImport`).

See [./views.md](./views.md) for what each route renders and [./features.md](./features.md) for the behaviours (file sync, terminals, restart, pod gate) behind them.

## Route table

| Route file | URL | Component | Notes |
|---|---|---|---|
| `routes/computer/route.tsx` | `/computer` (layout) | `ComputerLayoutRoot` | `createFileRoute('/computer')` `sdk/org/apps/web/src/routes/computer/route.tsx:122-124` |
| `routes/computer/index.tsx` | `/computer` (index) | `IdeRoute` | `createFileRoute('/computer/')` `sdk/org/apps/web/src/routes/computer/index.tsx:5-7` |
| `routes/computer/dashboard.tsx` | `/computer/dashboard` | `DashboardRoute` | `sdk/org/apps/web/src/routes/computer/dashboard.tsx:7-9` |
| `routes/computer/terminal.tsx` | `/computer/terminal` | `TerminalRoute` | `sdk/org/apps/web/src/routes/computer/terminal.tsx:8-10` |
| `routes/computer/settings.tsx` | `/computer/settings` | `Settings` | `sdk/org/apps/web/src/routes/computer/settings.tsx:13-15` |
| `routes/computer/login.tsx` | `/computer/login` | `Login` | `sdk/org/apps/web/src/routes/computer/login.tsx:4-6` |
| `routes/computer/spaces/index.tsx` | `/computer/spaces` | `SpaceList` | `createFileRoute('/computer/spaces/')` `sdk/org/apps/web/src/routes/computer/spaces/index.tsx:3-5` |
| `routes/computer/spaces/$spaceId/index.tsx` | `/computer/spaces/$spaceId` | `SpaceDetail` | `sdk/org/apps/web/src/routes/computer/spaces/$spaceId/index.tsx:3-5` |
| `routes/computer/spaces/$spaceId/config.tsx` | `/computer/spaces/$spaceId/config` | `SpaceConfig` | `sdk/org/apps/web/src/routes/computer/spaces/$spaceId/config.tsx:3-5` |
| `routes/computer/spaces/$spaceId/logs.tsx` | `/computer/spaces/$spaceId/logs` | `SpaceLogs` | `sdk/org/apps/web/src/routes/computer/spaces/$spaceId/logs.tsx:3-5` |

Non-route files in the same directory (hooks, not routes): `use-ide.ts` (composes the IDE props — `sdk/org/apps/web/src/routes/computer/use-ide.ts:12-29`), `use-ide-files.ts`, `use-ide-terminals.ts` (`sdk/org/apps/web/src/routes/computer/use-ide-terminals.ts:6` `CLI_LOG_COMMAND`), `use-pod-restart.ts` (`sdk/org/apps/web/src/routes/computer/use-pod-restart.ts:38-59`).

## Ancestors

`/computer` sits under the shared root route, which supplies auth and the PIN gate for every surface: `AuthProvider(appName='studio') → AuthGate → PinGate → <Outlet/>` `sdk/org/apps/web/src/routes/__root.tsx:15-29`. The Computer surface therefore owns no login logic of its own — `/computer/login` is vestigial: it renders `<Navigate to="/"/>` when authenticated and `null` otherwise, with a comment stating the real `LoginScreen` comes from `AuthGate` `sdk/org/apps/web/src/routes/computer/login.tsx:8-13`.

## The `/computer` layout route

`route.tsx` is a pure-wrapper layout: `RepoSyncGate → PodEnsureGate → PodReadyTree → ComputerShell` `sdk/org/apps/web/src/routes/computer/route.tsx:110-120`.

- `RepoSyncGate` calls `useRepoSync` from `@lmthing/auth` with the session and the `github_token` from localStorage, syncing the user's GitHub repo into the pod filesystem `sdk/org/apps/web/src/routes/computer/route.tsx:11-27`.
- `PodEnsureGate` is the shared pod-readiness gate (cold wake, upgrade prompt, edge probe, keepalive); it short-circuits entirely when `isPodEmbedded() || isLocalRun()` `sdk/org/apps/web/src/lib/gates.tsx:216-219`. Details in [./features.md](./features.md).
- `PodReadyTree` mounts the providers for the subtree: `ComputerProvider(computerBaseUrl=COMPUTER_BASE_URL)` → `AppProvider(pod:{podBaseUrl, getAccessToken, refresh})` → `ProjectProvider(projectId="user")` → `SpaceProvider(spaceId="default")` `sdk/org/apps/web/src/routes/computer/route.tsx:84-103`. The project and space ids are **hardcoded**, so merely visiting any `/computer/*` route also drives the project/space REST calls those providers make.

`ComputerShell` chooses the chrome: when `location.pathname === '/computer'` it returns a bare `<Outlet/>` (the IDE is full-screen, no sidebar), otherwise it wraps the outlet in `<ComputerLayout>` with `tier="flyio"` `sdk/org/apps/web/src/routes/computer/route.tsx:62-80`. It also listens for `window.postMessage({type:'lmthing:navigate', path})` and routes to `path` — the pod-embedded iframe navigation seam `sdk/org/apps/web/src/routes/computer/route.tsx:37-44` — and owns a restart handler (`POST /api/restart`, then poll `GET /api/env` until 200, then reload) `sdk/org/apps/web/src/routes/computer/route.tsx:46-60`, which duplicates `usePodRestart` `sdk/org/apps/web/src/routes/computer/use-pod-restart.ts:42-56`.

```tsx
// sdk/org/apps/web/src/routes/computer/route.tsx:62-65
// IDE gets full-screen layout (no sidebar) at /computer.
if (currentPath === '/computer') {
  return <Outlet />
}
```

## Navigation into these routes

Two different nav bars exist, and neither covers the whole tree:

- The sidebar shell (`ComputerLayout`, used by every route EXCEPT `/computer`) lists `{path:'/computer', label:'Dashboard'}, '/computer/terminal', '/computer/spaces', '/computer/settings'` `sdk/org/libs/ui/src/computer/computer-layout.tsx:22-27`.
- The IDE shell (`IdeLayout`, used at `/computer`) lists only `'/computer/terminal', '/computer/spaces', '/computer/settings'` `sdk/org/libs/ui/src/computer/ide-layout.tsx:48-52`.

Consequences worth knowing:

- The sidebar's "Dashboard" item points at `/computer`, which renders the **IDE**, not the dashboard `sdk/org/apps/web/src/routes/computer/index.tsx:9-38`. **`/computer/dashboard` is not linked from any nav** — it is reachable only by typing the URL.
- `/computer/login` is likewise unlinked (and inert, see above).

## Route-level gaps (verified in source)

- The four `spaces/` routes are placeholders: each renders a single heading (`<h1>Spaces</h1>`, `Space: {spaceId}`, `Config: {spaceId}`, `Logs: {spaceId}`) `sdk/org/apps/web/src/routes/computer/spaces/index.tsx:7-13` · `sdk/org/apps/web/src/routes/computer/spaces/$spaceId/index.tsx:7-14` · `sdk/org/apps/web/src/routes/computer/spaces/$spaceId/config.tsx:7-14` · `sdk/org/apps/web/src/routes/computer/spaces/$spaceId/logs.tsx:7-14`. They are linked from both nav bars but have no functionality.
- `/computer/terminal` destructures `tier` from `useComputer()` `sdk/org/apps/web/src/routes/computer/terminal.tsx:13` and passes it to `<BootProgress tier={tier}>` `:42-46`, but `ComputerContextValue` declares no `tier` field `sdk/org/apps/web/src/lib/runtime/ComputerContext.tsx:14-26` — so `undefined` is passed while booting. It is not caught at build time because `apps/web`'s scripts are only `dev/build/preview/lint*/format` — there is no `typecheck` script `sdk/org/apps/web/package.json:7-14`.
- `/computer/dashboard` hardcodes `tier="flyio"` for both `<BootProgress>` and `<ComputerDashboard>` `sdk/org/apps/web/src/routes/computer/dashboard.tsx:24-42`, and derives uptime client-side from a `useRef(Date.now())` at first render `:19-20` — it is not pod uptime.

> UNVERIFIED: whether `/computer/login` and the `spaces/*` placeholder routes are intentionally retained (searched `rg -n "computer/login|computer/spaces" sdk/org` — only the nav-item and route definitions above; no issue file or TODO explains them).

## Cross-links

- What each route renders (IDE panes, dashboard cards, settings cards, terminal) → [./views.md](./views.md)
- Pod gate, file sync, terminals, restart, and the endpoints each route calls → [./features.md](./features.md)
- The pod endpoints themselves → [../cli-api/rest/README.md](../cli-api/rest/README.md) (notably [../cli-api/rest/fs.md](../cli-api/rest/fs.md), [../cli-api/rest/env.md](../cli-api/rest/env.md), [../cli-api/rest/projects.md](../cli-api/rest/projects.md), [../cli-api/rest/misc.md](../cli-api/rest/misc.md) for `/api/restart` + `/api/keepalive`)
