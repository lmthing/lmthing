# Project-as-Application — two-TLD domain routing (Phase 8C)

> **STATUS 2026-07-04: `lmthing.app` is LIVE.** Set up exactly like `lmthing.studio`/`lmthing.chat`
> (`devops/argocd/envoy/app-routes.yaml` + `app-policies.yaml`, gateway `app-http`/`app-https`
> listeners, `lmthing-app-tls` Let's Encrypt cert):
> - **`/*` → the JWT-FREE unified-SPA shell** (`app-static` → the shared `studio` Service) — it
>   renders the **login page** when unauthenticated and self-authenticates via `@lmthing/auth`. This
>   is why the other domains show login rather than a raw 401; the shell is public.
> - **`/api/*` → per-user pod** (`app-api-proxy` → `dynamic-user-backend` via the shared
>   `rewrite-host-from-header` filter), JWT (`Authorization: Bearer` OR `?access_token=`) →
>   `sub`→`x-user-id` → Lua → `lmthing.user-<id>.svc:8080`.
> Verified live: `/` → 200 (SPA HTML + JWT-free assets), `/api/*` → 401 without a token, HTTP→HTTPS 301,
> valid Let's Encrypt TLS.
> **Remaining (optional, for a DEDICATED app surface):** the SPA has no `/app` surface yet, so
> `surfaceForHost('lmthing.app')` falls back to `/studio` (`apps/web/src/routes/index.tsx`). To make
> `lmthing.app` its own end-user surface that browses/launches installed apps and renders a project's
> pod-served pages (`/app/<project>/…`), add an `/app` route to `apps/web` + `lmthing.app` to
> `HOST_SURFACE`, and (if serving pod pages same-origin) an `app-pages-proxy` for `/app/*` → pod
> alongside `/api/*`. `lmthing.studio` `/app/*` preview passthrough is likewise not yet wired.

---


> The project-app **engine** (db/api/typed-contracts/pages/hooks/chat + the Studio management
> API) is fully built and validated locally (`localhost:8080/{studio, app/<project>, api}` all
> coexist, browser-verified). This task stands up the two public domains that proxy the SAME pod,
> per `org/app/routes.md` (serving & domains). Per the plan: **build the engine
> locally first (done); stand up the domains last.**

## Goal — one pod, two Host-anchored TLD aliases (both proxy the same pod)

| Public URL | → pod path |
|---|---|
| `lmthing.app/` · `lmthing.app/<project>/…` | `/app/` · `/app/<project>/…` |
| `lmthing.app/<project>/api/<name>` | `/app/<project>/api/<name>` |
| `lmthing.studio/` | `/studio` (client-side routed) |
| `lmthing.studio/app/<project>/…` | `/app/<project>/…` (same-origin preview) |
| `lmthing.studio/api/projects/<project>/app…` | `/api/projects/<project>/app…` (management) |

- **`lmthing.app` is root-anchored to `/app`** — `lmthing.app/<project>/…` → pod `/app/<project>/…`.
  It reaches an app's pages + its own `/app/<project>/api/*`, but **NO** top-level admin `/api/*`
  (nothing on this host maps there) — **safe by construction**. Auth identifies the user; `<project>`
  selects a project within that user's pod.
- **`lmthing.studio`** passes `/app/*` and `/api/*` through UNCHANGED and maps `/` → the Studio
  surface, so Studio previews a running app same-origin at `lmthing.studio/app/<project>/…`.

## Work items (net-new infra — mirrors the existing per-domain nginx/Envoy setup)
1. **DNS + TLS** — `lmthing.app`, `lmthing.studio` A/AAAA → the cluster LB; cert-manager certs.
2. **Envoy Gateway** — add HTTPRoutes for the two hosts. `lmthing.app`: rewrite `/<rest>` → `/app/<rest>`
   at the pod; do NOT expose `/api/*`. `lmthing.studio`: pass `/app/*` + `/api/*` through; `/` → Studio.
   Both are **per-user pod-routed** for `/app/*` + `/api/*` (Envoy JWT + the Lua per-user routing the
   existing `chat`/`studio`/`computer` domains use — see `.claude/skills/authentication.md` + devops).
3. **nginx images** — `lmthing.app` is dynamic (pod-routed), so it has NO static shell of its own;
   `lmthing.studio` serves the Studio SPA shell statically for `/` and pod-routes `/app/*`+`/api/*`.
4. **CSP** — served app pages already carry a strict CSP (Phase 5B, `app/pages-serve.ts`); the
   `lmthing.studio/app/*` preview is the one same-origin XSS-sensitive spot (spec §Safety). Optional
   hardening: point the Studio preview iframe at the `lmthing.app` origin.
5. **Validate** — `curl -H 'Host: lmthing.app' …/<project>/api/<name>` reaches the app api but a
   top-level `/api/*` 404s; `lmthing.studio/app/<project>/` renders byte-identical to the CLI.

## Reference
- Engine + route table: `org/app/routes.md` (serving & domains).
- CLI serve router (already mounts `/app/<project>/api/*`, `/app/<project>/*`, `/api/projects/<project>/app…`):
  `sdk/org/libs/cli/src/server/serve.ts`.
- Per-domain routing precedent: the existing `chat`/`studio`/`computer` domain nginx K8s images + Envoy JWT+Lua.
