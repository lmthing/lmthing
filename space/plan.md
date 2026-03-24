# lmthing.space — Implementation Plan

> **Status:** Draft
> **Date:** 2026-03-14
> **Port:** 3005 (`space.local`)
> **Package:** `@lmthing/space`

---

## Current State

The space app is a minimal scaffold:

- `__root.tsx` — bare `<Outlet />`, no auth or providers
- `index.tsx` — placeholder "lmthing space" centered text
- `$spaceId/index.tsx` — shows space ID from params
- `$spaceId/terminal.tsx` — working WebSocket terminal (fetches token from `issue-computer-token`, connects via `wss://`)
- `$spaceId/logs.tsx`, `$spaceId/settings.tsx` — stubs

No auth integration, no space CRUD, no admin/user role split.

---

## Goal

Transform space into an AI-native app platform where:

1. **Owners** talk to THING to build apps (pages, components, database schemas)
2. **Users** interact with the deployed AI-native app
3. Each space lives at `lmthing.space/<slug>/` with config-driven + code-gen rendering

---

## Phase 1: Infrastructure (Cloud + DB)

### 1.1 Database Migration

Create `cloud/supabase/migrations/003_spaces.sql`:

```sql
CREATE TABLE public.spaces (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug              text NOT NULL UNIQUE,
  name              text NOT NULL,
  description       text,

  -- K8s
  pod_name          text UNIQUE,
  namespace         text,
  volume_claim      text,
  region            text NOT NULL DEFAULT 'iad',
  status            text NOT NULL DEFAULT 'created'
                    CHECK (status IN ('created','provisioning','running','stopped','failed','destroyed')),

  -- Config
  app_config        jsonb DEFAULT '{}',
  auth_enabled      boolean DEFAULT false,
  custom_domain     text UNIQUE,

  -- Per-space DB (schema isolation)
  db_schema         text,

  -- Internal auth
  internal_key_id   uuid REFERENCES public.api_keys(id),

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);

ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own spaces" ON public.spaces
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public read running spaces" ON public.spaces
  FOR SELECT USING (status = 'running');
```

### 1.2 New Edge Functions

All follow the standard pattern in `cloud/supabase/functions/`:

| Function | Method | Auth | Purpose |
|----------|--------|------|---------|
| `create-space` | POST | JWT | Insert into `spaces`, create K8s pod, create DB schema |
| `list-spaces` | GET | JWT | `SELECT * FROM spaces WHERE user_id = auth.uid()` |
| `get-space` | GET | JWT or none | By slug; public if `status = 'running'` (RLS handles it) |
| `update-space` | POST | JWT | Update config, status, custom domain |
| `delete-space` | POST | JWT | Set `status = 'destroyed'`, delete K8s namespace |

File structure for each:

```
cloud/supabase/functions/
  create-space/index.ts
  list-spaces/index.ts
  get-space/index.ts
  update-space/index.ts
  delete-space/index.ts
```

**`create-space/index.ts`** — key logic:

```typescript
// 1. Auth
const user = await getUser(req);

// 2. Validate input
const { name, slug, description, region } = await req.json();

// 3. Insert space record
const { data: space } = await supabase
  .from('spaces')
  .insert({ user_id: user.id, name, slug, description, region, status: 'provisioning' })
  .select()
  .single();

// 4. Create DB schema for this space
await supabase.rpc('create_space_schema', { schema_name: `space_${space.id.replace(/-/g, '')}` });

// 5. Create K8s pod (async — update status on completion)
// TODO: K8s API call

// 6. Return space metadata
```

**`get-space/index.ts`** — supports unauthenticated access for public spaces:

```typescript
const url = new URL(req.url);
const slug = url.searchParams.get('slug');

// Use service client for public read (RLS policy allows SELECT on running spaces)
const { data: space } = await supabase
  .from('spaces')
  .select('*')
  .eq('slug', slug)
  .single();
```

### 1.3 Extend `_shared/auth.ts`

Add `lmt_space_` prefix handling for space-internal keys:

```typescript
// In getUser():
if (token.startsWith("lmt_space_")) {
  // Extract space ID, verify against spaces table
  // Return user with space scope
}
```

This is additive — the existing `lmt_` path stays unchanged.

### 1.4 Generalize `issue-computer-token` → `issue-node-token`

Current `issue-computer-token` issues HMAC-signed tokens for WebSocket auth. Generalize to support both computer and space nodes:

- Accept `{ type: "computer" | "space", spaceId?: string }` in request body
- For `type: "space"`: verify user owns the space, include `spaceId` in token payload
- Keep backward compatibility: if no `type` specified, default to `"computer"`

