# LMThing — Developer Onboarding

Welcome to lmthing. This file is an **orientation index** — load the detail files in the **Task Index** below only when a task needs them. For full product & domain architecture (diagrams, data flow), see [Architecture.md](./Architecture.md).

## Prerequisites

- **Node.js** ≥ 24 · **pnpm** ≥ 9 · **Git** · a GitHub account (OAuth + workspace persistence)

## Repository Structure

The monorepo is organized by TLD — each lmthing.\* domain has its own top-level directory.

```
lmthing/
├── sdk/org/            # the sdk submodule (github.com/lmthing/org): core, shared libs, runtime + the studio/computer/chat Vite apps
│   ├── libs/           # @lmthing/{state,spaces,css,ui,auth,utils,core,cli}
│   ├── apps/web/       # unified Vite SPA; /studio, /computer, /chat as client-side routes (Host-redirect at /)
│   └── common/         # shared favicons (favicon.ico/*)
├── cloud/              # THE backend — gateway + LiteLLM (see cloud-backend skill)
├── com/ social/ team/ store/ space/ blog/ casa/          # product app shells (static SPAs)
├── pnpm-workspace.yaml · package.json
```

- **Studio / Computer / Chat** live together in one Vite SPA — `sdk/org/apps/web/` — as client-side routes (`/studio`, `/computer`, `/chat`). `lmthing serve` (the bare `lmthing` command) serves the pre-built SPA as a catch-all for all non-`/api` requests; all three surfaces are on one origin. In production, the same build is deployed as three separate nginx K8s images (one per domain); the hostname-based redirect at `/` picks the right surface client-side.
- **Core runtime** lives in `sdk/org/libs/{core,cli}` — model-streamed TypeScript evaluated one statement at a time in a QuickJS WASM sandbox. See [sdk/org/CLAUDE.md](./sdk/org/CLAUDE.md).
- **Shared libraries** in `sdk/org/libs/`: `@lmthing/state` (in-memory VFS), `@lmthing/ui`, `@lmthing/css`, `@lmthing/auth`, `@lmthing/spaces`, `@lmthing/utils`. They live **inside the sdk/org submodule** so the pod image (Docker context = `sdk/org`) can build the apps self-contained.
- **Project-as-application** — a project can own a full **app** (`database/ pages/ api/ hooks/` at the project root, siblings of `spaces/`) built on the shared pod runtime: a project-rooted SQLite db, worker-isolated Node API handlers, client-side React pages, and in-proc db/cron hooks, all gated by an agent's `capabilities:` frontmatter. Apps are authored by the **`system-appbuilder`** space (THING delegates "build me an app" requests to its `app-architect`) and distributed via the **`store/projects/`** catalog (browsed on lmthing.store; installed by the pod's CLI server via `GET /api/apps` + `POST /api/apps/install`). Five ship today — `blog`, `health`, `kitchen`, `trips`, `demo-feed` (`store/projects/<id>/`, indexed by `store/projects/manifest.json`). Detail → **[org/](./org/README.md)** — the on-disk format [org/format/project/](./org/format/project/README.md), the runtime/serving model [org/app/](./org/app/README.md), the authoring globals [org/runtime-globals/app-authoring.md](./org/runtime-globals/app-authoring.md) · authoring skill [sdk/org/.claude/skills/project-app.md](./sdk/org/.claude/skills/project-app.md) · [store/README.md](./store/README.md).

## Backend — important

**There is no separate backend service.** `cloud/` is the **sole backend** for the entire project: a Hono/Node.js **Gateway** (`/api/*` — auth, API keys, billing, webhooks) and **LiteLLM** (`/v1/*` — OpenAI-compatible LLM proxy to Azure AI Foundry), on Kubernetes (Kubespray, Azure VM), backed by PostgreSQL + Stripe. **Any server-side logic — new endpoints, DB ops, webhooks — must be implemented in the gateway (`cloud/gateway/`) or as K8s config.** Do not create backend services elsewhere; all frontend apps are static SPAs that call `cloud/`.

- Full backend detail (routes table, tiers, libraries, K8s) → `@.claude/skills/cloud-backend.md`
- Auth flows / SSO / tokens → `@.claude/skills/authentication.md`

## Events, integrations & the store (current model)

lmthing has ONE **event pipeline** with symmetric halves: **emitter defs** (`events/<name>.ts` — a
typed `webhook`/`cron`/`db`/`internal` producer) and **event hooks** (`hooks/<slug>.ts`
`{type:'event'}` — the consumer, code-handler-as-filter or agent `trigger`), in a project or a space.
Full authoring guide → `@.claude/skills/events-and-hooks.md`. Consequences of this model:

