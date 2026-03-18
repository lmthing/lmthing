---
title: Shared Libraries
description: Core libraries in org/libs/ used across all product domains
order: 1
---

# Shared Libraries — `org/libs/`

The shared libraries are the foundation of the entire lmthing ecosystem. Every product app depends on these packages. They live in `org/libs/` and are resolved via pnpm workspace aliases and Vite `resolve.alias` mappings.

## Package Map

### `org/libs/core/` — `lmthing`

The agentic framework powering all of lmthing. Built on **Vercel AI SDK v6** (`streamText()`, `generateText()`, Zod tool schemas).

- **StatefulPrompt system** — React-like hooks (`useState`, `useEffect`, `useMemo`, `useCallback`) for managing agent state across turns
- **Two modes**: Stateful Interactive Chat (multi-turn) and Autonomous Agents (self-directed)
- **Plugins**: `defTaskList` (task management), `defTaskGraph` (DAG dependencies), `defFunction` (vm2 sandbox), `defMethod` (inline code)
- **Provider resolution**: `openai/*`, `anthropic/*`, `google/*`, `mistral/*`, `azure/*`, `groq/*`, or any OpenAI-compatible endpoint
- **Entry points**: `runPrompt()` programmatic API, `lmthing run` CLI
- **Key files**: `src/stateful-prompt.ts`, `src/plugins/`, `src/providers/`, `src/cli/`

### `org/libs/state/` — `@lmthing/state`

In-memory virtual file system for browser-based workspace management.

- **Storage**: `Map<string, string>` with `FSEventBus` for fine-grained subscriptions (file, dir, glob, prefix)
- **React context hierarchy**: `AppProvider` → `StudioProvider` → `SpaceProvider`
- **Hooks**: `useFile()`, `useDir()`, `useGlob()`, `useDraft()`
- **Persistence**: GitHub sync (push/pull) with standard git merge conflict resolution
- **Key files**: `src/fs.ts`, `src/event-bus.ts`, `src/providers/`, `src/hooks/`

### `org/libs/auth/` — `@lmthing/auth`

Cross-domain SSO client library.

- **Pattern**: All apps redirect to `com/` for GitHub OAuth login, receive SSO code, exchange for session
- **Exports**: `AuthProvider` (React context), `useAuth()` hook (`isAuthenticated`, `login()`, `logout()`, `username`, `session`)
- **Key files**: `src/provider.tsx`, `src/hooks.ts`, `src/sso.ts`

### `org/libs/ui/` — `@lmthing/ui`

Shared React UI components used across all product domains. Built with Radix UI primitives and Tailwind CSS.

- **Key files**: `src/components/`, `src/index.ts`

### `org/libs/css/` — `@lmthing/css`

Shared Tailwind CSS styles and design tokens.

- **Key files**: `src/global.css`, `src/tokens.ts`

### `org/libs/container/` — `@lmthing/container`

Fly.io Machines API client for managing compute containers.

- **Purpose**: Provision, start, stop, and destroy Fly.io machines for spaces and computers
- **Key files**: `src/machines.ts`, `src/types.ts`

### `org/libs/server/`

Container runtime server with WebSocket, PTY, and metrics support.

- **Purpose**: Runs inside Fly.io containers to provide terminal access, health checks, and metrics
- **Key files**: `src/server.ts`, `src/pty.ts`, `src/ws.ts`

### `org/libs/thing/` — `@lmthing/thing`

THING agent system studio — 7 built-in spaces that ship with the THING agent.

- **Spaces**: `space-creator`, `space-ecosystem`, `space-studio`, `space-chat`, `space-computer`, `space-deploy`, `space-store`
- **Totals**: 12 agents, 12 flows, 17 knowledge domains
- **Key files**: `spaces/*/agents/`, `spaces/*/flows/`, `spaces/*/knowledge/`

### `org/libs/utils/`

Shared build utilities including Vite configuration with workspace alias resolution.

- **Key files**: `src/vite.mjs` (contains all `@lmthing/*` → file path alias mappings)

## Dependency Flow

```
product apps → @lmthing/ui, @lmthing/css, @lmthing/state, @lmthing/auth, lmthing (core)
@lmthing/state → (standalone, no lmthing deps)
@lmthing/auth → (standalone, calls cloud/ edge functions)
@lmthing/ui → @lmthing/css
lmthing (core) → Vercel AI SDK v6, @lmthing/state (optional)
cloud/ → @lmthing/container, Stripe SDK, Supabase client
```

## Working with Shared Libs

- All libs use `workspace:*` version references in `package.json`
- Vite alias resolution is configured in `org/libs/utils/src/vite.mjs`
- Changes to shared libs are immediately available to all apps in dev mode (no build step)
- TypeScript source is imported directly — no pre-compilation needed
