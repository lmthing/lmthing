# `/computer` — features

What the Computer surface actually does, and which pod / gateway endpoint each feature calls.

`/computer` is **a browser IDE over the user's compute pod** — a pod-rooted file tree + Monaco editor + xterm terminals — plus a runtime dashboard, a settings page, and four placeholder "spaces" routes. See [routes.md](./routes.md) for the route tree and [views.md](./views.md) for the component layout.

**Doc drift, not code:** two marketing blurbs still call `/computer` an "autonomous computer-use surface" where "the agent executes it with screen captures streamed back in real time" (`sdk/org/README.md:64`, and the same copy on the docs-site card in `org/src/routes/index.tsx:64`). No such thing is implemented: a `grep -riE 'screenshot|screencast|capture|vnc|cdp|playwright|puppeteer|xdotool|desktop'` over `sdk/org/apps/web/src/routes/computer/**` and `sdk/org/libs/ui/src/computer/**` returns zero hits — the whole surface is the file/terminal/dashboard/settings set described below. Treat those blurbs as superseded by this page.

Two origins are in play. `COMPUTER_BASE_URL` is the **pod** (same-origin in production and under `pnpm thing`; `computer.test` only behind the `*.test` proxy) — `sdk/org/apps/web/src/lib/config.ts:18-20`. `CLOUD_BASE_URL` is the **gateway** — `config.ts:23-26`. Every pod route below is documented in [../cli-api/rest/README.md](../cli-api/rest/README.md).

---

## Auth on every call

Pod REST goes through one of two clients, both of which attach the gateway JWT as `Authorization: Bearer …` and retry once after a `401` → `refresh()`:

- `PodTransport` (`Bearer` header at `sdk/org/libs/state/src/lib/pod/transport.ts:52-54`, the `401` → `refresh()` → single retry at `transport.ts:69-72`), mounted by `AppProvider` in the `/computer` layout (`sdk/org/apps/web/src/routes/computer/route.tsx:88-94`) — used by the IDE's file APIs and terminal sockets.
- `useAuth().authFetch` — used by the restart hook (`sdk/org/apps/web/src/routes/computer/use-pod-restart.ts:17-21`) and every settings card.

WebSockets cannot send headers, so the token rides as a query param: `?access_token=<jwt>` on both `WS /api/ws` (`sdk/org/apps/web/src/lib/runtime/pod-connection.ts:69-71`) and `WS /api/terminals/:termId` (`transport.ts:198-204`).

---

## Pod readiness, upgrade, keep-warm

The `/computer` layout wraps everything in the shared `PodEnsureGate` (`route.tsx:110-120`), which is skipped entirely when `isPodEmbedded()` / `isLocalRun()` (`sdk/org/apps/web/src/lib/gates.tsx:219`). It:

- POSTs `{CLOUD}/api/compute/ensure` to cold-wake the pod (`gates.tsx:48`);
- polls `GET {CLOUD}/api/compute/status` for monotonic boot progress (`gates.tsx:99`);
- probes the **pod edge** with same-origin `GET /api/sessions` until it stops returning an Envoy 503/504 (`waitForPodEdge`, `gates.tsx:132-149`) → [../cli-api/rest/sessions.md](../cli-api/rest/sessions.md);
- compares the running tag against `GET {CLOUD}/api/compute/version` (`gates.tsx:61`) and offers `POST {CLOUD}/api/compute/upgrade` (`gates.tsx:75`), re-polling every 60 s while live (`UPGRADE_POLL_MS = 60_000`, `gates.tsx:197`);
- POSTs `/api/keepalive` every 5 min while the tab is visible (`KEEPALIVE_MS = 5 * 60_000`, `gates.tsx:202,339-350`) → [../cli-api/rest/misc.md](../cli-api/rest/misc.md).

### RepoSyncGate

Outside the pod gate sits `RepoSyncGate` (`route.tsx:11-27`), which calls `useRepoSync` — it pulls `package.json`, `lmthing.json`, `.env*`, `agents/`, `flows/`, `knowledge/` blobs straight from the GitHub API when the session carries a `githubRepo` (gate `sdk/org/libs/auth/src/useRepoSync.ts:34`, path filter `:84-89`, blob fetches `:94-103`) and hands the file map to `onFilesLoaded` (`useRepoSync.ts:105`). On `/computer` that callback only `console.log`s the file count (`route.tsx:15-17`) — despite the gate's doc comment, **nothing is written to the pod filesystem**.

