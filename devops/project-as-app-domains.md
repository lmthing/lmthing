# Project-as-Application — two-TLD domain routing (Phase 8C)

> **STATUS 2026-07-04: `lmthing.app` is LIVE.** Set up exactly like `lmthing.studio`/`lmthing.chat`
> (`devops/argocd/envoy/app-routes.yaml` + `app-policies.yaml`, gateway `app-http`/`app-https`
> listeners, `lmthing-app-tls` Let's Encrypt cert). Per-user pod routing via the shared
> `rewrite-host-from-header` filter + `dynamic-user-backend`, JWT (`Authorization: Bearer` OR
> `?access_token=`) → `sub`→`x-user-id` → Lua → `lmthing.user-<id>.svc:8080`. Paths pass through
> unchanged (like chat's `/api` proxy), so the app surface is reached at `lmthing.app/app/<project>/…`.
> Verified: HTTP→HTTPS 301, valid TLS, and `401 "Jwt is missing"` without a token (auth layer live).
> **Remaining (optional):** (1) if the clean root-anchored URL `lmthing.app/<project>/` (→ pod
> `/app/<project>/`) is wanted instead of `lmthing.app/app/<project>/`, add a `ReplacePrefixMatch /app`
> URLRewrite to `app-proxy`. (2) `lmthing.studio` same-origin `/app/*` preview passthrough is not yet
> wired (studio currently proxies only `/api/*`). (3) the browser token-handoff (how a top-level nav
> gets the `access_token`) rides the same self-auth flow the chat/studio SPAs use.

---


> The project-app **engine** (db/api/typed-contracts/pages/hooks/chat + the Studio management
> API) is fully built and validated locally (`localhost:8080/{studio, app/<project>, api}` all
> coexist, browser-verified). This task stands up the two public domains that proxy the SAME pod,
> per `sdk/org/project-as-application.md` §"Serving & domains". Per the plan: **build the engine
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
- Engine + route table: `sdk/org/project-as-application.md` §"Serving & domains".
- CLI serve router (already mounts `/app/<project>/api/*`, `/app/<project>/*`, `/api/projects/<project>/app…`):
  `sdk/org/libs/cli/src/server/serve.ts`.
- Per-domain routing precedent: the existing `chat`/`studio`/`computer` domain nginx K8s images + Envoy JWT+Lua.
