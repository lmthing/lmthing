# lmthing.com

The commercial landing page, and the central auth + billing surface for all lmthing.\* domains
(login/signup, cross-domain SSO, pricing, Stripe checkout, API keys, usage). Unlike the other product
shells, this one is built: its routes render real pages against the `cloud/` gateway. It is still a
static SPA — no backend of its own.

> **Source of truth:** [`org/docs/`](../org/docs/README.md) (lmthing.org). This README deliberately
> states no numbers. Tiers, budgets, markup, Stripe checkout →
> [`org/docs/cloud/billing-and-tiers.md`](../org/docs/cloud/billing-and-tiers.md). Auth/SSO →
> [`org/docs/cloud/auth.md`](../org/docs/cloud/auth.md). Pods →
> [`org/docs/devops/infrastructure.md`](../org/docs/devops/infrastructure.md). The SPA shells as a
> group → [`org/docs/product-spas/`](../org/docs/product-spas/README.md).
>
> Note: `src/config/plans.ts` in this SPA is **display only** — the real tier definitions live in
> `cloud/gateway/src/lib/tiers.ts`.

## Real routes

From `com/src/routes/` (there is no `/home` and no `/cloud`; the landing page is `/`):

| Route | File |
|---|---|
| `/` | `index.tsx` — landing page; the service grid marks social, team, blog and casa `upcoming: true` |
| `/about` | `about.tsx` |
| `/docs` | `docs.tsx` |
| `/pricing` | `pricing.tsx` |
| `/checkout` | `checkout.tsx` |
| `/billing` · `/billing/usage` | `billing.tsx` · `billing/usage.tsx` |
| `/account` · `/account/keys` | `account.tsx` · `account/keys.tsx` |
| `/login` · `/signup` · `/callback` · `/onboarding` | `login.tsx` · `signup.tsx` · `callback.tsx` · `onboarding.tsx` |
| `/forgot-password` · `/reset-password` | `forgot-password.tsx` · `reset-password.tsx` |
| `/auth/sso` | `auth/sso.tsx` |

## Ideas (not implemented)

The old margin table and managed-services pitch (compute-pod pricing, a fine-tuning service, a blog
subscription) is preserved, unimplemented and non-authoritative, in [`./IDEAS.md`](./IDEAS.md).

Stack, design-system rules, local dev and the task index → [`com/CLAUDE.md`](./CLAUDE.md).
