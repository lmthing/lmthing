# Running the local stack

Everything you need to bring up lmthing on your machine: the frontend dev servers, the `*.test` HTTPS reverse proxy, local demo auth, and (optionally) a full local backend + compute pod on minikube. All targets are defined in the root [`Makefile`](../../Makefile) and driven by [`services.yaml`](../../services.yaml). For test-writing conventions once the stack is up, see [../contributing/testing.md](../contributing/testing.md).

## Quick start (frontend only)

```bash
make install     # git submodule update --init --recursive && pnpm install
make proxy        # nginx + mkcert + /etc/hosts for *.test (sudo)
make up           # start every Vite dev server in parallel
```

`make install` initializes submodules first, then installs the whole workspace (`Makefile:42-44`). `make up` frees the configured ports and launches each service (`Makefile:18-25`); `make down` kills them (`Makefile:28-31`).

To run just the unified Studio/Computer/Chat SPA without the proxy or the rest of the apps:

```bash
cd sdk/org/apps/web && pnpm dev
```

The unified app's package is `@lmthing/web-app` (`sdk/org/apps/web/package.json:2`); its `dev` script is `vp dev` (vite-plus) (`sdk/org/apps/web/package.json:8`). `/studio`, `/computer`, and `/chat` are client-side routes of this single SPA, not separate packages (see [CLAUDE.md](../../CLAUDE.md) Repository Structure and [../../sdk/org/CLAUDE.md](../../sdk/org/CLAUDE.md) "App Surfaces").

> UNVERIFIED (searched `services.yaml`, `Makefile`, repo root `ls`): `services.yaml` lists `studio`/`chat`/`computer` as `type: vite` services on ports 3000/3001/3010, and `make up` runs `cd <name> && pnpm dev` for each (`Makefile:23`) — but there are **no** top-level `studio/`, `chat/`, or `computer/` directories in the repo (the unified SPA lives at `sdk/org/apps/web/`). So `make up`'s `cd studio` etc. cannot start those three, and the root `package.json` `dev`/`build` scripts (`pnpm --filter ./studio …`, `package.json:8-14`) reference a non-existent `./studio` filter. Run the unified SPA directly via `cd sdk/org/apps/web && pnpm dev`. How the three proxied domains are meant to map onto the one unified dev server locally is not resolved in code.

## Service ports & domains

Defined in [`services.yaml`](../../services.yaml). Each entry has a `name`, `type`, production `domain`, local `.test` domain, and `port`.

| Service | Type | Port | Local domain | Prod domain | Source |
|---|---|---|---|---|---|
| studio | vite | 3000 | studio.test | lmthing.studio | `services.yaml:2-8` |
| chat | vite | 3001 | chat.test | lmthing.chat | `services.yaml:10-19` |
| com | vite | 3002 | com.test | lmthing.com | `services.yaml:21-27` |
| social | vite | 3003 | social.test | lmthing.social | `services.yaml:29-35` |
| store | vite | 3004 | store.test | lmthing.store | `services.yaml:37-43` |
| space | vite | 3005 | space.test | lmthing.space | `services.yaml:45-51` |
| team | vite | 3006 | team.test | lmthing.team | `services.yaml:53-59` |
| blog | vite | 3007 | blog.test | lmthing.blog | `services.yaml:61-67` |
| casa | vite | 3008 | casa.test | lmthing.casa | `services.yaml:69-75` |
| cloud | gateway | 3009 | cloud.test | lmthing.cloud | `services.yaml:77-83` |
| computer | vite | 3010 | computer.test | lmthing.computer | `services.yaml:85-96` |

Notes grounded in the config:

- **`chat` and `computer` carry extra CORS/isolation headers** (`Cross-Origin-Embedder-Policy: credentialless`, `Cross-Origin-Opener-Policy: same-origin`; `computer` adds `Cross-Origin-Resource-Policy: cross-origin`) (`services.yaml:17-19`, `services.yaml:93-96`). The proxy injects these as nginx `add_header … always` directives (`local-proxy.sh:53-56`, `:304`).
- **`computer` has an `api_gateway_port: 3009`** (`services.yaml:90`). This makes the proxy split its nginx block: `/api/*` → the gateway on 3009, everything else → the Vite server on 3010 (`local-proxy.sh:269-305`).
- **`cloud` is `type: gateway`, not `vite`** (`services.yaml:78`). `make up` only starts `VITE_SERVICES`; the gateway is started separately (see `local-up` below). The Makefile splits services by type via `awk` on `services.yaml` (`Makefile:5-7`).
- Vite servers have no hard-coded port in `createViteConfig` (`sdk/org/libs/utils/src/vite.mjs:160-163`); `make up` passes `--port <port> --strictPort` per service (`Makefile:23`). The config does set `server.allowedHosts: ['.test']` so the `*.test` proxy hostnames are accepted (`sdk/org/libs/utils/src/vite.mjs:161`).

## Make targets

