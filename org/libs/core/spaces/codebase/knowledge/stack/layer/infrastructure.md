---
title: Infrastructure
description: K8s compute pods, pnpm workspaces, nginx proxy, GitHub sync, and deployment
order: 3
---

# Infrastructure

The infrastructure layer handles compute provisioning, monorepo tooling, local development, and deployment.

## Compute — Kubernetes

K8s pods provide container-based compute for two use cases:

### Computer Nodes

- **Purpose**: THING agent runtime — 0.5 CPU, 1 GB RAM, 1 GB storage per user
- **Provisioning**: Triggered by Stripe webhook after Pro tier subscription, Gateway creates K8s namespace + deployment + service
- **Access**: Terminal via WebSocket, Envoy Gateway routes `/api/*` to user's pod
- **Management**: Gateway uses K8s API directly (in-cluster service account)

### Space Containers

- **Purpose**: Deployed spaces with running agents, or published agents for API access
- **Lifecycle**: Create → Start → Stop → Delete, managed by Gateway via K8s API

### Key K8s Concepts

- **Per-user namespace** — `user-{id}` namespace isolates each user's resources
- **Envoy Gateway** — JWT validation + Lua script for dynamic per-user routing
- **emptyDir volumes** — Ephemeral storage for user workspace data (1 GB limit)

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

1. Adds `127.0.0.1 <app>.test` entries to `/etc/hosts`
2. Creates nginx server blocks: `studio.test` → `localhost:3000`, etc.
3. Includes WebSocket upgrade headers for Vite HMR

### Service Ports

| App | Port | Domain |
|-----|------|--------|
| Studio | 3000 | studio.test |
| Chat | 3001 | chat.test |
| Com | 3002 | com.test |
| Social | 3003 | social.test |
| Store | 3004 | store.test |
| Space | 3005 | space.test |
| Team | 3006 | team.test |
| Blog | 3007 | blog.test |
| Casa | 3008 | casa.test |
| Cloud | 3009 | cloud.test |
| Computer | 3010 | computer.test |

Port assignments defined in `services.yaml`.

### Make Targets

| Command | Description |
|---------|-------------|
| `make up` | Start all frontend dev servers in parallel |
| `make down` | Stop all running dev servers |
| `make proxy` | Set up nginx + /etc/hosts for *.test domains |
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

### Cloud Backend

- Gateway (Hono/Node.js) + LiteLLM deployed to K8s via Ansible
- `cd devops/ansible && make deploy`

### Per-User Compute

- Provisioned dynamically via K8s API by the Gateway
- Managed by Stripe webhook handlers (create on Pro subscribe, delete on cancel)
- Pod template: Bun + @lmthing/repl runtime image
