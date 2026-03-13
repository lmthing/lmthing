# lmthing.space — Implementation Plan

> **Status:** Draft
> **Last updated:** 2026-03-13
> **Runtime:** Fly.io (1 core, 1 GB per node)
> **Port:** 3005 (`space.local`)
> **Package:** `@lmthing/space`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State](#2-current-state)
3. [Architecture Overview](#3-architecture-overview)
4. [Space Runtime Model](#4-space-runtime-model)
5. [Cloud Integration — New Edge Functions](#5-cloud-integration--new-edge-functions)
6. [Cloud Integration — Existing Function Changes](#6-cloud-integration--existing-function-changes)
7. [Database Schema Extensions](#7-database-schema-extensions)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [Frontend Implementation](#9-frontend-implementation)
10. [Agent Execution Engine](#10-agent-execution-engine)
11. [WebSocket Protocol](#11-websocket-protocol)
12. [Terminal Interface](#12-terminal-interface)
13. [Logging & Observability](#13-logging--observability)
14. [Billing & Metering](#14-billing--metering)
15. [Deployment & Infrastructure](#15-deployment--infrastructure)
16. [Security Model](#16-security-model)
17. [Migration Path from Studio](#17-migration-path-from-studio)
18. [API Reference](#18-api-reference)
19. [Implementation Phases](#19-implementation-phases)
20. [Open Questions](#20-open-questions)

---

## 1. Executive Summary

**lmthing.space** is the server-side agent runtime for lmthing. While Studio executes agents in the browser (via WebContainer on free tier), Space runs agents on dedicated Fly.io nodes — each provisioned with 1 CPU core and 1 GB RAM. This enables:

- **Persistent execution** — agents run 24/7, surviving browser closures
- **Background tasks** — autonomous agents that execute without user interaction
- **Server-side tools** — file system access, network requests, shell commands
- **Scheduled workflows** — cron-triggered flows and recurring agent tasks
- **Multi-agent orchestration** — agents collaborating within a shared VFS on the server

Space depends on the cloud backend for authentication, billing, node provisioning metadata, and LLM inference. This plan details both the Space package implementation and all required cloud-side changes.

---

## 2. Current State

### 2.1 Space Package (`space/`)

The Space package is a **skeleton UI** with placeholder routes:

| File | Status | Purpose |
|------|--------|---------|
| `src/routes/__root.tsx` | Placeholder | Root layout (bare `<Outlet />`) |
| `src/routes/index.tsx` | Placeholder | Dashboard (centered title only) |
| `src/routes/$spaceId/index.tsx` | Placeholder | Space detail (shows ID) |
| `src/routes/$spaceId/terminal.tsx` | Placeholder | Terminal (shows ID) |
| `src/routes/$spaceId/settings.tsx` | Placeholder | Settings (shows ID) |
| `src/routes/$spaceId/logs.tsx` | Placeholder | Logs (shows ID) |

**Dependencies installed but unused:** `@lmthing/state`, `@lmthing/ui`, `lmthing` (core framework).

### 2.2 Cloud Backend (`cloud/`)

Nine existing edge functions. None are space-aware today:

| Function | Space Impact |
|----------|-------------|
| `generate-ai` | Will be called by Space nodes for LLM inference |
| `list-models` | No changes needed |
| `create-api-key` | Space nodes need internal API keys |
| `list-api-keys` | May need space-scoped filtering |
| `revoke-api-key` | No changes needed |
| `create-checkout` | Needs space-tier pricing |
| `billing-portal` | No changes needed |
| `get-usage` | Needs per-space usage breakdown |
| `stripe-webhook` | Needs space lifecycle events |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (space.local)                   │
│                                                              │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌───────────┐  │
│  │Dashboard │  │ Terminal   │  │   Logs   │  │ Settings  │  │
│  │(list of  │  │(xterm.js  │  │(real-time│  │(config,   │  │
│  │ nodes)   │  │ + WS)     │  │ stream)  │  │ env vars) │  │
│  └────┬─────┘  └─────┬─────┘  └────┬─────┘  └─────┬─────┘  │
│       │               │             │               │        │
│       └───────────────┴──────┬──────┴───────────────┘        │
│                              │                                │
│                    WebSocket + REST                           │
└──────────────────────────────┼───────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
┌──────────────────┐  ┌──────────────┐  ┌──────────────────┐
│  Cloud (Supabase)│  │  Fly.io API  │  │  Space Node      │
│                  │  │              │  │  (Fly.io Machine) │
│  - Auth/JWT      │  │  - Provision │  │                   │
│  - Space CRUD    │  │  - Scale     │  │  ┌─────────────┐  │
│  - Billing       │  │  - Destroy   │  │  │ Agent Runner │  │
│  - Node registry │  │  - Logs API  │  │  │ (lmthing     │  │
│  - generate-ai   │  │  - Status    │  │  │  core)       │  │
│                  │  │              │  │  ├─────────────┤  │
│                  │  │              │  │  │ VFS (disk)   │  │
│                  │  │              │  │  ├─────────────┤  │
│                  │  │              │  │  │ WS Server    │  │
│                  │  │              │  │  ├─────────────┤  │
│                  │  │              │  │  │ PTY (shell)  │  │
│                  │  │              │  │  └─────────────┘  │
└──────────────────┘  └──────────────┘  └──────────────────┘
```

### 3.1 Three Distinct Components

1. **Space UI** (`space/src/`) — React SPA for managing and interacting with Space nodes
2. **Space Node Runtime** (`space/runtime/`) — Node.js process running on Fly.io machines
3. **Cloud Extensions** (`cloud/supabase/functions/`) — New and modified edge functions

---

## 4. Space Runtime Model

### 4.1 What is a Space Node?

A Space Node is a **Fly.io Machine** (microVM) that runs a single user's agent workspace. Each node:

- Runs a Node.js process with the `lmthing` core framework
- Has a persistent disk volume for workspace files (VFS on disk)
- Exposes a WebSocket server for terminal, logs, and agent communication
- Calls `cloud/generate-ai` for LLM inference (via internal `lmt_` API key)
- Can be started, stopped, and destroyed on demand

### 4.2 Node Lifecycle

```
Created ──► Starting ──► Running ──► Stopping ──► Stopped
                │                        │
                │                        ▼
                │                    Destroyed
                │
                └──► Failed
```

| State | Description |
|-------|-------------|
| `created` | Metadata exists in DB, Fly machine not yet provisioned |
| `starting` | Fly machine booting, runtime initializing |
| `running` | Node is live, accepting WebSocket connections |
| `stopping` | Graceful shutdown in progress |
| `stopped` | Machine suspended, volume preserved, no compute charges |
| `destroyed` | Machine and volume deleted, metadata retained for billing history |
| `failed` | Startup or runtime error, requires user intervention |

### 4.3 Node Specifications

| Resource | Default | Max (paid tier) |
|----------|---------|-----------------|
| CPU | 1 shared vCPU | 2 dedicated vCPU |
| Memory | 256 MB | 1 GB |
| Disk | 1 GB persistent volume | 10 GB |
| Region | Auto (closest) | User-selectable |
| Idle timeout | 15 min → auto-stop | Configurable (up to always-on) |
| Max nodes per user | 1 (free) | 5 (pro), 20 (team) |

### 4.4 Node Directory Structure

On the Fly.io machine's persistent volume:

```
/data/
├── workspace/                    # User's space files (mirrors VFS)
│   ├── package.json
│   ├── agents/
│   ├── flows/
│   └── knowledge/
├── runtime/
│   ├── config.json              # Node config (API key, cloud URL, etc.)
│   ├── state.json               # Current execution state
│   └── cron.json                # Scheduled tasks
├── logs/
│   ├── agent.log                # Agent execution logs
│   ├── system.log               # Node system logs
│   └── access.log               # API access logs
└── tmp/                          # Temp files, cleared on restart
```

---

## 5. Cloud Integration — New Edge Functions

Six new edge functions are required to support Space:

### 5.1 `create-space-node`

**Method:** POST
**Auth:** JWT or API key
**Purpose:** Register a new Space node and provision a Fly.io machine.

**Request:**
```json
{
  "space_id": "my-workspace",
  "region": "iad",
  "config": {
    "cpu": "shared-cpu-1x",
    "memory_mb": 256,
    "disk_gb": 1,
    "idle_timeout_min": 15,
    "auto_stop": true,
    "env": {
      "NODE_ENV": "production"
    }
  }
}
```

**Response:**
```json
{
  "node": {
    "id": "uuid",
    "space_id": "my-workspace",
    "fly_machine_id": "d5683eae",
    "fly_app_name": "lmt-usr-abc123",
    "region": "iad",
    "status": "starting",
    "internal_api_key": "lmt_internal_xxxx",
    "ws_url": "wss://lmt-usr-abc123.fly.dev/ws",
    "created_at": "2026-03-13T00:00:00Z"
  }
}
```

**Implementation steps:**
1. Authenticate user
2. Check node quota (free: 1, pro: 5, team: 20)
3. Ensure Stripe customer exists
4. Create `space_nodes` DB row with status `created`
5. Generate internal `lmt_` API key for the node (scoped to `generate-ai` only)
6. Call Fly.io Machines API to create machine:
   - Docker image: `registry.fly.io/lmthing-space-runtime:latest`
   - Attach persistent volume
   - Set environment variables (cloud URL, internal API key, node ID)
7. Update DB row with `fly_machine_id`, status → `starting`
8. Return node metadata

### 5.2 `list-space-nodes`

**Method:** GET
**Auth:** JWT or API key
**Purpose:** List all Space nodes for the authenticated user.

**Response:**
```json
{
  "nodes": [
    {
      "id": "uuid",
      "space_id": "my-workspace",
      "region": "iad",
      "status": "running",
      "cpu": "shared-cpu-1x",
      "memory_mb": 256,
      "disk_gb": 1,
      "created_at": "...",
      "last_active_at": "..."
    }
  ]
}
```

**Implementation:**
1. Authenticate user
2. Query `space_nodes` table filtered by `user_id`
3. Optionally poll Fly.io API for live status sync
4. Return node list

### 5.3 `get-space-node`

**Method:** GET
**Auth:** JWT or API key
**Purpose:** Get detailed status of a single Space node.

**Query param:** `?node_id=uuid`

**Response:**
```json
{
  "node": {
    "id": "uuid",
    "space_id": "my-workspace",
    "fly_machine_id": "d5683eae",
    "fly_app_name": "lmt-usr-abc123",
    "region": "iad",
    "status": "running",
    "cpu": "shared-cpu-1x",
    "memory_mb": 256,
    "disk_gb": 1,
    "idle_timeout_min": 15,
    "auto_stop": true,
    "ws_url": "wss://lmt-usr-abc123.fly.dev/ws",
    "uptime_seconds": 3600,
    "agents_running": ["agent-formula-expert"],
    "created_at": "...",
    "last_active_at": "..."
  }
}
```

**Implementation:**
1. Authenticate user
2. Query `space_nodes` by `id` + `user_id`
3. Fetch live status from Fly.io Machines API
4. Merge DB metadata with live state
5. Return combined node info

### 5.4 `update-space-node`

**Method:** POST
**Auth:** JWT or API key
**Purpose:** Start, stop, restart, or reconfigure a Space node.

**Request:**
```json
{
  "node_id": "uuid",
  "action": "start" | "stop" | "restart" | "resize",
  "config": {
    "cpu": "shared-cpu-2x",
    "memory_mb": 512,
    "idle_timeout_min": 30
  }
}
```

**Actions:**
| Action | Fly API Call | DB Update |
|--------|-------------|-----------|
| `start` | `POST /machines/{id}/start` | status → `starting` |
| `stop` | `POST /machines/{id}/stop` | status → `stopping` |
| `restart` | `POST /machines/{id}/restart` | status → `starting` |
| `resize` | `PATCH /machines/{id}` (guest config) | Update config columns |

### 5.5 `delete-space-node`

**Method:** POST
**Auth:** JWT or API key
**Purpose:** Permanently destroy a Space node and its volume.

**Request:**
```json
{
  "node_id": "uuid",
  "confirm": true
}
```

**Implementation:**
1. Authenticate user
2. Verify ownership
3. Require `confirm: true` (destructive operation)
4. Stop machine if running
5. Destroy Fly machine via API
6. Delete Fly volume via API
7. Revoke internal API key
8. Update DB: status → `destroyed`, set `destroyed_at`
9. Return confirmation

### 5.6 `space-node-heartbeat`

**Method:** POST
**Auth:** Internal API key only (`lmt_internal_*`)
**Purpose:** Node-to-cloud heartbeat for status sync and idle detection.

**Request (from node runtime):**
```json
{
  "node_id": "uuid",
  "status": "running",
  "agents_running": ["agent-formula-expert"],
  "memory_used_mb": 180,
  "cpu_percent": 12.5,
  "disk_used_mb": 450,
  "last_activity_at": "2026-03-13T12:00:00Z"
}
```

**Implementation:**
1. Validate internal API key
2. Update `space_nodes` row: `last_heartbeat_at`, `last_active_at`, resource usage
3. If idle beyond `idle_timeout_min`, send stop command to Fly API
4. Return `{ ack: true, commands: [] }` (can include remote commands like "stop", "update-config")

---

## 6. Cloud Integration — Existing Function Changes

### 6.1 `generate-ai` Changes

**Current:** Accepts any authenticated user request.
**Change:** Accept requests from Space nodes using internal API keys.

**Modifications:**
- Internal API keys (`lmt_internal_*`) resolve to the owning user's `stripe_customer_id`
- Add optional `x-space-node-id` header for per-node usage tracking
- No change to request/response format — nodes use the same API as browsers
- Rate limiting: Space nodes get higher rate limits (dedicated compute billing)

### 6.2 `create-checkout` Changes

**Current:** Generic subscription checkout.
**Change:** Support space-tier pricing.

**New price IDs:**
- `price_space_free` — 0 nodes included (just trying)
- `price_space_pro` — Up to 5 nodes, larger resource limits
- `price_space_team` — Up to 20 nodes, dedicated CPU option

**Modifications:**
- Accept optional `tier` field in request body
- Map tier to correct Stripe `price_id`
- Attach `metadata.space_tier` to Stripe subscription

### 6.3 `get-usage` Changes

**Current:** Returns overall Stripe balance.
**Change:** Also return per-node usage breakdown.

**Extended response:**
```json
{
  "stripe_customer_id": "cus_xxx",
  "balance_cents": -500,
  "balance_display": "$5.00",
  "has_credit": true,
  "space_usage": {
    "total_nodes": 2,
    "active_nodes": 1,
    "compute_hours_month": 45.2,
    "tokens_used_month": 125000,
    "by_node": [
      {
        "node_id": "uuid",
        "space_id": "my-workspace",
        "compute_hours": 30.1,
        "tokens_used": 80000
      }
    ]
  }
}
```

### 6.4 `stripe-webhook` Changes

**New events to handle:**

| Event | Action |
|-------|--------|
| `billing.alert.triggered` | Auto-stop all running space nodes when credits exhausted |
| `customer.subscription.deleted` | Schedule destruction of all space nodes (grace period: 7 days) |
| `customer.subscription.updated` | Adjust node quotas based on new tier |

### 6.5 `create-api-key` Changes

**Current:** Creates user-facing `lmt_` keys.
**Change:** Support internal key creation for Space nodes.

**New fields:**
- `type`: `"user"` (default) or `"internal"`
- `scope`: `["generate-ai"]` — restricts which endpoints the key can call
- `space_node_id`: Links key to a specific node (for internal keys)

**Internal keys:**
- Prefix: `lmt_internal_` (distinguishable from user keys)
- Auto-created during `create-space-node`
- Auto-revoked during `delete-space-node`
- Cannot be listed or managed by user (hidden from `list-api-keys`)

### 6.6 `auth.ts` (`_shared/`) Changes

**Current:** Resolves `lmt_*` keys to `AuthUser`.
**Change:** Also handle `lmt_internal_*` keys with scope checking.

**Extended `AuthUser` interface:**
```typescript
interface AuthUser {
  id: string
  email: string
  stripeCustomerId: string | null
  // New fields
  isInternalKey?: boolean
  keyScopes?: string[]        // e.g., ["generate-ai"]
  spaceNodeId?: string | null // linked node ID
}
```

**Scope enforcement:**
- After resolving the user, check if the key has scopes
- If scopes exist, verify the called function is in the allowed list
- Internal keys with `scope: ["generate-ai"]` can only call `generate-ai`

---

## 7. Database Schema Extensions

### 7.1 New Table: `space_nodes`

```sql
CREATE TABLE public.space_nodes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  space_id        text NOT NULL,                    -- workspace slug

  -- Fly.io metadata
  fly_machine_id  text UNIQUE,                      -- Fly machine ID
  fly_app_name    text,                             -- Fly app name
  fly_volume_id   text,                             -- Fly volume ID
  region          text NOT NULL DEFAULT 'iad',      -- Fly region code

  -- Configuration
  cpu             text NOT NULL DEFAULT 'shared-cpu-1x',
  memory_mb       int NOT NULL DEFAULT 256,
  disk_gb         int NOT NULL DEFAULT 1,
  idle_timeout_min int NOT NULL DEFAULT 15,
  auto_stop       boolean NOT NULL DEFAULT true,
  env_encrypted   text,                             -- AES-encrypted env vars JSON

  -- State
  status          text NOT NULL DEFAULT 'created'
                  CHECK (status IN ('created','starting','running','stopping','stopped','destroyed','failed')),
  error_message   text,                             -- set when status = 'failed'

  -- Internal auth
  internal_key_id uuid REFERENCES public.api_keys(id),

  -- Timestamps
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at   timestamptz,
  last_active_at      timestamptz,
  destroyed_at        timestamptz,

  -- Resource usage (updated by heartbeat)
  memory_used_mb      int,
  cpu_percent         real,
  disk_used_mb        int,
  agents_running      text[],                       -- array of agent IDs

  UNIQUE (user_id, space_id)                        -- one node per space per user
);

-- Indexes
CREATE INDEX idx_space_nodes_user ON public.space_nodes (user_id);
CREATE INDEX idx_space_nodes_status ON public.space_nodes (status) WHERE status != 'destroyed';
CREATE INDEX idx_space_nodes_fly ON public.space_nodes (fly_machine_id) WHERE fly_machine_id IS NOT NULL;

-- RLS
ALTER TABLE public.space_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own space nodes"
  ON public.space_nodes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role bypass (for heartbeat endpoint using internal keys)
CREATE POLICY "Service role full access"
  ON public.space_nodes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

### 7.2 Extend `api_keys` Table

```sql
ALTER TABLE public.api_keys
  ADD COLUMN type text NOT NULL DEFAULT 'user' CHECK (type IN ('user', 'internal')),
  ADD COLUMN scopes text[],                         -- e.g., ARRAY['generate-ai']
  ADD COLUMN space_node_id uuid REFERENCES public.space_nodes(id) ON DELETE SET NULL;

-- Index for internal key lookups
CREATE INDEX idx_api_keys_internal ON public.api_keys (space_node_id) WHERE type = 'internal';
```

### 7.3 New Table: `space_node_logs`

```sql
CREATE TABLE public.space_node_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id     uuid NOT NULL REFERENCES public.space_nodes(id) ON DELETE CASCADE,
  level       text NOT NULL CHECK (level IN ('debug','info','warn','error','fatal')),
  source      text NOT NULL DEFAULT 'system',       -- 'system', 'agent', 'user'
  message     text NOT NULL,
  metadata    jsonb,                                 -- structured data
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for log queries
CREATE INDEX idx_space_node_logs_node_time
  ON public.space_node_logs (node_id, created_at DESC);

-- Auto-cleanup: delete logs older than 30 days
-- (Implemented via pg_cron or Supabase scheduled function)

-- RLS via node ownership
ALTER TABLE public.space_node_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own node logs"
  ON public.space_node_logs FOR SELECT
  USING (
    node_id IN (
      SELECT id FROM public.space_nodes WHERE user_id = auth.uid()
    )
  );
```

### 7.4 Migration File

New migration: `cloud/supabase/migrations/002_space_nodes.sql`

Contains all the above DDL plus:
- `updated_at` trigger (reuse `moddatetime` extension)
- Comments on tables and columns
- Seed data for development (optional)

---

## 8. Authentication & Authorization

### 8.1 Browser ↔ Cloud

Standard flow — same as Studio:
- User authenticates via GitHub OAuth → Supabase JWT
- JWT passed in `Authorization: Bearer eyJh...` header
- All space management endpoints (CRUD, settings) use JWT auth

### 8.2 Browser ↔ Space Node

WebSocket authentication:
1. Browser requests a short-lived connection token from cloud (new endpoint or signed JWT claim)
2. Browser connects to Space node: `wss://{fly-app}.fly.dev/ws?token={connection_token}`
3. Node validates token against cloud
4. WebSocket connection established with user context

**Token format:**
```json
{
  "sub": "user_uuid",
  "node_id": "node_uuid",
  "exp": 1710000000,       // 5-minute expiry
  "iat": 1709999700,
  "scopes": ["terminal", "logs", "agent"]
}
```

### 8.3 Space Node ↔ Cloud

Internal API key authentication:
- Each node gets a dedicated `lmt_internal_*` key at creation
- Key is scoped to `["generate-ai"]` — nodes can only call LLM inference
- Key is injected as `LMTHING_INTERNAL_KEY` environment variable on the Fly machine
- Heartbeat endpoint accepts internal keys for status reporting

### 8.4 Authorization Matrix

| Actor | Endpoint | Auth Method |
|-------|----------|-------------|
| Browser | `create-space-node` | JWT |
| Browser | `list-space-nodes` | JWT or user API key |
| Browser | `get-space-node` | JWT or user API key |
| Browser | `update-space-node` | JWT |
| Browser | `delete-space-node` | JWT |
| Browser | Space Node WebSocket | Connection token |
| Space Node | `generate-ai` | Internal API key |
| Space Node | `space-node-heartbeat` | Internal API key |

---

## 9. Frontend Implementation

### 9.1 New Dependencies

```json
{
  "@xterm/xterm": "^5.5.0",
  "@xterm/addon-fit": "^0.10.0",
  "@xterm/addon-web-links": "^0.11.0",
  "@xterm/addon-search": "^0.15.0",
  "reconnecting-websocket": "^4.4.0"
}
```

### 9.2 Route Structure (Updated)

```
space/src/routes/
├── __root.tsx                    # Root layout with nav + auth context
├── index.tsx                     # Dashboard — list all nodes
├── new.tsx                       # Create new Space node wizard
└── $nodeId/
    ├── index.tsx                 # Node overview (status, agents, resources)
    ├── terminal.tsx              # Terminal (xterm.js + WebSocket)
    ├── logs.tsx                  # Real-time log viewer
    ├── agents.tsx                # Agent management (list, start, stop)
    ├── flows.tsx                 # Flow execution and history
    ├── knowledge.tsx             # Knowledge base editor
    ├── files.tsx                 # File browser (VFS on disk)
    └── settings.tsx              # Node config, env vars, resize
```

### 9.3 Root Layout (`__root.tsx`)

```
┌─────────────────────────────────────────────────────┐
│  [logo] lmthing.space          [usage] [user menu]  │
├──────────┬──────────────────────────────────────────┤
│          │                                           │
│  Sidebar │        <Outlet />                         │
│          │                                           │
│  Nodes:  │                                           │
│  ▸ node1 │                                           │
│  ▸ node2 │                                           │
│          │                                           │
│  [+ New] │                                           │
│          │                                           │
└──────────┴──────────────────────────────────────────┘
```

- Wraps in `AppProvider` from `@lmthing/state`
- Sidebar lists nodes from `list-space-nodes`
- Top bar shows usage (from `get-usage`) and user menu
- Uses `@lmthing/ui` components (Button, Card, Badge, etc.)

### 9.4 Dashboard (`index.tsx`)

Displays all Space nodes in a card grid:

```
┌───────────────────────────────────────────────┐
│  my-workspace                                  │
│  ● Running  │  iad  │  256 MB  │  1 vCPU      │
│                                                │
│  Agents: FormulaExpert (active)                │
│  Uptime: 2h 15m                                │
│                                                │
│  [Open]  [Stop]  [Terminal]                    │
└───────────────────────────────────────────────┘
```

- Status badge with color (green=running, yellow=starting, gray=stopped, red=failed)
- Quick actions: open, stop/start, terminal shortcut
- Empty state with "Create your first Space" CTA
- Resource usage bars (CPU, memory, disk)

### 9.5 Node Overview (`$nodeId/index.tsx`)

Detailed view of a single node:

- **Status card** — current state, uptime, region
- **Resource gauges** — CPU %, memory MB, disk GB (live via heartbeat polling)
- **Running agents** — list with start/stop controls
- **Recent activity** — last 10 log entries
- **Quick actions** — terminal, restart, destroy

### 9.6 Shared State

Use `@lmthing/state` hooks for client-side caching:

```typescript
// Custom hooks for Space
function useSpaceNodes()          // List all nodes (cached, auto-refresh)
function useSpaceNode(nodeId)     // Single node detail
function useNodeStatus(nodeId)    // Live status (polling or WS)
function useNodeLogs(nodeId)      // Log stream (WS subscription)
```

---

## 10. Agent Execution Engine

### 10.1 Runtime Process (`space/runtime/`)

A new directory for the server-side Node.js runtime that runs on Fly.io:

```
space/runtime/
├── package.json
├── tsconfig.json
├── Dockerfile
├── src/
│   ├── index.ts                 # Entry point — starts all services
│   ├── server.ts                # HTTP + WebSocket server (Hono or Fastify)
│   ├── agent-runner.ts          # Wraps lmthing core's runPrompt()
│   ├── workspace.ts             # Disk-backed VFS management
│   ├── heartbeat.ts             # Cloud heartbeat reporter
│   ├── scheduler.ts             # Cron-based flow execution
│   ├── terminal.ts              # PTY manager (node-pty)
│   └── logger.ts                # Structured logging
```

### 10.2 Agent Runner

Wraps the `lmthing` core framework for server-side execution:

```typescript
import { runPrompt } from 'lmthing'

class AgentRunner {
  // Start an agent from workspace config
  async startAgent(agentId: string): Promise<void> {
    const config = this.workspace.readAgentConfig(agentId)
    const instruct = this.workspace.readAgentInstruct(agentId)

    this.runningAgents.set(agentId, runPrompt({
      model: config.model || 'openai/gpt-4o-mini',
      system: instruct,
      tools: this.resolveTools(config.tools),
      apiKey: process.env.LMTHING_INTERNAL_KEY,
      baseURL: process.env.LMTHING_CLOUD_URL + '/generate-ai',
      // ... StatefulPrompt hooks, plugins, etc.
    }))
  }

  // Stop a running agent
  async stopAgent(agentId: string): Promise<void> { /* ... */ }

  // List running agents
  getRunningAgents(): string[] { /* ... */ }
}
```

### 10.3 Server-Side Tools

Agents running on Space nodes get access to tools unavailable in the browser:

| Tool | Description |
|------|-------------|
| `fs_read` | Read file from workspace |
| `fs_write` | Write file to workspace |
| `fs_list` | List directory contents |
| `shell_exec` | Execute shell command (sandboxed) |
| `http_fetch` | Make HTTP requests |
| `schedule_task` | Create cron-based recurring task |
| `send_notification` | Push notification to browser |

### 10.4 Workspace Manager

Syncs workspace files between disk and the agent:

```typescript
class WorkspaceManager {
  private basePath = '/data/workspace'

  // Read file from disk
  readFile(path: string): string { /* ... */ }

  // Write file to disk + emit event
  writeFile(path: string, content: string): void { /* ... */ }

  // List directory
  readDir(path: string): string[] { /* ... */ }

  // Sync with GitHub (push/pull)
  async gitSync(direction: 'push' | 'pull'): Promise<void> { /* ... */ }

  // Watch for file changes
  watch(pattern: string, callback: (event) => void): void { /* ... */ }
}
```

---

## 11. WebSocket Protocol

### 11.1 Connection

```
wss://{fly-app}.fly.dev/ws?token={connection_token}
```

### 11.2 Message Format

All messages are JSON-encoded:

```typescript
interface WSMessage {
  type: string
  channel: string       // 'terminal' | 'logs' | 'agent' | 'status' | 'files'
  payload: unknown
  id?: string           // For request/response correlation
  timestamp: string     // ISO 8601
}
```

### 11.3 Channels

**`terminal`** — PTY I/O
```typescript
// Client → Server
{ type: 'terminal:input', channel: 'terminal', payload: { data: "ls -la\r" } }
{ type: 'terminal:resize', channel: 'terminal', payload: { cols: 120, rows: 40 } }

// Server → Client
{ type: 'terminal:output', channel: 'terminal', payload: { data: "total 48\ndrwxr-xr-x..." } }
```

**`logs`** — Real-time log stream
```typescript
// Client → Server
{ type: 'logs:subscribe', channel: 'logs', payload: { level: 'info', source: 'agent' } }
{ type: 'logs:unsubscribe', channel: 'logs' }

// Server → Client
{ type: 'logs:entry', channel: 'logs', payload: { level: 'info', source: 'agent', message: '...', metadata: {} } }
```

**`agent`** — Agent control and output
```typescript
// Client → Server
{ type: 'agent:start', channel: 'agent', payload: { agentId: 'agent-formula-expert' } }
{ type: 'agent:stop', channel: 'agent', payload: { agentId: 'agent-formula-expert' } }
{ type: 'agent:message', channel: 'agent', payload: { agentId: '...', content: 'Hello' } }

// Server → Client
{ type: 'agent:started', channel: 'agent', payload: { agentId: '...' } }
{ type: 'agent:response', channel: 'agent', payload: { agentId: '...', content: '...', streaming: true } }
{ type: 'agent:tool_call', channel: 'agent', payload: { agentId: '...', tool: 'fs_write', args: {} } }
{ type: 'agent:stopped', channel: 'agent', payload: { agentId: '...' } }
{ type: 'agent:error', channel: 'agent', payload: { agentId: '...', error: '...' } }
```

**`status`** — Node status updates
```typescript
// Server → Client (periodic, every 5s)
{ type: 'status:update', channel: 'status', payload: { cpu_percent: 12.5, memory_used_mb: 180, disk_used_mb: 450, agents_running: ['...'] } }
```

**`files`** — File change notifications
```typescript
// Server → Client
{ type: 'files:changed', channel: 'files', payload: { path: 'agents/agent-expert/values.json', action: 'write' } }
{ type: 'files:deleted', channel: 'files', payload: { path: 'tmp/scratch.txt' } }
```

---

## 12. Terminal Interface

### 12.1 Frontend (`space/src/routes/$nodeId/terminal.tsx`)

Uses `@xterm/xterm` with WebSocket transport:

```typescript
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'

function TerminalPage() {
  const { nodeId } = Route.useParams()
  const termRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const term = new Terminal({
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 14,
      theme: { /* match @lmthing/css theme */ },
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(new WebLinksAddon())
    term.loadAddon(new SearchAddon())
    term.open(termRef.current)
    fitAddon.fit()

    // Connect WebSocket for PTY I/O
    const ws = connectToNode(nodeId, 'terminal')
    term.onData(data => ws.send({ type: 'terminal:input', channel: 'terminal', payload: { data } }))
    ws.onMessage(msg => { if (msg.type === 'terminal:output') term.write(msg.payload.data) })

    return () => { ws.close(); term.dispose() }
  }, [nodeId])

  return <div ref={termRef} className="h-full w-full" />
}
```

### 12.2 Backend (Node Runtime)

Uses `node-pty` for pseudo-terminal:

```typescript
import * as pty from 'node-pty'

class PTYManager {
  private sessions = new Map<string, pty.IPty>()

  createSession(userId: string): pty.IPty {
    const shell = process.env.SHELL || '/bin/bash'
    const proc = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: '/data/workspace',
      env: { ...process.env, TERM: 'xterm-256color' },
    })
    this.sessions.set(userId, proc)
    return proc
  }

  resize(userId: string, cols: number, rows: number) {
    this.sessions.get(userId)?.resize(cols, rows)
  }

  destroy(userId: string) {
    const proc = this.sessions.get(userId)
    proc?.kill()
    this.sessions.delete(userId)
  }
}
```

---

## 13. Logging & Observability

### 13.1 Log Sources

| Source | Description | Storage |
|--------|-------------|---------|
| `system` | Node lifecycle, resource usage, heartbeat | `space_node_logs` + disk |
| `agent` | Agent execution, tool calls, LLM requests | `space_node_logs` + disk |
| `user` | Terminal commands, file edits | Disk only (privacy) |
| `access` | WebSocket connections, API calls | Disk only |

### 13.2 Log Pipeline

```
Agent/System Event
       │
       ▼
  Logger (structured JSON)
       │
       ├──► Disk (rotated, 7 days)
       │
       ├──► WebSocket → Browser (real-time)
       │
       └──► Cloud (batched, every 60s)
              │
              ▼
         space_node_logs table
```

### 13.3 Frontend Log Viewer (`$nodeId/logs.tsx`)

- Real-time streaming via WebSocket `logs` channel
- Filter by level (debug, info, warn, error)
- Filter by source (system, agent)
- Search within logs
- Auto-scroll with "pin to bottom" toggle
- Historical logs loaded from cloud on page load
- Color-coded levels with monospace font

### 13.4 Metrics Collection

Heartbeat sends system metrics every 30 seconds:

```json
{
  "cpu_percent": 12.5,
  "memory_used_mb": 180,
  "memory_total_mb": 256,
  "disk_used_mb": 450,
  "disk_total_mb": 1024,
  "network_rx_bytes": 1048576,
  "network_tx_bytes": 524288,
  "agents_running": ["agent-formula-expert"],
  "open_ws_connections": 2,
  "uptime_seconds": 3600
}
```

---

## 14. Billing & Metering

### 14.1 Billing Components

| Component | Billing Model | Via |
|-----------|---------------|-----|
| LLM tokens | Per-token (existing) | Stripe Token Billing (via `generate-ai`) |
| Compute time | Per-second while running | Stripe Meter (new) |
| Disk storage | Per-GB-month | Stripe Meter (new) |
| Data transfer | Per-GB (egress) | Stripe Meter (new) |

### 14.2 Compute Metering

The heartbeat endpoint records compute time:

```
Node starts → record start_time
Heartbeat every 30s → increment meter
Node stops → record stop_time, final meter event
```

Stripe meter events sent from heartbeat handler:
```json
{
  "event_name": "space-compute-seconds",
  "payload": {
    "stripe_customer_id": "cus_xxx",
    "value": "30",
    "node_id": "uuid",
    "cpu": "shared-cpu-1x",
    "region": "iad"
  }
}
```

### 14.3 Tier Limits

| Feature | Free | Pro | Team |
|---------|------|-----|------|
| Max nodes | 1 | 5 | 20 |
| Max CPU | shared-1x | shared-2x | dedicated-2x |
| Max memory | 256 MB | 512 MB | 1 GB |
| Max disk | 1 GB | 5 GB | 10 GB |
| Idle timeout | 15 min (fixed) | Configurable | Always-on option |
| Compute included | 10 hr/month | 100 hr/month | 500 hr/month |
| Regions | Auto only | 3 choices | All regions |

### 14.4 Credit Exhaustion

When Stripe fires `billing.alert.triggered`:
1. Cloud webhook receives event
2. Queries `space_nodes` for all running nodes of the customer
3. Sends stop command to each node via Fly.io API
4. Updates DB status to `stopped`
5. Sends notification to user (if WebSocket connected)

---

## 15. Deployment & Infrastructure

### 15.1 Fly.io Setup

**Organization:** `lmthing`
**App naming:** `lmt-{user-hash}` (one Fly app per user, machines inside)

**Docker Image** (`space/runtime/Dockerfile`):
```dockerfile
FROM node:20-slim

RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy runtime package
COPY space/runtime/package.json space/runtime/pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod

COPY space/runtime/dist/ ./dist/

# Copy core framework (bundled)
COPY org/libs/core/dist/ ./node_modules/lmthing/dist/

ENV NODE_ENV=production
ENV DATA_DIR=/data

EXPOSE 8080

CMD ["node", "dist/index.js"]
```

### 15.2 Fly.io Machine Config

```json
{
  "config": {
    "image": "registry.fly.io/lmthing-space-runtime:latest",
    "guest": {
      "cpu_kind": "shared",
      "cpus": 1,
      "memory_mb": 256
    },
    "services": [
      {
        "ports": [{ "port": 443, "handlers": ["tls", "http"] }],
        "protocol": "tcp",
        "internal_port": 8080
      }
    ],
    "mounts": [
      {
        "volume": "{volume_id}",
        "path": "/data"
      }
    ],
    "env": {
      "LMTHING_CLOUD_URL": "https://{project-ref}.supabase.co/functions/v1",
      "LMTHING_INTERNAL_KEY": "lmt_internal_xxxx",
      "LMTHING_NODE_ID": "{node_uuid}",
      "DATA_DIR": "/data"
    },
    "auto_destroy": false,
    "restart": {
      "policy": "on-failure",
      "max_retries": 3
    }
  }
}
```

### 15.3 CI/CD Pipeline

```
Push to main
    │
    ├──► Build runtime Docker image
    │    └──► Push to Fly registry
    │
    ├──► Deploy cloud functions
    │    └──► supabase functions deploy
    │
    └──► Build Space UI
         └──► Deploy to CDN (Vercel/Cloudflare)
```

### 15.4 Required Secrets

| Secret | Location | Purpose |
|--------|----------|---------|
| `FLY_API_TOKEN` | Cloud env | Fly.io API access for provisioning |
| `FLY_ORG_SLUG` | Cloud env | Fly.io organization |
| `STRIPE_SECRET_KEY` | Cloud env (existing) | Billing |
| `STRIPE_WEBHOOK_SECRET` | Cloud env (existing) | Webhook verification |
| `LMTHING_INTERNAL_KEY` | Fly machine env | Per-node cloud auth |
| `LMTHING_CLOUD_URL` | Fly machine env | Per-node cloud endpoint |
| `LMTHING_NODE_ID` | Fly machine env | Per-node identity |

---

## 16. Security Model

### 16.1 Isolation

| Layer | Mechanism |
|-------|-----------|
| Compute | Fly.io microVM (Firecracker) — hardware-level isolation |
| Network | Each machine gets its own private IPv6 |
| Storage | Dedicated volume per machine, encrypted at rest |
| Process | Node.js with restricted shell (no root) |
| API | Internal API keys scoped to `generate-ai` only |

### 16.2 Shell Sandboxing

Agent `shell_exec` tool restrictions:
- No `sudo`, `su`, or privilege escalation
- No network tools that could scan internal infra (`nmap`, `nc` to internal IPs)
- Working directory locked to `/data/workspace`
- Execution timeout: 30 seconds
- Output size limit: 1 MB

### 16.3 WebSocket Security

- Connection tokens expire in 5 minutes
- Tokens are single-use (consumed on connection)
- Tokens are signed with a secret known only to cloud
- Node validates token by calling cloud verification endpoint
- WebSocket connections are rate-limited (max 5 concurrent per node)

### 16.4 Environment Variable Security

- User-defined env vars are encrypted at rest in the DB (`env_encrypted` column)
- Encryption: AES-256-GCM with a per-user derived key
- Env vars are decrypted only when provisioning/updating the Fly machine
- Env vars are never returned in API responses (write-only from user perspective)

---

## 17. Migration Path from Studio

### 17.1 Deploy from Studio to Space

Users can "deploy" a workspace from Studio (browser) to Space (server):

1. User clicks "Deploy to Space" in Studio
2. Studio exports workspace as a tarball (all VFS files)
3. Studio calls `create-space-node` with workspace config
4. Cloud provisions Fly machine
5. Studio uploads tarball to node via WebSocket `files` channel
6. Node extracts files to `/data/workspace`
7. Node starts configured agents
8. User redirected to `space.local/$nodeId`

### 17.2 Sync Between Studio and Space

Bidirectional sync via GitHub:
- **Studio → GitHub → Space:** User pushes from Studio, Space pulls
- **Space → GitHub → Studio:** Node pushes changes, Studio pulls
- Both use standard git merge workflows for conflict resolution

### 17.3 Import from Space to Studio

- Space node packages workspace as tarball
- Studio downloads and imports into VFS
- Useful for editing in browser then redeploying

---

## 18. API Reference

### 18.1 Cloud Endpoints (New)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/functions/v1/create-space-node` | JWT / API key | Create and provision a new node |
| GET | `/functions/v1/list-space-nodes` | JWT / API key | List all user's nodes |
| GET | `/functions/v1/get-space-node?node_id=` | JWT / API key | Get node details + live status |
| POST | `/functions/v1/update-space-node` | JWT | Start/stop/restart/resize node |
| POST | `/functions/v1/delete-space-node` | JWT | Destroy node permanently |
| POST | `/functions/v1/space-node-heartbeat` | Internal key | Node status reporting |

### 18.2 Node WebSocket API

| Channel | Client Messages | Server Messages |
|---------|----------------|-----------------|
| `terminal` | `input`, `resize` | `output` |
| `logs` | `subscribe`, `unsubscribe` | `entry` |
| `agent` | `start`, `stop`, `message` | `started`, `response`, `tool_call`, `stopped`, `error` |
| `status` | — | `update` (periodic) |
| `files` | — | `changed`, `deleted` |

### 18.3 Node HTTP API (Internal)

Exposed on port 8080 within the Fly machine:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check (Fly uses this) |
| GET | `/status` | Detailed node status |
| POST | `/agents/:id/start` | Start agent (called by WS handler) |
| POST | `/agents/:id/stop` | Stop agent |
| GET | `/agents` | List running agents |
| WS | `/ws` | WebSocket endpoint |

---

## 19. Implementation Phases

### Phase 1: Foundation (Weeks 1–2)

**Goal:** Cloud infrastructure and basic node lifecycle.

**Cloud:**
- [ ] Write migration `002_space_nodes.sql` (tables, indexes, RLS)
- [ ] Extend `api_keys` table with `type`, `scopes`, `space_node_id`
- [ ] Update `_shared/auth.ts` for internal key support and scope checking
- [ ] Implement `create-space-node` edge function
- [ ] Implement `list-space-nodes` edge function
- [ ] Implement `get-space-node` edge function
- [ ] Implement `update-space-node` edge function
- [ ] Implement `delete-space-node` edge function
- [ ] Implement `space-node-heartbeat` edge function

**Infrastructure:**
- [ ] Set up Fly.io org and registry
- [ ] Create base Docker image for Space runtime
- [ ] Configure Fly.io API token as Supabase secret
- [ ] Test machine provisioning via Fly Machines API

### Phase 2: Runtime (Weeks 3–4)

**Goal:** Node.js runtime that executes agents on Fly.io.

**Runtime (`space/runtime/`):**
- [ ] Scaffold runtime package (`package.json`, `tsconfig.json`)
- [ ] Implement HTTP server (health, status endpoints)
- [ ] Implement WebSocket server with channel routing
- [ ] Implement `WorkspaceManager` (disk-backed VFS)
- [ ] Implement `AgentRunner` (wraps `lmthing` core's `runPrompt`)
- [ ] Implement `HeartbeatReporter` (periodic cloud pings)
- [ ] Implement `PTYManager` (node-pty shell sessions)
- [ ] Implement structured logger
- [ ] Build Dockerfile and test locally
- [ ] Deploy test image to Fly registry

### Phase 3: Frontend — Dashboard & Node Management (Weeks 5–6)

**Goal:** Manage Space nodes from the browser.

**Frontend (`space/src/`):**
- [ ] Set up `AppProvider` in root layout with auth
- [ ] Build sidebar with node list
- [ ] Build dashboard with node cards (status, region, resources)
- [ ] Build "Create Node" wizard (region, size, env vars)
- [ ] Build node overview page (status, gauges, quick actions)
- [ ] Build settings page (resize, env vars, idle timeout)
- [ ] Build delete confirmation flow
- [ ] Implement `useSpaceNodes`, `useSpaceNode`, `useNodeStatus` hooks
- [ ] Connect to cloud endpoints for all CRUD operations

### Phase 4: Frontend — Terminal & Logs (Weeks 7–8)

**Goal:** Interactive terminal and real-time log viewer.

**Frontend:**
- [ ] Integrate `@xterm/xterm` with addons (fit, web-links, search)
- [ ] Build WebSocket connection manager with reconnection
- [ ] Build terminal page (full-height xterm, connected to PTY via WS)
- [ ] Build log viewer page (real-time + historical, filters, search)
- [ ] Build status bar (live resource gauges via WS `status` channel)
- [ ] Handle connection token lifecycle (request, refresh, expiry)

### Phase 5: Agent Management UI (Weeks 9–10)

**Goal:** Start, stop, and interact with agents from the browser.

**Frontend:**
- [ ] Build agents page (list, status badges, start/stop buttons)
- [ ] Build agent chat interface (send messages, receive streaming responses)
- [ ] Build tool call visualization (show what tools agent is invoking)
- [ ] Build flows page (trigger flows, view step progress)
- [ ] Build knowledge page (browse/edit knowledge base)
- [ ] Build files page (file browser, editor for workspace files)

### Phase 6: Billing & Metering (Weeks 11–12)

**Goal:** Usage tracking and tiered pricing.

**Cloud:**
- [ ] Create Stripe meters for `space-compute-seconds`, `space-disk-gb`
- [ ] Create Stripe products/prices for free, pro, team tiers
- [ ] Update `create-checkout` for space tier pricing
- [ ] Update `get-usage` for per-node usage breakdown
- [ ] Update `stripe-webhook` for credit exhaustion → auto-stop nodes
- [ ] Update `stripe-webhook` for subscription lifecycle → adjust quotas
- [ ] Implement compute metering in heartbeat handler

**Frontend:**
- [ ] Build usage page with per-node breakdown
- [ ] Build upgrade flow (free → pro → team)
- [ ] Show credit exhaustion warnings

### Phase 7: Deploy-from-Studio & Git Sync (Weeks 13–14)

**Goal:** Seamless movement between Studio and Space.

**Studio (`studio/src/`):**
- [ ] Add "Deploy to Space" button in studio toolbar
- [ ] Build deploy wizard (select region, configure node)
- [ ] Implement workspace export (VFS → tarball)
- [ ] Handle workspace upload to new Space node

**Runtime:**
- [ ] Implement workspace import (tarball → disk)
- [ ] Implement GitHub sync (push/pull from node)
- [ ] Handle merge conflicts

### Phase 8: Hardening & Polish (Weeks 15–16)

**Goal:** Production readiness.

- [ ] Shell sandboxing (restricted commands, timeouts, output limits)
- [ ] WebSocket connection token rotation and single-use enforcement
- [ ] Environment variable encryption (AES-256-GCM in DB)
- [ ] Rate limiting on all endpoints
- [ ] Error handling and retry logic throughout
- [ ] Comprehensive logging and alerting
- [ ] Load testing (concurrent nodes, concurrent WebSocket connections)
- [ ] Documentation (user-facing guides, API docs)
- [ ] End-to-end integration tests

---

## 20. Open Questions

1. **Fly.io app-per-user vs shared app?** — One Fly app per user provides better isolation but more management overhead. A shared app with per-machine networking may be simpler. Need to evaluate Fly.io's machine limits per app.

2. **WebSocket connection token validation** — Should the node call a cloud endpoint to validate tokens, or should tokens be self-validating JWTs signed with a shared secret?

3. **Log retention** — 30 days in the database is proposed. Should pro/team tiers get longer retention? Should logs be archived to object storage?

4. **Multi-node workspaces** — Can a single workspace span multiple nodes (horizontal scaling)? Or is it always 1:1?

5. **Space node auto-start** — Should nodes auto-start when the user opens the Space UI? Or require explicit start?

6. **GitHub sync frequency** — Real-time (every file change)? On-demand? Periodic (every N minutes)?

7. **Agent state persistence** — When a node stops, should in-progress agent conversations be serialized to disk and resumed on restart?

8. **Casa integration** — Casa (smart home) uses Space nodes to connect to Home Assistant. Does this require special networking (Tailscale/WireGuard) or just HTTP from node to HA instance?

9. **Shared vs isolated runtimes for Social/Team** — The architecture mentions "shared VFS + conversation log" for Social and Team. Do they share Space nodes or get their own isolated approach?

10. **Free tier compute limits** — 10 hours/month on free tier. Is this enforced by auto-stopping after 10 cumulative hours, or by blocking new starts after the limit?

---

*This plan is a living document. Update it as decisions are made and implementation progresses.*
