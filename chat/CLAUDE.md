# chat/ — lmthing.chat

Personal THING chat interface. Renders agent sessions directly via `@lmthing/agent-ui` against the user's K8s compute pod.

## Stack

- React 19 + Vite 8 + TanStack Router + Tailwind CSS v4
- `@lmthing/auth` (SSO client), `@lmthing/state` (VFS), `@lmthing/ui`, `@lmthing/agent-ui`
- Uses `vite-plus` CLI wrapper

## Running Locally

```bash
cd chat && pnpm dev    # http://localhost:3001 / chat.test
```

## Route Structure

```
src/routes/
├── __root.tsx                  # AuthProvider("chat"), AuthGate, PinGate, RepoSyncGate
├── index.tsx                   # Main chat page — direct pod session via @lmthing/agent-ui
├── conversation/
│   └── $conversationId.tsx     # Conversation view (stub)
└── settings.tsx                # Settings (stub)
```

## Architecture — Direct Pod Session

Agent sessions run in the user's K8s compute pod. The chat app talks directly to the pod's
multi-session server, authenticated by the user's gateway JWT.

```
┌─────────────────────────────────┐                       ┌──────────────────────────────┐
│  lmthing.chat                   │   WS /api/ws           │  User K8s Pod                │
│                                 │ ◄──────────────────── │  multi-session server        │
│  useReplSession({ baseUrl,      │                       │  POST /api/sessions          │
│    sessionId, accessToken })    │   HTTP /api/sessions/* │  POST /api/sessions/:id/msg  │
│                                 │ ──────────────────────►│  WS  /api/ws?sessionId=:id   │
│  DisplayBlock / AskBlock /      │                       │                              │
│  VariablesBlock                 │                       │  Envoy routes /api/* to pod  │
└─────────────────────────────────┘                       └──────────────────────────────┘
         |
         | POST /api/compute/ensure  (gateway JWT)
         ▼
   cloud.lmthing.cloud  (ensures pod is running before first session)
```

### Data Flow

1. On mount, after auth: `POST {VITE_CLOUD_URL}/api/compute/ensure` (JWT) — wakes the pod if idle.
2. `ReplRpcClient.createSession(computerBaseUrl, {}, accessToken)` — creates a session on the pod,
   returns a `sessionId`.
3. `useReplSession({ baseUrl, sessionId, accessToken })` — opens a WebSocket to `WS /api/ws?sessionId=…`
   and subscribes to `display` / `ask_start` / `ask_end` / `variables` / `error` / `done` events.
4. User messages: `sendMessage(text)` → `POST /api/sessions/:id/message`.
5. Ask forms: `submitForm(id, value)` → `POST /api/sessions/:id/ask/:id`;
   `cancelAsk(id)` → `DELETE /api/sessions/:id/ask/:id`.
6. Blocks are rendered as `<DisplayBlock>`, `<AskBlock>`, or `<VariablesBlock>` from `@lmthing/agent-ui`.

### Environment Variables

| Variable | Default (dev) | Default (prod) | Purpose |
|----------|--------------|---------------|---------|
| `VITE_COMPUTER_BASE_URL` | `https://computer.test` | `https://lmthing.computer` | Computer pod origin |
| `VITE_CLOUD_URL` | `https://cloud.test` | `https://cloud.lmthing.cloud` | Gateway origin (compute/ensure) |
