# LMThing Developer Onboarding Guide

Welcome to lmthing. This guide will get you set up and oriented in the codebase. For the full product and domain architecture, see [Architecture.md](./Architecture.md).

---

## Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9
- **Git** (all workspace sync is git-based)
- A GitHub account (for OAuth and workspace persistence)

---

## Repository Structure

The monorepo is organized by TLD — each lmthing.\* domain has its own top-level directory.

```
lmthing/
├── org/                    # Non-profit / open-source
│   ├── libs/               # Shared libraries used across all domains
│   │   ├── state/          # @lmthing/state — virtual file system (React hooks, Map-based VFS)
│   │   ├── spaces/         # Shared space knowledge content
│   │   ├── css/            # Shared styles
│   │   ├── ui/             # Shared UI components
│   │   ├── auth/           # @lmthing/auth — cross-domain SSO client
│   │   └── utils/          # Shared build utilities (Vite config)
│   ├── packages/           # Core framework packages
│   │   ├── core/           # @lmthing/core — QuickJS WASM sandbox, eval loop, globals, spaces
│   │   ├── cli/            # @lmthing/cli — terminal (Ink), WS server, AI provider wiring
│   │   └── ui/             # @lmthing/agent-ui — React THING chat shell + DevTools observability panel
│   └── docs/               # Documentation
├── cloud/                  # lmthing.cloud — API gateway (Hono/Node.js) + LiteLLM proxy
├── studio/                 # lmthing.studio — agent builder UI (React 19, Vite 7, TanStack Router)
├── chat/                   # lmthing.chat — personal THING interface
├── blog/                   # lmthing.blog — personalized AI news
├── computer/               # lmthing.computer — THING agent runtime (K8s compute pod, terminal access)
├── space/                  # lmthing.space — deploy spaces & publish agents
├── social/                 # lmthing.social — public hive mind
├── team/                   # lmthing.team — private agent rooms
├── store/                  # lmthing.store — agent marketplace
├── casa/                   # lmthing.casa — smart home (Home Assistant)
├── com/                    # lmthing.com — commercial landing page
├── pnpm-workspace.yaml
└── package.json
```

---

## Backend Architecture — Important

**There is no separate backend service.** The `cloud/` directory is the **sole backend** for the entire project. It runs on Kubernetes (Kubespray) on an Azure VM, with two services:

- **LiteLLM** — OpenAI-compatible LLM proxy that routes to Azure AI Foundry models, with budget enforcement, rate limiting, and token usage tracking (10% markup over Azure pricing).
- **Gateway** — Hono/Node.js service handling auth, API key management, billing (Stripe subscriptions), and webhooks.

Key details:

- **Users are managed by Zitadel** (auth.lmthing.cloud) — email/password and GitHub OAuth via IDP Intent API. The gateway issues its own HS256 JWTs; clients never hold Zitadel tokens. **Server-side data** (profiles, LiteLLM tables) is stored in PostgreSQL (in-cluster).
- **Billing and usage metering** are handled by Stripe subscriptions, orchestrated through the gateway.
- **LLM requests** go through LiteLLM (`/v1/*`), which enforces per-user budgets and rate limits based on their tier (Free/Starter/Basic/Pro/Max).
- **Whenever any service needs backend functionality** (new API endpoint, database operation, webhook handler, etc.), it **must be implemented in the gateway (`cloud/gateway/`) or as K8s configuration**. Do not create backend services elsewhere.
- All frontend apps are static SPAs — they call `cloud/` API endpoints for any server-side logic.

---

## Getting Started

```bash
# Clone and install
git clone git@github.com:lmthing/lmthing.git
cd lmthing
pnpm install

# Run Studio (the main development surface)
cd studio
pnpm dev
```

---

## System Overview

