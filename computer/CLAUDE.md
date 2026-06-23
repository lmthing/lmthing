# computer/ — lmthing.computer

THING agent runtime environment. Browser-based IDE with file tree, Monaco editor, xterm.js terminal, and an agent chat view powered by `@lmthing/agent-ui`. All agent execution runs server-side in the user's K8s compute pod.

## Stack

- React 19 + Vite 8 + TanStack Router + Tailwind CSS v4
- Monaco Editor, xterm.js, react-resizable-panels, Zustand
- `@lmthing/auth`, `@lmthing/state`, `@lmthing/ui`, `@lmthing/agent-ui`
- Docker: multi-stage build (node:22-slim builder + nginx:alpine runtime)

## Running Locally

```bash
cd computer && pnpm dev    # http://localhost:3010 / computer.test
```

## Route Structure

```
src/routes/
├── __root.tsx              # AuthProvider("computer"), AuthGate, PinGate, PodProvider
├── index.tsx               # IDE: file tree + editor + terminal tabs + preview
├── chat.tsx                # Agent chat via @lmthing/agent-ui (pod /api/sessions)
├── dashboard.tsx           # Pod management dashboard
├── terminal.tsx            # Full-screen terminal
├── settings.tsx            # Settings (env vars, billing)
└── spaces/                 # Space management
```

## Single Runtime Architecture — K8s Pod

All agent execution runs server-side in the user's dedicated K8s compute pod. Envoy Gateway validates the JWT and routes `/api/*` on lmthing.computer to the user's pod.

### Tier detection (`use-tier-detection.ts`)

1. Reads the stored `lmthing-cloud-auth` JWT from localStorage.
2. Calls `POST {CLOUD_BASE_URL}/api/compute/ensure` (best-effort) to provision or wake the pod.
3. Returns `{ podConfig: { computerBaseUrl, accessToken } }` once ready.

### ComputerContext (`src/lib/runtime/ComputerContext.tsx`)

Central React context managing the pod runtime lifecycle. Always creates a `PodRuntime` (never WebContainer). The root route wraps everything in `<PodProvider>` which reads from `useTierDetection()`.

### Pod Runtime (`src/lib/runtime/pod.ts`)

- Connects to the K8s compute pod via WebSocket: `/api/ws?access_token=...`
- Protocol defined in `src/lib/runtime/ws-protocol.ts`
- Handles: terminal sessions, metrics, process/agent lists, logs, network events
- Exponential backoff reconnection (max 5 retries)

> **Server-side status (2026-06):** Only the terminal path (`terminal.open/input/resize/close` → `terminal.opened/terminal.data`) is currently implemented by the pod server. The `subscribe` message and all dashboard WS message types (`metrics`, `processes`, `agents`, `log`, `network`) are **not yet answered by the pod** — treat the dashboard as stubbed until the pod implements those channels.

### Agent Session Rendering (`routes/chat.tsx`)

Agent sessions are created and rendered via `@lmthing/agent-ui`:

```ts
import { useReplSession, DisplayBlock, AskBlock, ReplRpcClient, type ReplClientConfig } from '@lmthing/agent-ui'

// 1. Create session
const client = await ReplRpcClient.createSession(
  COMPUTER_BASE_URL,            // e.g. https://lmthing.computer
  { agentSlug, model },          // optional
  accessToken,                   // JWT from lmthing-cloud-auth
)

// 2. Feed into hook
const { blocks, sendMessage, submitForm, cancelAsk } = useReplSession({
  baseUrl: COMPUTER_BASE_URL,
  sessionId: client.sessionId,
  accessToken,
})

// 3. Render blocks
blocks.map(block => {
  if (block.type === 'display') return <DisplayBlock data={block.data} />
  if (block.type === 'ask')    return <AskBlock id={block.id} data={block.data} onSubmit={...} onCancel={...} />
})
```

The pod exposes:
- `POST /api/sessions` → `{ sessionId }` — create a session
- `GET/DELETE /api/sessions/:id` — inspect/destroy session
- `POST /api/sessions/:id/message` — send a message
- `POST/DELETE /api/sessions/:id/ask/:askId` — submit/cancel an ask
- `WS /api/ws?sessionId=:id` — event stream (display/ask_start/ask_end/variables/error/done)

Envoy routes `/api/*` on the computer origin to the user's pod by JWT → `x-user-id`.

## Zustand Store (`src/lib/store.ts`)

IDE state: file tree, open files, active file, preview URL, boot/install status.

## Docker & nginx

The Dockerfile builds a multi-stage image (node:22-slim + nginx:alpine). nginx serves the SPA — **no cross-origin isolation headers** (COEP/COOP/CORP were required only for WebContainer and have been removed).

Images are built by GitHub Actions CI and pushed to `lmthingacr.azurecr.io/computer:<sha>`.

## Obsolete concepts (removed)

- **WebContainer** — browser-based VM, OPFS snapshots, cross-origin isolation headers. All deleted.
- **ReplRelay / FsRelay** — postMessage bridges for iframe embedding. Removed.
- **use-repl-bridge / repl-bridge** — WebContainer process I/O bridge. Removed.
- **Dual-runtime tier detection** — no longer selects between WebContainer and pod. Now just ensures the pod is provisioned and returns credentials.
- **gen-spaces script** — snapshotted space dirs for WebContainer; now a no-op (pod runtime loads spaces server-side).
