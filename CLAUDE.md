# LMThing — Developer Onboarding

Welcome to lmthing. This file is an **orientation index**: what the repo is, how to run it, and where to find the answer. It holds no knowledge of its own.

## Read this first — `org/docs/` is the source of truth

**[`org/docs/`](./org/docs/README.md) (published at lmthing.org) is the SINGLE SOURCE OF TRUTH for this codebase.** Every factual sentence there is cited to the implementation with a symbol anchor (`path#Symbol`), falling back to a line anchor (`path:Lstart-Lend`) only where a symbol isn't appropriate. `pnpm docs:check` resolves every citation as a hard CI gate. When this file, a `.claude/skill`, or any README disagrees with `org/docs/`, **`org/docs/` wins**; when `org/docs/` disagrees with the **code**, the **code** wins and the doc is a bug.

> **A code change is not done until the matching `org/docs/` page is updated in the same change.**

The contract — what "grounded" means, which doc to update, the deletion rule → **[`org/docs/SYNC.md`](./org/docs/SYNC.md)**. How to change things safely (add a global, a space, a provider, a tier; testing, debugging) → [`org/docs/contributing/`](./org/docs/contributing/README.md).

## Prerequisites

- **Node.js** ≥ 24 · **pnpm** ≥ 9 · **Git** · a GitHub account (OAuth + workspace persistence)

## Getting Started

```bash
pnpm install
cd sdk/org/apps/web && pnpm dev        # unified app (routes: /studio /computer /chat)
```

Full local stack (ports, `*.test` nginx proxy, demo auth, make targets) → [`org/docs/devops/local-dev.md`](./org/docs/devops/local-dev.md).

## Repository Structure

The monorepo is organized by TLD — each lmthing.\* domain has its own top-level directory.

```
lmthing/
├── sdk/org/            # sdk submodule (github.com/lmthing/org): runtime, shared libs, the unified web app
│   ├── libs/           # @lmthing/{auth,cli,config,core,css,state,ui,utils}
│   └── apps/web/       # unified Vite SPA; /studio, /computer, /chat as client-side routes
├── cloud/              # THE backend — Hono gateway (/api/*) + LiteLLM (/v1/*)
├── org/                # lmthing.org SPA — org/docs/** is the source of truth
├── store/              # lmthing.store SPA + the catalog (store/projects/, store/spaces/)
├── com/ social/ team/ space/ blog/ casa/     # product app shells (static SPAs)
├── devops/             # terraform, ansible, argocd, k8s manifests
```

**There is no separate backend service.** `cloud/` is the sole backend; every frontend is a static SPA that calls it. Any server-side logic — new endpoints, DB ops, webhooks — belongs in `cloud/gateway/` or in K8s config. Detail → [`org/docs/cloud/`](./org/docs/cloud/README.md). Whole-system view (domains, pods, data flow) → [`org/docs/architecture.md`](./org/docs/architecture.md).

## Design system — mandatory, enforced

**Never write a raw color** in any web surface (no hex, no literal `rgb()/hsl()`, no stock Tailwind color utilities like `gray-*`/`blue-*`). Use a design token (`var(--foreground)`, `bg-primary`, …). To change a color, edit `sdk/org/libs/css/src/tokens/tokens.json` then `pnpm --filter @lmthing/css generate` — never hand-edit `theme.css`. Hard gate: `pnpm lint:tokens` (root) and CI (`.github/workflows/design-tokens.yml`) fail on violations. Rules, tokens, components → [`org/docs/design-system/`](./org/docs/design-system/README.md).

## Task Index

Working on… → open the `org/docs` page that owns it.

