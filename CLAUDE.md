# LMThing — Developer Onboarding

Welcome to lmthing. This file is an **orientation index** — load the detail files in the **Task Index** below only when a task needs them. For full product & domain architecture (diagrams, data flow), see [Architecture.md](./Architecture.md).

## Prerequisites

- **Node.js** ≥ 20 · **pnpm** ≥ 9 · **Git** · a GitHub account (OAuth + workspace persistence)

## Repository Structure

The monorepo is organized by TLD — each lmthing.\* domain has its own top-level directory.

```
lmthing/
├── org/                # open-source core + shared libs (the sdk)
│   ├── libs/           # @lmthing/{state,spaces,css,ui,auth,utils}
│   ├── packages/       # @lmthing/{core,cli,agent-ui} — the THING runtime
│   └── docs/
├── cloud/              # THE backend — gateway + LiteLLM (see cloud-backend skill)
├── studio/             # agent builder UI (primary dev surface)
├── computer/           # THING agent runtime (K8s compute pod)
├── chat/ com/ social/ team/ store/ space/ blog/ casa/   # product apps
├── pnpm-workspace.yaml · package.json
```

- **Studio** (`studio/`) is the primary development surface.
- **Core runtime** lives in `sdk/org/packages/{core,cli,ui}` — model-streamed TypeScript evaluated one statement at a time in a QuickJS WASM sandbox. See [sdk/org/CLAUDE.md](./sdk/org/CLAUDE.md).
- **Shared libraries** in `sdk/org/libs/`: `@lmthing/state` (in-memory VFS), `@lmthing/ui`, `@lmthing/css`, `@lmthing/auth`, `@lmthing/spaces`, `@lmthing/utils`.

## Backend — important

**There is no separate backend service.** `cloud/` is the **sole backend** for the entire project: a Hono/Node.js **Gateway** (`/api/*` — auth, API keys, billing, webhooks) and **LiteLLM** (`/v1/*` — OpenAI-compatible LLM proxy to Azure AI Foundry), on Kubernetes (Kubespray, Azure VM), backed by PostgreSQL + Stripe. **Any server-side logic — new endpoints, DB ops, webhooks — must be implemented in the gateway (`cloud/gateway/`) or as K8s config.** Do not create backend services elsewhere; all frontend apps are static SPAs that call `cloud/`.

- Full backend detail (routes table, tiers, libraries, K8s) → `@.claude/skills/cloud-backend.md`
- Auth flows / SSO / tokens → `@.claude/skills/authentication.md`

## Getting Started

```bash
pnpm install
cd studio && pnpm dev     # primary dev surface
```

Running the full local stack (ports, `*.test` nginx proxy, demo auth, make targets) → `@.claude/skills/local-dev.md`.

## Task Index

Load the matching file when working on:

| Working on… | Load |
|---|---|
| cloud gateway / LiteLLM / billing / tiers / API routes / webhooks | `@.claude/skills/cloud-backend.md` |
| running the local dev stack (ports, `make`, nginx proxy, demo auth) | `@.claude/skills/local-dev.md` |
| adding a pricing tier (cross-cutting checklist) | `@.claude/skills/add-tier.md` |
| auth flows / SSO / gateway routes | `@.claude/skills/authentication.md` |
| deploying an SPA / domain health checks | `@.claude/skills/deploy-spa.md` |
| full system & data-flow architecture (diagrams) | [./Architecture.md](./Architecture.md) |
| spaces authoring / agent runtime / eval loop | [./sdk/org/CLAUDE.md](./sdk/org/CLAUDE.md) |
| the VFS library (`@lmthing/state`) | [./sdk/libs/state/CLAUDE.md](./sdk/libs/state/CLAUDE.md) |
| infrastructure / deployment | [./devops/CLAUDE.md](./devops/CLAUDE.md) |

## Useful Links

- [Architecture.md](./Architecture.md) — full product & domain architecture
- [sdk/org/CLAUDE.md](./sdk/org/CLAUDE.md) — core runtime reference (eval loop, system spaces, sessions)
- [devops/CLAUDE.md](./devops/CLAUDE.md) — infrastructure & deployment
