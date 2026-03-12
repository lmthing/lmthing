# Agent Notes

This repository is a monorepo organized by TLD — each lmthing.* domain has its own top-level directory.

## Shared Libraries

- `org/libs/core/` — Agentic framework (TypeScript, Vercel AI SDK v6). StatefulPrompt system with React-like hooks, plugins, multi-provider support, CLI (`lmthing run`).
- `org/libs/state/` — Virtual file system (`@lmthing/state`). In-memory Map-based VFS with FSEventBus, React context hierarchy, and hooks (`useFile`, `useDir`, `useGlob`, `useDraft`).
- `org/libs/css/` — Shared styles used across all product domains.
- `org/libs/ui/` — Shared React UI components used across all product domains.

## Cloud Backend

- `cloud/` — Supabase Edge Functions (Deno). Nine functions: `generate-ai`, `list-models`, `create-api-key`, `list-api-keys`, `revoke-api-key`, `create-checkout`, `billing-portal`, `get-usage`, `stripe-webhook`. Shared modules in `_shared/`.

## Product Domains

- `studio/` — Agent builder UI (React 19, Vite 7, TanStack Router, Tailwind 4, Radix UI). Primary development surface.
- `chat/` — Personal THING interface.
- `blog/` — Personalized AI news.
- `space/` — Fly.io agent runtime.
- `social/` — Public hive mind.
- `team/` — Private agent rooms.
- `store/` — Agent marketplace.
- `casa/` — Smart home (Home Assistant integration).
- `com/` — Commercial landing page.

## Key Documentation

- [Architecture.md](./Architecture.md) — full product & domain architecture
- [TechArchitecture.md](./TechArchitecture.md) — developer onboarding, system overview, auth, data flow
