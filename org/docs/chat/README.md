# `/chat` — the THING conversation surface

`/chat` is the primary conversational surface: you talk to the **THING** agent, it streams TypeScript that runs in your compute pod's QuickJS sandbox, and the transcript shows what it did. It is a client-side route of the unified SPA (`sdk/org/apps/web`) — not a separate app — and it talks to exactly two backends: your **pod** (same-origin `/api/*` + `WS /api/ws`) and the **cloud gateway** (pod lifecycle, env vars, inbound URLs).

> **A project's main surface is its chat.** Selecting a project opens its chat — the full-fledged `ChatView` transcript, not a stripped dock — connected over the pod session protocol. There is no separate app launcher: the `/apps` route is a bare redirect into `/chat` (`sdk/org/apps/web/src/routes/apps/index.tsx`). Landing on a bare `/chat/<project>` resolves the project's most-recent conversation, or starts a fresh one when it has none, and **redirects** to `/chat/<project>/<conversation>` so the transcript renders and the location is shareable (`sdk/org/libs/ui/src/chat/app/session-control.ts#resolveProjectChat`). The shell is a **top bar over the transcript, with no left sidebar**: the `TopBar` (`sdk/org/libs/ui/src/chat/app/TopBar.tsx#TopBar`) carries the project switcher on the left and the surface switcher on the right, and `ChatShell` owns the one direction location → store → socket (`sdk/org/libs/ui/src/chat/app/ChatShell.tsx#ChatShell`).

| | |
|---|---|
| Route files | `sdk/org/apps/web/src/routes/chat/` — a layout (`route.tsx`) and three leaves: `index.tsx`, `$projectId/index.tsx`, `$projectId/$sessionId.tsx`, all rendering the same `-shell.tsx` |
| URLs | `/chat` · `/chat/<project>` · `/chat/<project>/<conversation>` — every state the surface has is addressable ([routes.md](./routes.md)) |
| Implementation | `sdk/org/libs/ui/src/chat/**`, imported via the `@lmthing/ui/chat` subpath export (`sdk/org/libs/ui/package.json:L10-L11`) |
| Pod API it drives | [../cli-api/rest/](../cli-api/rest/README.md) — sessions, projects, uploads, env, budget, prices, restart, report-bug |
| Detail pages | [routes.md](./routes.md) · [features.md](./features.md) · [views.md](./views.md) |

---

## How it is served

There is **one** Vite SPA and **one** origin per surface. The pod's HTTP server dispatches its router first; anything unmatched that does not start with `/api/` falls through to the built SPA (Vite dev middleware when `LM_DEV_WEB` is set, else the static dist) — `sdk/org/libs/cli/src/server/serve.ts:L358-L369`, `:L123`. In production the same build is deployed as a per-domain nginx image, and the surface is chosen **client-side from the hostname**: `lmthing.chat → /chat` (`sdk/org/apps/web/src/routes/index.tsx#HOST_SURFACE`, `:L22-L24`), redirected at `/` in `beforeLoad` (`sdk/org/apps/web/src/routes/index.tsx#Route`). Unknown hosts (localhost, the `*.test` dev proxy) fall back to `/studio` (`sdk/org/apps/web/src/routes/index.tsx#surfaceForHost`).

Above every surface sits the shared root: `AuthProvider(appName='studio') → AuthGate → PinGate → <Outlet/>` (`sdk/org/apps/web/src/routes/__root.tsx#RootComponent`). One session key unifies auth across chat/studio/computer (`sdk/org/apps/web/src/routes/__root.tsx:L7-L14`).

The `/chat` layout route adds exactly one thing — `PodEnsureGate` (`sdk/org/apps/web/src/routes/chat/route.tsx:L4-L14`):

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

`PodEnsureGate` is the shared readiness gate (`sdk/org/apps/web/src/lib/gates.tsx:L206-L219`): it POSTs `{CLOUD}/api/compute/ensure`, polls `{CLOUD}/api/compute/status` while the pod cold-wakes, offers an upgrade when the running image tag is older than the latest CI tag (`POST {CLOUD}/api/compute/upgrade`), probes the same-origin pod edge, and — once ready — POSTs `/api/keepalive` every 5 minutes while the tab is visible (`sdk/org/apps/web/src/lib/gates.tsx#KEEPALIVE_MS`, `:L330-L350`). It is skipped entirely for pod-embedded / local runs (`sdk/org/apps/web/src/lib/gates.tsx#PodEnsureGate`).

Each of the three leaf routes is a few lines — the entire surface is `<ChatShell/>`, handed the project and conversation its URL names (`sdk/org/apps/web/src/routes/chat/-shell.tsx#ChatRouteShell`).

---

