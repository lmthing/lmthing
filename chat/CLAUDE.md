# chat/ — lmthing.chat

Personal THING chat interface. Embeds lmthing.computer in a hidden iframe and relays REPL session state to a chat UI via postMessage.

## Stack

- React 19 + Vite 8 + TanStack Router + Tailwind CSS v4
- `@lmthing/auth` (SSO client), `@lmthing/state` (VFS), `@lmthing/ui`, `lmthing` (core)
- Uses `vite-plus` CLI wrapper

## Running Locally

```bash
cd chat && pnpm dev    # http://localhost:3001 / chat.local
```

## Route Structure

```
src/routes/
├── __root.tsx                  # AuthProvider("chat"), AuthGate, PinGate, RepoSyncGate
├── index.tsx                   # Main chat page — iframe embed + ThingChat component
├── conversation/
│   └── $conversationId.tsx     # Conversation view (stub)
└── settings.tsx                # Settings (stub)
```

## Architecture — Chat <-> Computer Relay

The core pattern is a hidden iframe embedding lmthing.computer, with postMessage as the communication bridge:

```
┌─────────────────────────────────┐     postMessage      ┌──────────────────────────────┐
│  lmthing.chat                   │ ◄──────────────────► │  lmthing.computer (iframe)   │
│                                 │                       │                              │
│  ThingChat ◄─ useReplRelay()    │  lmthing:repl-update │  ReplRelay                   │
│             ─► lmthing:repl-send│ ─────────────────────►│  ├─ SSE /events (read)       │
│                                 │                       │  └─ POST /send (write)       │
│  On load: sends lmthing:session │  lmthing:session     │  AuthProvider receives       │
│  (auth tokens to iframe)        │ ─────────────────────►│  session, no SSO redirect    │
└─────────────────────────────────┘                       └──────────────────────────────┘
```

### PostMessage Protocol

| Message Type | Direction | Payload | Purpose |
|-------------|-----------|---------|---------|
| `lmthing:session` | chat → computer | `{ accessToken, userId, email }` | Authenticate iframe without SSO redirect |
| `lmthing:auth-needed` | computer → chat | — | Computer requests session injection |
| `lmthing:repl-update` | computer → chat | `{ status, output, ... }` | REPL state updates for ThingChat |
| `lmthing:repl-send` | chat → computer | `{ message }` | User messages forwarded to REPL |
| `lmthing:server-ready` | computer → chat | — | WebContainer/pod server is ready |

### Data Flow

1. Chat loads lmthing.computer in a hidden iframe (positioned offscreen)
2. On iframe load, chat sends auth session via `lmthing:session` postMessage
3. Computer's AuthProvider receives session (no redirect needed)
4. Computer's ReplRelay connects to WebContainer SSE `/events` endpoint
5. ReplRelay forwards REPL state to chat via `lmthing:repl-update` postMessage
6. User messages go: chat → `lmthing:repl-send` postMessage → ReplRelay → POST to `/send`

The iframe can be expanded/collapsed via a toggle button (shows full computer IDE when expanded).
