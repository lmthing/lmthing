# Product SPAs — `com` `social` `team` `store` `space` `blog` `casa`

The seven product **domain shells** at the monorepo root. Each maps to one `lmthing.<tld>`
domain, is an independent **static SPA** built with Vite, and talks to the backend only over
HTTP to the `cloud/` gateway — there is no per-SPA server. They are distinct from the unified
studio/chat/computer app (`sdk/org/apps/web/`, documented under [../studio/](../studio/README.md),
[../chat/](../chat/README.md), [../computer/](../computer/README.md)).

Only **`com`, `store`, and `space`** are substantively built. **`social`, `team`, `blog`, `casa`** are
route scaffolds whose pages render a title placeholder — on the `com` landing they are all flagged
`upcoming: true` (`com/src/routes/index.tsx:82,95,108,121`). The tables below reflect the shipped
routes (`src/routeTree.gen.ts`).

## Shared foundation (all seven)

Every SPA has the identical stack and build, differing only in `name` and routes.

- **Stack** — React 19 + Vite 8 + TanStack Router (file-based) + Tailwind CSS v4 via
  `@tailwindcss/vite`; scripts run through `vite-plus` (`vp dev|build|preview|test`). See any
  `package.json`, e.g. `com/package.json:7-13,14-40`. Routes are files under `src/routes/`, compiled
  to `src/routeTree.gen.ts` by `@tanstack/router-plugin`.
- **Shared workspace libs** — all depend on `@lmthing/{css,state,ui}` (`workspace:*`); `space`
  additionally depends on `@lmthing/auth` and the `@xterm/*` terminal packages
  (`space/package.json:14-31`). `@lmthing/utils` (dev dep) supplies the shared Vite config.
- **One Vite config** — each `vite.config.ts` is just `createViteConfig(__dirname)`
  (`com/vite.config.ts`), the shared factory in `sdk/org/libs/utils/src/vite.mjs`. It wires the
  TanStack router plugin, React, Tailwind, a shared-favicon plugin, a GitHub-Pages `404.html` copy,
  aliases every `@lmthing/*` import to the submodule's `libs/*/src` sources, dedupes React, and stubs
  the server-only `@ai-sdk/*`/`vm2` packages so the browser bundle builds
  (`sdk/org/libs/utils/src/vite.mjs`, `createViteConfig`). `store` passes an extra plugin (below).
- **Design system (mandatory, enforced)** — every SPA uses `@lmthing/css` tokens + `@lmthing/ui`
  and must never write a raw color; enforced by `pnpm lint:tokens` (a hard CI gate). Each
  `CLAUDE.md` restates the rule (e.g. `social/CLAUDE.md` "Design system"). Full spec →
  [../design-system/README.md](../design-system/README.md).
- **Auth** — SPAs authenticate against the `cloud/` gateway; no direct identity-provider client.
  `com` is the central auth + billing hub and ships its own `src/lib/cloud.ts` client + an
  `AuthProvider` (`com/CLAUDE.md` "Key Modules"); other SPAs consume the shared `@lmthing/auth`
  package (`useAuth`, `getAuthHeaders`, `redirectToLogin`, session helpers —
  `sdk/org/libs/auth/src/index.ts:1-5`). Cross-domain SSO bounces through `com`'s `/auth/sso`
  handler. Full flows → [../cloud/README.md](../cloud/README.md), [../libs/auth.md](../libs/auth.md).
- **Backend target** — the gateway base URL comes from `VITE_CLOUD_URL`, defaulting to
  `https://lmthing.cloud` (`com/src/lib/cloud.ts#CLOUD_URL`). `space` targets the Supabase-style edge-function
  base `…/functions/v1` (dev `cloud.test`, prod `lmthing.cloud`) instead
  (`space/src/lib/api.ts#CLOUD_URL`).
- **Static serving** — each SPA builds to `dist/` and ships as an nginx image (multi-stage
  `Dockerfile`, `com/Dockerfile`). nginx serves `/index.html` with `no-cache` and hashed `/assets/`
  with a 1-year immutable cache, falling back all unknown paths to the SPA shell (`com/nginx.conf`).
  In production each domain is its own K8s deployment in the `lmthing` namespace (see
  [../devops/README.md](../devops/README.md)).

## Implementation status

