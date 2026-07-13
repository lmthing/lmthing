# /computer — Views & Components

What each screen of the Computer surface renders, and which component draws it. For the URL→file map and the endpoints each screen calls, see [./routes.md](./routes.md).

Two trees make up the surface:

- **Route + hook files** — `sdk/org/apps/web/src/routes/computer/**` (thin composition: they hold state and pass props down).
- **Presentational components** — `sdk/org/libs/ui/src/computer/**`, re-exported from the `@lmthing/ui/computer` barrel `sdk/org/libs/ui/src/computer/index.ts:1-37`.

Every component in that barrel imports a token-driven stylesheet from `@lmthing/css` (one CSS file per component under `sdk/org/libs/css/src/components/computer/`, 15 files) — e.g. `import '@lmthing/css/components/computer/ide-layout.css'` `sdk/org/libs/ui/src/computer/ide-layout.tsx:1`.

---

## Shells — which chrome wraps a screen

The layout route decides between two shells based on the pathname: at exactly `/computer` it renders a bare `<Outlet/>` (the IDE is full-screen, no sidebar); every other `/computer/*` path is wrapped in `<ComputerLayout>` `sdk/org/apps/web/src/routes/computer/route.tsx:62-80`.

```tsx
// routes/computer/route.tsx — ComputerShell
// IDE gets full-screen layout (no sidebar) at /computer.
if (currentPath === '/computer') {
  return <Outlet />
}
return (
  <ComputerLayout status={status} tier="flyio" currentPath={currentPath} … >
    <Outlet />
  </ComputerLayout>
)
```

### `ComputerLayout` — the sidebar shell

`sdk/org/libs/ui/src/computer/computer-layout.tsx#ComputerLayout` renders a left `Sidebar` + a `TopBar` + a `ConnectionBanner` + the routed children:

- **Nav items** — `Dashboard → /computer`, `Terminal → /computer/terminal`, `Spaces → /computer/spaces`, `Settings → /computer/settings` `sdk/org/libs/ui/src/computer/computer-layout.tsx#navItems`. Note the "Dashboard" entry points at `/computer`, which actually renders the IDE (see [routes.md](./routes.md)).
- **Cross-app links** — `otherAppLinks('computer')` at the sidebar foot `sdk/org/libs/ui/src/computer/computer-layout.tsx:50-60`.
- **`⏻ Restart` item** — becomes `↻ Restarting…` and is click-disabled while `restarting` `sdk/org/libs/ui/src/computer/computer-layout.tsx:61-69`.
- **TopBar** — `CozyThingText "lmthing.computer"` plus two badges: the runtime `status`, and a tier badge that reads `Computer` for `flyio`, else `Free` `sdk/org/libs/ui/src/computer/computer-layout.tsx:73-83`.

### `ConnectionBanner`

Returns `null` when `state === 'connected'`; otherwise a colored strip — `Starting runtime...` (booting) or the error text with a **Retry** button (error, wired to `boot`) `sdk/org/libs/ui/src/computer/connection-banner.tsx#ConnectionBanner`. `ComputerLayout` derives the state from the runtime status: `error → 'error'`, `booting → 'booting'`, anything else → `'connected'` `sdk/org/libs/ui/src/computer/computer-layout.tsx#ComputerLayout`.

### `WakingScreen` (above all of this)

Before any of the shells mount, `PodEnsureGate` renders a full-screen `WakingScreen` in one of three modes — `signing-in`, `waking`, `upgrading` — with a monotonic progress bar fed from the gateway's cold-boot milestones `sdk/org/apps/web/src/lib/gates.tsx:401-418` · `sdk/org/apps/web/src/lib/waking-screen.tsx#WakingScreen`.

---

## The IDE (`/computer`)

`IdeRoute` is a pure composition: it calls `useIde()` and spreads the result into `<IdeLayout>` `sdk/org/apps/web/src/routes/computer/index.tsx#IdeRoute`. `useIde()` merges four sources — `useComputer().status`, `useIdeStore()`, `useIdeFiles()`, `useIdeTerminals(status, transport)`, `usePodRestart()` `sdk/org/apps/web/src/routes/computer/use-ide.ts#useIde`.