```mermaid
graph TB
    subgraph Browser["Browser"]
        App["@lmthing/app<br/>React 19 + Vite + TanStack Router"]
        State["@lmthing/state<br/>Virtual File System + Event Bus"]
        App --> State
    end

    subgraph Cloud["Kubernetes on Azure VM"]
        Envoy["Envoy Gateway<br/>TLS + Routing"]
        LiteLLM["LiteLLM<br/>OpenAI-compatible proxy"]
        Gateway["Gateway (Hono/Node.js)<br/>Auth · Keys · Billing · Webhooks"]
        DB[("PostgreSQL<br/>profiles · LiteLLM tables")]
        Envoy -- "/v1/*" --> LiteLLM
        Envoy -- "/api/*" --> Gateway
        LiteLLM --> DB
        Gateway --> DB
    end

    subgraph External["External Services"]
        Azure["Azure AI Foundry<br/>LLM Models"]
        Stripe["Stripe<br/>Subscriptions + Billing"]
        Zitadel["Zitadel<br/>Identity — users · GitHub OAuth"]
        GitHub["GitHub API<br/>OAuth + Repo Sync"]
    end

    subgraph Library["sdk/org/packages"]
        Core["@lmthing/core + @lmthing/cli<br/>QuickJS WASM Sandbox · System Spaces · CLI"]
    end

    App -- "REST + Streaming" --> Envoy
    LiteLLM --> Azure
    Gateway --> Stripe
    Gateway --> Zitadel
    App -- "OAuth + Octokit" --> GitHub
    Core -. "Standalone CLI<br/>lmthing run" .-> Azure
```

---

## Key Packages

### sdk/org/packages — Core Framework

Three packages that power the THING agent runtime:

| Package | Entry | Purpose |
|---------|-------|---------|
| `@lmthing/core` | `packages/core/src/index.ts` | Runtime — QuickJS WASM sandbox, eval loop, globals (`ask`, `sleep`, `fork`, `delegate`, `tasklist`, `loadKnowledge`, `registerSpace`, …), spaces/agents, system spaces. No renderer/provider. |
| `@lmthing/cli` | `packages/cli/src/cli/bin.ts` | Terminal (Ink), WS DevTools server, AI provider wiring, `lmthing run` CLI. |
| `@lmthing/agent-ui` | `packages/ui/src/index.ts` | React web surface — the THING chat shell (`AppShell`: projects/sessions sidebar, chat, per-project documents + instructions) with a toggleable DevTools observability panel (execution tree + inspector), Tailwind v4. Exports `useReplSession`, `DisplayBlock`, `AskBlock`, `VariablesBlock`. |

Key concepts:

- **Execution model** — The model streams TypeScript; the host evaluates statements one-at-a-time in a QuickJS WASM sandbox. Value-yielding calls (`ask`, `sleep`, `tasklist`, `fork`, `delegate`, `inspect`, `loadKnowledge`, `registerSpace`) abort the stream, hand control to the host, and resume the next turn with resolved values injected as a VARIABLES block.
- **System spaces** — Always-loaded baseline spaces merged into every user space. The `global` space's functions are universally injected; the system agents (`thing`, `architect`, `engineer`, `solver`, `deep_research`, `memory`) are universally delegatable. The `thing` agent is the user-facing orchestrator that routes each request; the `architect` agent is the space-builder meta-agent — it synthesizes new spaces on demand via `scaffoldSpace`/`validateSpace`/`registerSpace`.
- **Compute runtime** — Server-side QuickJS WASM running in K8s pods. Every tier gets an ephemeral per-user pod; WebContainers are retired.
- **Spaces** — Self-contained directories with agents, functions, components, and knowledge. Loaded by `loadSpace(dir)`, merged via `mergeSystemInto`.
- **Provider resolution** — `azure/*`, `anthropic/*`, `openai/*`, `google/*`, `mistral/*`, or any OpenAI-compatible endpoint.

See [sdk/org/CLAUDE.md](./sdk/org/CLAUDE.md) for the full runtime architecture reference.

### sdk/libs/state — Virtual File System

In-memory VFS for browser-based workspace management:

- `Map<string, string>` storage with `FSEventBus` for fine-grained subscriptions (file, dir, glob, prefix)
- React context hierarchy: `AppProvider` → `StudioProvider` → `SpaceProvider`
- Hooks: `useFile()`, `useDir()`, `useGlob()`, `useDraft()`
- Persistence via GitHub sync (push/pull), conflict resolution follows standard git merge workflows

```mermaid
graph TB
    subgraph Contexts["React Context Hierarchy"]
        AppCtx["AppProvider<br/>AppFS (root)"]
        StudioCtx["StudioProvider<br/>StudioFS (scoped)"]
        SpaceCtx["SpaceProvider<br/>SpaceFS (scoped)"]
        AppCtx --> StudioCtx --> SpaceCtx
    end

    subgraph FS["File System Internals"]
        Map["Map&lt;string, string&gt;<br/>In-memory storage"]
        EventBus["FSEventBus<br/>file · dir · glob · prefix subscriptions"]
        Map --> EventBus
    end

    subgraph Hooks["React Hooks"]
        useFile["useFile()"]
        useDir["useDir()"]
        useGlob["useGlob()"]
        useDraft["useDraft()"]
    end

    SpaceCtx --> FS
    Hooks --> SpaceCtx
```