Alternatively, create a separate `issue-space-token` function to avoid breaking the computer flow. Decision: **separate function** (`issue-space-token/index.ts`) — simpler, no risk to existing computer terminal.

### 1.5 Files to Create/Modify

| Action | File |
|--------|------|
| Create | `cloud/supabase/migrations/003_spaces.sql` |
| Create | `cloud/supabase/functions/create-space/index.ts` |
| Create | `cloud/supabase/functions/list-spaces/index.ts` |
| Create | `cloud/supabase/functions/get-space/index.ts` |
| Create | `cloud/supabase/functions/update-space/index.ts` |
| Create | `cloud/supabase/functions/delete-space/index.ts` |
| Create | `cloud/supabase/functions/issue-space-token/index.ts` |
| Modify | `cloud/supabase/functions/_shared/auth.ts` — add `lmt_space_` handling |

### 1.6 Verification

- `curl -X POST cloud/create-space -H "Authorization: Bearer ..."` returns space metadata with `status: 'provisioning'`
- `curl cloud/list-spaces` returns array of user's spaces
- `curl cloud/get-space?slug=my-space` returns space details (public if running)
- Migration applies cleanly: `pnpm db:migrate`

---

## Phase 2: Space SPA Foundation

### 2.1 Add Auth

Add `@lmthing/auth` dependency to `space/package.json` (already has `@lmthing/state`):

```json
"@lmthing/auth": "workspace:*"
```

Register Vite alias in `org/libs/utils/src/vite.mjs` (if not already present):

```js
'@lmthing/auth': path.resolve(dirname, '../org/libs/auth/src'),
```

### 2.2 Restructure Routes

Rename `$spaceId` to `$spaceSlug` throughout. Restructure from flat to nested admin/app layout:

```
space/src/routes/
  __root.tsx              # AuthProvider + AppProvider
  index.tsx               # "/" → spaces directory

  $spaceSlug/
    route.tsx             # SpaceBootstrap + SpaceRoleGate
    index.tsx             # Role router (redirect to admin/ or app/)

    admin/
      route.tsx           # Admin layout (sidebar + header)
      index.tsx           # Overview dashboard
      builder.tsx         # THING builder chat (Phase 3)
      agents.tsx          # Agent management
      database.tsx        # Database viewer (Phase 5)
      pages.tsx           # Page & component manager
      settings.tsx        # Space config
      users.tsx           # End-user management
      logs.tsx            # Activity logs (move from $spaceId/logs.tsx)

    app/
      route.tsx           # App layout (dynamic from config)
      index.tsx           # App home
      $page.tsx           # Dynamic page rendering (Phase 4)
```

### 2.3 `__root.tsx`

Follow `computer/src/routes/__root.tsx` pattern:

```tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AppProvider } from '@lmthing/state'
import { AuthProvider, useAuth } from '@lmthing/auth'
import { LoginScreen } from '@lmthing/ui/components/auth/login-screen'
import '@/index.css'

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  if (!isAuthenticated) return <LoginScreen />
  return <>{children}</>
}

function RootComponent() {
  return (
    <AppProvider>
      <AuthProvider appName="space">
        <AuthGate>
          <Outlet />
        </AuthGate>
      </AuthProvider>
    </AppProvider>
  )
}

export const Route = createRootRoute({ component: RootComponent })
```

### 2.4 `index.tsx` — Spaces Directory

Dashboard listing owned spaces with a "Create Space" button:

```tsx
// GET cloud/list-spaces → render grid of space cards
// Each card: name, slug, status badge, link to /$slug/admin
// "Create Space" → modal with name/description → POST cloud/create-space
```

### 2.5 `$spaceSlug/route.tsx` — Space Bootstrap

```tsx
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/$spaceSlug')({
  loader: async ({ params }) => {
    // GET cloud/get-space?slug=params.spaceSlug
    // Returns space config or 404
  },
  component: SpaceLayout,
})

function SpaceLayout() {
  const space = Route.useLoaderData()
  return (
    <SpaceProvider space={space}>
      <SpaceRoleGate>
        <Outlet />
      </SpaceRoleGate>
    </SpaceProvider>
  )
}
```

**`SpaceRoleGate`** — compares `useAuth().userId` against `space.user_id`:

- Owner → renders children (admin routes accessible)
- Visitor + `auth_enabled: false` → renders children (app routes only)
- Visitor + `auth_enabled: true` → login screen

### 2.6 `$spaceSlug/index.tsx` — Role Router