### `IdeLayout` — the frame

`sdk/org/libs/ui/src/computer/ide-layout.tsx#IdeLayout`:

- **Header** — `CozyThingText "lmthing.computer"`, a nav row (`Terminal`, `Spaces`, `Settings` — no Dashboard entry) `sdk/org/libs/ui/src/computer/ide-layout.tsx#navItems`, a status area, and the `⏻` restart button (`↻` while restarting) `sdk/org/libs/ui/src/computer/ide-layout.tsx:77-86`.
- **Status area** — a spinner + `Booting...` / `Installing dependencies...` when `isBooting`/`isInstalling`, else a `Badge` with the raw status string `sdk/org/libs/ui/src/computer/ide-layout.tsx:70-76`.
- **Body** — `react-resizable-panels`: a horizontal `PanelGroup` with `IdeFileTree` (15%, min 10 / max 30) beside a vertical `PanelGroup` of `IdeEditor` (70%) over `IdeTerminal` (30%) `sdk/org/libs/ui/src/computer/ide-layout.tsx#IdeLayout`.

### `IdeFileTree` — files pane

`sdk/org/libs/ui/src/computer/ide-file-tree.tsx#IdeFileTree` renders a `Files` header with **New File** / **New Folder** buttons (creating at root `'.'`) and a recursive `IdeFileTreeItem` list. Each item `sdk/org/libs/ui/src/computer/ide-file-tree.tsx#IdeFileTreeItem`:

- directories toggle open/closed locally (chevron + folder icon); files call `onFileSelect(path)` `sdk/org/libs/ui/src/computer/ide-file-tree.tsx:49-55`;
- a Radix `ContextMenu` offers **New File**, **New Folder** and a danger **Delete** `sdk/org/libs/ui/src/computer/ide-file-tree.tsx:93-107`;
- creation opens a Radix `Dialog` with a name input (Enter submits); the parent is the node itself for a directory, otherwise the node's parent dir `sdk/org/libs/ui/src/computer/ide-file-tree.tsx:57-64`.

The tree data is `buildTree(paths)` over the flat path list from `GET /api/fs/tree` `sdk/org/apps/web/src/routes/computer/use-ide-files.ts:65` · `sdk/org/apps/web/src/lib/file-tree.ts`.

### `IdeEditor` — Monaco tabs

`sdk/org/libs/ui/src/computer/ide-editor.tsx#IdeEditor`: a tab strip over the open files (basename + an `X` close button that `stopPropagation`s) and a `MonacoEditor` for the active file. With no open file the strip shows `Select a file to edit` and the body `No file open` `sdk/org/libs/ui/src/computer/ide-editor.tsx:31-34,72-74`. Language comes from the extension via `LANG_MAP` (js/jsx→javascript, ts/tsx→typescript, json, html, css, md, svg→xml; anything else → `plaintext`) `sdk/org/libs/ui/src/computer/ide-editor.tsx:15-25`. Editor options: `theme="vs-dark"`, minimap off, fontSize 14, tabSize 2, `automaticLayout` `sdk/org/libs/ui/src/computer/ide-editor.tsx:62-70`.

> Note: the Monaco theme is hard-pinned to `vs-dark` rather than following the design-token theme.

### `IdeTerminal` — terminal dock

`sdk/org/libs/ui/src/computer/ide-terminal.tsx#IdeTerminal`: a tab strip plus one `<Terminal>` pane per tab (inactive panes are hidden, not unmounted, so scrollback survives a tab switch) `sdk/org/libs/ui/src/computer/ide-terminal.tsx:51-60`. `readonly` tabs render no close button `sdk/org/libs/ui/src/computer/ide-terminal.tsx:34-42`; a `+` tile calls `onAddTab` `sdk/org/libs/ui/src/computer/ide-terminal.tsx:45-49`.