---

## The control WebSocket (`WS /api/ws`)

`ComputerProvider` constructs a `PodRuntime` and boots it on mount (`sdk/org/apps/web/src/lib/runtime/ComputerContext.tsx:98-121`). `PodRuntime` opens `ws(s)://<pod>/api/ws?access_token=…` with **no `sessionId`** (`pod-connection.ts:69-71`), which the pod treats as a **control socket** rather than an agent session (`sdk/org/libs/cli/src/server/ws/agent.ts:129-138`). The pod immediately replies `{type:'auth.ok'}` (`ws/agent.ts:13-15` — Envoy already validated the JWT at the edge), which is what flips the client status to `running` (`pod-connection.ts:122-127`). A drop reconnects with exponential backoff, max 5 attempts (`pod-connection.ts:5-6,141-160`).

On open, `PodRuntime` sends `{type:'subscribe', channels:['metrics','processes','agents','logs','network']}` (`sdk/org/apps/web/src/lib/runtime/pod.ts:54-59`).

> **Gap:** the pod's control socket implements only `terminal.open` / `terminal.input` / `terminal.resize` / `terminal.close` (`ws/agent.ts:27-46`) — `subscribe` is not even in the pod's `ClientMessage` union (`sdk/org/libs/cli/src/rpc/events.ts:44-54`, whose only non-terminal members are `sendMessage`/`submitForm`/`cancelAsk`/`subscribeTrace`), and no metrics/processes/agents/network emitter exists anywhere in the pod server. The subscription is silently dropped by the `switch`'s missing default, so those dashboard panels can never populate from the pod (see *Dashboard* below).

---

## IDE (`/computer`)

The default `/computer` view is the IDE, rendered full-screen without the sidebar shell (`route.tsx:62-65`). `index.tsx` is a thin composition of `useIde()` into `<IdeLayout/>` (`sdk/org/apps/web/src/routes/computer/index.tsx:9-39`, `use-ide.ts:12-29`).

### File tree, editor, autosave

`useIdeFiles` (`sdk/org/apps/web/src/routes/computer/use-ide-files.ts`) owns all file state, and every call goes through `PodTransport`:

| Action | Transport call | Pod endpoint |
|---|---|---|
| Load the tree on mount (`use-ide-files.ts:44-63`) | `listFiles()` (`transport.ts:163-167`) | `GET /api/fs/tree` |
| Open a file (lazy, cached) (`use-ide-files.ts:67-81`) | `readFile(path)` (`transport.ts:169-175`) | `GET /api/fs/read?path=<rel>` |
| Edit → autosave (`use-ide-files.ts:23-41,122-126`) | `writeFile(path, content)` (`transport.ts:177-184`) | `PUT /api/fs/write` |
| New file (`use-ide-files.ts:83-94`) | `writeFile(path, '')` | `PUT /api/fs/write` |
| New folder (`use-ide-files.ts:96-106`) | `writeFile('<dir>/.gitkeep', '')` | `PUT /api/fs/write` |
| Delete (`use-ide-files.ts:108-120`) | — | **none** |

Full endpoint reference → [../cli-api/rest/fs.md](../cli-api/rest/fs.md).

Facts worth pinning:

- **Autosave is debounced 1500 ms per path** — each keystroke resets that path's timer, then a single `PUT /api/fs/write` fires (`use-ide-files.ts:29-38`). There is no explicit Save button.
- **The pod registers exactly three `fs` routes** — `GET /api/fs/tree`, `GET /api/fs/read`, `PUT /api/fs/write` (`sdk/org/libs/cli/src/server/serve.ts:201-203`). There is no mkdir and no delete.
- **There is no "new directory" endpoint.** A folder is created by writing an empty `<dir>/.gitkeep`, which the pod's `handleFsWrite` materializes with `mkdir -p` (`sdk/org/libs/cli/src/server/routes/fs.ts:71-73`).
- **Delete is local-only.** `handleDelete` prunes client state and closes the tab with the comment *"Optimistically remove from local state; no delete API yet"* (`use-ide-files.ts:108-110`) — the file remains on the pod, and it reappears on the next `GET /api/fs/tree`.
- **The tree is the whole pod workspace**, rooted at `ctx.effectiveLmthingRoot` (the `.lmthing` runtime root), excluding `.git`, `node_modules`, `.cache` (`fs.ts:14-32`). That root contains the projects and their spaces, so the IDE is a raw editor over the on-disk space format described in [../format/space/README.md](../format/space/README.md) — unlike Studio, it does **not** go through the space-file API, so nothing here is validated or normalized.
- Reads and writes are path-traversal guarded (`isSafeRelPath` + a resolved-prefix check → `400`), and a missing file is `404` (`fs.ts:45-51,68-70`).
- The tree is built client-side by `buildTree(paths)` (`sdk/org/apps/web/src/lib/file-tree.ts`), shared with Studio's raw-files view.

