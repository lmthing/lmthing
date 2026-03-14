# LMThing Codebase Audit

**Date:** 2026-03-14
**Scope:** Full monorepo — all product domains, shared libraries, cloud backend, infrastructure

---

## 1. What We're Building

**LMThing is an AI agent platform** — a suite of interconnected products that let users build, configure, deploy, and share AI agents. The architecture follows a "TLD-per-product" model where each product lives at its own domain (lmthing.studio, lmthing.chat, etc.).

### Core Value Proposition

1. **Studio** (`lmthing.studio`) — A visual agent builder where users create AI agents with structured knowledge bases, multi-step workflows (flows), and tool integrations. Agents are configured via markdown + JSON files in a virtual filesystem.

2. **Computer** (`lmthing.computer`) — A dedicated Fly.io VM per paying user that provides terminal access and runs THING agents persistently. This is the "always-on AI assistant" product.

3. **Space** (`lmthing.space`) — Deployable containers that host agents as services, with admin panels, databases, and custom domains. Think "Heroku for AI agents."

4. **Supporting products** — Chat (personal AI), Blog (AI news), Social (public agent feed), Team (private agent rooms), Store (agent marketplace), Casa (Home Assistant integration).

### Architecture Philosophy

- **Browser-first**: All apps are static SPAs with an in-memory virtual filesystem (`@lmthing/state`) for workspace management
- **Single backend**: All server-side logic routes through Supabase Edge Functions (`cloud/`)
- **Git-based persistence**: Workspaces sync to GitHub repositories (not a custom database)
- **Stripe-native billing**: Token usage is metered automatically via Stripe's LLM proxy — no usage tables needed
- **Container orchestration**: Computer and Space products run on Fly.io machines, managed via the `@lmthing/container` library

---

## 2. Implementation Completeness by Area

### Fully Implemented (Production-Ready)

| Component | Lines | Tests | Notes |
|-----------|-------|-------|-------|
| `org/libs/core` — Agent framework | ~5K+ | 39 tests (31 unit, 8 integration) | StatefulPrompt, plugins, providers, CLI all complete |
| `org/libs/state` — Virtual file system | ~4K+ | 25+ test files | AppFS, ScopedFS, FSEventBus, all hooks, parsers, DraftStore |
| `org/libs/auth` — SSO client | ~300 | — | Full SSO flow: redirect, code exchange, session management |
| `org/libs/container` — Fly.io abstraction | ~500 | — | FlyioProvider, FlyClient, typed machine/volume APIs |
| `org/libs/server` — Container runtime | ~300 | — | WebSocket server, PTY terminals, metrics, process list |
| `org/libs/ui` — Shared components | 258 files | 1 test | Large component library: shell, assistant, knowledge, computer, etc. |
| `cloud/` — Edge functions (original 9) | ~1.5K | — | generate-ai, list-models, API keys, billing, webhook |
| `cloud/` — SSO functions | ~200 | — | create-sso-code, exchange-sso-code |
| `cloud/` — Space management (7 functions) | ~700 | — | Full CRUD + start/stop/token for Fly.io spaces |
| `cloud/` — Computer management (2 functions) | ~300 | — | provision-computer, issue-computer-token |
| `cloud/` — SQL migrations (4) | ~100 | — | profiles, api_keys, sso_codes, spaces, computers |

### Partially Implemented (Functional but Incomplete)

| Component | What Works | What's Missing |
|-----------|-----------|---------------|
| **Studio** (`studio/`) | Route structure, StudioShell (1603 lines), VFS integration, agent config UI, chat/streaming, knowledge browser, flow editor, workspace loading | "Create Knowledge" button only logs to console; "Create Agent" button only logs to console; file management operations (create/rename/delete) only log to console; marketplace page is a placeholder |
| **Computer** (`computer/`) | Route structure (10 routes), terminal integration, WebSocket runtime, boot progress UI, spaces management | Dashboard is sparse (47 lines); login flow needs work |
| **Com** (`com/`) | Auth hub routes (login, signup, SSO, callback, password reset), account management, billing, pricing, docs | Many pages are thin placeholders |