| SPA | Domain | Purpose | Built? |
|---|---|---|---|
| `com` | lmthing.com | Landing + central auth + billing hub | Yes |
| `store` | lmthing.store | Project-app + integration (space) catalog | Yes (browse only) |
| `space` | lmthing.space | Space directory + admin dashboard | Yes |
| `social` | lmthing.social | Public multi-agent "hive mind" feed | Scaffold |
| `team` | lmthing.team | Private agent rooms | Scaffold |
| `blog` | lmthing.blog | Personalized AI news | Scaffold |
| `casa` | lmthing.casa | Home Assistant integration | Scaffold |

---

## `com` — lmthing.com (auth + billing + landing)

The commercial landing page and the **centralized authentication + billing surface**; other domains
redirect here for login/signup and cross-domain SSO (`com/CLAUDE.md` "What This Is").

**Landing** (`com/src/routes/index.tsx`) presents nine `lmthing.*` services. The three live surfaces
of the unified app come first — `studio` ("Build AI agents visually"), `chat` ("Your personal
THING"), `computer` ("Full runtime, zero setup") — then `space` and `store`; `social`, `team`,
`blog`, `casa` render as `upcoming: true` ("coming soon") cards
(`com/src/routes/index.tsx#services,236`).

Routes (`com/src/routeTree.gen.ts`):

| Route | Purpose |
|---|---|
| `/` | Landing page (`index.tsx`) |
| `/about`, `/docs` | About + documentation |
| `/pricing` | Plan comparison, 4 tiers (`pricing.tsx`, data from `src/config/plans.ts`) |
| `/login`, `/signup` | **GitHub OAuth only** — a single "Continue with GitHub" button; no email/password form is rendered (`com/src/routes/login.tsx#Login,38-43`, `com/src/routes/signup.tsx#Signup,33`) |
| `/forgot-password`, `/reset-password` | **Redirect stubs** — both `useEffect`-navigate to `/login` ("Password reset is not available with GitHub-only authentication"), `com/src/routes/forgot-password.tsx:8-17`, `com/src/routes/reset-password.tsx:8-17` |
| `/callback` | OAuth callback — reads `#access_token/refresh_token/expires_at` from the hash, stores them, then calls `provision()` (`com/src/routes/callback.tsx:15-36`) |
| `/auth/sso` | Cross-domain SSO code issuer (`redirect_uri`/`app`/`state` params) |
| `/onboarding` | Post-signup repo + PIN setup |
| `/checkout` | Stripe Embedded Checkout (`@stripe/react-stripe-js`) |
| `/account`, `/account/keys` | Profile + API-key management (protected) |
| `/billing`, `/billing/usage` | Subscription status + token-budget usage (protected) |

- **`src/lib/cloud.ts`** — typed gateway client with JWT storage (`lmt_access_token` /
  `lmt_refresh_token` / `lmt_expires_at` in `localStorage`) and automatic refresh via
  `POST /api/auth/refresh` on a 60s-buffered expiry check; split into `cloudFetch()` (authed) and
  `cloudFetchPublic()` (`com/src/lib/cloud.ts#CLOUD_URL,4-6,28-32,46,65,86`). It wraps 15 gateway endpoints,
  every one of which resolves to a real handler on the gateway routers:

  | `cloud.ts` wrapper | Endpoint | Gateway | Reached from |
  |---|---|---|---|
  | `register()` | `POST /api/auth/register` | `cloud/gateway/src/routes/auth.ts:62` | `AuthProvider.signUp` — **no UI caller** |
  | `login()` | `POST /api/auth/login` | `auth.ts:94` | `AuthProvider.signIn` — **no UI caller** |
  | `getOAuthUrl()` | `GET /api/auth/oauth/url` | `auth.ts:121` | `signInWithGitHub` (`/login`, `/signup`) |
  | `provision()` | `POST /api/auth/provision` | `auth.ts:173` | `/callback` |
  | `getMe()` | `GET /api/auth/me` | `auth.ts:186` | `AuthProvider` |
  | (inline refresh) | `POST /api/auth/refresh` | `auth.ts:208` | `ensureValidToken()` |
  | `createSsoCode()` | `POST /api/auth/sso/create` | `auth.ts:236` | `/auth/sso` |
  | `exchangeSsoCode()` | `POST /api/auth/sso/exchange` | `auth.ts:261` | **unused in `com`** — other SPAs exchange via `sdk/org/libs/auth/src/client.ts:63` |
  | `listApiKeys/createApiKey/revokeApiKey()` | `GET/POST /api/keys`, `DELETE /api/keys/:token` | `keys.ts:12,32,62` | `/account/keys` |
  | `createCheckout/getCheckoutStatus()` | `POST /api/billing/checkout`, `GET /api/billing/checkout/status` | `billing.ts:63,205` | `/checkout` |
  | `billingPortal()` | `POST /api/billing/portal` | `billing.ts:99` | `/billing` |
  | `getUsage()` | `GET /api/billing/usage` | `billing.ts:115` | `/billing/usage` |

  Two wrappers are **dead code today**: `register()`/`login()` (email/password) are exposed through
  `AuthProvider.signUp`/`signIn` but no route renders a password form (`/login` and `/signup` are
  GitHub-only, above), and `exchangeSsoCode()` has no importer in `com`. Route-level detail →
  [../cloud/routes.md](../cloud/routes.md).
- **`src/lib/auth/AuthProvider.tsx`** — `useAuth()` context (`user`, `loading`, `signIn`, `signUp`,
  `signOut`, `signInWithGitHub/Google`, `setSessionFromOAuth`) built on `cloud.ts`
  (`com/src/lib/auth/AuthProvider.tsx:2-9,20-24,52-77`); `com` does **not** use the shared
  `@lmthing/auth` package (it is not in `com/package.json`). `signInWithGoogle` is implemented
  (`AuthProvider.tsx:75-77`) but no route renders a Google button — only `signInWithGitHub` is
  destructured by `/login` and `/signup`.
- **`src/config/plans.ts`** — frontend plan metadata for 4 tiers (Free/Basic/Pro/Max) with budget
  windows; a display mirror of `cloud/gateway/src/lib/tiers.ts` and only one of ~10 files a new tier
  touches (`com/src/config/plans.ts:1-2,14`). Tier checklist → [../cloud/billing-and-tiers.md](../cloud/billing-and-tiers.md).

## `store` — lmthing.store (catalog)

The public browse surface for two catalogs. **All install/publish is authenticated and happens on
the user's compute pod, not here** — the static store only browses (`store/CLAUDE.md`).

Routes (`store/src/routeTree.gen.ts`):

| Route | Purpose | Built? |
|---|---|---|
| `/` | Landing (data-backed / pages+API / automated) (`index.tsx`) | Yes |
| `/projects`, `/projects/$appId` | Project-app catalog browse + detail | Yes |
| `/spaces`, `/spaces/$spaceId` | Integration (store space) catalog browse + detail | Yes |
| `/agent/$agentId` | Agent listing | Scaffold (`agent/$agentId.tsx`, title only) |
| `/category/$categoryId` | Category browse | Scaffold |
| `/publish` | Seller publish | Scaffold (`publish.tsx`, title only) |

- **Project-app catalog** — `projects/<id>/` holds one full on-disk app template each (`blog`,
  `health`, `kitchen`, `trips`, `demo-feed`), and `projects/manifest.json` is the generated browse
  index. The manifest is regenerated + templates copied into `dist/projects/` on every build by the
  `lmthing-apps-manifest` Vite plugin passed into `createViteConfig`
  (`store/vite.config.ts`, `appsManifestPlugin` → `scripts/gen-apps-manifest.mjs`). Routes read it
  through `src/lib/apps-manifest.ts` (`listCatalogApps`, `getCatalogApp`) —
  `store/src/routes/projects/index.tsx:8`, `store/src/routes/projects/$appId.tsx:10`. Format +
  runtime → [../format/project/README.md](../format/project/README.md), [../app/README.md](../app/README.md).
- **Integrations** — the `/spaces` routes list store spaces (event-source integrations) via
  `listCatalogIntegrations()` (`store/src/routes/spaces/index.tsx:8,14`).
- **Install hand-off** — the detail page's install action builds an `installUrlForApp(...)` that
  bounces to the authenticated lmthing.app page (`store/src/lib/pod-api.ts`,
  `store/src/routes/projects/$appId.tsx:11`); the pod CLI server does the actual
  `POST /api/apps/install` (see [../cli-api/README.md](../cli-api/README.md)).
- **nginx caveat** — `store/nginx.conf` deliberately omits `$uri/` from the SPA fallback so the
  copied `dist/projects/` template directories don't 301→403 over client routes.

## `space` — lmthing.space (space directory + admin)

A directory of a user's Spaces plus a per-space admin dashboard. This is the only SPA that renders
live backend state and a terminal.

Routes (`space/src/routeTree.gen.ts`), all space-scoped routes nested under `/$spaceSlug`:

| Route | Purpose |
|---|---|
| `/` | Spaces directory + create-space modal, with status badges (`index.tsx`) |
| `/$spaceSlug` | Space shell (`$spaceSlug/route.tsx` + `index.tsx`) |
| `/$spaceSlug/app`, `/$spaceSlug/app/$page` | End-user app view |
| `/$spaceSlug/admin` | Owner dashboard overview |
| `/$spaceSlug/admin/{builder,agents,pages,database,users,logs,settings}` | Admin sub-tabs |
| `/$spaceSlug/admin/terminal` | PTY over WebSocket (`@xterm/*`) |

- **`src/lib/api.ts`** — typed client hitting the gateway's edge-function base `…/functions/v1`
  (`listSpaces`/`getSpace`/`createSpace`/`updateSpace`/`deleteSpace`/`startSpace`/`stopSpace`, e.g.
  `/list-spaces`, `/create-space`) with `@lmthing/auth`'s `getAuthHeaders()`
  (`space/src/lib/api.ts:1,4-5,11,26-76`).
- **`src/lib/auth.ts`** re-exports `useAuth` from `@lmthing/auth` (`space/src/lib/auth.ts:1`);
  `SpaceContext.tsx` + `types.ts` carry the `Space` shape (statuses: `created`/`provisioning`/
  `running`/`stopped`/`failed`/`destroyed`, `space/src/routes/index.tsx#StatusBadge`).
- **Terminal** — the admin terminal opens a `wss://<appHost>/ws?token=…&spaceId=…` WebSocket for a
  live PTY session (`space/src/routes/$spaceSlug/admin/terminal.tsx:88`).

## Scaffold SPAs — `social` `team` `blog` `casa`

These have real TanStack route trees but placeholder page bodies (each renders a
`<CozyThingText>` title or a stub `<h1>`); no backend calls or feature logic yet. Documented so the
route inventory is complete. A `rg` for `fetch(`, `@lmthing/state`, `@lmthing/auth`, `useAuth` and
`VITE_CLOUD_URL` across `social/src team/src blog/src casa/src` returns **zero hits** — the four
SPAs are 6–8 source files each (route stubs plus `__root.tsx`/`main.tsx`), so there is no VFS, no
auth, and no gateway call anywhere in them.

- **`social`** (lmthing.social) — routes `/`, `/explore`, `/explore/$explorationId`,
  `/profile/$username` (`social/src/routeTree.gen.ts`). Home renders the `lmthing.social` title
  (`social/src/routes/index.tsx`); `/explore` is a stub list (`social/src/routes/explore/index.tsx`).
- **`team`** (lmthing.team) — routes `/`, `/create`, `/room/$roomId`, `/room/$roomId/members`,
  `/room/$roomId/settings` (`team/src/routeTree.gen.ts`); all stub pages
  (`team/src/routes/index.tsx`, `team/src/routes/create.tsx`).
- **`blog`** (lmthing.blog) — routes `/`, `/post/$slug`, `/tag/$tag` (`blog/src/routeTree.gen.ts`);
  stub pages (`blog/src/routes/index.tsx`, `blog/src/routes/post/$slug.tsx`).
- **`casa`** (lmthing.casa) — routes `/`, `/notifications`, `/profile`, `/settings`
  (`casa/src/routeTree.gen.ts`); stub pages (`casa/src/routes/index.tsx`,
  `casa/src/routes/settings.tsx`).

**The unbuilt product visions live in `<domain>/IDEAS.md`.** Each scaffold's original pitch — `social`'s
shared-VFS "hive mind", `team`'s private room context, `blog`'s RSS/web-search agent, `casa`'s Home
Assistant bridge and SLM fine-tuning, plus their pricing models and mermaid route trees — is preserved
there, explicitly marked as unimplemented and non-authoritative. None of it is backed by code, and the
routes it draws do not match the generated ones. Each `<domain>/README.md` describes only what the
shell actually is; the tables in this section are the code.

## See also

- [../architecture.md](../architecture.md) — full product & domain architecture
- [../cloud/README.md](../cloud/README.md) — the gateway/LiteLLM backend every SPA calls
- [../design-system/README.md](../design-system/README.md) — the mandatory shared token system
- [../libs/auth.md](../libs/auth.md) — the shared `@lmthing/auth` package
- [../devops/README.md](../devops/README.md) — per-domain nginx K8s deployment
