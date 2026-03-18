---
title: Infrastructure
description: Fly.io containers, pnpm workspaces, nginx proxy, GitHub sync, and deployment
order: 3
---

# Infrastructure

The infrastructure layer handles compute provisioning, monorepo tooling, local development, and deployment.

## Compute — Fly.io

Fly.io provides container-based compute for two use cases:

### Computer Nodes

- **Purpose**: THING agent runtime — 1 core, 1 GB RAM per user
- **Provisioning**: Triggered by `stripe-webhook` after successful payment, calls `provision-computer` edge function
- **Access**: Terminal via WebSocket, managed by `org/libs/server/` runtime
- **Management**: `@lmthing/container` library wraps Fly.io Machines API

### Space Containers

- **Purpose**: Deployed spaces with running agents, or published agents for API access
- **Lifecycle**: Create → Start → Stop → Delete, managed by space edge functions
- **Tokens**: Short-lived access tokens issued by `issue-space-token` edge function

### Key Fly.io Concepts

- **Machines API** — REST API for creating/starting/stopping/destroying VMs
- **Regions** — Deploy close to users (auto-selected or specified)
- **Volumes** — Persistent storage attached to machines (for computer nodes)

## Monorepo Tooling — pnpm

### Workspace Structure

```yaml
# pnpm-workspace.yaml
packages:
  - 'org/libs/*'
  - 'studio'
  - 'chat'
  - 'com'
  - 'cloud'
  # ... all TLD directories
```

### Key Commands

```bash
pnpm install              # Install all workspace dependencies
pnpm -r build             # Build all packages recursively
pnpm --filter studio dev  # Run dev server for studio only
pnpm add <pkg> --filter <workspace>  # Add dependency to specific workspace
```

### Workspace References

Inter-package dependencies use `workspace:*`:

```json
{
  "dependencies": {
    "@lmthing/ui": "workspace:*",
    "@lmthing/state": "workspace:*",
    "lmthing": "workspace:*"
  }
}
```

## Local Development — nginx Proxy

`make proxy` sets up an nginx reverse proxy for local development:

1. Adds `127.0.0.1 <app>.local` entries to `/etc/hosts`
2. Creates nginx server blocks: `studio.local` → `localhost:3000`, etc.
3. Includes WebSocket upgrade headers for Vite HMR

### Service Ports

| App | Port | Domain |
|-----|------|--------|
| Studio | 3000 | studio.local |
| Chat | 3001 | chat.local |
| Com | 3002 | com.local |
| Social | 3003 | social.local |
| Store | 3004 | store.local |
| Space | 3005 | space.local |
| Team | 3006 | team.local |
| Blog | 3007 | blog.local |
| Casa | 3008 | casa.local |
| Cloud | 3009 | cloud.local |
| Computer | 3010 | computer.local |

Port assignments defined in `services.yaml`.

### Make Targets

| Command | Description |
|---------|-------------|
| `make up` | Start all frontend dev servers in parallel |
| `make down` | Stop all running dev servers |
| `make proxy` | Set up nginx + /etc/hosts for *.local domains |
| `make proxy-clean` | Remove nginx configs and /etc/hosts entries |
| `make install` | Run `pnpm install` |

## Data Sync — GitHub

- **Workspace persistence**: User's workspace (agents, flows, knowledge) stored in a private GitHub repo
- **Created during onboarding**: `com/` creates the repo via GitHub API with `repo` scope
- **Sync mechanism**: `@lmthing/state` VFS pushes/pulls to GitHub repo
- **Conflict resolution**: Standard git merge workflows

## Deployment

### Frontend Apps

- Static SPAs built with Vite
- Deployed to CDN/edge hosting (Vercel, Cloudflare Pages, or similar)
- No server-side rendering — all client-side

### Cloud Functions

```bash
# Deploy a single function
supabase functions deploy <function-name>

# Deploy all functions
supabase functions deploy
```

### Fly.io Containers

- Provisioned dynamically via Machines API
- Managed by edge functions (`create-space`, `provision-computer`, etc.)
- `@lmthing/container` library handles all Fly.io API interactions