## What `<ChatShell/>` does

It is the surface's one synchronisation point: the **location** (which project, which conversation) is the source of truth, and `ChatShell` is the only thing that turns it into store state and a live socket (`sdk/org/libs/ui/src/chat/app/ChatShell.tsx#ChatShell`). On mount it fetches `GET /api/projects` — safe to do once, because `PodEnsureGate` has already confirmed the pod edge is serving — redirects `/chat` to the project with id `user` (else the first one), applies the `?node=&tab=&follow=` view params, and renders `<AppShell/>`.

The location arrives as props from a host that owns a history stack; with no host the store holds it instead, which is how the same shell runs on desktop and on a phone (`sdk/org/libs/ui/src/chat/app/chat-nav.tsx#useChatNav`). See [routes.md](./routes.md) §3.

`AppShell` is a **top bar over a main pane, with no left sidebar** — **TopBar** (project switcher + surface switcher) above, then the main pane (a routed opening/not-found pane, the no-session pane, or the `ChatView` transcript) beside the **DevPanel** (docked ≥1024px, drawer below; toggled with `Alt+I` or `?inspect=1`), plus the project-settings drawer (`sdk/org/libs/ui/src/chat/app/AppShell.tsx#AppShell`).

All chat state lives in one Zustand store composed from session / replay / pricing / project / ui-panel slices (`sdk/org/libs/ui/src/chat/store/store.ts#useStore`).

---

## The live session

A conversation is a **pod session** streamed over a WebSocket. Its id is what the URL carries, and every way of arriving at one — a sidebar click, a fresh chat, a pasted link, a reload, Back — goes through `openSession`, which resumes it pod-side if needed and is both idempotent and race-guarded (`sdk/org/libs/ui/src/chat/app/session-control.ts#openSession`). That closes the old socket, resets the store, opens `WS /api/ws?sessionId=<id>&access_token=<jwt>` and publishes the sender on `window.__LM_SEND__` — the seam every component uses to send (`sdk/org/libs/ui/src/chat/app/session-control.ts#switchSession`).

```ts
activeConn = connectLive(`${proto}//${window.location.host}/api/ws?sessionId=${encodeURIComponent(sessionId)}${wsTokenSuffix()}`);
(window as unknown as { __LM_SEND__?: (m: unknown) => void }).__LM_SEND__ = activeConn.send;
```

Server → client the socket carries `hello`, `trace_snapshot`, `trace`, `ask_start`/`ask_end`/`ask_pending`, `error`, `done` and `ui_control` (the agent can drive the UI) — `sdk/org/libs/ui/src/chat/store/ws-client.ts#createConnectLive`, `:L65-L120`. Client → server it carries `sendMessage`, `submitForm`, `cancelAsk`, `subscribeTrace`. Server side: `sdk/org/libs/cli/src/server/ws/agent.ts` `handleAgentWsUpgrade`. See [../cli-api/rest/sessions.md](../cli-api/rest/sessions.md).

---

## Auth on the wire

Every same-origin pod call carries the gateway JWT from `@lmthing/auth` as `Authorization: Bearer …` (`sdk/org/libs/ui/src/chat/app/auth.ts#authHeaders`). The WebSocket cannot send headers, so it carries the token as `&access_token=…` (`sdk/org/libs/ui/src/chat/app/auth.ts#wsTokenSuffix`), and `<img>`/`<audio>`/`<a>` for stored uploads use `?access_token=…` — Envoy's `chat-jwt` SecurityPolicy accepts header **or** query param and routes by the `sub` claim to the user's pod (`sdk/org/libs/ui/src/chat/app/auth.ts:L28-L41`).

---

## Where to go next

- **[routes.md](./routes.md)** — the route tree, the two path params that make every state addressable, the push/replace rules behind the back button, the query state it deep-links (`?node=`, `?tab=`, `?follow=0`, `?inspect=1`), and the surrounding gates.
- **[features.md](./features.md)** — the feature → endpoint table: projects & conversations, live streaming, attachments & voice, `@` completions, cost & budget, restart, bug report, consent cards, replay, and the **Integrations** settings tab (pod `GET /api/projects/:id/integrations` + gateway `GET/PUT /api/compute/env` + gateway `GET /api/inbound`, with the save → pod-restart → auto-resume flow).
- **[views.md](./views.md)** — the component map under `sdk/org/libs/ui/src/chat/` (ChatShell, AppShell, TopBar, ChatView, Composer, Message, StatusLine, DevPanel, ProjectSettings, IntegrationsTab, ConsentCard, replay).
- **[../cli-api/rest/](../cli-api/rest/README.md)** — the pod endpoints behind all of it.
- **[../README.md](../README.md)** — the documentation hub.