| Target | What it does | Source |
|---|---|---|
| `make install` | `git submodule update --init --recursive` then `pnpm install` | `Makefile:42-44` |
| `make up` | Free all service ports, start every Vite service in parallel (colored/emoji-prefixed log lines) | `Makefile:18-25` |
| `make down` | `fuser -k <port>/tcp` for every service | `Makefile:28-31` |
| `make proxy` | Run `.etc/scripts/local-proxy.sh` (nginx + mkcert + `/etc/hosts`) | `Makefile:34-35` |
| `make proxy-clean` | `local-proxy.sh --clean` — remove hosts entries, nginx confs, certs | `Makefile:38-39` |
| `make check` | Health-check all `lmthing.*` domains (DNS, TLS, HTTPS, hosting) via `.etc/scripts/check-domains.sh` | `Makefile:47-48` |
| `make show-cost` | Azure cost breakdown for the month (needs `az` login) | `Makefile:51-52` |
| `make show-resources` | Azure resources by group + VM power state | `Makefile:55-56` |
| `make local-k8s-setup` | Start minikube (`--driver=docker --cpus=4 --memory=4096`), apply compute RBAC, print minikube IP | `Makefile:62-67` |
| `make local-compute-image` | Build the compute pod image from `sdk/org/` and load it into minikube | `Makefile:71-75` |
| `make local-up` | Full local stack: Postgres + LiteLLM (compose) → `kubectl proxy :8001` → gateway on 3009 → `make up` | `Makefile:82-90` |
| `make local-down` | Stop everything `local-up` started (`make down`, kill `kubectl proxy`/gateway, `docker compose down`) | `Makefile:93-97` |
| `make local-pods` | `kubectl get pods -A -l app=compute` | `Makefile:100-101` |
| `make local-pod-logs USER_ID=…` | Tail a compute pod's logs (`user-<id>` namespace) | `Makefile:104-105` |
| `make local-compute-env [USER_ID=…]` | Seed the `user-env` secret for a compute pod from `devops/local/.env.local` and restart it | `Makefile:110-125` |
| `make local-compute-dev` | Run the compute server from source on the host with auto-reload (tsup `--watch` + `node --watch`) on port 18080 | `Makefile:131-136` |

## The `*.test` nginx proxy

`make proxy` runs [`.etc/scripts/local-proxy.sh`](../../.etc/scripts/local-proxy.sh), a 5-step setup that reads `services.yaml` and maps each `local` domain to its `port` over **HTTPS** (not plain HTTP). It parses each service's `name`/`domain`/`local`/`port`/`api_gateway_port`/`headers` from the YAML (`local-proxy.sh:38-78`).

1. **nginx** — installs it if missing (`apt-get` on Linux, `brew` on macOS) (`local-proxy.sh:152-171`).
2. **TLS via mkcert** — installs `mkcert` if absent, installs the local CA into the system trust store, and generates one certificate covering all `.test` domains at `.etc/certs/local.pem` (regenerated when the domain set changes) (`local-proxy.sh:173-230`).
3. **`/etc/hosts`** — appends `127.0.0.1 <domain>` for each service (idempotent; skips existing lines) (`local-proxy.sh:232-246`).
4. **nginx server blocks** — writes one config per domain: a `:80` → `:443` redirect plus a `:443 ssl` server that `proxy_pass`es to the Vite port, forwarding standard headers and the WebSocket `Upgrade`/`Connection` headers for HMR (`local-proxy.sh:248-345`). Services with `api_gateway_port` get a split block (`/api/` → gateway, `/` → Vite) (`local-proxy.sh:269-305`); per-service `headers:` become `add_header … always` inside the `location /` block (`local-proxy.sh:304`).
5. **Validate & restart** — `nginx -t` then restart (`brew services restart nginx` / `sudo systemctl restart nginx`) (`local-proxy.sh:347-356`).

The script is idempotent (re-running skips already-added hosts entries but always regenerates nginx confs to guarantee HTTPS) and needs sudo for `/etc/hosts` and nginx config writes (`local-proxy.sh:102-109`). On Linux it writes to `/etc/nginx/sites-available` and symlinks into `sites-enabled`; on macOS to `$(brew --prefix)/etc/nginx/servers` (`local-proxy.sh:86-100`).

`make proxy-clean` (`local-proxy.sh --clean`) removes each domain's `/etc/hosts` line and nginx conf, deletes `.etc/certs/`, and restarts nginx (`local-proxy.sh:112-145`).

## Local demo / no-auth mode

There is **no** `.env.development` / `VITE_DEMO_USER` file shipped in the app — demo auth is automatic. `@lmthing/auth`'s `AuthProvider` treats the session as demo when either the build-time `VITE_DEMO_USER === 'true'` **or** `isLocalRun()` is true (`sdk/org/libs/auth/src/AuthProvider.tsx:37-41`). `isLocalRun()` returns true when the page hostname is `localhost`, `127.0.0.1`, `0.0.0.0`, or ends with `.test` (`sdk/org/libs/auth/src/client.ts:248-252`). So visiting any `*.test` proxy domain (or `localhost`) skips the SSO wall and the pod-ensure gate, and a hardcoded demo session is used:

