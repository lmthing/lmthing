# LMTHING Technical Architecture

## Core Agent Framework (org/core)

The agentic framework that powers all of lmthing. It supports two modes: **stateful interactive chat** (multi-turn conversations where the agent maintains state across turns) and **autonomous agents** (self-directed task execution without human input). Built on the Vercel AI SDK v6, it provides a StatefulPrompt system with React-like hooks (useState, useEffect, useMemo, useCallback) for managing agent state. Built-in plugins handle task lists, DAG-based task graphs, sandboxed TypeScript execution (vm2), and inline code methods. Provider resolution supports OpenAI, Anthropic, Google, Mistral, Azure, Groq, and any OpenAI-compatible endpoint. Agents can run in the browser via Studio or standalone via the `lmthing run` CLI.

```mermaid
graph TB
    subgraph Entry["Entry Points"]
        RunPrompt["runPrompt()"]
        CLI["CLI: lmthing run"]
    end

    subgraph Modes["Agent Modes"]
        Interactive["Stateful Interactive Chat<br/>Multi-turn conversations with state"]
        Autonomous["Autonomous Agents<br/>Self-directed task execution"]
    end

    subgraph Prompt["StatefulPrompt System"]
        SP["StatefulPrompt<br/>React-like hooks for agent state"]
        Hooks["useState · useEffect<br/>useMemo · useCallback"]
        SP --> Hooks
    end

    Entry --> Modes
    Modes --> Prompt

    subgraph Plugins["Built-in Plugins"]
        TaskList["defTaskList<br/>Task management"]
        TaskGraph["defTaskGraph<br/>DAG dependencies"]
        Function["defFunction<br/>vm2 sandbox execution"]
        Method["defMethod<br/>Inline code execution"]
    end

    subgraph Providers["Provider Resolution"]
        OpenAI["openai/*"]
        Anthropic["anthropic/*"]
        Google["google/*"]
        Mistral["mistral/*"]
        Azure["azure/*"]
        Groq["groq/*"]
        Custom["custom (OpenAI-compatible)"]
    end

    subgraph SDK["Vercel AI SDK v6"]
        StreamText["streamText()"]
        GenerateText["generateText()"]
        Tools["Tool definitions + Zod schemas"]
    end

    RunPrompt --> SP
    CLI --> RunPrompt
    SP --> Plugins
    SP --> SDK
    SDK --> Providers
```

---
## Monorepo Structure

Four packages in a pnpm workspace. The app depends on the state library for file system management and calls the cloud backend over HTTP. The core framework shares types with the app and can also run independently as a CLI tool.

```mermaid
graph LR
    Root["pnpm workspace"] --> App["org/studio/<br/>@lmthing/app"]
    Root --> Core["org/core/<br/>lmthing"]
    Root --> State["org/state/<br/>@lmthing/state"]
    Root --> CloudPkg["com/cloud/<br/>@lmthing/cloud"]

    App --> State
    App -- "HTTP" --> CloudPkg
    Core -. "shared types" .-> App
```

| Package | Name | Stack | Role |
|---------|------|-------|------|
| `org/studio/` | @lmthing/app | React 19, Vite 7, TanStack Router, Tailwind 4, Radix UI | Visual studio for building and testing AI agents |
| `org/core/` | lmthing | TypeScript, Vercel AI SDK v6, Zod, vm2 | Agentic framework — stateful prompts, plugins, tool execution, multi-provider support |
| `org/state/` | @lmthing/state | React hooks, Map-based VFS, FSEventBus | Virtual file system with scoped contexts, event subscriptions, and glob matching |
| `org/docs/` | — | Documentation | Project documentation |
| `com/cloud/` | @lmthing/cloud | Deno, Supabase Edge Functions, @stripe/ai-sdk | Serverless backend — auth, billing, LLM proxy, API key management |

---



## System Overview

The platform is built as a pnpm monorepo with four packages. The frontend app (React 19) communicates with Supabase Edge Functions for authentication, billing, and LLM proxying. The core agent framework can run both inside the browser (via Studio) and standalone via CLI. The state library provides a virtual file system that powers workspace management in the browser, with GitHub as the persistence and sync layer.

```mermaid
graph TB
    subgraph Browser["Browser"]
        App["@lmthing/app<br/>React 19 + Vite + TanStack Router"]
        State["@lmthing/state<br/>Virtual File System + Event Bus"]
        App --> State
    end

    subgraph Cloud["Supabase Cloud"]
        Edge["Edge Functions (Deno)"]
        DB[("PostgreSQL<br/>profiles · api_keys")]
        Edge --> DB
    end

    subgraph External["External Services"]
        Stripe["Stripe LLM Proxy<br/>llm.stripe.com"]
        Providers["LLM Providers<br/>OpenAI · Anthropic · Google<br/>Mistral · Groq · Cohere"]
        GitHub["GitHub API<br/>OAuth + Repo Sync"]
        Stripe --> Providers
    end

    subgraph Library["org/core"]
        Core["lmthing Framework<br/>Vercel AI SDK · Plugins · CLI"]
    end

    App -- "REST + Streaming" --> Edge
    Edge -- "@stripe/ai-sdk" --> Stripe
    App -- "OAuth + Octokit" --> GitHub
    Core -. "Standalone CLI<br/>lmthing run" .-> Providers
```

---

## Agent Execution Flow

When a user sends a message in Studio, the app reads the agent configuration from the virtual file system, then streams a request through the Supabase edge function. The edge function authenticates the user, resolves their Stripe customer ID, and proxies the request through Stripe's LLM gateway — which handles token metering automatically. The response streams back to the browser in real time.

