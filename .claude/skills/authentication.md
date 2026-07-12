---
name: authentication
description: Load when working on auth flows, SSO, GitHub OAuth, gateway auth routes, or gateway JWT/token issuance.
---

# Authentication

Use this skill when you touch anything that establishes or verifies identity: the gateway's `/api/auth/*` routes, gateway JWT signing/verification, Zitadel (users, passwords, GitHub OAuth), cross-domain SSO between the lmthing.\* SPAs, the `@lmthing/auth` client library, or the demo/local-dev auth bypass.

This file holds **no knowledge** — the grounded, code-cited truth lives in `org/docs/`.

## Read first

| You need… | Read |
|---|---|
| Token shape + signing, auth middleware, register/login/OAuth/refresh, SSO codes, API keys, auth env vars | **`org/docs/cloud/auth.md`** (start here — it owns this topic) |
| The full `/api/*` route table (method, handler line, auth requirement) | `org/docs/cloud/routes.md` |
| The `@lmthing/auth` client library — `AuthProvider`, `useAuth`, session storage, `authFetch` | `org/docs/libs/auth.md` |
| Demo mode, the `*.test` proxy, running the stack locally | `org/docs/devops/local-dev.md` |
| Tiers, budgets, provisioning (what `/provision` sets up) | `org/docs/cloud/billing-and-tiers.md` |
| The backend as a whole | `org/docs/cloud/README.md` |

**Known-broken:** `POST /api/auth/login` fails in production (Zitadel password grant disabled). Root cause and the mint-a-JWT workaround: `.issues/zitadel-password-login-disabled.md`. Do not assume password login works when writing or testing a flow — GitHub OAuth is unaffected.

## Procedure — add auth to a new SPA

1. Add the dependency:

   ```bash
   cd your-app/
   pnpm add "@lmthing/auth@workspace:*"
   ```

2. Wrap the app in `AuthProvider` (`appName` is required; `callbackPath` defaults to `/`) and gate your routes on `isAuthenticated` / `isLoading` from `useAuth()`. Exact prop and context shapes: `org/docs/libs/auth.md`.

3. Call cloud APIs with `authFetch` from `@lmthing/auth` — it attaches the Bearer token, refreshes on `401`, and retries the scaled-to-zero pod wake response. Do not hand-roll the `Authorization` header.

4. **No Vite alias step is needed.** `@lmthing/auth` is already aliased centrally in `sdk/org/libs/utils/src/vite.mjs`; consume the shared Vite config rather than adding your own alias.

5. Verify locally in demo mode (no real login), then against the real gateway. Setup: `org/docs/devops/local-dev.md`.

## Procedure — get a session on production (testing)

Password login is broken, so mint a gateway HS256 JWT by hand and inject it into `localStorage.lmthing_session`. Step-by-step (secret source, claim shape, session shape): the callout in `org/docs/cloud/auth.md` plus `.issues/zitadel-password-login-disabled.md`.

## Keep the docs true

GROUND TRUTH IS THE CODE. If you change the implementation, update the matching org/docs page in the same change (see `org/docs/SYNC.md`).