### Scaffolded Only (Routes Exist, No Real Functionality)

| Product | Routes | Reality |
|---------|--------|---------|
| **Chat** (`chat/`) | 5 routes (home, conversations, settings) | Home page just renders "lmthing chat" centered text |
| **Blog** (`blog/`) | 4 routes (home, post, tag) | Home page just renders "lmthing blog" centered text |
| **Social** (`social/`) | 5 routes (feed, explore, profile) | Home page just renders "lmthing social" centered text |
| **Team** (`team/`) | 6 routes (rooms, create, members, settings) | Placeholder pages |
| **Store** (`store/`) | 5 routes (home, agent detail, category, publish) | Home page just renders placeholder |
| **Casa** (`casa/`) | 5 routes (home, settings, notifications, profile) | Home page just renders "lmthing casa" centered text |
| **Space** (`space/`) | 17 routes (admin panel, app view, builder, terminal, agents, db, settings, users, pages, logs) | Admin builder says "coming soon"; most admin pages are thin |

---

## 3. Documentation vs. Reality Inconsistencies

### CRITICAL: Cloud README Documents 9 Functions, Reality Has 22

**`cloud/README.md`** and **`cloud/CLAUDE.md`** both document only the original 9 edge functions:

```
generate-ai, list-models, create-api-key, list-api-keys, revoke-api-key,
create-checkout, billing-portal, get-usage, stripe-webhook
```

**Actually deployed functions (22 total):**

| Category | Functions | Documented? |
|----------|-----------|-------------|
| AI & Models | `generate-ai`, `list-models` | Yes |
| API Keys | `create-api-key`, `list-api-keys`, `revoke-api-key` | Yes |
| Billing | `create-checkout`, `billing-portal`, `get-usage`, `stripe-webhook` | Yes |
| SSO | `create-sso-code`, `exchange-sso-code` | **NO** |
| Spaces | `list-spaces`, `create-space`, `get-space`, `update-space`, `start-space`, `stop-space`, `delete-space`, `issue-space-token` | **NO** |
| Computer | `provision-computer`, `issue-computer-token` | **NO** |

**13 functions are completely undocumented.** The README's "Project Structure" section, API Reference, and deploy instructions all omit them.

### CRITICAL: CLAUDE.md Lists 2 Shared Modules, Reality Has 6

`CLAUDE.md` documents `_shared/` as having 4 files: `auth.ts`, `cors.ts`, `stripe.ts`, `supabase.ts`.

**Actually present:**
- `auth.ts` — documented
- `cors.ts` — documented
- `stripe.ts` — documented
- `supabase.ts` — documented
- **`provider.ts`** — undocumented (LLM provider abstraction with Stripe/Ollama/OpenAI backends)
- **`container.ts`** — undocumented (Fly.io container management: specs, tokens, app naming)

### CRITICAL: CLAUDE.md Lists 2 SQL Migrations, Reality Has 4

`cloud/README.md` references only `001_initial.sql`. The `CLAUDE.md` mentions 2 tables (`profiles`, `api_keys`).

**Actually present:**
- `001_initial.sql` — profiles + api_keys (documented)
- **`002_sso_codes.sql`** — SSO authorization codes table (undocumented)
- **`003_spaces.sql`** — Spaces table with Fly.io fields (undocumented)
- **`004_computers.sql`** — Computers table (undocumented)

### CLAUDE.md Lists 6 Shared Libraries, Reality Has 8

CLAUDE.md documents: `core`, `state`, `css`, `ui`, `auth`, `utils`.

**Also present but undocumented:**
- **`org/libs/container/`** — Fly.io Machines API client abstraction (`@lmthing/container`)
- **`org/libs/server/`** — Container runtime server with Dockerfile, WebSocket handler, PTY terminals

### GitHub Sync Not Implemented