| Working on… | Read |
|---|---|
| **frontend styling** — tokens, Tailwind utilities, component CSS, theming (MANDATORY) | [design-system/](./org/docs/design-system/README.md) · [tokens](./org/docs/design-system/tokens.md) · [components](./org/docs/design-system/components.md) |
| **the on-disk FORMAT you author** — a project (`database/ api/ pages/ components/ hooks/ events/ spaces/`) or a space (`agents/ functions/ components/ tasklists/ knowledge/ events/`) | [format/](./org/docs/format/README.md) · [format/project/](./org/docs/format/project/README.md) · [format/space/](./org/docs/format/space/README.md) |
| **agent runtime globals** — `ask`/`display`/`fork`/`delegate`/`tasklist`, `db.*`, `writeTableSchema`/`writeApi`/`writePage`/`writeHook`, `emitEvent`, `installSpace`, `callConnection`, the capability gate | [runtime-globals/](./org/docs/runtime-globals/README.md) |
| **the core runtime** — turn/eval loop, typecheck+DTS, forks, delegation, space loading, sessions | [runtime/](./org/docs/runtime/README.md) |
| **events, hooks & integrations** — `events/*` emitter defs (webhook/cron/db/internal), event hooks, integration spaces as event sources | [format/space/events/](./org/docs/format/space/events/README.md) · [format/project/hooks/](./org/docs/format/project/hooks/README.md) · [runtime-globals/events-and-integrations](./org/docs/runtime-globals/events-and-integrations.md) |
| **the store + consent** — installing spaces/apps, `installSpace`, the consent card | [runtime-globals/store-and-consent](./org/docs/runtime-globals/store-and-consent.md) · [cli-api/rest/apps](./org/docs/cli-api/rest/apps.md) · [cli-api/rest/store-spaces](./org/docs/cli-api/rest/store-spaces.md) |
| **the `lmthing` CLI + the pod REST/WS API** — commands, flags, every `/api/*` route | [cli-api/](./org/docs/cli-api/README.md) · [cli-api/rest/](./org/docs/cli-api/rest/README.md) |
| **a product surface** — routes, features, views | [chat/](./org/docs/chat/README.md) · [studio/](./org/docs/studio/README.md) · [computer/](./org/docs/computer/README.md) · [app/](./org/docs/app/README.md) (served project-app) |
| **the backend** — gateway routes, auth/SSO/tokens, billing & tiers, LiteLLM, the render service | [cloud/](./org/docs/cloud/README.md) · [routes](./org/docs/cloud/routes.md) · [auth](./org/docs/cloud/auth.md) · [billing-and-tiers](./org/docs/cloud/billing-and-tiers.md) · [litellm](./org/docs/cloud/litellm.md) |
| **agent web search** — `webSearch`/`webFetch` and the render service | [cloud/render.md](./org/docs/cloud/render.md) |
| **shared libraries** — `@lmthing/state` (VFS), `ui`, `css`, `auth` | [libs/](./org/docs/libs/README.md) |
| **the shipped system spaces** (THING, architect, appbuilder, …) | [system-spaces/](./org/docs/system-spaces/README.md) |
| **a product SPA** (`com social team store space blog casa`) | [product-spas/](./org/docs/product-spas/README.md) |
| **infra, deploy, local stack** — k8s, ArgoCD, CI, image builds | [devops/](./org/docs/devops/README.md) · [infrastructure](./org/docs/devops/infrastructure.md) · [deploy](./org/docs/devops/deploy.md) · [local-dev](./org/docs/devops/local-dev.md) |
| **making a change** — add a global / space / provider / tier; testing, debugging | [contributing/](./org/docs/contributing/README.md) |
| **the whole system** — domain map, pod model, end-to-end data flow | [architecture.md](./org/docs/architecture.md) |

## Kubernetes cluster (production) — practical

Use the helpers in `devops/scripts/` — they find the SSH key, fix its permissions, and quote
arguments so jsonpath braces survive the trip to the remote shell.

```bash
./devops/scripts/cluster-ssh.sh                          # interactive shell on the node
./devops/scripts/cluster-ssh.sh 'df -h'                  # or run one command

./devops/scripts/cluster-kubectl.sh get deployments --all-namespaces -o wide
./devops/scripts/cluster-kubectl.sh get pods -n lmthing -l app=org

./devops/scripts/cluster-logs.sh gateway                 # follow logs (-n lmthing)
./devops/scripts/cluster-logs.sh org --tail=200

./devops/scripts/cluster-restart.sh gateway              # restart + wait for rollout
./devops/scripts/cluster-restart.sh --all-user-pods      # blunt fallback; prompts first
```

The key is **terraform output, so it is gitignored** and absent from a fresh clone. The scripts search
`devops/terraform/generated/`, then `~/GEANT/lmthing/devops/terraform/generated/`, then `~/.ssh/`;
override with `LMTHING_SSH_KEY=/path/to/key.pem` (and `LMTHING_SSH_HOST` for a different node). If none
is found, run `terraform apply` in `devops/terraform` to regenerate it.

> Quote any kubectl arg containing `[` `]` or `{` `}` — **your local shell expands it first**
> (zsh errors with `no matches found`). `-o 'jsonpath={.items[*].metadata.name}'`, not bare.

What lives in which namespace, the routing model, per-user pods and scale-to-zero → [`org/docs/devops/infrastructure.md`](./org/docs/devops/infrastructure.md).

## Testing on production / creating a test user — practical

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

Open problems live in [`.issues/`](./.issues) (CI/ArgoCD deploy flakiness, Zitadel login).
