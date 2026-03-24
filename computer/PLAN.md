# lmthing.computer — Unified Runtime Dashboard & Terminal

## Context

The THING agent needs a runtime. Free tier users get a WebContainer (browser-side Node.js via StackBlitz), while Pro tier ($20/mo) users get a dedicated K8s compute pod. `lmthing.computer` is the unified UI for both — a full dashboard showing container state plus terminal access.

## Architecture

- **Free tier**: WebContainer in the browser (WebContainer API)
- **Pro/Max tier**: Dedicated Bun-based K8s pod (0.5 CPU, 1 GB RAM, 1 GB storage)
  - Pod created automatically on Pro subscription via Stripe webhook
  - Envoy Gateway validates JWT, routes `/api/*` to user's pod
  - WebSocket protocol for terminal, metrics, processes, agents, logs, network

### Pod Lifecycle

1. User subscribes to Pro → Stripe webhook → Gateway creates K8s namespace `user-{id}` with deployment + service
2. User visits lmthing.computer → SPA checks `/api/auth/me` → tier is "pro" → PodRuntime connects
3. PodRuntime opens WebSocket to `wss://lmthing.computer/api/ws` → Envoy routes to pod
4. User cancels subscription → webhook deletes namespace (cascades all resources)

## Styling Rules

All UI follows the established `@lmthing/ui` + `@lmthing/css` pattern:
- **No raw Tailwind classes in JSX** — all styling via CSS classes with `@apply` in `org/libs/css/`
- **BEM naming** in CSS: `.computer-dashboard`, `.computer-dashboard__header`, `.computer-dashboard--loading`
- **All components live in `org/libs/ui/`** — either `elements/` (generic) or `components/` (feature-specific)
- **CSS files live in `org/libs/css/`** — mirroring the `ui/` structure

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/runtime/types.ts` | `ComputerRuntime` interface, `RuntimeTier = 'webcontainer' \| 'pod'` |
| `src/lib/runtime/webcontainer.ts` | WebContainer implementation (free tier) |
| `src/lib/runtime/pod.ts` | PodRuntime — connects to K8s pod via WebSocket |
| `src/lib/runtime/ws-protocol.ts` | WebSocket message types (shared protocol) |
| `src/lib/runtime/use-tier-detection.ts` | Tier detection via `/api/auth/me` |
| `src/lib/runtime/ComputerContext.tsx` | React context managing runtime state + auto-boot |
| `src/routes/__root.tsx` | Root provider chain + conditional layout |
| `src/routes/terminal.tsx` | Terminal view with boot progress |
| `src/routes/dashboard.tsx` | Dashboard with metrics, processes, agents, logs |
| `src/routes/settings.tsx` | Tier info + billing |