### Terminals

`useIdeTerminals` (`sdk/org/apps/web/src/routes/computer/use-ide-terminals.ts`) creates two always-on tabs once `status === 'running'` (`use-ide-terminals.ts:13-45`):

| Tab id | Label | Mode | Command |
|---|---|---|---|
| `cli` | `process` | readonly | `tail -n 100 -f /tmp/lmthing-server.log 2>/dev/null \|\| sleep 9999` (`use-ide-terminals.ts:6`) |
| `bash` | `bash` | interactive | default shell |

`+` adds further `bash-<timestamp>` tabs (`use-ide-terminals.ts:47-55`); closing disposes the session (`:57-66`).

Every IDE tab is its **own** WebSocket — `transport.connectTerminal(command?)` opens `WS /api/terminals/<termId>?access_token=…[&command=…]` (`transport.ts:191-204`). PTY output arrives as raw text frames; input and resize are JSON control frames `{type:'input',data}` / `{type:'resize',cols,rows}` (`transport.ts:213-225`, pod side `sdk/org/libs/cli/src/server/ws/terminal.ts:52-59`). The pod matches this path in its upgrade handler *before* the agent socket (`sdk/org/libs/cli/src/server/serve.ts:381-386`) and starts the PTY with `cwd = effectiveLmthingRoot` (`serve.ts:373`).

Note this is a **different transport** from `/computer/terminal` (below), which multiplexes over the single `/api/ws` control socket.

### Restart

The IDE header's ⏻ button calls `usePodRestart` (`use-pod-restart.ts:13-27`): `POST {POD}/api/restart` (the connection error is expected — the process exits), then poll `GET {POD}/api/env` every 800 ms until it answers `200`, then `window.location.reload()`. Both routes → [../cli-api/rest/misc.md](../cli-api/rest/misc.md) and [../cli-api/rest/env.md](../cli-api/rest/env.md). The sidebar shell has the same button (`sdk/org/libs/ui/src/computer/computer-layout.tsx:61-69`) wired to a duplicate copy of the same logic inside `ComputerShell` (`route.tsx:46-60`).

> **Dead state:** `IdeLayout` renders "Booting…" / "Installing dependencies…" from `store.isBooting` / `store.isInstalling` (`sdk/org/libs/ui/src/computer/ide-layout.tsx:71-74`, `sdk/org/apps/web/src/routes/computer/index.tsx:16-17`). Those flags and their setters exist in the IDE store (`sdk/org/apps/web/src/lib/store.ts:19-22,56-63`) but **nothing ever sets them** (leftover from the WebContainer era) — in practice only `files.isLoading` drives the spinner.

---

## Dashboard (`/computer/dashboard`)

Renders `<BootProgress tier="flyio">` until the runtime is `running`/`error`, then `<ComputerDashboard>` with status, uptime, metrics, processes, agents, logs and network from `useComputer()` (`sdk/org/apps/web/src/routes/computer/dashboard.tsx:17-45`). No REST endpoint is involved — everything is meant to arrive over the `/api/ws` control socket (`pod.ts:158-218`).

In practice:

- **Metrics / processes / agents / network are always empty** — the pod never answers the `subscribe` message (see *The control WebSocket* above). The only rows that ever appear are the client-generated log lines from `PodRuntime.emitLog` ("Connected to compute pod", "Connection lost…") (`pod.ts:220-223`, `pod-connection.ts:95,125,151`), capped at 500 logs / 200 network entries (`ComputerContext.tsx:49-50`).
- **Uptime is client-side** — `Date.now()` at first render, not pod uptime (`dashboard.tsx:19-20`).
- **The tier is hardcoded `"flyio"`** (`dashboard.tsx:25,34`) even though the actual runtime reports `tier = 'pod'` (`pod.ts:36`); the UI's `RuntimeTier` union is still the legacy `'webcontainer' | 'flyio'` (`sdk/org/libs/ui/src/computer/status-card.tsx:9`).
- **The route is unreachable from the UI.** `ComputerLayout`'s nav labels `/computer` (the IDE) as "Dashboard" and never links `/computer/dashboard` (`computer-layout.tsx:22-27`); `IdeLayout`'s nav omits it entirely (`sdk/org/libs/ui/src/computer/ide-layout.tsx:48-52`). You reach it only by typing the URL.

---

## Terminal (`/computer/terminal`)

A single full-page xterm session (`sdk/org/apps/web/src/routes/computer/terminal.tsx:12-50`). It calls `createTerminalSession()` from `ComputerContext`, which sends `{type:'terminal.open', sessionId}` over the **control socket** and wraps `terminal.input`/`terminal.resize`/`terminal.close` sends plus `terminal.data` receives into a `TerminalSession` (`pod.ts:93-122`). The pod services those messages by lazily constructing a `TerminalManager` on the control socket (`ensureTerminals`, `ws/agent.ts:17-22`; the message `switch`, `ws/agent.ts:27-46`), rooted at the same `terminalCwd` (`serve.ts:373`).

> **Bug:** `TerminalRoute` destructures `tier` from `useComputer()` (`terminal.tsx:13`), but `ComputerContextValue` has no `tier` field (`ComputerContext.tsx:14-26`). `<BootProgress tier={undefined}>` (`terminal.tsx:42-46`) therefore falls back to the webcontainer step list, since `BootProgress` picks `tier === 'flyio' ? flyioSteps : webcontainerSteps` (`sdk/org/libs/ui/src/computer/boot-progress.tsx:33`). `apps/web` ships no `typecheck` script (`sdk/org/apps/web/package.json:7-14` — only `dev`/`build`/`preview`/`lint`/`lint:tokens`/`format`), so this is not caught in CI.

---

## Settings (`/computer/settings`)

Five cards (`sdk/org/apps/web/src/routes/computer/settings.tsx:26-76`):

| Card | Component | Calls |
|---|---|---|
| Account | `@lmthing/ui/elements/settings/account` | — |
| Runtime | inline | none — a static `Dedicated Pod` badge, the live `status` from `useComputer()`, and the hardcoded caption "0.5 CPU, 1 GB memory" (`settings.tsx:40-45`) |
| Models | `elements/settings/models` | `GET {CLOUD}/api/compute/env` + `GET {POD}/api/prices/azure` on load (`sdk/org/libs/ui/src/elements/settings/models/index.tsx:72-73`); save = GET-merge-`PUT {CLOUD}/api/compute/env` preserving non-model vars (`models/index.tsx:111-123`) |
| Environment Variables | `elements/settings/env-vars` | `GET {CLOUD}/api/compute/env` (`env-vars/index.tsx:30`); save = GET-merge-`PUT` preserving model aliases (`env-vars/index.tsx:67-75`) |
| Billing | `elements/settings/billing` | `POST {CLOUD}/api/billing/portal` → redirect to the Stripe portal (`billing/index.tsx:11-21`) |

Both env-writing cards GET-merge-PUT because **`PUT /api/compute/env` replaces the whole variable set** and a save restarts the pod — the card says so out loud ("Saving will restart your pod", `settings.tsx:62-64`). The pod-side twin of this file is `GET|PUT /api/env` → [../cli-api/rest/env.md](../cli-api/rest/env.md); the model price table is [../cli-api/rest/budget.md](../cli-api/rest/budget.md).

---

## Spaces (`/computer/spaces**`) — stubs

Four routes exist and are linked from both navs, but all four render a heading and nothing else:

```tsx
// sdk/org/apps/web/src/routes/computer/spaces/index.tsx
function SpaceList() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Spaces</h1>
    </div>
  )
}
```

Same for `/computer/spaces/$spaceId`, `…/config` and `…/logs` (`spaces/$spaceId/index.tsx`, `spaces/$spaceId/config.tsx`, `spaces/$spaceId/logs.tsx`). Space browsing/authoring lives in Studio; the on-disk space format is [../format/space/README.md](../format/space/README.md). The one way `/computer` touches spaces today is as raw files in the IDE tree.