### sdk/org/packages/core/system-spaces — THING System Spaces

THING and its baseline capabilities live in `@lmthing/core` as always-loaded system spaces, not in a separate package. The old `@lmthing/thing` package has been retired.

Key system spaces (in `packages/core/system-spaces/`):

- **`global`** — Universally injected toolkit: `readFile`, `writeFile`, `editFile`, `glob`, `grep`, `listDir`, `webSearch`, `webFetch`, `remember`/`recall`/`recallAll`/`forget`, `todoWrite`/`todoRead`.
- **`thing`** — The main user-facing orchestrator agent (model-driven, no forced tasklist) and the default agent in the `lmthing` project server. It triages each request: answer directly, `delegate('deep_research', …)` to research, `delegate('architect', …)` to build a new specialist, `delegate('engineer'|'solver', …)` to code, or `delegate('memory', …)` to persist user facts. Reads per-project `instructions.md` + `documents/`.
- **`architect`** — The space-builder meta-agent. Synthesizes new spaces via `scaffoldSpace`/`validateSpace`/`registerSpace`, driving the `synthesize_and_run` tasklist DAG (research → design → scaffold → validate → register). Includes the `skill-to-space-transformer` agent for importing Claude Code skills/plugins.
- **`engineer`** — Coding agent with `TaskInput` component.
- **`solver`** — Verifier-gated coding agent.
- **`deep_research`** — Deep Research Analyst with Tavily search + `research_report` tasklist.
- **`memory`** — Thin agent wrapping `remember`/`recall`/`recallAll`/`forget`; stores facts about the user **globally** (across projects).

All system agents are universally delegatable from any user space. User space wins on name collisions (unless the user provides an empty placeholder).

### cloud/ — API Gateway + LiteLLM (The Only Backend)

The **sole backend** for all lmthing products. Runs on Kubernetes (Kubespray) on an Azure VM with two services:

- **LiteLLM** (`/v1/*`) — OpenAI-compatible LLM proxy routing to Azure AI Foundry, with per-user budgets, rate limits, and 10% token markup.
- **Gateway** (`/api/*`) — Hono/Node.js service for auth, API keys, billing, and Stripe webhooks.

**Tiers:**

| Tier    | Price      | Budget | Reset   | Rate Limits       |
| ------- | ---------- | ------ | ------- | ----------------- |
| Free    | $0         | $1     | 7 days  | 10K tpm / 60 rpm  |
| Starter | $5/month   | $5     | 30 days | 25K tpm / 150 rpm |
| Basic   | $10/month  | $10    | 30 days | 50K tpm / 300 rpm |
| Pro     | $20/month  | $20    | 30 days | 100K tpm / 1K rpm |
| Max     | $100/month | $100   | 30 days | 1M tpm / 5K rpm   |

