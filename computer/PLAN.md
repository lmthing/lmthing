# lmthing.computer — Unified Runtime Dashboard & Terminal

## Context

The THING agent needs a Node.js runtime. Free tier users get a WebContainer (browser-side Node.js via StackBlitz), while Computer tier ($8/mo) users get an always-on Fly.io node. `lmthing.computer` is the unified UI for both — a full dashboard showing container state plus terminal access.

Currently all routes in `computer/` are skeleton placeholders. No terminal, WebContainer, or Fly.io integration exists yet.

## Styling Rules

All UI follows the established `@lmthing/ui` + `@lmthing/css` pattern:
- **No raw Tailwind classes in JSX** — all styling via CSS classes with `@apply` in `org/libs/css/`
- **BEM naming** in CSS: `.computer-dashboard`, `.computer-dashboard__header`, `.computer-dashboard--loading`
- **All components live in `org/libs/ui/`** — either `elements/` (generic) or `components/` (feature-specific)
- **CSS files live in `org/libs/css/`** — mirroring the `ui/` structure
- **Reuse existing elements**: `Card`, `Badge`, `Panel`, `Page`, `PageHeader`, `PageBody`, `Sidebar`, `SidebarItem`, `TopBar`, `Stack`, `SplitPane`, `ListItem`, `Button`, `Heading`, `Caption`
- Components import CSS: `import '@lmthing/css/components/computer/...'`
- Use `cn()` from `@lmthing/ui` for conditional class application

---

## Phase 1 — Foundation

### 1.1 Runtime abstraction (`computer/src/lib/runtime/types.ts`)

Define the `ComputerRuntime` interface both backends implement:

```
ComputerRuntime
  .tier: 'webcontainer' | 'flyio'
  .status: 'booting' | 'running' | 'stopped' | 'error'
  .boot() / .shutdown()
  .createTerminalSession() → TerminalSession
  .onStatusChange() / .onMetrics() / .onProcessList()
  .onAgentList() / .onLog() / .onNetwork()

TerminalSession
  .write(data) / .onData(cb) / .resize(cols, rows) / .dispose()
```

Supporting types: `RuntimeMetrics`, `RuntimeProcess`, `RuntimeAgent`, `LogEntry`, `NetworkEntry`.

This is runtime logic — stays in `computer/src/lib/`, not a UI component.

### 1.2 Shared terminal element (`org/libs/ui/src/elements/content/terminal/`)

Reusable xterm.js wrapper — also needed by `space/$spaceId/terminal.tsx`.

