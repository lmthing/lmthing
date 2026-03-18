---
title: Product Apps
description: Frontend product domains — each TLD has its own directory and Vite dev server
order: 3
---

# Product Apps

The monorepo is organized by TLD — each `lmthing.*` domain has its own top-level directory. All apps are static SPAs calling `cloud/` edge functions for server-side logic.

## App Directory

### `studio/` — lmthing.studio (Port 3000)

The **primary development surface** — the agent builder UI. Most features are built and tested here.

- **Stack**: React 19, Vite 7, TanStack Router, Tailwind 4, Radix UI
- **Purpose**: Create, configure, and test agents. Manage workspaces. Edit spaces, flows, and knowledge.
- **Key integration**: `@lmthing/state` (VFS for workspace files), `@lmthing/ui` (shared components), `lmthing` (core framework)
- **Runtime**: Browser (WebContainer for free tier)

### `chat/` — lmthing.chat (Port 3001)

Personal THING interface for conversational interaction.

- **Purpose**: Chat with the THING agent and its studio spaces
- **Runtime**: Browser

### `com/` — lmthing.com (Port 3002)

Commercial landing page and **central auth hub**.

- **Purpose**: Marketing site, GitHub OAuth login, onboarding (creates user's private GitHub repo), SSO code issuance
- **Critical role**: All other apps redirect here for authentication — no app has its own login UI

### `social/` — lmthing.social (Port 3003)

Public hive mind — shared conversations and agent interactions.

- **Runtime**: Shared VFS + conversation log

### `store/` — lmthing.store (Port 3004)

Agent marketplace for publishing and discovering agents.

- **Purpose**: Browse, purchase, and deploy community-built agents

### `space/` — lmthing.space (Port 3005)

Deploy spaces to containers with running agents, or publish agents for API access.

- **Runtime**: Fly.io container — deployed spaces + published agents

### `team/` — lmthing.team (Port 3006)

Private agent rooms for team collaboration.

- **Runtime**: Shared VFS + conversation log

### `blog/` — lmthing.blog (Port 3007)

Personalized AI news aggregation.

- **Runtime**: Shared serverless worker

### `casa/` — lmthing.casa (Port 3008)

Smart home integration with Home Assistant.

- **Runtime**: Computer node → remote Home Assistant connection

### `computer/` — lmthing.computer (Port 3010)

THING agent runtime — where the THING agent and its studio spaces live.

- **Purpose**: Fly.io node (1 core, 1 GB) with terminal access, agent execution
- **Runtime**: Fly.io container

### `cloud/` — lmthing.cloud (Port 3009)

Supabase Edge Functions — the sole backend. See the **Cloud Backend** knowledge domain for details.

## Shared Stack

All frontend apps share:

- **React 19** + **Vite 7** + **TanStack Router** (file-based routing)
- **Tailwind CSS v4** via `@tailwindcss/vite`
- **Shared workspace libs**: `@lmthing/ui`, `@lmthing/css`, `@lmthing/state`, `lmthing` (core)
- **Path aliases**: `@/` → `./src`, workspace libs resolved via Vite `resolve.alias` in `org/libs/utils/src/vite.mjs`

## Creating a New App

1. Create a directory at the monorepo root matching the TLD (e.g., `newapp/`)
2. Initialize with shared Vite config from `org/libs/utils/`
3. Add `@lmthing/auth` for authentication (redirects to `com/` for login)
4. Add port assignment to `services.yaml`
5. Run `make proxy` to add nginx reverse proxy mapping
6. Add workspace dependencies: `pnpm add @lmthing/ui@workspace:* @lmthing/css@workspace:*`

## Local Development

```bash
make up          # Start all frontend dev servers in parallel
make down        # Stop all running dev servers
make proxy       # Set up nginx + /etc/hosts for *.local domains
make proxy-clean # Remove nginx configs and /etc/hosts entries
```

Individual app: `cd studio && pnpm dev`

Domains resolve via nginx reverse proxy: `studio.local` → `localhost:3000`, etc.
