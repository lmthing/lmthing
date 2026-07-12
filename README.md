# lmthing

A complete platform for building, running, and deploying AI agents. At its center is **THING** — a
super agent that creates knowledge fields, spawns custom agents on demand, and orchestrates them to
solve complex tasks.

The model does not call tools. **The model writes TypeScript**, one statement at a time, and the host
evaluates each statement as it streams in — inside a QuickJS WASM sandbox, against a capability-gated
set of globals.

## Documentation — [`org/docs/`](./org/docs/README.md), published at [lmthing.org](https://lmthing.org)

> **`org/docs/` is the single source of truth for this codebase.** Every factual sentence there ends
> with a citation to the implementation that makes it true (`path:Lstart-Lend`). When a README, a
> `CLAUDE.md`, or a skill disagrees with `org/docs`, **`org/docs` wins**; when `org/docs` disagrees
> with the **code**, the **code** wins and the doc is a bug.
>
> **A code change is not done until the matching `org/docs/` page is updated in the same change** —
> the contract is [`org/docs/SYNC.md`](./org/docs/SYNC.md).

Start here:

| To understand… | Read |
|---|---|
| the whole system — domains, pods, end-to-end data flow | [architecture.md](./org/docs/architecture.md) |
| the on-disk format you author — a **project** or a **space** | [format/](./org/docs/format/README.md) |
| the agent runtime — turn loop, yield protocol, typecheck, forks, delegation | [runtime/](./org/docs/runtime/README.md) |
| the globals an agent can call, and the capabilities that gate them | [runtime-globals/](./org/docs/runtime-globals/README.md) |
| the `lmthing` CLI and the pod REST/WS API | [cli-api/](./org/docs/cli-api/README.md) |
| the backend — gateway routes, auth, billing, LiteLLM | [cloud/](./org/docs/cloud/README.md) |
| infra, deploy, the local stack | [devops/](./org/docs/devops/README.md) |
| making a change (add a global / space / provider / tier; testing, debugging) | [contributing/](./org/docs/contributing/README.md) |

## Getting Started

**Prerequisites:** Node.js ≥ 24 · pnpm ≥ 9 · Git (`package.json:5-7`)

```bash
git clone git@github.com:lmthing/lmthing.git
cd lmthing
git submodule update --init --recursive   # sdk/org is a submodule
pnpm install
```

### The unified web app (no backend)

```bash
cd sdk/org/apps/web && pnpm dev    # /studio, /computer and /chat are client-side routes
```

### Full local stack

Ports, the `*.test` nginx proxy, demo auth and every `make` target are documented in
[`org/docs/devops/local-dev.md`](./org/docs/devops/local-dev.md).

## Repository Structure

The monorepo is organized by TLD — each lmthing.\* domain has its own top-level directory.

```
lmthing/
├── sdk/org/            # git submodule (github.com/lmthing/org) — the runtime + shared libs + the app
│   ├── libs/           # @lmthing/{auth,cli,config,core,css,openclaw-compat,state,ui,utils}
│   └── apps/web/       # the unified Vite SPA: /studio, /computer, /chat
├── cloud/              # THE backend — Hono gateway (/api/*) + LiteLLM (/v1/*)
├── org/                # lmthing.org — the docs site; org/docs/** is the source of truth
├── store/              # lmthing.store SPA + the catalog (store/projects/, store/spaces/)
├── com/ social/ team/ space/ blog/ casa/   # product app shells (static SPAs)
├── devops/             # terraform, ansible, argocd, k8s manifests
├── app-specifications/ # worked example specs for project-apps
└── automation/         # long-running agent harnesses (not part of the product)
```

**There is no separate backend service.** `cloud/` is the sole backend; every frontend is a static SPA
that calls it. Any server-side logic — new endpoints, DB ops, webhooks — belongs in `cloud/gateway/`.

## Key Packages

| Directory | Package | Stack |
|-----------|---------|-------|
| `sdk/org/libs/core/` | `lmthing` | TypeScript · Vercel AI SDK · Zod · **QuickJS WASM** sandbox |
| `sdk/org/libs/cli/` | `@lmthing/cli` | the `lmthing` binary + the per-user pod server |
| `sdk/org/libs/state/` | `@lmthing/state` | React hooks over a virtual file system |
| `sdk/org/libs/ui/`, `libs/css/` | `@lmthing/ui`, `@lmthing/css` | shared React components · the design system |
| `sdk/org/apps/web/` | `@lmthing/web` | React 19 · Vite · TanStack Router · Tailwind 4 |
| `cloud/gateway/` | `@lmthing/gateway` | **Node 24 · Hono** · Stripe |

## Design system — mandatory, enforced

**Never write a raw color** in any web surface (no hex, no literal `rgb()/hsl()`, no stock Tailwind
color utilities like `gray-*`/`blue-*`). Use a design token (`var(--foreground)`, `bg-primary`, …).
Hard gate: `pnpm lint:tokens` and CI. Rules → [`org/docs/design-system/`](./org/docs/design-system/README.md).

## License

See [LICENSE](./LICENSE) for details.