```tsx
// If owner → redirect to /$spaceSlug/admin
// If visitor → redirect to /$spaceSlug/app
```

### 2.7 Admin Layout (`admin/route.tsx`)

Sidebar navigation with links to all admin pages:

```
Overview | Builder | Agents | Pages | Database | Users | Settings | Logs
```

Follows existing layout patterns from studio (sidebar + main content area).

### 2.8 Space Context & Types

Create `space/src/lib/types.ts`:

```typescript
export interface Space {
  id: string
  user_id: string
  slug: string
  name: string
  description: string | null
  pod_name: string | null
  namespace: string | null
  region: string
  status: 'created' | 'provisioning' | 'running' | 'stopped' | 'failed' | 'destroyed'
  app_config: Record<string, unknown>
  auth_enabled: boolean
  custom_domain: string | null
  db_schema: string | null
  created_at: string
  updated_at: string
}
```

Create `space/src/lib/SpaceContext.tsx`:

```typescript
// React context providing Space data + role info
// isOwner: boolean derived from useAuth().userId === space.user_id
```

### 2.9 API Client

Create `space/src/lib/api.ts`:

```typescript
import { getAuthHeaders } from '@lmthing/auth'

const CLOUD_URL = import.meta.env.VITE_CLOUD_URL || 'https://cloud.local/functions/v1'

export async function listSpaces(): Promise<Space[]> { ... }
export async function getSpace(slug: string): Promise<Space> { ... }
export async function createSpace(data: { name: string; description?: string }): Promise<Space> { ... }
export async function updateSpace(id: string, data: Partial<Space>): Promise<Space> { ... }
export async function deleteSpace(id: string): Promise<void> { ... }
```

### 2.10 Files to Create/Modify

| Action | File |
|--------|------|
| Modify | `space/package.json` — add `@lmthing/auth` dep |
| Modify | `space/tsconfig.app.json` — add `@lmthing/auth` path alias |
| Rewrite | `space/src/routes/__root.tsx` |
| Rewrite | `space/src/routes/index.tsx` |
| Create | `space/src/routes/$spaceSlug/route.tsx` |
| Create | `space/src/routes/$spaceSlug/index.tsx` |
| Create | `space/src/routes/$spaceSlug/admin/route.tsx` |
| Create | `space/src/routes/$spaceSlug/admin/index.tsx` |
| Create | `space/src/routes/$spaceSlug/admin/builder.tsx` (stub) |
| Create | `space/src/routes/$spaceSlug/admin/agents.tsx` (stub) |
| Create | `space/src/routes/$spaceSlug/admin/database.tsx` (stub) |
| Create | `space/src/routes/$spaceSlug/admin/pages.tsx` (stub) |
| Create | `space/src/routes/$spaceSlug/admin/settings.tsx` |
| Create | `space/src/routes/$spaceSlug/admin/users.tsx` (stub) |
| Create | `space/src/routes/$spaceSlug/admin/logs.tsx` (move from old) |
| Create | `space/src/routes/$spaceSlug/app/route.tsx` |
| Create | `space/src/routes/$spaceSlug/app/index.tsx` |
| Create | `space/src/routes/$spaceSlug/app/$page.tsx` (stub) |
| Create | `space/src/lib/types.ts` |
| Create | `space/src/lib/SpaceContext.tsx` |
| Create | `space/src/lib/api.ts` |
| Delete | `space/src/routes/$spaceId/` (replaced by `$spaceSlug/`) |

### 2.11 Verification

- Visit `space.local` → see spaces directory (empty initially, then with created spaces)
- Visit `space.local/<slug>/` → as owner, redirected to admin overview
- Visit `space.local/<slug>/` → as visitor, redirected to app (or login if auth_enabled)
- Admin sidebar navigation works across all admin routes

---

## Phase 3: THING Builder

### 3.1 Builder Chat UI

`$spaceSlug/admin/builder.tsx` — conversational app builder where the admin talks to THING.

Connection model: same as `computer/` terminal — WebSocket to the space's K8s pod. But instead of a terminal, it's a chat interface.

```
Admin → builder.tsx → WebSocket → K8s pod → THING agent → tools → VFS/DB changes
```

Reference: `studio/` chat patterns for the UI, `computer/` pod runtime for the WebSocket connection.

### 3.2 Builder Agent Tools

Tools defined using `lmthing` core's Zod-schema tool system, running on the K8s pod:

| Tool | Purpose | VFS Path |
|------|---------|----------|
| `create_page` | Create page config | `app/pages/{slug}.json` |
| `update_page` | Modify page config | `app/pages/{slug}.json` |
| `delete_page` | Remove a page | `app/pages/{slug}.json` |
| `create_component` | Config-driven component | `app/components/{name}.json` |
| `create_custom_component` | Generate React TSX | `app/custom/{Name}.tsx` |
| `create_database_table` | DDL in space schema | (DB operation) |
| `alter_database_table` | Modify table | (DB operation) |
| `query_database` | Read-only queries | (DB operation) |
| `configure_auth` | Enable end-user auth | `app/config.json` |
| `configure_agent` | Load/configure agent | `agents/{name}/config.json` |
| `configure_flow` | Create/modify flow | `flows/{name}/index.md` |
| `update_app_config` | Theme, nav, name | `app/config.json` |
| `read_workspace_file` | Read VFS file | (any path) |
| `write_workspace_file` | Write VFS file | (any path) |
| `list_workspace_files` | List files/dirs | (any path) |

### 3.3 Files to Create

| Action | File |
|--------|------|
| Implement | `space/src/routes/$spaceSlug/admin/builder.tsx` |
| Create | `space/src/lib/builder/useBuilderChat.ts` — WebSocket chat hook |
| Create | `space/src/lib/builder/BuilderMessage.tsx` — message rendering |

### 3.4 Verification

- Admin opens builder chat at `space.local/<slug>/admin/builder`
- Asks THING to create a page → page config JSON appears in VFS
- Tool calls visible in chat as structured responses

---

## Phase 4: App Rendering Engine

### 4.1 New Library: `org/libs/app-engine/`

Shared rendering engine that interprets page/component JSON configs and renders React components.

```
org/libs/app-engine/
  src/
    index.ts              # Public API
    ConfigRenderer.tsx    # Interprets page JSON → React tree
    ComponentRegistry.ts  # Maps type strings to React components
    ComponentLoader.tsx   # Dynamic import for custom components
    components/
      DataTable.tsx       # type: "data-table"
      Form.tsx            # type: "form"
      AgentChat.tsx       # type: "agent-chat"
      StatsCard.tsx       # type: "stats-card"
      Markdown.tsx        # type: "markdown"
      Chart.tsx           # type: "chart"
      Kanban.tsx          # type: "kanban"
      Calendar.tsx        # type: "calendar"
      FileUpload.tsx      # type: "file-upload"
    types.ts              # PageConfig, SectionConfig, ComponentConfig
    theme.ts              # Theme system (inherits @lmthing/css)
  package.json
```

### 4.2 VFS Structure for App Config

```
{spaceId}/
  app/
    config.json           # App-level: name, theme, navigation, auth
    pages/
      home.json           # Page definition with sections
      dashboard.json
    components/
      user-list.json      # Config-driven: type, schema ref, columns
      chat-widget.json    # Config-driven: type="agent-chat", agentId
    custom/
      InvoiceBuilder.tsx  # Code-gen React component
```

### 4.3 Page Config Format

```json
{
  "slug": "dashboard",
  "title": "Dashboard",
  "layout": "sidebar",
  "sections": [
    { "type": "data-table", "ref": "components/user-list.json" },
    { "type": "agent-chat", "ref": "components/chat-widget.json" },
    { "type": "stats-card", "data": { "query": "select count(*) from users" } }
  ]
}
```

### 4.4 User-Facing Routes

`$spaceSlug/app/route.tsx` — renders the app layout from `app/config.json` (nav, theme).

`$spaceSlug/app/$page.tsx` — loads `app/pages/{page}.json`, passes to `ConfigRenderer`.

`$spaceSlug/app/index.tsx` — loads `app/pages/home.json` (default page).

### 4.5 Custom Component Loading

THING generates `.tsx` files in `app/custom/`. The K8s pod compiles them with esbuild and serves as JS modules. The SPA loads via dynamic `import()`.

```typescript
// ComponentLoader.tsx
export async function loadCustomComponent(name: string, nodeUrl: string) {
  const module = await import(/* @vite-ignore */ `${nodeUrl}/components/${name}.js`)
  return module.default
}
```

### 4.6 Files to Create

| Action | File |
|--------|------|
| Create | `org/libs/app-engine/package.json` |
| Create | `org/libs/app-engine/src/index.ts` |
| Create | `org/libs/app-engine/src/ConfigRenderer.tsx` |
| Create | `org/libs/app-engine/src/ComponentRegistry.ts` |
| Create | `org/libs/app-engine/src/ComponentLoader.tsx` |
| Create | `org/libs/app-engine/src/types.ts` |
| Create | `org/libs/app-engine/src/components/*.tsx` (9 built-in components) |
| Implement | `space/src/routes/$spaceSlug/app/route.tsx` |
| Implement | `space/src/routes/$spaceSlug/app/index.tsx` |
| Implement | `space/src/routes/$spaceSlug/app/$page.tsx` |
| Modify | `pnpm-workspace.yaml` — add `org/libs/app-engine` |
| Modify | `space/package.json` — add `@lmthing/app-engine` dep |