- **Integrations are now EVENT SOURCES, not handler-agent bridges.** A messaging integration (Slack,
  Telegram, …) is a store SPACE whose `events/messages.ts` emits a typed `message.received` event; a
  project subscribes with an event hook. (The old `triggers:`/webhook-descriptor path — `triggers.md`,
  `webhooks.md` — is LEGACY.)
- **THING installs from the store with consent.** THING delegates discovery to `system-store` (agent
  `finder`, `store:read`), then calls the consent-marked `installSpace()` (`store:install`) — the host
  renders a consent card and installs only on user approval; `@consent` is a generic host-enforced flag
  for any function. Automation is authored into the LIVE project by `system-appbuilder`'s `automator`.
- **Chat Integrations tab** — the `/chat` surface has an Integrations settings tab (schema form + public
  inbound URL + `missingRequired`) that writes secrets to pod env via GET-merge-PUT `/api/compute/env`;
  a save restarts the pod and auto-resumes THING with a "<id> configured" system message.

## Getting Started

```bash
pnpm install
cd sdk/org/apps/web && pnpm dev        # unified app (routes: /studio /computer /chat)
```

Running the full local stack (ports, `*.test` nginx proxy, demo auth, make targets) → `@.claude/skills/local-dev.md`.

## Design system (all frontend — mandatory)

Every web surface (the `sdk/org` studio/chat/computer app **and** the product SPAs
`com/social/team/store/space/blog/casa`) shares one token-driven design system in
`@lmthing/css`. **Never write a raw color** (no hex, no literal `rgb()/hsl()`, no stock
Tailwind color utilities like `gray-*`/`blue-*`/`green-500`) — use a design token
(`var(--foreground)`, `bg-primary`, `text-agent`, …). To change a color, edit
`sdk/org/libs/css/src/tokens/tokens.json` then `pnpm --filter @lmthing/css generate`; never
hand-edit `theme.css`. This is a **hard gate**: `pnpm lint:tokens` (root) and CI
(`.github/workflows/design-tokens.yml`) fail on violations. Full rules → `@.claude/skills/design-system.md`
(canonical spec: [sdk/org/libs/css/DESIGN.md](./sdk/org/libs/css/DESIGN.md)).

## Task Index

Load the matching file when working on:

| Working on… | Load |
|---|---|
| **any frontend styling** — colors, Tailwind classes, component CSS, theming (MANDATORY, enforced) | `@.claude/skills/design-system.md` |
| cloud gateway / LiteLLM / billing / tiers / API routes / webhooks | `@.claude/skills/cloud-backend.md` |
| agent web search — `webSearch`/`webFetch`, Tavily/Bing/DuckDuckGo providers, the render service | `@.claude/skills/web-search.md` |
| **the unified event pipeline (CURRENT)** — `events/<name>.ts` emitter defs (webhook/cron/db/internal), event hooks (`hooks/<slug>.ts` `{type:'event'}`), code nodes in tasklists, project functions, the `@consent` flag, `installSpace`/store globals | `@.claude/skills/events-and-hooks.md` |
| inbound Triggers (LEGACY inbound path) — authoring an inbound binding (`triggers:` frontmatter / `type:'webhook'` hook), the binding manifest, Triggers settings tab | `@.claude/skills/triggers.md` |
| inbound webhook plumbing — gateway `/api/inbound` broker, pod dispatcher, provider verifiers (slack/github HMAC), inbound tokens, secrets, threading, deploy/verify | `@.claude/skills/webhooks.md` |
| running OpenClaw plugins as-is — `@lmthing/openclaw-compat` host, `.openclaw-plugins/`, the `tool()` global, plugin HTTP routes on the Triggers ingress | `@.claude/skills/openclaw-compat.md` |
| running the local dev stack (ports, `make`, nginx proxy, demo auth) | `@.claude/skills/local-dev.md` |
| adding a pricing tier (cross-cutting checklist) | `@.claude/skills/add-tier.md` |
| auth flows / SSO / gateway routes | `@.claude/skills/authentication.md` |
| deploying an SPA / domain health checks | `@.claude/skills/deploy-spa.md` |
| **the on-disk FORMAT of a project or a space** — `database/ api/ pages/ hooks/ events/` file kinds; agent `charter.md`/`instruct.md` frontmatter, capabilities, tasklists, knowledge, components | [./org/format/](./org/format/README.md) |
| **the agent runtime globals** — `display`/`ask`/`delegate`/`fork`, `db`, `writeTableSchema`/`writeApi`/`writePage`/`writeHook`, `installSpace`, `emitEvent`, `callConnection` | [./org/runtime-globals/](./org/runtime-globals/README.md) |
| **the `lmthing` CLI + the pod REST API** — commands/flags; every `/api/*` route the pod serves | [./org/cli-api/](./org/cli-api/README.md) |
| **a product surface** — routes, features, views of `/chat`, `/studio`, `/computer`, and a served project-app | [./org/chat/](./org/chat/README.md) · [./org/studio/](./org/studio/README.md) · [./org/computer/](./org/computer/README.md) · [./org/app/](./org/app/README.md) |
| full system & data-flow architecture (diagrams) | [./Architecture.md](./Architecture.md) |
| spaces authoring / agent runtime / eval loop | [./sdk/org/CLAUDE.md](./sdk/org/CLAUDE.md) |
| the VFS library (`@lmthing/state`) | [./sdk/org/libs/state/CLAUDE.md](./sdk/org/libs/state/CLAUDE.md) |
| infrastructure / deployment | [./devops/CLAUDE.md](./devops/CLAUDE.md) |

