# com/ — lmthing.com

Central auth hub and billing surface for all lmthing.* domains: the commercial landing page,
login/signup, cross-domain SSO, pricing, checkout, API keys and usage. A static SPA; all
server-side logic lives in the `cloud/` gateway API.

> **Source of truth:** [`org/docs/`](../org/docs/README.md) (lmthing.org) — every factual claim there
> is cited to code. This file is an orientation index; knowledge does not live here. A code change is
> not done until the matching `org/docs` page is updated in the same change ([SYNC.md](../org/docs/SYNC.md)).

## Stack

React 19 + Vite 7 + TanStack Router (file-based routing) · Tailwind CSS v4 via `@tailwindcss/vite` ·
Stripe Embedded Checkout (`@stripe/react-stripe-js`) · shared libs `@lmthing/ui`, `@lmthing/css`,
`@lmthing/state`, `lmthing` · Vite config from `@lmthing/utils/vite`.

Identity is **Zitadel**, reached only through the gateway (`cloud/gateway/src/lib/zitadel.ts`) — there
is no Supabase and no direct IdP client in this SPA. `src/lib/cloud.ts` is the single API client (JWT
storage + automatic refresh); `src/lib/auth/AuthProvider.tsx` wraps it in a `useAuth()` context.

## Design system (mandatory)

Uses the shared lmthing design system (`@lmthing/css` tokens + `@lmthing/ui`). **Never write a
raw color** (hex, literal `rgb()/hsl()`, or stock Tailwind colors like `gray-*`/`blue-*`/`green-500`);
use a token (`var(--foreground)`, `bg-primary`, `text-agent`, …). To change a color, edit
`sdk/org/libs/css/src/tokens/tokens.json` then `pnpm --filter @lmthing/css generate`. Enforced by
`pnpm lint:tokens` (hard CI gate). Full rules → [`org/docs/design-system/`](../org/docs/design-system/README.md)
· procedure: root `@.claude/skills/design-system.md`.

## Running Locally

```bash
cd com && pnpm dev    # http://localhost:3002 / com.test
```

`VITE_CLOUD_URL` selects the gateway (defaults to `https://lmthing.cloud`).

## Task Index

| Working on… | Read |
|---|---|
| routes, pages, what each product SPA contains | [org/docs/product-spas/README.md](../org/docs/product-spas/README.md) |
| auth — Zitadel, gateway JWTs, GitHub OAuth (IDP Intent), the SSO code exchange | [org/docs/cloud/auth.md](../org/docs/cloud/auth.md) |
| any `/api/*` endpoint this SPA calls | [org/docs/cloud/routes.md](../org/docs/cloud/routes.md) |
| tiers, budgets, Stripe checkout/portal, usage | [org/docs/cloud/billing-and-tiers.md](../org/docs/cloud/billing-and-tiers.md) |
| **adding a pricing tier** (cross-cutting — `src/config/plans.ts` here is display only; the real tier logic is `cloud/gateway/src/lib/tiers.ts`) | [org/docs/contributing/add-a-tier.md](../org/docs/contributing/add-a-tier.md) |
