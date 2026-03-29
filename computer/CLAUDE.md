# computer/ — lmthing.computer

THING agent runtime environment. Browser-based IDE with file tree, Monaco editor, xterm.js terminal, and preview pane. Supports two runtime backends based on user tier.

## Stack

- React 19 + Vite 8 + TanStack Router + Tailwind CSS v4
- Monaco Editor, xterm.js, react-resizable-panels, Zustand
- `@lmthing/auth`, `@lmthing/state`, `@lmthing/ui`, `lmthing` (core)
- Docker: multi-stage build (node:22-slim builder + nginx:alpine runtime)

## Running Locally

```bash
cd computer && pnpm dev    # http://localhost:3010 / computer.local
```

## Route Structure

```
src/routes/
├── __root.tsx              # AuthProvider("computer"), AuthGate, PinGate
├── index.tsx               # IDE: file tree + editor + terminal tabs + preview
├── dashboard.tsx           # Pod management dashboard
├── terminal.tsx            # Full-screen terminal
├── settings.tsx            # Settings
└── spaces/                 # Space management
```

## Dual Runtime Architecture

Tier detection (`use-tier-detection.ts`) calls `/api/auth/me` to determine runtime:

| Tier | Runtime | Implementation |
|------|---------|---------------|
| Free/Starter/Basic | WebContainer | In-browser VM via `@webcontainer/api`, persisted to OPFS |
| Pro/Max | K8s Pod | WebSocket connection to `user-{id}` pod via Envoy Gateway |

### ComputerContext (`src/lib/runtime/ComputerContext.tsx`)

Central React context managing the runtime lifecycle. Creates either `WebContainerRuntime` or `PodRuntime`, dispatches events (status, metrics, process, agent, log, network), handles IDE initialization.

### WebContainer Runtime (`src/lib/runtime/webcontainer.ts`)

- Runs entirely in-browser using `@webcontainer/api`
- Requires cross-origin isolation headers (COEP/COOP — see Docker section)
- Persists state to OPFS (`src/lib/runtime/opfs.ts`) for snapshot/restore across sessions
- Mounts space templates or restores from OPFS on boot

### Pod Runtime (`src/lib/runtime/pod.ts`)

- Connects to K8s compute pod via WebSocket: `/api/ws?access_token=...`
- Protocol defined in `src/lib/runtime/ws-protocol.ts`
- Handles: terminal sessions, metrics, process/agent lists, logs, network events
- Exponential backoff reconnection (max 5 retries)

### ReplRelay (`src/lib/runtime/ReplRelay.tsx`)

Bridge component that activates only when embedded as iframe (by lmthing.chat):

1. Connects to WebContainer's SSE `/events` endpoint
2. Receives REPL state updates
3. Forwards to parent frame via `postMessage({ type: 'lmthing:repl-update' })`
4. Receives user messages via `lmthing:repl-send` postMessage
5. Sends them to WebContainer via POST `/send`

## Zustand Store (`src/lib/store.ts`)

IDE state: file tree, open files, active file, preview URL, boot/install status.

## Docker & Cross-Origin Isolation

The Dockerfile builds a multi-stage image (node:22-slim + nginx:alpine). nginx serves the SPA with required headers for WebContainer:

```
Cross-Origin-Embedder-Policy: credentialless
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: cross-origin
```

These headers enable `SharedArrayBuffer` which WebContainer requires. The `credentialless` COEP policy (instead of `require-corp`) allows embedding as iframe in lmthing.chat without CORP issues.

Images are built by GitHub Actions CI and pushed to `lmthingacr.azurecr.io/computer:<sha>`.

## Space Templates

The `gen-spaces` script snapshots space templates from `org/libs/core/spaces/` and `org/libs/spaces/` for WebContainer initialization.
