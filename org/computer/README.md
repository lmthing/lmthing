# `/computer` — the pod IDE surface

`/computer` is a **browser IDE over your compute pod**: a file tree + Monaco editor rooted at the pod's workspace, xterm terminals over real PTYs in the pod, a runtime dashboard, and a settings page. It is a client-side route of the unified SPA (`sdk/org/apps/web`) — not a separate app — and it talks to two backends: your **pod** (same-origin `/api/*` + `WS /api/ws` + `WS /api/terminals/:id`) and the **cloud gateway** (pod lifecycle, env vars, billing).

| | |
|---|---|
| Route files | `sdk/org/apps/web/src/routes/computer/**` — 10 route files + 4 non-route hooks |
| Components | `sdk/org/libs/ui/src/computer/**`, imported via the `@lmthing/ui/computer` barrel (`sdk/org/libs/ui/src/computer/index.ts`) |
| Pod transport | `PodTransport` — `sdk/org/libs/state/src/lib/pod/transport.ts` (`listFiles`/`readFile`/`writeFile`/`connectTerminal`) |
| Pod API it drives | [../cli-api/rest/fs.md](../cli-api/rest/fs.md) · [../cli-api/rest/env.md](../cli-api/rest/env.md) · [../cli-api/rest/sessions.md](../cli-api/rest/sessions.md) · [../cli-api/rest/misc.md](../cli-api/rest/misc.md) |
| Detail pages | [routes.md](./routes.md) · [features.md](./features.md) · [views.md](./views.md) |

> **The name is misleading.** `sdk/org/CLAUDE.md` describes `/computer` as an "autonomous computer-use surface … the agent controls a browser/desktop environment … with screen captures streamed back". No such code exists: there is no browser control, no desktop, and no screen capture anywhere under `sdk/org/apps/web/src/routes/computer/**` or `sdk/org/libs/ui/src/computer/**`. What ships is the IDE + dashboard + settings described here.

---

## How it is served

One Vite SPA, one origin per surface. The pod's HTTP server dispatches its router first; anything unmatched that does not start with `/api/` falls through to the built SPA — Vite dev middleware when `LM_DEV_WEB` is set, else the static dist (`sdk/org/libs/cli/src/server/serve.ts:L358-L369`). In production the same build is deployed as a per-domain nginx image, and the surface is picked **client-side from the hostname**: `lmthing.computer → /computer` (`sdk/org/apps/web/src/routes/index.tsx:L5-L10`, `:L22-L24`). Unknown hosts (localhost, the `*.test` dev proxy) fall back to `/studio` (`sdk/org/apps/web/src/routes/index.tsx:L23`).

Two origins are resolved at boot (`sdk/org/apps/web/src/lib/config.ts`, `sdk/org/apps/web/src/lib/origins.ts` `resolveApiOrigin`):

- **`COMPUTER_BASE_URL`** — the pod. Same-origin in production and under `pnpm thing`; only the `*.test` nginx proxy stack uses `https://computer.test`.
- **`CLOUD_BASE_URL`** — the gateway. `https://lmthing.cloud` in production, `https://cloud.test` under the proxy stack.

Above every surface sits the shared root: `AuthProvider(appName='studio') → AuthGate → PinGate → <Outlet/>` (`sdk/org/apps/web/src/routes/__root.tsx`). `/computer/login` is therefore vestigial — it renders `null` (or redirects when already authed); the real login screen comes from `AuthGate` (`sdk/org/apps/web/src/routes/computer/login.tsx:L8-L13`).

---

## The layout route

`sdk/org/apps/web/src/routes/computer/route.tsx` is the whole boot chain (`:L110-L124`):

```tsx
function ComputerLayoutRoot() {
  return (
    <RepoSyncGate>
      <PodEnsureGate>
        <PodReadyTree>
          <ComputerShell />
        </PodReadyTree>
      </PodEnsureGate>
    </RepoSyncGate>
  )
}
export const Route = createFileRoute('/computer')({ component: ComputerLayoutRoot })
```

