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

# Restart all user compute pods
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
projects, and an always-on right-side **THING** chat dock — see [studio/agents.md](./studio/agents.md).
Open `.issues/` problems: CI/ArgoCD deploy flakiness, Zitadel login, architect stall (sdk/org/.issues).

## Useful Links

- [Architecture.md](./Architecture.md) — full product & domain architecture
- [studio/agents.md](./studio/agents.md) — Studio dev guide (editors, sidebar, projects, THING dock)
- [sdk/org/CLAUDE.md](./sdk/org/CLAUDE.md) — core runtime reference (eval loop, system spaces, sessions)
- [devops/CLAUDE.md](./devops/CLAUDE.md) — infrastructure & deployment
