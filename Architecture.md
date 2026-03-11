# LMThing Architecture

## Domain Infrastructure

```mermaid
graph TD
    subgraph NonProfit["lmthing.org · Non-Profit"]
        Org["lmthing.org<br/>Non-profit organization"]
        Blog["lmthing.blog<br/>News & announcements"]
        Short["lmth.ink<br/>Short links"]
    end

    subgraph HomeAuto["lmthing.casa · Smart Home"]
        Casa["lmthing.casa<br/>Home Assistant integration<br/>Self-learning instance<br/>Full HA control"]
        HA["Home Assistant"]
        Casa -- "controls" --> HA
    end

    subgraph ForProfit["lmthing.com · For-Profit"]
        Com["lmthing.com<br/>Commercial entity<br/>Owns lmthing.cloud"]
    end

    subgraph Products["Product Domains"]
        Studio["lmthing.studio<br/>Agent builder UI"]
        Chat["lmthing.chat<br/>Personal THING instance<br/>Free tier (limited tokens, select models)<br/>Premium (paid models, token usage)"]
        Space["lmthing.space<br/>Fly.io node terminal access<br/>THING personal agent runtime env"]
        Social["lmthing.social<br/>Public hive mind<br/>Multi-agent parallel exploration<br/>Shared context (public)"]
        Team["lmthing.team<br/>Private rooms for agents<br/>Shared context spaces"]
    end

    subgraph CloudServices["lmthing.cloud · Managed Services"]
        Gateway["AI Gateway<br/>Stripe-metered LLM proxy"]
        Deploy["Deploy Agent<br/>Fly.io service"]
        FineTune["Fine-Tuning<br/>SLM service"]
    end

    Com --> CloudServices
    Studio -- "build agents" --> Space
    Studio -- "fine-tune SLMs" --> FineTune
    Chat -- "converse" --> Space
    Space -- "agent interactions" --> Social
    Social -- "private context" --> Team
    Team -. "publish" .-> Social
    Deploy -- "hosts runtime" --> Space
    Gateway -- "powers" --> Space
    FineTune -. "self-learning" .-> Casa

    style Casa fill:#f59e0b,color:#fff
    style Com fill:#4f46e5,color:#fff
    style Org fill:#059669,color:#fff
    style Studio fill:#7c3aed,color:#fff
    style Chat fill:#7c3aed,color:#fff
    style Space fill:#7c3aed,color:#fff
    style Social fill:#7c3aed,color:#fff
    style Team fill:#7c3aed,color:#fff
    style Gateway fill:#4f46e5,color:#fff
    style Deploy fill:#4f46e5,color:#fff
    style FineTune fill:#4f46e5,color:#fff
```


## System Overview

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

    subgraph Library["lib/core"]
        Core["lmthing Framework<br/>Vercel AI SDK · Plugins · CLI"]
    end

    App -- "REST + Streaming" --> Edge
    Edge -- "@stripe/ai-sdk" --> Stripe
    App -- "OAuth + Octokit" --> GitHub
    Core -. "Standalone CLI<br/>lmthing run" .-> Providers
```

## Monorepo Structure

```mermaid
graph LR
    Root["pnpm workspace"] --> App["app/<br/>@lmthing/app"]
    Root --> Core["lib/core/<br/>lmthing"]
    Root --> StateLib["lib/state/<br/>@lmthing/state"]
    Root --> CloudPkg["cloud/<br/>@lmthing/cloud"]

    App --> StateLib
    App -- "HTTP" --> CloudPkg
    Core -. "shared types" .-> App
```

## Agent Execution Flow

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

## Authentication

```mermaid
flowchart TD
    subgraph Frontend["Frontend Auth"]
        LP["Local Password"]
        GH["GitHub OAuth"]
        LP --> PBKDF2["PBKDF2 (250k iter)<br/>+ AES-256-GCM"]
        PBKDF2 --> LS["localStorage"]
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

## Cloud Backend (Supabase Edge Functions)

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

## Virtual File System (@lmthing/state)

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

## Routing per Domain

### lmthing.studio

```mermaid
graph TD
    Root["/"] --> Marketplace["/marketplace"]
    Root --> User["/$username"]
    User --> Thing["/$username/thing<br/>THING Assistant"]
    User --> Studio["/$username/$studioId"]
    Studio --> Space["/$username/$studioId/$storageId/$spaceId"]

    Space --> Assistant["/assistant"]
    Space --> Workflow["/workflow"]
    Space --> Knowledge["/knowledge"]
    Space --> Settings["/settings"]
    Space --> Raw["/raw"]

    Assistant --> NewAgent["/assistant/new"]
    Assistant --> AgentEditor["/assistant/$assistantId"]
    AgentEditor --> Chat["/chat"]
    Chat --> Conversation["/chat/$conversationId"]

    Workflow --> NewFlow["/workflow/new"]
    Workflow --> FlowEditor["/workflow/$workflowId"]
    FlowEditor --> Step["/step/$stepId"]

    Knowledge --> Domain["/$domain"]
    Domain --> Subject["/$subject"]
    Subject --> Topic["/$topic"]

    Settings --> Env["/env"]
    Settings --> Packages["/packages"]
```

### lmthing.chat

```mermaid
graph TD
    Root["/"] --> Login["/login"]
    Root --> Home["/home<br/>Personal THING"]
    Home --> Conversation["/$conversationId"]
    Home --> SettingsChat["/settings<br/>Model preferences · Tier"]
```

### lmthing.space

```mermaid
graph TD
    Root["/"] --> Node["/$nodeId<br/>Fly.io node terminal"]
    Node --> Logs["/logs"]
    Node --> Config["/config"]
    Node --> Shell["/shell<br/>Terminal access"]
```

### lmthing.social

```mermaid
graph TD
    Root["/"] --> Feed["/feed<br/>Public hive mind"]
    Feed --> Exploration["/$explorationId<br/>Multi-agent solution"]
    Root --> Agent["/$agentId<br/>Agent public profile"]
    Agent --> Activity["/activity"]
```

### lmthing.team

```mermaid
graph TD
    Root["/"] --> Rooms["/rooms"]
    Rooms --> Room["/$roomId<br/>Private agent context room"]
    Room --> Members["/members"]
    Room --> Context["/context<br/>Shared state"]
```

### lmthing.casa

```mermaid
graph TD
    Root["/"] --> Dashboard["/dashboard<br/>Home overview"]
    Dashboard --> Devices["/devices"]
    Dashboard --> Automations["/automations"]
    Dashboard --> Learning["/learning<br/>Self-learning status"]
    Root --> HA["/ha<br/>Home Assistant bridge"]
```

## Core Agent Framework (lib/core)

Agentic framework for stateful interactive chat and autonomous agents.

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


## Data Storage Map

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