Adding a new tier touches files across the monorepo — see [Adding a New Tier](#adding-a-new-tier) below.

**Gateway API routes:**

| Route                      | Method | Auth       | Purpose                                  |
| -------------------------- | ------ | ---------- | ---------------------------------------- |
| `/api/auth/register`       | POST   | Public     | Register → returns API key               |
| `/api/auth/login`          | POST   | Public     | Login → returns JWT + refresh token      |
| `/api/auth/oauth/url`      | GET    | Public     | Start GitHub OAuth via Zitadel IDP Intent |
| `/api/auth/oauth/callback` | GET    | Public     | IDP Intent callback — issues gateway tokens, redirects |
| `/api/auth/provision`      | POST   | JWT        | Provision LiteLLM user + Stripe customer |
| `/api/auth/refresh`        | POST   | Public     | Refresh access token                     |
| `/api/auth/me`             | GET    | JWT        | User info + tier                         |
| `/api/auth/sso/create`     | POST   | JWT        | Generate SSO authorization code          |
| `/api/auth/sso/exchange`   | POST   | Public     | Exchange SSO code for session            |
| `/api/keys`                | GET    | JWT        | List API keys                            |
| `/api/keys`                | POST   | JWT        | Create API key                           |
| `/api/keys/:token`         | DELETE | JWT        | Revoke API key                           |
| `/api/billing/checkout`    | POST   | JWT        | Stripe checkout session                  |
| `/api/billing/portal`      | POST   | JWT        | Stripe billing portal                    |
| `/api/billing/usage`       | GET    | JWT        | Budget usage info                        |
| `/api/billing/checkout/status` | GET | JWT       | Check Stripe checkout session status     |
| `/api/compute/status`      | GET    | JWT        | Compute pod status                       |
| `/api/compute/env`         | GET    | JWT        | List user pod environment variables      |
| `/api/compute/env`         | PUT    | JWT        | Set user pod env vars (triggers restart) |
| `/api/stripe/webhook`      | POST   | Stripe sig | Subscription events → tier changes       |
| `/v1/chat/completions`     | POST   | API key    | OpenAI-compatible chat (via LiteLLM)     |
| `/v1/models`               | GET    | API key    | Available models (via LiteLLM)           |

**Gateway libraries** in `gateway/src/lib/`: `tokens.ts` (gateway JWT issuance/verification), `zitadel.ts` (Zitadel v2 API — users + IDP Intent), `litellm.ts` (LiteLLM admin API client), `stripe.ts` (Stripe client), `tiers.ts` (tier definitions + model lists).

**K8s manifests** are now in `devops/argocd/` (Envoy Gateway). See `devops/CLAUDE.md` for details.

```mermaid
graph TB
    subgraph EnvoyGW["Envoy Gateway (TLS + Routing)"]
        V1["/v1/* → LiteLLM"]
        API["/api/* → Gateway"]
    end

    subgraph LiteLLMSvc["LiteLLM"]
        Chat["/v1/chat/completions<br/>OpenAI-compatible"]
        Models["/v1/models<br/>Available models"]
    end

    subgraph GatewaySvc["Gateway (Hono/Node.js)"]
        AuthRoutes["routes/auth.ts<br/>Register · Login · OAuth · SSO · Provision"]
        KeyRoutes["routes/keys.ts<br/>List · Create · Revoke"]
        BillingRoutes["routes/billing.ts<br/>Checkout · Portal · Usage"]
        WebhookRoutes["routes/webhook.ts<br/>Stripe tier changes"]
    end

    subgraph Libs["gateway/src/lib/"]
        TokensLib["tokens.ts<br/>HS256 JWT issuance"]
        ZitadelLib["zitadel.ts<br/>Zitadel v2 API"]
        LiteLLMLib["litellm.ts<br/>Admin API client"]
        StripLib["stripe.ts<br/>Stripe client"]
        TiersLib["tiers.ts<br/>Tier definitions"]
    end

    subgraph External["External"]
        Azure["Azure AI Foundry"]
        Zitadel["Zitadel<br/>auth.lmthing.cloud"]
        Stripe["Stripe"]
        DB[("PostgreSQL<br/>profiles · LiteLLM tables")]
    end

    V1 --> LiteLLMSvc
    API --> GatewaySvc
    LiteLLMSvc --> Azure
    LiteLLMSvc --> DB
    GatewaySvc --> LiteLLMLib
    GatewaySvc --> Zitadel
    GatewaySvc --> Stripe
    GatewaySvc --> DB
```

---

## Agent Execution Flow

1. User configures agent + sends message in Studio
2. Studio reads agent config from VFS (`@lmthing/state`)
3. Studio POSTs to `/v1/chat/completions` (OpenAI-compatible) with the user's LiteLLM API key
4. LiteLLM authenticates the API key, checks budget + rate limits for the user's tier
5. Request routed to Azure AI Foundry model endpoint
6. Response streams back to browser; LiteLLM tracks token usage against user's budget

```mermaid
sequenceDiagram
    participant User
    participant Studio as App (Studio)
    participant VFS as @lmthing/state
    participant LiteLLM as LiteLLM Proxy
    participant Azure as Azure AI Foundry

    User->>Studio: Configure agent + send message
    Studio->>VFS: Read agent config, knowledge, tools
    VFS-->>Studio: Workspace files
    Studio->>LiteLLM: POST /v1/chat/completions<br/>{model, messages, tools}
    LiteLLM->>LiteLLM: Verify API key + check budget/rate limits
    LiteLLM->>Azure: Forward to model endpoint
    Azure-->>LiteLLM: Token stream
    LiteLLM->>LiteLLM: Track usage (10% markup)
    LiteLLM-->>Studio: SSE stream
    Studio-->>User: Real-time response
```

---

## Data Storage

| Layer              | What                            | Where               |
| ------------------ | ------------------------------- | ------------------- |
| Client (ephemeral) | Auth tokens, encrypted sessions | localStorage        |
| Client (ephemeral) | Workspace files                 | In-memory VFS       |
| Server             | User profiles, API keys         | PostgreSQL (in-cluster) |
| Server             | Billing, meters, subscriptions  | Stripe              |
| Sync               | Workspace persistence           | GitHub repositories |

```mermaid
graph LR
    subgraph Client["Client-side"]
        LocalStorage["localStorage<br/>Auth tokens · Encrypted session"]
        InMemory["In-memory VFS<br/>Workspace files (ephemeral)"]
    end

    subgraph Server["Server-side"]
        Postgres[("PostgreSQL<br/>profiles · api_keys · sso_codes")]
        StripeBilling["Stripe<br/>Customers · Meters<br/>Subscriptions · Invoices"]
    end

    subgraph Sync["Sync Layer"]
        GitHubRepo["GitHub Repos<br/>Workspace persistence<br/>Version control"]
    end

    InMemory <-- "push/pull" --> GitHubRepo
    Client -- "API calls" --> Server
```

---

## Agent Runtimes

Different products run agents in different environments:

| Product     | Runtime                                                              |
| ----------- | -------------------------------------------------------------------- |
| Studio      | Browser UI only — agent execution runs in the user's compute pod     |
| Computer    | K8s pod (QuickJS WASM) — ephemeral per-user pod, every tier          |
| Space       | K8s pod — deployed spaces + published agents                         |
| Blog        | Shared serverless worker                                             |
| Casa        | Computer node → remote Home Assistant connection                     |
| Social/Team | Shared VFS + conversation log                                        |

---

## Development Workflow

- **Studio** is the primary development surface — most features are built and tested here
- **Cloud gateway** is developed locally — build and run the Hono server, deploy via `cd devops/ansible && make deploy` (ArgoCD auto-syncs manifest changes from git)
- **Core framework** changes can be tested via `lmthing run` CLI (in `sdk/org/`) or within Studio
- All workspace data syncs through git — standard merge/conflict resolution applies

---

## Local Development

### Quick Start

```bash
pnpm install       # install all workspace dependencies
make proxy         # set up nginx reverse proxy (requires sudo)
make up            # start all services
```

### Service Ports & Domains

Each app runs on its own Vite dev server. The local proxy maps `*.test` domains via nginx.

| App      | Port | Local Domain                          |
| -------- | ---- | ------------------------------------- |
| Studio   | 3000 | [studio.test](http://studio.test)     |
| Chat     | 3001 | [chat.test](http://chat.test)         |
| Com      | 3002 | [com.test](http://com.test)           |
| Social   | 3003 | [social.test](http://social.test)     |
| Store    | 3004 | [store.test](http://store.test)       |
| Space    | 3005 | [space.test](http://space.test)       |
| Team     | 3006 | [team.test](http://team.test)         |
| Computer | 3010 | [computer.test](http://computer.test) |
| Blog     | 3007 | [blog.test](http://blog.test)         |
| Casa     | 3008 | [casa.test](http://casa.test)         |
| Cloud    | 3009 | [cloud.test](http://cloud.test)       |

Port assignments and domain mappings are defined in `services.yaml`.

### Make Targets

| Command            | Description                                                                       |
| ------------------ | --------------------------------------------------------------------------------- |
| `make up`          | Start all frontend dev servers in parallel                                        |
| `make down`        | Stop all running dev servers                                                      |
| `make proxy`       | Set up nginx + `/etc/hosts` for `*.test` domains (interactive, prompts for sudo)  |
| `make proxy-clean` | Remove nginx configs and `/etc/hosts` entries                                     |
| `make install`     | Run `pnpm install`                                                                |
| `make check`       | Health check all lmthing.\* domains (DNS, TLS, HTTPS, hosting config)             |

### Proxy Setup

`make proxy` runs `.etc/scripts/local-proxy.sh`, which:

1. Installs nginx if missing (apt/brew)
2. Adds `127.0.0.1 <app>.test` entries to `/etc/hosts`
3. Creates nginx server blocks that reverse-proxy each domain to its Vite port (including WebSocket upgrade for HMR)
4. Validates the config and restarts nginx

The script is idempotent — re-running it skips already-configured services. Use `make proxy-clean` to tear everything down.

### Demo Auth

Studio, chat, and computer ship with `.env.development` files that set `VITE_DEMO_USER=true`. This makes `@lmthing/auth`'s `AuthProvider` skip SSO and use a hardcoded demo session, so you can develop without running the cloud gateway or com/.

### Running Individual Apps

To run a single app without `make up`:

```bash
cd studio && pnpm dev          # starts on default port
cd chat && pnpm vite --port 3001  # starts on assigned port
```

### Stack

All frontend apps share the same stack:

- **React 19** + **Vite 7** + **TanStack Router** (file-based routing)
- **Tailwind CSS v4** via `@tailwindcss/vite`
- Shared workspace libs: `@lmthing/ui`, `@lmthing/css`, `@lmthing/state`
- Path aliases: `@/` → `./src`, workspace libs resolved via Vite `resolve.alias`

---

## Useful Links

- [Architecture.md](./Architecture.md) — full product & domain architecture
- [devops/CLAUDE.md](./devops/CLAUDE.md) — infrastructure & deployment guide
- [sdk/org/CLAUDE.md](./sdk/org/CLAUDE.md) — core framework architecture reference (QuickJS sandbox, eval loop, system spaces)
- [sdk/org/packages/core/](./sdk/org/packages/core/) — `@lmthing/core` runtime source
- [sdk/org/packages/cli/](./sdk/org/packages/cli/) — `@lmthing/cli` terminal + WS server source
- [sdk/org/packages/ui/](./sdk/org/packages/ui/) — `@lmthing/agent-ui` React DevTools source
- [sdk/libs/state/](./sdk/libs/state/) — VFS library source
- [sdk/libs/css/](./sdk/libs/css/) — shared styles
- [sdk/libs/ui/](./sdk/libs/ui/) — shared UI components

---

## Skills Reference

| Topic | Skill File |
|-------|-----------|
| SPA deployment to GitHub Pages, adding new deployments, domain health checks | [deploy-spa.md](.claude/skills/deploy-spa.md) |
| Adding a new pricing tier (cross-cutting checklist) | [add-tier.md](.claude/skills/add-tier.md) |
| Auth flows, SSO, gateway routes, integrating auth in new services | [authentication.md](.claude/skills/authentication.md) |

# Agent Notes

This repository is a monorepo organized by TLD — each lmthing.\* domain has its own top-level directory.

## Shared Libraries

- `sdk/org/packages/core/` — `@lmthing/core`. QuickJS WASM sandbox, eval loop, value-yielding globals (`ask`, `sleep`, `fork`, `delegate`, `tasklist`, `loadKnowledge`, `registerSpace`, …), spaces/agents loading, system spaces (including the `architect` THING agent). No renderer or provider dependency.
- `sdk/org/packages/cli/` — `@lmthing/cli`. Terminal renderer (Ink), WS DevTools server, AI provider wiring, `lmthing run` CLI. Depends on `@lmthing/core`.
- `sdk/org/packages/ui/` — `@lmthing/agent-ui`. React THING chat shell (`AppShell` + Sidebar/ChatView/Composer/Message/ProjectSettings) with a toggleable DevTools observability panel (Tailwind v4). Exports `useReplSession`, `DisplayBlock`, `AskBlock`, `VariablesBlock`, and the Ink-compatibility layer (`@lmthing/agent-ui/compat`).
- `sdk/libs/state/` — Virtual file system (`@lmthing/state`). In-memory Map-based VFS with FSEventBus, React context hierarchy, and hooks (`useFile`, `useDir`, `useGlob`, `useDraft`).
- `sdk/libs/spaces/` — Shared space knowledge content.
- `sdk/libs/css/` — Shared styles used across all product domains.
- `sdk/libs/ui/` — Shared React UI components (`@lmthing/ui`) used across all product domains. Design elements, agent builder components, shell layouts. Rendering is done by `@lmthing/agent-ui` — `@lmthing/ui` does not re-export the agent renderer.

## Cloud Backend

- `cloud/` — API gateway (Hono/Node.js) + LiteLLM proxy. Gateway handles auth (Zitadel identity + gateway-issued HS256 JWTs), API key management (LiteLLM), billing (Stripe subscriptions), and webhooks. LiteLLM provides OpenAI-compatible LLM proxy routing to Azure AI Foundry with tier-based budgets and rate limits. Gateway source in `gateway/`, migrations in `migrations/`. K8s manifests are in `devops/argocd/`.
- `devops/` — Infrastructure automation. Terraform for Azure VM provisioning, Kubespray for K8s cluster, ArgoCD for GitOps deployment. Envoy Gateway for ingress, cert-manager for TLS, per-user compute pods for lmthing.computer. K8s manifests in `devops/argocd/`, auto-synced by ArgoCD. See `devops/CLAUDE.md`.

## Product Domains

- `studio/` — Agent builder UI (React 19, Vite 7, TanStack Router, Tailwind 4, Radix UI). Primary development surface.
- `chat/` — Personal THING interface.
- `blog/` — Personalized AI news.
- `computer/` — THING agent runtime. Where the THING agent and its studio spaces live and run on a dedicated K8s compute pod. Visiting directly gives terminal access.
- `space/` — Deploy spaces to containers with running agents, or publish agents for API access via the store.
- `social/` — Public hive mind.
- `team/` — Private agent rooms.
- `store/` — Agent marketplace.
- `casa/` — Smart home (Home Assistant integration).
- `com/` — Commercial landing page.

## Spaces Architecture

A **Space** is a self-contained workspace with five pillars: **Agents**, **Flows**, **Functions**, **Components**, and **Knowledge**.

```
{space-slug}/
├── package.json              # metadata (name, version)
├── agents/                   # AI specialists
│   └── agent-{role}/
│       ├── config.json       # runtime field requirements + accessible functions/components/knowledge
│       └── instruct.md       # personality, behavior, slash actions
├── flows/                    # step-by-step workflows
│   └── flow_{action}/
│       ├── index.md          # overview + step links
│       └── {N}.Step Name.md  # numbered steps with output schemas
├── functions/                # utility functions (TypeScript)
│   └── {functionName}.tsx    # plain TS exports, injected as sandbox globals
├── components/               # React components
│   ├── view/                 # display components (for display())
│   │   └── {ComponentName}.tsx
│   └── form/                 # form input components (for ask())
│       └── {ComponentName}.tsx
└── knowledge/                # structured domain data
    └── {domain}/
        ├── config.json       # section: label, icon, color
        └── {field}/
            ├── config.json   # field: type, default, variableName
            └── option-a.md   # selectable option with frontmatter
```

### Agents

Each agent is a specialist with a distinct role (e.g., `FormulaExpert`, `DataAnalyst`). An agent's `instruct.md` defines (via YAML frontmatter):

- **title** — Agent display name (PascalCase)
- **model** — LLM model override (optional)
- **actions** — Slash commands that trigger flows (`id` = `/command`, `flow` = directory in `flows/`)

The `config.json` declares what the agent can access: **knowledge** (domain/field selectors), **components** (view + form references, including catalog components), and **functions** (local or catalog functions with optional config).

### Flows

Flows are sequential, numbered step guides (4–8 steps) that an agent executes when a slash action is invoked. Each step is a discrete markdown file (`1.Step Name.md`, `2.Step Name.md`, etc.) linked from `index.md`.

### Knowledge Base

A hierarchical, structured context system injected into agent prompts:

- **Domains** — top-level categories with `renderAs: "section"`, each with a label, emoji icon, and hex color
- **Fields** — typed inputs (`select`, `multiSelect`, `text`, `number`) with a `variableName` for template injection
- **Options** — markdown files with YAML frontmatter (`title`, `description`, `order`) containing detailed guidance

This structure lets agents pull rich, user-configured context at runtime — the knowledge base acts as a declarative configuration layer that shapes agent behavior without modifying prompts directly.

### Naming Conventions

| Thing       | Convention                    | Example                |
| ----------- | ----------------------------- | ---------------------- |
| Folders     | `kebab-case`                  | `agent-formula-expert` |
| Variables   | `camelCase`                   | `gradeLevel`           |
| Agent names | `PascalCase`                  | `FormulaExpert`        |
| Flow IDs    | `snake_case` + `flow_` prefix | `flow_generate_report` |

## Key Documentation

- [Architecture.md](./Architecture.md) — full product & domain architecture
