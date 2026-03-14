# @lmthing/server

Runtime server that runs inside Fly.io containers for both Space and Computer products. Implements the server half of the WebSocket protocol defined in `computer/src/lib/runtime/flyio-protocol.ts`.

## What it does

- HTTP health check on `/health`
- WebSocket endpoint on `/ws` with HMAC token authentication
- PTY terminal sessions (multiplexed per connection)
- System metrics streaming (CPU, memory from `/proc`)
- Process list reporting
- Agent status broadcasting

## Building & Deploying

```bash
# Authenticate with Fly.io registry
flyctl auth docker

# Build the image
cd org/libs/server
docker build -t registry.fly.io/lmthing-space:latest .

# Push to registry
docker push registry.fly.io/lmthing-space:latest
```

You need a Fly app created first:

```bash
flyctl apps create lmthing-space --org lmthing
```

## Local Development

```bash
pnpm install
pnpm dev
```

Requires `TOKEN_SECRET` env var to verify WebSocket auth tokens.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 8080) |
| `TOKEN_SECRET` | Yes | HMAC secret for verifying WebSocket tokens (injected at machine creation) |
| `SPACE_ID` | No | Set automatically for space containers |
| `USER_ID` | No | Set automatically at provisioning |
| `RUNTIME_MODE` | No | `computer` or `space` (set at provisioning) |

## Architecture

```
Browser → issue-space-token (cloud) → signed token
Browser → wss://{app}.fly.dev/ws?token=... → this server
         ├── terminal.open/input/resize/close → PTY sessions
         ├── subscribe metrics → /proc/stat + /proc/meminfo
         ├── subscribe processes → /proc listing
         └── subscribe agents → agent status
```