**UI component** (`org/libs/ui/src/elements/content/terminal/index.tsx`):
- Props: `session: TerminalSession | null`, `className?`, `fontSize?`, `theme?`
- Imports `@lmthing/css/elements/content/terminal/index.css`
- Uses `cn()` for class composition: `cn('terminal', className)`
- Wires session I/O ↔ xterm via `useEffect`, handles resize via `ResizeObserver` + `fitAddon.fit()`
- Cleans up xterm on unmount but does NOT dispose the session (caller's responsibility)

**CSS** (`org/libs/css/src/elements/content/terminal/index.css`):
```css
@reference "../../../theme.css";

.terminal {
  @apply flex flex-col w-full h-full bg-background overflow-hidden rounded-md;
}

.terminal__viewport {
  @apply flex-1 min-h-0;
}

.terminal--loading {
  @apply items-center justify-center;
}
```

### 1.3 Dependencies

**`computer/package.json`**: add `@webcontainer/api`, `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-web-links`
**`org/libs/ui/package.json`**: add xterm packages as peer deps
**`space/package.json`**: add xterm packages (for terminal route)

---

## Phase 2 — WebContainer (Free Tier)

### 2.1 WebContainer backend (`computer/src/lib/runtime/webcontainer.ts`)

- `boot()` → `WebContainer.boot()` (singleton, module-level promise guards double-boot)
- `createTerminalSession()` → `webcontainer.spawn('jsh')`, wire streams into `TerminalSession`
- Metrics: limited — memory estimated, CPU shown as "N/A" on free tier
- Processes: poll via `spawn('ps')` + parse output
- Logs: captured from spawned process stdout/stderr
- Network: "Not available on free tier" (no intercept API)
- Lifecycle: instance survives route navigation (held in context), teardown on `beforeunload`

**Important**: WebContainer requires COEP/COOP headers — **done**:
- `Cross-Origin-Embedder-Policy: credentialless`
- `Cross-Origin-Opener-Policy: same-origin`
- Configured in `computer/vite.config.ts` (dev server headers)
- Configured in `services.yaml` `headers:` field + `local-proxy.sh` `add_header` directives (nginx proxy)

### 2.2 React context (`computer/src/lib/runtime/ComputerContext.tsx`)

NOT using `@lmthing/state` VFS — runtime data is ephemeral streaming, not file-like.

```
ComputerContextValue:
  runtime, tier, status, metrics, processes, agents, logs, network, error
  boot(), shutdown()
```

- Determines tier from auth/subscription state
- Free tier: auto-boots WebContainer on mount
- Paid tier: connects to Fly.io WebSocket on mount
- Subscribes to all runtime events → feeds into `useReducer` state
- Exposes `useComputer()` hook

### 2.3 Dashboard components (`org/libs/ui/src/components/computer/`)

All dashboard UI lives in the shared UI library. Each component has a corresponding CSS file in `org/libs/css/src/components/computer/`.

| Component | CSS | Reuses Elements | Data |
|-----------|-----|-----------------|------|
| `status-card.tsx` | `status-card.css` | `Card`, `Badge`, `Caption` | status, uptime, tier |
| `metrics-card.tsx` | `metrics-card.css` | `Card`, `Caption`, `Heading` | cpuPercent, memory |
| `processes-panel.tsx` | `processes-panel.css` | `Panel`, `ListItem`, `Caption` | processes[] |
| `agents-panel.tsx` | `agents-panel.css` | `Panel`, `ListItem`, `Badge` | agents[] |
| `logs-viewer.tsx` | `logs-viewer.css` | `Panel`, `Button` (filter), `Code` | logs[] |
| `network-panel.tsx` | `network-panel.css` | `Panel`, `Badge`, `Caption` | network[] |
| `computer-dashboard.tsx` | `computer-dashboard.css` | `Page`, `PageBody`, all above | grid layout |

**CSS location**: `org/libs/css/src/components/computer/`

Example CSS pattern:
```css
/* org/libs/css/src/components/computer/status-card.css */
@reference "../../theme.css";

.computer-status-card {
  @apply flex flex-col gap-2;
}

.computer-status-card__indicator {
  @apply inline-flex items-center gap-1.5;
}

.computer-status-card__indicator--running {
  @apply text-green-500;
}

.computer-status-card__indicator--stopped {
  @apply text-destructive;
}
```

Example component pattern:
```tsx
// org/libs/ui/src/components/computer/status-card.tsx
import '@lmthing/css/components/computer/status-card.css'
import { Card, CardHeader, CardBody } from '../../elements/content/card'
import { Badge } from '../../elements/content/badge'
import { Caption } from '../../elements/typography/caption'
import { cn } from '../../lib/utils'

interface StatusCardProps {
  status: RuntimeStatus
  tier: RuntimeTier
  uptime: number
}

function StatusCard({ status, tier, uptime }: StatusCardProps) {
  return (
    <Card>
      <CardHeader>
        <span className={cn(
          'computer-status-card__indicator',
          status === 'running' && 'computer-status-card__indicator--running',
          status === 'stopped' && 'computer-status-card__indicator--stopped',
        )}>
          {status}
        </span>
        <Badge>{tier}</Badge>
      </CardHeader>
      <CardBody>
        <Caption>Uptime: {formatUptime(uptime)}</Caption>
      </CardBody>
    </Card>
  )
}
```

### 2.4 Layout (`org/libs/ui/src/components/computer/computer-layout.tsx`)

**CSS**: `org/libs/css/src/components/computer/computer-layout.css`

Composes existing elements:
- `Sidebar` + `SidebarItem` — left nav: Dashboard, Terminal, Spaces, Settings
- `TopBar` — runtime status badge, tier label
- Content area via `children` (the router Outlet)

### 2.5 Routes (thin wrappers in `computer/src/routes/`)

Routes import components from `@lmthing/ui` and wire them to the `ComputerContext`. Routes contain **no styling logic** — they just connect data to components.

- `__root.tsx` — wrap with `AppProvider` → `AuthProvider` → `ComputerProvider` → `ComputerLayout` → `Outlet`
- `index.tsx` — renders `<ComputerDashboard />` from `@lmthing/ui`, passes data from `useComputer()`
- `terminal.tsx` — renders `<Terminal />` from `@lmthing/ui`, passes session from `useComputer().runtime.createTerminalSession()`
- `login.tsx` — auth (reuse studio pattern)
- `settings.tsx` — tier info, billing links
- `spaces/` — unchanged structure, wire up later

---

## Phase 3 — Fly.io (Paid Tier)

### 3.1 Token issuance edge function (`cloud/supabase/functions/issue-computer-token/index.ts`)

- CORS + `getUser(req)` (reuse `_shared/auth.ts`)
- Verify user has Computer tier subscription (check Stripe or profiles flag)
- Generate HMAC-signed short-lived token (5 min): `{ user_id, exp, iat }`
- Shared secret: `COMPUTER_TOKEN_SECRET` env var (on cloud + Fly.io)
- Returns `{ token, expiresAt }`

### 3.2 WebSocket protocol (`computer/src/lib/runtime/flyio-protocol.ts`)

Connection: `wss://<user-app>.fly.dev/ws?token=<short-lived-token>`

Client → Server: `terminal.input`, `terminal.resize`, `terminal.open`, `terminal.close`, `subscribe`
Server → Client: `terminal.data`, `terminal.opened`, `metrics`, `processes`, `agents`, `log`, `network`, `auth.ok`, `auth.fail`, `error`

### 3.3 Fly.io backend (`computer/src/lib/runtime/flyio.ts`)

- `boot()` → fetch token from `issue-computer-token`, open WebSocket, send `subscribe` for all channels
- `createTerminalSession()` → send `terminal.open`, wire messages through `TerminalSession`
- All dashboard data arrives as server-pushed messages
- Reconnection: exponential backoff, re-fetch token before each retry (token may have expired)
- `shutdown()` → close WebSocket gracefully

### 3.4 Tier detection in `ComputerContext`

Check user's subscription state → instantiate `WebContainerRuntime` or `FlyioRuntime`.

---

## Phase 4 — Polish

- Wire up `space/$spaceId/terminal.tsx` using the shared `Terminal` element from `@lmthing/ui`
- Settings route: tier management, links to billing portal via existing `billing-portal` edge function
- Error recovery UI: connection lost banner, retry button (using existing `Card`, `Button` elements)
- Loading states: WebContainer boot progress, Fly.io connection status

---

## File Map

### New files in `org/libs/ui/src/`

| File | Type | Purpose |
|------|------|---------|
| `elements/content/terminal/index.tsx` | Element | Shared xterm.js terminal wrapper |
| `components/computer/index.ts` | Barrel | Re-exports all computer components |
| `components/computer/status-card.tsx` | Component | Status + tier badge |
| `components/computer/metrics-card.tsx` | Component | CPU/memory gauges |
| `components/computer/processes-panel.tsx` | Component | Process table |
| `components/computer/agents-panel.tsx` | Component | Active agents list |
| `components/computer/logs-viewer.tsx` | Component | Filterable log output |
| `components/computer/network-panel.tsx` | Component | HTTP request table |
| `components/computer/computer-dashboard.tsx` | Component | Dashboard grid layout |
| `components/computer/computer-layout.tsx` | Component | App shell (sidebar + topbar + content) |

### New files in `org/libs/css/src/`

| File | Purpose |
|------|---------|
| `elements/content/terminal/index.css` | Terminal element styles |
| `components/computer/status-card.css` | Status card styles |
| `components/computer/metrics-card.css` | Metrics card styles |
| `components/computer/processes-panel.css` | Process table styles |
| `components/computer/agents-panel.css` | Agent panel styles |
| `components/computer/logs-viewer.css` | Log viewer styles |
| `components/computer/network-panel.css` | Network panel styles |
| `components/computer/computer-dashboard.css` | Dashboard grid layout |
| `components/computer/computer-layout.css` | App shell layout |

### New/modified files in `computer/`

| File | Action |
|------|--------|
| `src/lib/runtime/types.ts` | Create — runtime interface (logic, not UI) |
| `src/lib/runtime/webcontainer.ts` | Create — WebContainer backend |
| `src/lib/runtime/flyio.ts` | Create — Fly.io backend |
| `src/lib/runtime/flyio-protocol.ts` | Create — WS message types |
| `src/lib/runtime/ComputerContext.tsx` | Create — React context/provider |
| `src/routes/__root.tsx` | Modify — wrap with providers + layout |
| `src/routes/index.tsx` | Modify — render `ComputerDashboard` |
| `src/routes/terminal.tsx` | Create — render `Terminal` element |
| `package.json` | Modify — add deps |

### Other

| File | Action |
|------|--------|
| `cloud/supabase/functions/issue-computer-token/index.ts` | Create — token endpoint |
| `space/src/routes/$spaceId/terminal.tsx` | Modify — use shared Terminal element |
| `space/package.json` | Modify — add xterm deps |
| `org/libs/ui/package.json` | Modify — add xterm peer deps |

## Verification

1. **WebContainer**: Run `cd computer && pnpm dev`, visit `http://computer.local:3010` — dashboard should auto-boot WebContainer, terminal should give a shell
2. **Dashboard**: All panels render (processes, logs, agents, metrics — some "N/A" for free tier)
3. **Terminal**: Type commands in xterm, see output — verify resize works
4. **COEP/COOP**: ~~Verify headers are set~~ **Done** — Vite dev server + nginx proxy via `services.yaml` `headers:` field
5. **Fly.io** (when infra ready): Token issuance returns valid token, WebSocket connects, dashboard streams live data
6. **Styling**: Confirm zero raw Tailwind classes in any TSX file — all styling through CSS classes
