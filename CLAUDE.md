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

## Backend — important

**There is no separate backend service.** `cloud/` is the **sole backend** for the entire project: a Hono/Node.js **Gateway** (`/api/*` — auth, API keys, billing, webhooks) and **LiteLLM** (`/v1/*` — OpenAI-compatible LLM proxy to Azure AI Foundry), on Kubernetes (Kubespray, Azure VM), backed by PostgreSQL + Stripe. **Any server-side logic — new endpoints, DB ops, webhooks — must be implemented in the gateway (`cloud/gateway/`) or as K8s config.** Do not create backend services elsewhere; all frontend apps are static SPAs that call `cloud/`.

- Full backend detail (routes table, tiers, libraries, K8s) → `@.claude/skills/cloud-backend.md`
- Auth flows / SSO / tokens → `@.claude/skills/authentication.md`

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
| running the local dev stack (ports, `make`, nginx proxy, demo auth) | `@.claude/skills/local-dev.md` |
| adding a pricing tier (cross-cutting checklist) | `@.claude/skills/add-tier.md` |
| auth flows / SSO / gateway routes | `@.claude/skills/authentication.md` |
| deploying an SPA / domain health checks | `@.claude/skills/deploy-spa.md` |
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
| `lmthing` | All product deployments — `gateway`, `litellm`, `chat`, `studio`, `computer`, `com`, `social`, `team`, `store`, `space`, `blog`, `casa`, `zitadel` |
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
Open `.issues/` problems: CI/ArgoCD deploy flakiness, Zitadel login, architect stall (sdk/org/.issues).

## Useful Links

- [Architecture.md](./Architecture.md) — full product & domain architecture
- [sdk/org/CLAUDE.md](./sdk/org/CLAUDE.md) — core runtime + served UI (studio/computer/chat routes in `apps/web/`)
- [sdk/org/CLAUDE.md](./sdk/org/CLAUDE.md) — core runtime reference (eval loop, system spaces, sessions)
- [devops/CLAUDE.md](./devops/CLAUDE.md) — infrastructure & deployment