- **`RepoSyncGate`** — calls `useRepoSync` from `@lmthing/auth` with the `github_token` in localStorage, syncing the user's GitHub repo into the pod filesystem (`sdk/org/apps/web/src/routes/computer/route.tsx:L11-L27`).
- **`PodEnsureGate`** — the readiness gate shared verbatim by `/studio`, `/chat` and `/computer` (`sdk/org/apps/web/src/lib/gates.tsx:L206-L219`): POST `{CLOUD}/api/compute/ensure`, poll `{CLOUD}/api/compute/status` while the pod cold-wakes, compare the running image tag against `{CLOUD}/api/compute/version` and offer `POST {CLOUD}/api/compute/upgrade`, probe the same-origin pod edge with `GET /api/sessions` until it is not an Envoy 503/504 (`:L143`), then POST `/api/keepalive` every 5 minutes while the tab is visible (`:L202`, `:L330-L352`). Skipped entirely for pod-embedded / local runs (`:L216-L219`).
- **`PodReadyTree`** — mounts `ComputerProvider(computerBaseUrl, getAccessToken)` + `AppProvider(pod)` + **`ProjectProvider(projectId="user")`** + **`SpaceProvider(spaceId="default")`** with those ids hardcoded (`sdk/org/apps/web/src/routes/computer/route.tsx:L84-L103`). Note the consequence: merely visiting `/computer` also fires `GET /api/projects`, `GET /api/projects/user/spaces` and `GET /api/projects/user/spaces/default/files` (`sdk/org/libs/state/src/lib/pod/transport.ts`), even though the IDE itself only uses the providers' `transport`.
- **`ComputerShell`** — returns a bare `<Outlet/>` when the path is exactly `/computer` (the IDE is full-screen, no sidebar), otherwise wraps children in `<ComputerLayout>` (`sdk/org/apps/web/src/routes/computer/route.tsx:L62-L80`). It also listens for `window` `message` events of shape `{type:'lmthing:navigate', path}` and routes to `path` — the pod-embedded-iframe navigation seam (`:L37-L44`).

---

## Nav

Two different navs exist, because the IDE deliberately drops the sidebar.

**Sidebar (`ComputerLayout`, every route except the IDE)** — `sdk/org/libs/ui/src/computer/computer-layout.tsx:L22-L27`:

| Label | Path |
|---|---|
| Dashboard | `/computer` |
| Terminal | `/computer/terminal` |
| Spaces | `/computer/spaces` |
| Settings | `/computer/settings` |

plus cross-app links (`otherAppLinks('computer')`) and a `⏻ Restart` item, with a `TopBar` showing `lmthing.computer` + status/tier badges and a `ConnectionBanner` (`sdk/org/libs/ui/src/computer/computer-layout.tsx:L49-L88`).

**IDE header (`IdeLayout`, at `/computer`)** — `sdk/org/libs/ui/src/computer/ide-layout.tsx:L48-L52`: Terminal · Spaces · Settings (no Dashboard), plus the status badge and the restart button.

> **Nav bug worth knowing.** The sidebar labels `/computer` as "Dashboard", but `/computer` renders the **IDE** (`sdk/org/apps/web/src/routes/computer/index.tsx:L5-L7`). The real dashboard lives at `/computer/dashboard` (`sdk/org/apps/web/src/routes/computer/dashboard.tsx:L7-L9`) and is linked from **nowhere** — it is reachable only by typing the URL.

Full file→URL table: [routes.md](./routes.md).

---

## What each view is

| URL | What it is |
|---|---|
| `/computer` | **The IDE.** Pod file tree (`GET /api/fs/tree`), lazy file open (`GET /api/fs/read`), Monaco tabs with a 1500 ms-debounced autosave (`PUT /api/fs/write`), and a terminal dock. `sdk/org/apps/web/src/routes/computer/index.tsx` + `use-ide.ts` + `use-ide-files.ts` + `use-ide-terminals.ts` |
| `/computer/dashboard` | Status / metrics / processes / agents / logs / network panels, `BootProgress` while connecting. `sdk/org/apps/web/src/routes/computer/dashboard.tsx` |
| `/computer/terminal` | A single full-page xterm session, opened over the **control socket** (`WS /api/ws`), not over `/api/terminals/:id`. `sdk/org/apps/web/src/routes/computer/terminal.tsx:L12-L49` |
| `/computer/settings` | Account · Runtime (`Dedicated Pod`, "0.5 CPU, 1 GB memory") · Models · Environment Variables · Billing cards. `sdk/org/apps/web/src/routes/computer/settings.tsx:L20-L60` |
| `/computer/spaces`, `/computer/spaces/$spaceId{,/config,/logs}` | **Stubs** — each renders a single heading. `sdk/org/apps/web/src/routes/computer/spaces/index.tsx:L7-L13` |
| `/computer/login` | Vestigial (see above). |