`/computer/login` is likewise vestigial — it returns `<Navigate to="/"/>` when authenticated and `null` otherwise, because the real login screen is rendered by `AuthGate` in the shared root (`sdk/org/apps/web/src/routes/computer/login.tsx`).

---

## Providers mounted by the layout (a hidden cost)

`PodReadyTree` wraps the surface in `ComputerProvider` + `AppProvider` + `ProjectProvider(projectId="user")` + `SpaceProvider(spaceId="default")` with **hardcoded ids** (`route.tsx:84-103`). Merely visiting `/computer` therefore also fires `GET /api/projects` (`AppProvider`'s mount effect `sdk/org/libs/state/src/lib/contexts/AppContext.tsx:139-145` → `transport.listProjects()` at `:121`), `GET /api/projects/user/spaces` (`ProjectContext.tsx:61`, from the mount effect at `:72-78`) and `GET /api/projects/user/spaces/default/files` (the hydrate-on-entry effect `SpaceContext.tsx:67-92`, which fetches only when nothing under the prefix is cached yet) — and `SpaceProvider` then subscribes to that prefix and debounce-`PUT`s the space's files back on any change under it (`SpaceContext.tsx:126-165`). The IDE itself uses none of those providers except for the `transport` handle (`use-ide.ts:15`). Endpoints → [../cli-api/rest/projects.md](../cli-api/rest/projects.md) and [../cli-api/rest/spaces.md](../cli-api/rest/spaces.md).

---

## Pod-embedded navigation

`ComputerShell` listens for `window` `message` events of shape `{type:'lmthing:navigate', path}` and routes to `path` (`route.tsx:37-44`) — the seam for driving the surface when it is embedded in an iframe by the pod.

---

## Endpoint index for this surface

| Endpoint | Origin | Feature | Reference |
|---|---|---|---|
| `WS /api/ws?access_token=` | pod | control socket (status, dashboard subscribe, `/computer/terminal` session) | `ws/agent.ts:121-149` |
| `WS /api/terminals/:termId?access_token=&command=` | pod | IDE terminal tabs | `ws/terminal.ts:24-37` |
| `GET /api/fs/tree` | pod | IDE file tree | [fs.md](../cli-api/rest/fs.md) |
| `GET /api/fs/read?path=` | pod | open a file | [fs.md](../cli-api/rest/fs.md) |
| `PUT /api/fs/write` | pod | autosave / create file / create folder | [fs.md](../cli-api/rest/fs.md) |
| `POST /api/restart` | pod | ⏻ Restart | [misc.md](../cli-api/rest/misc.md) |
| `GET /api/env` | pod | post-restart readiness poll | [env.md](../cli-api/rest/env.md) |
| `GET /api/sessions` | pod | `PodEnsureGate` edge probe | [sessions.md](../cli-api/rest/sessions.md) |
| `POST /api/keepalive` | pod | keep-warm heartbeat | [misc.md](../cli-api/rest/misc.md) |
| `GET /api/prices/azure` | pod | Models settings card | [budget.md](../cli-api/rest/budget.md) |
| `GET /api/projects`, `…/spaces`, `…/spaces/default/files` | pod | mounted providers (not used by the IDE) | [projects.md](../cli-api/rest/projects.md) |
| `POST /api/compute/ensure`, `GET /api/compute/status`, `GET /api/compute/version`, `POST /api/compute/upgrade` | gateway | `PodEnsureGate` | `sdk/org/apps/web/src/lib/gates.tsx:48,61,75,99` |
| `GET\|PUT /api/compute/env` | gateway | Env Vars + Models settings | `sdk/org/libs/ui/src/elements/settings/env-vars/index.tsx:30,71` |
| `POST /api/billing/portal` | gateway | Billing settings | `sdk/org/libs/ui/src/elements/settings/billing/index.tsx:11` |

Dead code in this subtree, listed so nobody documents it as a feature: `sdk/org/apps/web/src/lib/runtime/use-tier-detection.ts` (`useTierDetection` — imported by nothing; `PodEnsureGate` replaced it) and `sdk/org/libs/ui/src/computer/ide-preview.tsx` (`IdePreview` — exported from the `@lmthing/ui/computer` barrel, rendered by no route).
