# `/chat` — the THING conversation surface

`/chat` is the primary conversational surface: you talk to the **THING** agent, it streams TypeScript that runs in your compute pod's QuickJS sandbox, and the transcript shows what it did. It is a client-side route of the unified SPA (`sdk/org/apps/web`) — not a separate app — and it talks to exactly two backends: your **pod** (same-origin `/api/*` + `WS /api/ws`) and the **cloud gateway** (pod lifecycle, env vars, inbound URLs).

| | |
|---|---|
| Route files | `sdk/org/apps/web/src/routes/chat/route.tsx`, `sdk/org/apps/web/src/routes/chat/index.tsx` — **the only two files** under `routes/chat/` |
| Implementation | `sdk/org/libs/ui/src/chat/**`, imported via the `@lmthing/ui/chat` subpath export (`sdk/org/libs/ui/package.json:L10-L11`) |
| Pod API it drives | [../cli-api/rest/](../cli-api/rest/README.md) — sessions, projects, uploads, env, budget, prices, restart, report-bug |
| Detail pages | [routes.md](./routes.md) · [features.md](./features.md) · [views.md](./views.md) |

---

## How it is served

There is **one** Vite SPA and **one** origin per surface. The pod's HTTP server dispatches its router first; anything unmatched that does not start with `/api/` falls through to the built SPA (Vite dev middleware when `LM_DEV_WEB` is set, else the static dist) — `sdk/org/libs/cli/src/server/serve.ts:L358-L369`, `:L123`. In production the same build is deployed as a per-domain nginx image, and the surface is chosen **client-side from the hostname**: `lmthing.chat → /chat` (`sdk/org/apps/web/src/routes/index.tsx:L5-L10`, `:L22-L24`), redirected at `/` in `beforeLoad` (`sdk/org/apps/web/src/routes/index.tsx:L31-L42`). Unknown hosts (localhost, the `*.test` dev proxy) fall back to `/studio` (`sdk/org/apps/web/src/routes/index.tsx:L23`).

Above every surface sits the shared root: `AuthProvider(appName='studio') → AuthGate → PinGate → <Outlet/>` (`sdk/org/apps/web/src/routes/__root.tsx:L15-L25`). One session key unifies auth across chat/studio/computer (`sdk/org/apps/web/src/routes/__root.tsx:L7-L14`).

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

`PodEnsureGate` is the shared readiness gate (`sdk/org/apps/web/src/lib/gates.tsx:L206-L219`): it POSTs `{CLOUD}/api/compute/ensure`, polls `{CLOUD}/api/compute/status` while the pod cold-wakes, offers an upgrade when the running image tag is older than the latest CI tag (`POST {CLOUD}/api/compute/upgrade`), probes the same-origin pod edge, and — once ready — POSTs `/api/keepalive` every 5 minutes while the tab is visible (`sdk/org/apps/web/src/lib/gates.tsx:L202`, `:L330-L350`). It is skipped entirely for pod-embedded / local runs (`sdk/org/apps/web/src/lib/gates.tsx:L218-L219`).

The `/chat/` index route is 11 lines — the entire surface is `<ChatShell/>` (`sdk/org/apps/web/src/routes/chat/index.tsx:L1-L11`).

---

## What `<ChatShell/>` does

On mount it fetches `GET /api/projects`, selects the project with id `user` (else the first one), then wires URL ↔ store state and renders `<AppShell/>` (`sdk/org/libs/ui/src/chat/app/ChatShell.tsx:L13-L43`). It is safe to fetch once here because `PodEnsureGate` has already confirmed the pod edge is serving (`sdk/org/libs/ui/src/chat/app/ChatShell.tsx:L17-L19`).

`AppShell` is a responsive 3-pane layout — **Sidebar** (docked ≥768px, drawer below) | **ChatView** | **DevPanel** (docked ≥1024px, drawer below; toggled with `Alt+I` or `?inspect=1`) plus the project-settings drawer (`sdk/org/libs/ui/src/chat/app/AppShell.tsx:L3-L7`, `:L42-L43`, `:L71`, `:L77-L83`).

All chat state lives in one Zustand store composed from session / replay / pricing / project / ui-panel slices (`sdk/org/libs/ui/src/chat/store/store.ts:L16-L22`).

---

## The live session

A conversation is a **pod session** streamed over a WebSocket. Selecting a chat closes the old socket, resets the store, opens `WS /api/ws?sessionId=<id>&access_token=<jwt>` and publishes the sender on `window.__LM_SEND__` — the seam every component uses to send (`sdk/org/libs/ui/src/chat/app/Sidebar.tsx:L37-L46`).

```ts
activeConn = connectLive(`${proto}//${window.location.host}/api/ws?sessionId=${encodeURIComponent(sessionId)}${wsTokenSuffix()}`);
(window as unknown as { __LM_SEND__?: (m: unknown) => void }).__LM_SEND__ = activeConn.send;
```

Server → client the socket carries `hello`, `trace_snapshot`, `trace`, `ask_start`/`ask_end`/`ask_pending`, `error`, `done` and `ui_control` (the agent can drive the UI) — `sdk/org/libs/ui/src/chat/store/ws-client.ts:L25`, `:L65-L120`. Client → server it carries `sendMessage`, `submitForm`, `cancelAsk`, `subscribeTrace`. Server side: `sdk/org/libs/cli/src/server/ws/agent.ts` `handleAgentWsUpgrade`. See [../cli-api/rest/sessions.md](../cli-api/rest/sessions.md).

---

## Auth on the wire

Every same-origin pod call carries the gateway JWT from `@lmthing/auth` as `Authorization: Bearer …` (`sdk/org/libs/ui/src/chat/app/auth.ts:L17-L20`). The WebSocket cannot send headers, so it carries the token as `&access_token=…` (`sdk/org/libs/ui/src/chat/app/auth.ts:L23-L26`), and `<img>`/`<audio>`/`<a>` for stored uploads use `?access_token=…` — Envoy's `chat-jwt` SecurityPolicy accepts header **or** query param and routes by the `sub` claim to the user's pod (`sdk/org/libs/ui/src/chat/app/auth.ts:L28-L41`).

---

## Where to go next

- **[routes.md](./routes.md)** — the (tiny) route tree, the URL/query state it deep-links (`?node=`, `?tab=`, `?follow=0`, `?inspect=1`), and the surrounding gates.
- **[features.md](./features.md)** — the feature → endpoint table: projects & conversations, live streaming, attachments & voice, `@` completions, cost & budget, restart, bug report, consent cards, replay, and the **Integrations** settings tab (pod `GET /api/projects/:id/integrations` + gateway `GET/PUT /api/compute/env` + gateway `GET /api/inbound`, with the save → pod-restart → auto-resume flow).
- **[views.md](./views.md)** — the component map under `sdk/org/libs/ui/src/chat/` (ChatShell, AppShell, Sidebar, ChatView, Composer, Message, LiveActivity, DevPanel, ProjectSettings, IntegrationsTab, ConsentCard, replay).
- **[../cli-api/rest/](../cli-api/rest/README.md)** — the pod endpoints behind all of it.
- **[../README.md](../README.md)** — the documentation hub.