Per-view detail: [views.md](./views.md). Behaviour (file autosave, terminal tabs, restart, dashboard wiring): [features.md](./features.md).

---

## Two terminal transports

This surface opens PTYs **two different ways**, and both exist in the pod's WS upgrade handler (`sdk/org/libs/cli/src/server/serve.ts:L376-L381`, `sdk/org/libs/cli/src/server/ws/agent.ts:L130-L135`):

1. **IDE terminal tabs** → `PodTransport.connectTerminal()` → `WS /api/terminals/:termId?access_token=&command=` (`sdk/org/libs/state/src/lib/pod/transport.ts` `connectTerminal`). The IDE always creates two tabs once the runtime is `running`: a readonly `process` tab tailing the server log (`tail -n 100 -f /tmp/lmthing-server.log 2>/dev/null || sleep 9999`) and a `bash` tab; `+` adds more `bash-*` tabs (`sdk/org/apps/web/src/routes/computer/use-ide-terminals.ts:L6`, `:L14-L26`, `:L50-L52`).
2. **`/computer/terminal` and the runtime dashboard** → `PodRuntime` / `PodConnection` → `WS /api/ws?access_token=<jwt>` with **no `sessionId`** (`sdk/org/apps/web/src/lib/runtime/pod-connection.ts:L67-L70`). A `/api/ws` connection with no `sessionId` is registered as a **control socket** (`sdk/org/libs/cli/src/server/ws/agent.ts:L130-L135`), which sends `{type:'auth.ok'}` and then only handles `terminal.open` / `terminal.input` / `terminal.resize` / `terminal.close` (`:L15`, `:L28-L44`).

> **The dashboard's panels cannot populate.** `PodRuntime` sends `{type:'subscribe', channels:['metrics','processes','agents','logs','network']}` on open (`sdk/org/apps/web/src/lib/runtime/pod.ts:L53-L58`), but `registerControlSocket` has **no `subscribe` case** — it is silently ignored (`sdk/org/libs/cli/src/server/ws/agent.ts:L28-L44`). The only rows the dashboard ever shows are client-generated log lines from `PodRuntime.emitLog`, and uptime is computed client-side from first render (`sdk/org/apps/web/src/routes/computer/dashboard.tsx:L19-L20`). Treat the metrics/processes/agents/network panels as **not wired**, not as a working feature.

---

## Restart

Both `ComputerShell` and the IDE's `usePodRestart` implement the same sequence (duplicated): `POST {COMPUTER_BASE_URL}/api/restart` (the pod process exits, so the fetch is expected to fail), then poll `GET {COMPUTER_BASE_URL}/api/env` every 800 ms until it answers 200, then `window.location.reload()` — `sdk/org/apps/web/src/routes/computer/use-pod-restart.ts:L13-L27` and `sdk/org/apps/web/src/routes/computer/route.tsx:L46-L60`. Pod side: `POST /api/restart` (`sdk/org/libs/cli/src/server/serve.ts:L143`) and `GET /api/env` (`:L160`). See [../cli-api/rest/env.md](../cli-api/rest/env.md) and [../cli-api/rest/misc.md](../cli-api/rest/misc.md).

---

## Where this sits

- Hub: [../README.md](../README.md)
- Sibling surfaces: [../chat/README.md](../chat/README.md) · [../studio/README.md](../studio/README.md) · [../app/README.md](../app/README.md)
- The endpoints this surface calls: [../cli-api/rest/README.md](../cli-api/rest/README.md)
- The binary that serves it: [../cli-api/README.md](../cli-api/README.md)