```ts
const DEMO_SESSION: AuthSession = {
  accessToken: 'demo',
  userId: 'demo-user',
  email: 'demo@lmthing.local',
  githubRepo: null,
  githubUsername: null,
}
```

(`sdk/org/libs/auth/src/AuthProvider.tsx:27-33`.) Tier detection likewise short-circuits when `accessToken === 'demo'` or `VITE_DEMO_USER` is set (`sdk/org/apps/web/src/lib/runtime/use-tier-detection.ts:10`, `:34`). Production hostnames (`lmthing.*`) return `false` from `isLocalRun()`, so real gateway auth is unaffected (`sdk/org/libs/auth/src/client.ts:245-246`).

In dev, `AuthProvider` also points the com/cloud URLs at the local proxy: `com.test` / `cloud.test` when `import.meta.env.DEV` (overridable with `VITE_COM_URL` / `VITE_CLOUD_URL`) (`sdk/org/libs/auth/src/AuthProvider.tsx:11-18`).

## Full local backend + compute pod (minikube)

For work that needs the real gateway, Postgres, LiteLLM, and a compute pod, use the `local-*` targets. Config lives in [`devops/local/`](../../devops/local/).

One-time / rebuild steps:

```bash
make local-k8s-setup       # minikube + devops/local/k8s/compute-rbac.yaml, prints minikube IP
make local-compute-image   # build compute:local from sdk/org/, load into minikube
```

`local-k8s-setup` applies `devops/local/k8s/compute-rbac.yaml` and tells you to copy the printed IP into `cloud/gateway/.env.local` as `MINIKUBE_IP` (`Makefile:62-67`). `local-compute-image` builds `devops/argocd/compute/Dockerfile` with build context `sdk/org/` and tags it `compute:local` — re-run after changing `sdk/org/libs/{core,cli,ui}` (`Makefile:69-75`).

Run the stack:

```bash
make local-up      # Postgres+LiteLLM (compose), kubectl proxy :8001, gateway :3009, all Vite apps
```

`local-up` brings up Docker Compose ([`devops/local/docker-compose.yml`](../../devops/local/docker-compose.yml)) — `postgres:16-alpine` on 5432 (seeded from `cloud/migrations/`) and `litellm v1.90.0` on 4000 (configured by `devops/local/litellm-config.yaml`, keyed from `devops/local/.env.local`) — then `kubectl proxy --port=8001`, then the gateway (`cd cloud/gateway && . ./.env.local && PORT=3009 pnpm dev`), then `make up` (`Makefile:82-90`, `devops/local/docker-compose.yml`).

Two ways to serve compute, selected in `cloud/gateway/.env.local`:

- **Host process (fastest iteration):** `make local-compute-dev` runs the compute server from source with auto-reload on port 18080 (`Makefile:131-136`); set `COMPUTE_LOCAL_URL=http://localhost:18080` in the gateway env to route all pod traffic there (`cloud/gateway/.env.local.example`).
- **minikube pod:** comment out `COMPUTE_LOCAL_URL` and set `COMPUTE_IMAGE=compute:local` + `MINIKUBE_IP=<minikube ip>`; seed the pod's secret with `make local-compute-env USER_ID=<id>` (default `local-dev-user`, `Makefile:110-125`) and tail it with `make local-pod-logs USER_ID=<id>`.

Relevant gateway env (from `cloud/gateway/.env.local.example`): `DATABASE_URL=postgresql://lmthing:lmthing_local@localhost:5432/lmthing`, `LITELLM_URL=http://localhost:4000`, `LITELLM_MASTER_KEY=sk-lmt-local-dev` (must match `devops/local/.env.local`'s `LITELLM_MASTER_KEY`, `devops/local/.env.local.example`). The compute-server model is set via `LM_MODEL=provider:modelId` in `devops/local/.env.local` (`devops/local/.env.local.example`).

`make local-down` reverses it all: `make down`, kill `kubectl proxy` and the gateway, `docker compose down` (`Makefile:93-97`).

## Stack summary

All frontend apps share React 19 + Vite (vite-plus) + TanStack Router + Tailwind v4, wired by `createViteConfig` (`sdk/org/libs/utils/src/vite.mjs:96-168`): it collapses React to one copy, aliases the workspace `@lmthing/{ui,css,state,auth,utils}` libs, injects a shared-favicon plugin, and sets `server.allowedHosts: ['.test']`. The unified SPA depends on `@lmthing/{auth,css,state,ui}` as `workspace:*` (`sdk/org/apps/web/package.json`).

## See also

- [../contributing/testing.md](../contributing/testing.md) — running the test suites
- [./deploy.md](./deploy.md) · [./infrastructure.md](./infrastructure.md) — production deploy and cluster
- [../cli-api/README.md](../cli-api/README.md) — the `lmthing` CLI and pod REST API (compute server run by `local-compute-dev`)
- [../cloud/README.md](../cloud/README.md) — the gateway started by `local-up`