Tabs come from `useIdeTerminals` `sdk/org/apps/web/src/routes/computer/use-ide-terminals.ts#useIdeTerminals`: two always-on tabs seeded up-front — `cli` (label **process**, `readonly: true`) and `bash` (the initially active one) `sdk/org/apps/web/src/routes/computer/use-ide-terminals.ts#useIdeTerminals` — each bound to a `transport.connectTerminal()` PTY once `status === 'running'`; the readonly one runs

```ts
const CLI_LOG_COMMAND = 'tail -n 100 -f /tmp/lmthing-server.log 2>/dev/null || sleep 9999'
```

`sdk/org/apps/web/src/routes/computer/use-ide-terminals.ts#CLI_LOG_COMMAND,25-26`. `handleAddTab` appends a `bash-<Date.now()>` tab with its own session `sdk/org/apps/web/src/routes/computer/use-ide-terminals.ts:47-55`.

### `Terminal` (shared element)

`sdk/org/libs/ui/src/elements/content/terminal/index.tsx#Terminal` — the xterm host used by BOTH the IDE tabs and the full-page terminal route. It lazily constructs `XTerm` only once the container has non-zero dimensions (a `ResizeObserver` retries `tryInit`) `sdk/org/libs/ui/src/elements/content/terminal/index.tsx:32-72`, loads the `FitAddon` + `WebLinksAddon`, pipes `session.onData → xterm.write`, and pipes `xterm.onData → session.write` **only when not `readonly`** `sdk/org/libs/ui/src/elements/content/terminal/index.tsx:86-101`. A second `ResizeObserver` refits and forwards `session.resize(cols, rows)` `sdk/org/libs/ui/src/elements/content/terminal/index.tsx:104-120`.

### IDE state hooks

| Hook | Renders/feeds | Behaviour |
|---|---|---|
| `useIdeFiles` `sdk/org/apps/web/src/routes/computer/use-ide-files.ts#useIdeFiles` | `fileTree`, `fileContents` | `listFiles()` on mount; `readFile()` lazily on select with an in-memory cache; `handleContentChange` writes through a **1500 ms per-path debounce** `sdk/org/apps/web/src/routes/computer/use-ide-files.ts:23-41`; `handleCreateDirectory` writes `<dir>/.gitkeep` because there is no mkdir endpoint `sdk/org/apps/web/src/routes/computer/use-ide-files.ts:96-106`; `handleDelete` is **local-only** ("no delete API yet") `sdk/org/apps/web/src/routes/computer/use-ide-files.ts:108-120` |
| `useIdeStore` (zustand) `sdk/org/apps/web/src/lib/store.ts#useIdeStore` | `openFiles`, `activeFile`, `fileContents` | Editor tab state. Also holds `isBooting`/`isInstalling`/`isRunning`/`installComplete` flags `sdk/org/apps/web/src/lib/store.ts:56-63` |
| `usePodRestart` `sdk/org/apps/web/src/routes/computer/use-pod-restart.ts#usePodRestart` | the `⏻` button | `POST /api/restart`, then poll `GET /api/env` every 800 ms until 200, then `window.location.reload()` |

> **Gap:** nothing in the codebase ever calls `setBooting`/`setInstalling` — the store's boot flags are leftovers, so `IdeLayout`'s `Installing dependencies...` state is unreachable and `isBooting` is only ever true via `files.isLoading` `sdk/org/apps/web/src/routes/computer/index.tsx:16-17`.

---

## Dashboard (`/computer/dashboard`)

`DashboardRoute` renders `<BootProgress tier="flyio">` while the status is neither `running` nor `error`, otherwise `<ComputerDashboard>` `sdk/org/apps/web/src/routes/computer/dashboard.tsx#DashboardRoute`. Uptime is computed **client-side** from a `useRef(Date.now())` captured at first render — it is not pod uptime `sdk/org/apps/web/src/routes/computer/dashboard.tsx#DashboardRoute`.

`ComputerDashboard` is a grid of six panels `sdk/org/libs/ui/src/computer/computer-dashboard.tsx#ComputerDashboard`:

| Panel | Renders | Source |
|---|---|---|
| `StatusCard` | status dot + text, a tier badge (`Computer` for `flyio`, else `Free`), and `Uptime: 1h 2m` / `3m 4s` / `--` via `formatUptime` | `sdk/org/libs/ui/src/computer/status-card.tsx:17-53` |
| `MetricsCard` | CPU % and Memory `used MB / total MB`, each with a fill bar; `N/A` when the value is `null` | `sdk/org/libs/ui/src/computer/metrics-card.tsx#MetricsCard` |
| `ProcessesPanel` | `N running` + one `ListItem` per process (command, `PID n`); `No processes` when empty | `sdk/org/libs/ui/src/computer/processes-panel.tsx#ProcessesPanel` |
| `AgentsPanel` | `N active` + one `ListItem` per agent with an `idle`/`running`/`error` badge; `No agents running` when empty | `sdk/org/libs/ui/src/computer/agents-panel.tsx#AgentsPanel` |
| `LogsViewer` | full-width; filter buttons `all/info/warn/error/debug`, auto-scroll to bottom on new entries, rows of `HH:MM:SS [source] message` (warn/error color-modified) | `sdk/org/libs/ui/src/computer/logs-viewer.tsx#LogsViewer` |
| `NetworkPanel` | full-width; `N requests` + `METHOD url` + status badge (`success` under 400) + duration; renders `Not available on free tier` when `tier === 'webcontainer'` | `sdk/org/libs/ui/src/computer/network-panel.tsx#NetworkPanel` · `sdk/org/libs/ui/src/computer/computer-dashboard.tsx:48` |

`BootProgress` is a stepper that returns `null` once `stage === 'running'`; it picks `flyioSteps` (Connecting to Fly.io node → Authenticating → Runtime ready) or `webcontainerSteps` from the `tier` prop `sdk/org/libs/ui/src/computer/boot-progress.tsx:11-33`.

> **Gap — the dashboard panels cannot populate today.** `PodRuntime` sends `{type:'subscribe', channels:['metrics','processes','agents','logs','network']}` on socket open `sdk/org/apps/web/src/lib/runtime/pod.ts#PodRuntime.constructor`, but the pod's control socket only implements `auth.ok` + `terminal.*` and silently ignores `subscribe` `sdk/org/libs/cli/src/server/ws/agent.ts#registerControlSocket`. The only rows the dashboard can ever show are the client-generated log entries from `PodRuntime.emitLog` (boot/connection messages) `sdk/org/apps/web/src/lib/runtime/pod.ts#PodRuntime.emitLog`; `metrics`/`processes`/`agents`/`network` stay at their `initialState` empties `sdk/org/apps/web/src/lib/runtime/ComputerContext.tsx#initialState`.

---

## Terminal (`/computer/terminal`)

A single full-page `<Terminal session>` `sdk/org/apps/web/src/routes/computer/terminal.tsx:49`. The session is created with `createTerminalSession()` from `ComputerContext` once `status === 'running'`, and disposed on unmount `sdk/org/apps/web/src/routes/computer/terminal.tsx#TerminalRoute`. This is a **different transport from the IDE tabs**: it rides the `/api/ws` control socket (`terminal.open/input/resize/close` messages) `sdk/org/apps/web/src/lib/runtime/pod.ts#PodRuntime.createTerminalSession`, whereas IDE tabs open a dedicated `WS /api/terminals/:id` per tab via `PodTransport.connectTerminal` `sdk/org/apps/web/src/routes/computer/use-ide-terminals.ts:25-26`.

While not running it renders `<BootProgress tier={tier} …>` `sdk/org/apps/web/src/routes/computer/terminal.tsx:40-47`.

> **Bug:** the route destructures `tier` from `useComputer()` `sdk/org/apps/web/src/routes/computer/terminal.tsx#TerminalRoute`, but `ComputerContextValue` has no `tier` field `sdk/org/apps/web/src/lib/runtime/ComputerContext.tsx#ComputerContextValue` — so `BootProgress` receives `undefined` and falls back to the legacy `webcontainerSteps` list `sdk/org/libs/ui/src/computer/boot-progress.tsx:33`. `apps/web` has no `typecheck` script (only `dev`/`build`/`lint`/`format`) `sdk/org/apps/web/package.json:7-13`, so this is not caught in CI.