CLAUDE.md states: *"Persistence via GitHub sync (push/pull), conflict resolution follows standard git merge workflows"*

The `@lmthing/state` library has **zero GitHub/Octokit integration**. There is no push/pull implementation anywhere in the VFS code. The `GithubContext.tsx` file exists in Studio but is for OAuth, not repository sync. Workspace persistence via GitHub is not implemented.

### `generate-ai` Uses Provider Abstraction, Not Direct Stripe

The `cloud/CLAUDE.md` shows `generate-ai` using `createStripe()` directly. The actual implementation uses `resolveModel()` from `_shared/provider.ts`, which supports three backends:
- `stripe` (default) — routes through `llm.stripe.com`
- `ollama` — routes to local Ollama instance
- `openai` — direct OpenAI API calls

This is a significant architectural difference that's undocumented.

### `stripe-webhook` Does More Than Documented

The webhook handler documentation says it just "logs" events. In reality, it:
- Auto-provisions Fly.io computer machines on Computer tier subscription activation
- Auto-destroys computer machines on subscription cancellation
- Has full provisioning logic (~80 lines of Fly.io orchestration code)

### Deploy Workflow Has Duplicate Steps

`.github/workflows/deploy.yml` runs the build steps **twice** — lines 40-47 duplicate lines 58-84. It also references `cd app` (line 68) which should be `cd studio`.

---

## 4. Unimplemented Features

### High Priority (Core Product Gaps)

1. **GitHub Workspace Sync** — Documented as the persistence mechanism for all workspace data. Not implemented at all. Without this, workspaces are ephemeral and lost on page refresh.

2. **Studio: Create Agent** — Button exists but only logs `"Create agent"` to console (`studio/todo.json`).

3. **Studio: Create Knowledge Domain** — Button exists but only logs `"Create domain"` to console (`studio/todo.json`).

4. **Studio: File Management** — Create File, Create Folder, Rename, Delete, Duplicate all only log to console (`studio/todo.json`).

5. **Chat App** — All 5 routes are placeholder. No conversation system, no AI integration, no message persistence. Just "lmthing chat" text.

6. **Blog App** — All 4 routes are placeholder. No content system, no AI news generation. Just "lmthing blog" text.

7. **Store App** — All 5 routes are placeholder. No agent marketplace, no publishing system.

8. **Social App** — All 5 routes are placeholder. No feed, no social features.

9. **Team App** — All 6 routes are placeholder. No room system, no collaboration.

10. **Casa App** — All 5 routes are placeholder. No Home Assistant integration.

### Medium Priority

11. **Space Admin Builder** — Route exists, shows "THING builder chat — coming soon" (`space/src/routes/$spaceSlug/admin/builder.tsx:12`).

12. **Space Admin Database** — Route exists, likely placeholder for per-space PostgreSQL schema management (schema isolation is defined in migration but no UI).

13. **Space Custom Domains** — Database field exists (`spaces.custom_domain`) but no DNS management or certificate provisioning.

14. **Space Auth** — Database field exists (`spaces.auth_enabled`) but no per-space authentication system.

15. **Studio Marketplace** — Route exists but is likely a minimal placeholder.

16. **Computer Dashboard** — Only 47 lines. Needs monitoring, resource usage, agent status.

### Low Priority

17. **Cloud Function Tests** — Zero test files for any edge function.

18. **CI/CD for Cloud** — No deployment workflow for Supabase edge functions (only Studio GitHub Pages and server Docker image have CI).

19. **CI/CD for Product Apps** — No deployment pipelines for chat, blog, social, team, store, casa, space, com.

---

## 5. Wrong Implementation Directions

### 1. Studio Chat Runs Client-Side, Bypassing Billing

The Studio chat interface (`studio/src/routes/$assistantId/chat/index.tsx`) calls `runPrompt()` from `@lmthing/core` **directly in the browser** with a hardcoded model (`anthropic:claude-sonnet-4-20250514`). This means:

- LLM calls go **directly to Anthropic**, not through `cloud/generate-ai`
- Token usage is **not metered by Stripe** — users consume tokens for free
- The entire billing architecture is bypassed for the primary product surface
- Requires the user's own API key (or one injected via env), not the platform's Stripe-proxied key

This is the core revenue leak. The cloud backend's `generate-ai` function exists to meter and bill token usage via Stripe, but the main chat UI doesn't use it.

**Recommendation:** Route Studio chat through `cloud/generate-ai` instead of calling providers directly. The core framework's `runPrompt()` should be used server-side (in edge functions or the container runtime), not in the browser.

### 2. StudioShell.tsx is a 1603-Line Legacy Component

`studio/src/shell/components/StudioShell.tsx` at **1603 lines** is the single largest file in the entire codebase. It appears to be a **legacy component** — the actual Studio shell is now delegated to `@lmthing/ui`'s `StudioLayout` component via routes. However, this file still exists and may cause confusion:

- It's unclear if it's still imported anywhere or truly dead code
- At 1603 lines, it's a maintenance burden even as dead code
- New developers may modify it thinking it's active

**Recommendation:** Verify if StudioShell.tsx is still referenced. If not, remove it. If parts are still used, extract them into focused components.

### 3. @stripe/ai-sdk Provider Doesn't Support Tool Calling

The `cloud/CLAUDE.md` explicitly states: *"`@stripe/ai-sdk` provider does NOT support tool calling."*

This is a fundamental limitation for an **agent platform**. Agents need tools — that's the core value proposition. The current architecture routes ALL LLM requests through Stripe's proxy, which means:

- No function/tool calling for any agent
- No structured output via tools
- The entire `defFunction`, `defMethod`, `defTool` plugin system in `org/libs/core` can't work through the cloud backend

**Recommendation:** The `_shared/provider.ts` already has the multi-provider abstraction. For tool-calling agents, use `meteredModel` (wrapping direct provider SDKs with Stripe metering) instead of `createStripe()`. This is mentioned in CLAUDE.md but not implemented.

### 4. VFS Relies on localStorage — No Real Sync

The workspace stores files in a `Map<string, string>` in memory, with `AppContext` auto-saving to localStorage (`lmthing-app` key + per-space keys). This means workspaces **do survive page refreshes** on the same browser, but:

- **No cross-device access** — localStorage is browser-local
- **No sharing/collaboration** — workspaces are trapped in one browser
- **localStorage size limits** (~5-10MB) — large workspaces will fail silently
- **No version history** — one accidental overwrite loses everything
- **Clearing browser data loses all work**

GitHub sync is documented as the persistence mechanism but isn't implemented. The codebase has `@octokit/rest` as a dependency and `GithubContext.tsx` handles OAuth + workspace loading from repos, but there's no **write-back** (push) implementation.

**Recommendation:** Implement GitHub sync (push) as the highest priority. The read path (workspace loading from GitHub) already works — the write path is the missing piece.

### 5. Deploy Workflow Only Deploys Studio to GitHub Pages

`.github/workflows/deploy.yml` only deploys `studio/` to GitHub Pages. This means:

- `lmthing.studio` is served as a static site from GitHub Pages
- All other 9 product apps have **no deployment pipeline**
- The cloud functions have **no CI/CD** for Supabase deployment
- There's no staging environment

For a multi-domain product suite, each domain needs its own deployment. GitHub Pages is also limiting for a SPA with complex routing.

**Recommendation:** Set up deployments for each product (Vercel/Cloudflare Pages per domain, or a unified platform). Add Supabase function deployment to CI.

### 6. SSO Code Table Has No Automatic Cleanup

`sso_codes` table stores authorization codes with a 60-second TTL (`expires_at`) but there's no cleanup mechanism:

- No cron job to delete expired codes
- No database trigger to auto-clean
- Table will grow indefinitely with expired, unused codes

**Recommendation:** Add a Supabase cron extension or a cleanup edge function, or use `pg_cron` to periodically delete expired codes.

