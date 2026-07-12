---
name: local-dev
description: Load when setting up or running the local dev stack — ports, domains, make targets, the nginx proxy, demo auth, or running an individual app.
---

# Skill: Local Development

Use this when you need to bring the stack up on your machine: the frontend dev servers, the `*.test` HTTPS proxy, local demo auth, or a full local backend (gateway + Postgres + LiteLLM + a compute pod on minikube).

## Read first — the grounded truth

- `org/docs/devops/local-dev.md` — **the** local-stack page: every `make` target, the `services.yaml` port/domain table, how the nginx+mkcert proxy is built, how demo auth engages, and the full minikube backend flow. Read it before touching anything here.
- `org/docs/contributing/testing.md` — running the test suites once the stack is up.
- `org/docs/devops/infrastructure.md` · `org/docs/devops/deploy.md` — the production cluster and deploy (not local).
- `org/docs/cloud/README.md` — the gateway that `make local-up` starts.
- `org/docs/architecture.md` — where state lives, the pod model, which surface runs what.

Ports, domains and make targets are **generated from `services.yaml` + the root `Makefile`** — read those (or the doc above), never a copy in a skill.

## Procedure

Frontend only:

```bash
make install    # git submodule update --init --recursive && pnpm install
make proxy      # nginx + mkcert + /etc/hosts for the *.test domains (needs sudo)
make up         # start the product-SPA Vite dev servers in parallel
make down       # stop them
```

The unified Studio/Computer/Chat SPA is **not** started by `make up` (it has no top-level directory). Run it one of two ways:

```bash
pnpm thing                                  # CLI serves the app + /api + agent WS on one port (http://localhost:8080, override with THING_PORT)
cd sdk/org/apps/web && pnpm dev             # Vite only — no /api backend
```

Locally you reach the surfaces **by path** (`/studio`, `/computer`, `/chat`), not by hostname. Auth is skipped automatically on `localhost` and `*.test` — no env file to create.

Full local backend (gateway + Postgres + LiteLLM + compute):

```bash
make local-k8s-setup       # one-time: minikube + compute RBAC; copy the printed IP into cloud/gateway/.env.local
make local-compute-image   # rebuild after changing sdk/org/libs/{core,cli,ui}
make local-up              # compose + kubectl proxy + gateway :3009 + make up
make local-compute-dev     # alternative: compute server from source on :18080 (set COMPUTE_LOCAL_URL in the gateway env)
make local-down
```

Gotcha worth remembering: `make local-compute-env` takes `LOCAL_USER_ID=` (default `local-dev-user`), while `make local-pod-logs` takes `USER_ID=` and has no default.

Teardown of the proxy: `make proxy-clean`.

## Keep the docs true

GROUND TRUTH IS THE CODE. If you change the implementation, update the matching org/docs page in the same change (see org/docs/SYNC.md).