---

## Settings (`/computer/settings`)

A `Page` of five `Card`s `sdk/org/apps/web/src/routes/computer/settings.tsx#Settings`:

1. **Account** — `<Account/>` from `@lmthing/ui/elements/settings/account`.
2. **Runtime** — a static `Dedicated Pod` badge, `Status: {status}` from `useComputer()`, and the hardcoded caption `0.5 CPU, 1 GB memory. Always-on with full metrics and terminal access.` `sdk/org/apps/web/src/routes/computer/settings.tsx:36-46`.
3. **Models** — `<Models/>` (gateway `/api/compute/env` + pod `/api/prices/azure`) `sdk/org/libs/ui/src/elements/settings/models/index.tsx`.
4. **Environment Variables** — `<EnvVars/>` with the caption "Saving will restart your pod" `sdk/org/apps/web/src/routes/computer/settings.tsx:57-67` · `sdk/org/libs/ui/src/elements/settings/env-vars/index.tsx`.
5. **Billing** — `<Billing/>` (Stripe portal) `sdk/org/libs/ui/src/elements/settings/billing/index.tsx`.

---

## Stub views

| Route | Renders |
|---|---|
| `/computer/spaces` | only `<h1>Spaces</h1>` `sdk/org/apps/web/src/routes/computer/spaces/index.tsx#SpaceList` |
| `/computer/spaces/$spaceId` | `<h1>Space: {spaceId}</h1>` `sdk/org/apps/web/src/routes/computer/spaces/$spaceId/index.tsx:33-39` |
| `/computer/spaces/$spaceId/config` | `<h1>Config: {spaceId}</h1>` `sdk/org/apps/web/src/routes/computer/spaces/$spaceId/config.tsx:47-53` |
| `/computer/spaces/$spaceId/logs` | `<h1>Logs: {spaceId}</h1>` `sdk/org/apps/web/src/routes/computer/spaces/$spaceId/logs.tsx:61-67` |
| `/computer/login` | `<Navigate to="/"/>` when authenticated, else `null` — the real login screen is `AuthGate` in the root route `sdk/org/apps/web/src/routes/computer/login.tsx#Login` |

Both `ComputerLayout` and `IdeLayout` link to `/computer/spaces` even though it has no content `sdk/org/libs/ui/src/computer/computer-layout.tsx#navItems` · `sdk/org/libs/ui/src/computer/ide-layout.tsx#navItems`.

---

## Exported but unused

`IdePreview` `sdk/org/libs/ui/src/computer/ide-preview.tsx#IdePreview` — an address bar + refresh button + sandboxed `<iframe>` for a dev-server URL. It is exported from the barrel `sdk/org/libs/ui/src/computer/index.ts:14,35` but no route or component imports it (verified by `rg 'IdePreview'` across `apps/` and `libs/`, which only hits the component file and the barrel). It is not wired into `IdeLayout` `sdk/org/libs/ui/src/computer/ide-layout.tsx#IdeLayout`.

---

## Two incompatible `RuntimeTier` types (worth knowing when reading these files)

`RuntimeTier` means two different things in the two trees: `'pod'` in the app's runtime types `sdk/org/apps/web/src/lib/runtime/types.ts#RuntimeTier` · `sdk/org/apps/web/src/lib/runtime/pod.ts#PodRuntime.tier`, but `'webcontainer' | 'flyio'` in the UI components `sdk/org/libs/ui/src/computer/status-card.tsx#RuntimeTier` · `sdk/org/libs/ui/src/computer/boot-progress.tsx#BootProgressProps.stage`. The routes bridge this by passing the literal `"flyio"` `sdk/org/apps/web/src/routes/computer/route.tsx:70` · `sdk/org/apps/web/src/routes/computer/dashboard.tsx#DashboardRoute,34`, which is why the badge reads `Computer` rather than `Free` `sdk/org/libs/ui/src/computer/status-card.tsx#StatusCard`.