### 4.7 Verification

- End-user visits `space.local/<slug>/` → sees rendered app with config-driven pages
- Pages with `data-table`, `form`, `agent-chat`, `markdown` sections render correctly
- Custom components load via dynamic import from the node

---

## Phase 5: Per-Space Database

### 5.1 Schema Isolation

Each space gets a PostgreSQL schema (e.g., `space_abc123`). Created during `create-space` flow.

Add to migration:

```sql
CREATE OR REPLACE FUNCTION create_space_schema(schema_name text)
RETURNS void AS $$
BEGIN
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 5.2 `space-proxy` Edge Function

New function: `cloud/supabase/functions/space-proxy/index.ts`

Proxies end-user DB queries to the correct space schema using service role:

```typescript
// 1. Auth (optional — depends on space.auth_enabled)
// 2. Look up space by ID/slug → get db_schema
// 3. Execute query in that schema using service role
// 4. Return results
```

### 5.3 Builder DB Tools

THING's `create_database_table` and `alter_database_table` tools execute DDL within the space's schema:

```sql
SET search_path TO space_abc123;
CREATE TABLE users (id uuid PRIMARY KEY, name text, email text);
```

### 5.4 Admin Database Viewer

`$spaceSlug/admin/database.tsx` — shows tables, columns, row counts in the space's schema. Uses `space-proxy` to query `information_schema`.

### 5.5 Files to Create/Modify

| Action | File |
|--------|------|
| Modify | `cloud/supabase/migrations/003_spaces.sql` — add `create_space_schema` function |
| Create | `cloud/supabase/functions/space-proxy/index.ts` |
| Implement | `space/src/routes/$spaceSlug/admin/database.tsx` |

### 5.6 Verification

- THING creates a table → visible in admin database viewer
- End-user app queries data via `space-proxy` → data renders in `data-table` component
- Schemas are isolated — space A cannot access space B's tables

---

## Phase 6: Subscription & Creation Flow

### 6.1 Space Pricing

`space.local/` dashboard shows pricing if user has no active Space subscription. Links to Stripe checkout via `cloud/create-checkout` with `tier: "space"`.

### 6.2 Create Space Flow

1. User has active subscription → "Create Space" button visible
2. Modal: name (auto-slug), description, region select
3. `POST cloud/create-space` → provisions everything
4. Redirect to `space.local/<slug>/admin/builder`

### 6.3 Studio Workspace Import

Builder tool: `import_studio_space` — fetches workspace files from GitHub (where Studio syncs) and writes to the space node's VFS.

Admin says: "Load my studio space <name>" → THING imports agents, flows, knowledge.

### 6.4 Files to Modify

| Action | File |
|--------|------|
| Modify | `space/src/routes/index.tsx` — add pricing section, subscription check |
| Modify | `cloud/supabase/functions/create-checkout/index.ts` — support `tier: "space"` |

### 6.5 Verification

- User without subscription sees pricing → completes checkout → can create spaces
- "Create Space" → fills form → space provisioned → redirected to builder
- THING imports Studio workspace → agents/flows/knowledge available

---

## Implementation Order

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
  DB &       SPA       THING      App       Per-space   Subscription
  Cloud     routes    builder   rendering   database    & creation
```

Phases 1 and 2 are foundational — everything depends on them. Phases 3-5 can partially overlap (builder UI can start before all tools are wired). Phase 6 is polish/monetization.

---

## Key Design Decisions

1. **`$spaceSlug` not `$spaceId`** — URL-friendly slugs in routes, UUIDs in API calls
2. **Separate `issue-space-token`** — avoids breaking computer terminal flow
3. **Schema isolation** — per-space PostgreSQL schemas within shared Supabase project (cost-effective, instant provisioning)
4. **Config-driven + code-gen hybrid** — JSON configs for standard patterns, generated TSX for custom components
5. **Builder chat over WebSocket** — same protocol as computer terminal but chat-mode, runs THING on K8s pod
6. **`@lmthing/app-engine` as shared lib** — reusable across space and potentially studio preview
7. **SpaceRoleGate** — single component handles owner vs visitor routing, simplifies auth logic