### 7. Webhook Handler Has Implicit Container Provisioning

`stripe-webhook/index.ts` contains ~80 lines of Fly.io container provisioning logic embedded directly in the webhook handler. If provisioning fails:

- No retry mechanism
- User has a subscription but no computer
- The only error handling is a console.log

This should be an async job, not synchronous webhook processing (Stripe expects webhook responses within seconds).

**Recommendation:** Move provisioning to a separate queue/function triggered by the webhook, with retries and status tracking.

### 8. `org/libs/core` Has Its Own `.github` Directory

The core framework at `org/libs/core/.github/` contains its own CI workflows (`ci.yml`, `llm-tests.yml`) and copilot instructions. This suggests it may have been an independent repository before being absorbed into the monorepo. Having nested `.github` directories in a monorepo is confusing — only the root `.github` is used by GitHub Actions.

**Recommendation:** Consolidate CI into the root `.github/workflows/` directory and remove the nested one.

### 9. Excessive Product App Scaffolding

7 out of 10 product apps (chat, blog, social, team, store, casa, space) are essentially empty scaffolds with route files that render placeholder text. Each app has its own `package.json`, dependencies, Vite config, and TanStack Router setup — but no real functionality.

This creates:
- Maintenance overhead (keeping dependencies in sync across 10+ apps)
- A misleading codebase (appears larger and more complete than it is)
- Wasted CI/install time

**Recommendation:** Consider removing empty scaffolds until they're ready for development, or consolidate related products. Focus engineering effort on making Studio, Computer, and the cloud backend production-quality before expanding.

---

## 6. Inconsistencies Between Components

### Naming Inconsistency: "Assistant" vs "Agent"

The codebase uses both terms interchangeably:
- Routes use `assistant` (`studio/src/routes/.../$assistantId/...`)
- UI components directory: `org/libs/ui/src/components/assistant/`
- Hooks use `agent` (`useAgentConfig`, `useAgentInstruct`, `useAgentList`)
- State hooks: `useAgent`, `useAgentList`
- Knowledge/flows reference "agents" in directory names

This creates confusion about whether these are the same concept.

### `services.yaml` Cloud Port vs. Supabase Default

`services.yaml` lists cloud port as `54321` (Supabase default). But the CLAUDE.md and Makefile reference `cloud.local:3009` in some places. The cloud service type is `supabase` (not `vite`), so it uses Supabase's own port, but the services config implies it should be proxied at `cloud.local` on port 54321.

### `cloud/CLAUDE.md` vs `cloud/README.md` Divergence

These two files document the same system but are significantly out of sync:
- README only covers original 9 functions
- CLAUDE.md only covers original 9 functions
- Neither documents the SSO, Space, or Computer functions
- Neither documents `_shared/provider.ts` or `_shared/container.ts`
- Neither documents migrations 002-004

---

## 7. Summary of Priorities

### Must Fix (Blocking)

1. **Route Studio chat through cloud/generate-ai** — currently bypasses Stripe billing entirely (revenue leak)
2. **Implement GitHub workspace sync** — without persistence, the product is unusable
3. **Fix tool-calling limitation** — agents without tools aren't useful agents
4. **Implement Studio file operations** — can't build agents if CRUD doesn't work
5. **Fix deploy.yml duplicate steps** and `cd app` bug

### Should Fix (Quality)

6. **Update all documentation** — 13 undocumented cloud functions, 2 undocumented libraries, 2 undocumented migrations
7. **Remove or repurpose StudioShell.tsx** — 1603-line legacy component, likely dead code
8. **Add async provisioning** — webhook shouldn't do synchronous Fly.io calls
9. **Add SSO code cleanup**
10. **Add cloud function tests**

### Consider (Strategic)

11. **Remove empty scaffolds** — focus on Studio/Computer/Cloud first
12. **Add deployment pipelines** for all active products
13. **Consolidate naming** — pick "agent" or "assistant", not both
14. **Remove nested `.github`** from core lib
