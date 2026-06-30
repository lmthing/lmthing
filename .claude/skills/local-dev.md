---
name: local-dev
description: Load when setting up or running the local dev stack — ports, domains, make targets, the nginx proxy, demo auth, or running an individual app.
---

# Skill: Local Development

## Quick Start

```bash
pnpm install       # install all workspace dependencies
make proxy         # set up nginx reverse proxy (requires sudo)
make up            # start all services
```

## Service Ports & Domains

Studio, Computer, and Chat are all client-side routes in the unified SPA (`sdk/org/packages/ui/apps/web/`), served by a single dev server. Other apps each have their own Vite dev server. The local proxy maps `*.test` domains via nginx.

| App      | Port | Local Domain                          |
| -------- | ---- | ------------------------------------- |
| Studio / Computer / Chat (unified) | 3000 | [studio.test](http://studio.test) / [computer.test](http://computer.test) / [chat.test](http://chat.test) |
| Com      | 3002 | [com.test](http://com.test)           |
| Social   | 3003 | [social.test](http://social.test)     |
| Store    | 3004 | [store.test](http://store.test)       |
| Space    | 3005 | [space.test](http://space.test)       |
| Team     | 3006 | [team.test](http://team.test)         |
| Blog     | 3007 | [blog.test](http://blog.test)         |
| Casa     | 3008 | [casa.test](http://casa.test)         |
| Cloud    | 3009 | [cloud.test](http://cloud.test)       |

## Make Targets

| Command            | Description                                                                       |
| ------------------ | --------------------------------------------------------------------------------- |
| `make up`          | Start all frontend dev servers in parallel                                        |
| `make down`        | Stop all running dev servers                                                      |
| `make proxy`       | Set up nginx + `/etc/hosts` for `*.test` domains (interactive, prompts for sudo)  |
| `make proxy-clean` | Remove nginx configs and `/etc/hosts` entries                                     |
| `make install`     | Run `pnpm install`                                                                |
| `make check`       | Health check all lmthing.\* domains (DNS, TLS, HTTPS, hosting config)             |

## Proxy Setup

`make proxy` runs `.etc/scripts/local-proxy.sh`, which:

1. Installs nginx if missing (apt/brew)
2. Adds `127.0.0.1 <app>.test` entries to `/etc/hosts`
3. Creates nginx server blocks that reverse-proxy each domain to its Vite port (including WebSocket upgrade for HMR)
4. Validates the config and restarts nginx

The script is idempotent — re-running it skips already-configured services. Use `make proxy-clean` to tear everything down.

## Demo Auth

The unified web app ships with an `.env.development` file in `sdk/org/packages/ui/apps/web/` that sets `VITE_DEMO_USER=true`. This makes `@lmthing/auth`'s `AuthProvider` skip SSO and use a hardcoded demo session, so you can develop without running the cloud gateway.

## Running Individual Apps

To run the unified app (Studio / Computer / Chat) without `make up`:

```bash
cd sdk/org/packages/ui/apps/web && pnpm dev    # starts on port 3000
```

To run any other app individually:

```bash
cd com && pnpm dev        # starts on default port
```

## Stack

All frontend apps share the same stack:

- **React 19** + **Vite 7** + **TanStack Router** (file-based routing)
- **Tailwind CSS v4** via `@tailwindcss/vite`
- Shared workspace libs: `@lmthing/ui`, `@lmthing/css`, `@lmthing/state`
- Path aliases: `@/` → `./src`, workspace libs resolved via Vite `resolve.alias`

## Data Storage (where state lives)

| Layer              | What                            | Where               |
| ------------------ | ------------------------------- | ------------------- |
| Client (ephemeral) | Auth tokens, encrypted sessions | localStorage        |
| Client (ephemeral) | Workspace files                 | In-memory VFS       |
| Server             | User profiles, API keys         | PostgreSQL (in-cluster) |
| Server             | Billing, meters, subscriptions  | Stripe              |
| Sync               | Workspace persistence           | GitHub repositories |

## Agent Runtimes

| Product     | Runtime                                                              |
| ----------- | -------------------------------------------------------------------- |
| Studio      | Browser UI only — agent execution runs in the user's compute pod     |
| Computer    | K8s pod (QuickJS WASM) — ephemeral per-user pod, every tier          |
| Space       | K8s pod — deployed spaces + published agents                         |
| Blog        | Shared serverless worker                                             |
| Casa        | Computer node → remote Home Assistant connection                     |
| Social/Team | Shared VFS + conversation log                                        |