## Kubernetes Cluster (Production)

**SSH access:**
```bash
ssh -i ~/GEANT/lmthing/devops/terraform/generated/lmthing-test-key.pem \
    -o StrictHostKeyChecking=no azureuser@4.223.83.5
```

**Namespace map:**

| Namespace | What lives there |
|---|---|
| `lmthing` | All product deployments — `gateway`, `litellm`, `render` (in-cluster headless-Chromium for `webSearch`), `chat`, `studio`, `computer`, `com`, `social`, `team`, `store`, `space`, `blog`, `casa`, `zitadel` |
| `user-<id>` | One namespace per user; contains a single `lmthing` deployment (the compute pod, image `lmthingacr.azurecr.io/compute:latest`) |
| `argocd` | ArgoCD — GitOps controller, repo server, dex SSO, Redis |
| `cert-manager` | TLS certificate management |
| `envoy-gateway-system` | Envoy Gateway (ingress proxy) |
| `kube-system` | CoreDNS, Calico CNI, metrics-server |
| `metallb-system` | MetalLB load balancer |
| `local-path-storage` | Local-path PV provisioner |

**Common operations:**
```bash
# List all deployments
kubectl get deployments --all-namespaces -o wide

# Restart all user compute pods (blunt fallback — normally users are prompted
# in-app to upgrade individually; see PodEnsureGate in sdk/org/apps/web)
kubectl get namespaces | grep ^user- | awk '{print $1}' \
  | xargs -I{} kubectl rollout restart deployment/lmthing -n {}

# Restart a specific lmthing-namespace deployment (e.g. gateway)
kubectl rollout restart deployment/gateway -n lmthing

# Tail logs for a deployment
kubectl logs -n lmthing deployment/gateway -f

# Get all user namespaces
kubectl get namespaces | grep ^user-
```

## Testing on production / creating a test user

The production apps require a logged-in user. `POST https://lmthing.cloud/api/auth/register`
creates one, but **`POST /api/auth/login` is broken** (Zitadel "password not supported" —
see [.issues/zitadel-password-login-disabled.md](./.issues/zitadel-password-login-disabled.md)).
To get a session: mint a gateway HS256 JWT with `GATEWAY_JWT_SECRET` (from the
`lmthing-secrets` k8s secret; shape in `cloud/gateway/src/lib/tokens.ts`) for the
registered `user_id`, then inject `localStorage.lmthing_session = {accessToken,
refreshToken, expiresAt, userId, email, githubRepo:null, githubUsername:null}` on the
target SPA and reload. `POST /api/compute/ensure` provisions the free-tier pod;
`PUT /api/compute/env {vars}` loads API keys (it **replaces** all vars — GET + merge first;
source keys in `sdk/org/.env`). Drive the browser with the chrome-devtools MCP.

Studio shows a synthetic **`system`** project (the system/user spaces) plus the user's
projects, and an always-on right-side **THING** chat dock (the `/studio` route in `sdk/org/apps/web/`).
Open `.issues/` problems: CI/ArgoCD deploy flakiness, Zitadel login (sdk/org/.issues is empty — the reliability-redesign issues were closed after live verification, 2026-07-02).

## Useful Links

- **[org/](./org/README.md) — the code-grounded doc hub.** Every sentence cites the implementation:
  [format/](./org/format/README.md) (project + space on-disk format) ·
  [runtime-globals/](./org/runtime-globals/README.md) ·
  [cli-api/](./org/cli-api/README.md) (CLI + pod REST) ·
  [chat/](./org/chat/README.md) · [studio/](./org/studio/README.md) ·
  [computer/](./org/computer/README.md) · [app/](./org/app/README.md) (served project-app)
- [Architecture.md](./Architecture.md) — full product & domain architecture
- [sdk/org/CLAUDE.md](./sdk/org/CLAUDE.md) — core runtime reference (eval loop, system spaces, sessions)
- [devops/CLAUDE.md](./devops/CLAUDE.md) — infrastructure & deployment