```mermaid
sequenceDiagram
    participant User
    participant Studio as App (Studio)
    participant VFS as @lmthing/state
    participant Edge as Edge Function
    participant Stripe as Stripe LLM Proxy
    participant LLM as LLM Provider

    User->>Studio: Configure agent + send message
    Studio->>VFS: Read agent config, knowledge, tools
    VFS-->>Studio: Workspace files
    Studio->>Edge: POST /generate-ai<br/>{model, messages, tools, temperature}
    Edge->>Edge: Authenticate (JWT or lmt_ API key)
    Edge->>Edge: Resolve Stripe customer ID
    Edge->>Stripe: stripeLLM(model) streaming request
    Stripe->>LLM: Forward to provider
    LLM-->>Stripe: Token stream
    Stripe-->>Edge: Stream + meter tokens
    Edge-->>Studio: SSE stream
    Studio-->>User: Real-time response
```

---

## Authentication

Three modes of auth. Studio can run entirely without an account — users set a local password that encrypts their API keys in localStorage via PBKDF2 + AES-256-GCM (BYOK mode, no server needed). For cloud features, users authenticate via GitHub OAuth device flow (also enables workspace syncing). On the backend, requests are authenticated either with a Supabase JWT (browser sessions) or a programmatic API key prefixed with `lmt_` (for SDK/script access). Both server-side paths resolve to a user ID and Stripe customer ID.

```mermaid
flowchart TD
    subgraph Frontend["Frontend Auth"]
        NoAccount["No Account (BYOK)"]
        NoAccount --> LP["Local Password"]
        LP --> PBKDF2["PBKDF2 (250k iter)<br/>+ AES-256-GCM"]
        PBKDF2 --> LS["localStorage<br/>Encrypted API keys"]
        GH["GitHub OAuth"]
        GH --> DeviceFlow["Device Flow"]
        DeviceFlow --> Token["OAuth Token"]
    end

    subgraph Backend["Backend Auth"]
        JWT["Bearer JWT<br/>(Supabase Auth)"]
        APIKey["Bearer lmt_*<br/>(API Key)"]
        JWT --> Verify["Verify JWT"]
        APIKey --> Hash["SHA-256 lookup"]
        Verify --> UserID["user_id +<br/>stripe_customer_id"]
        Hash --> UserID
    end

    Frontend -- "Authorization header" --> Backend
```

---

## Cloud Backend (Supabase Edge Functions)

The serverless backend runs on Supabase Edge Functions (Deno runtime). Nine functions handle AI generation, model listing, API key lifecycle, Stripe billing, and webhooks. Shared modules provide authentication (dual JWT/API key), CORS, Stripe client initialization, and Supabase client factories. All user data is stored in PostgreSQL with row-level security enforced per user.

```mermaid
graph TB
    subgraph Functions["Edge Functions"]
        GenAI["generate-ai<br/>POST · Streaming LLM"]
        Models["list-models<br/>GET · Available models"]
        CreateKey["create-api-key<br/>POST · Generate lmt_ key"]
        ListKeys["list-api-keys<br/>GET · Key prefixes"]
        RevokeKey["revoke-api-key<br/>POST · Soft-delete"]
        Checkout["create-checkout<br/>POST · Stripe session"]
        Portal["billing-portal<br/>POST · Customer portal"]
        Usage["get-usage<br/>GET · Stripe balance"]
        Webhook["stripe-webhook<br/>POST · No auth"]
    end

    subgraph Shared["_shared/"]
        Auth["auth.ts<br/>JWT + API key verify"]
        CORS["cors.ts"]
        StripeClient["stripe.ts"]
        Supa["supabase.ts"]
    end

    subgraph Storage["PostgreSQL"]
        Profiles["profiles<br/>id · email · stripe_customer_id"]
        Keys["api_keys<br/>key_hash · prefix · revoked_at"]
    end

    GenAI --> Auth
    CreateKey --> Auth
    ListKeys --> Auth
    GenAI --> StripeClient
    Checkout --> StripeClient
    Auth --> Supa
    Supa --> Storage
```

---

## Virtual File System (@lmthing/state)

The state library provides a layered, in-memory virtual file system for managing workspace data in the browser. It uses a `Map<string, string>` as storage and an event bus (FSEventBus) that supports fine-grained subscriptions — by file path, directory, glob pattern, or prefix. React context providers (App → Studio → Space) scope the file system at each level, and hooks like `useFile()`, `useDir()`, `useGlob()`, and `useDraft()` give components reactive access to workspace data. Files are ephemeral in memory and persisted through GitHub sync.

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

---


## Data Storage Map

Data lives in three tiers. Client-side storage is ephemeral — localStorage holds auth tokens and encrypted sessions, while the in-memory VFS holds workspace files that exist only for the duration of the browser session. Server-side, Supabase PostgreSQL stores user profiles and API keys with row-level security, and Stripe manages customer records, token meters, subscriptions, and invoicing. GitHub serves as the sync and persistence layer — workspaces are stored as repositories and can be pushed/pulled bidirectionally.

```mermaid
graph LR
    subgraph Client["Client-side"]
        LocalStorage["localStorage<br/>Auth tokens · Encrypted session"]
        InMemory["In-memory VFS<br/>Workspace files (ephemeral)"]
    end

    subgraph Server["Server-side"]
        Postgres[("PostgreSQL<br/>profiles · api_keys<br/>RLS enforced")]
        StripeBilling["Stripe<br/>Customers · Meters<br/>Subscriptions · Invoices"]
    end

    subgraph Sync["Sync Layer"]
        GitHubRepo["GitHub Repos<br/>Workspace persistence<br/>Version control"]
    end

    InMemory <-- "push/pull" --> GitHubRepo
    Client -- "API calls" --> Server
```
