# lmthing.casa

The static SPA shell for a smart-home (Home Assistant) product. **Today this is a route scaffold, not
a built product** — every page renders a title placeholder, and lmthing.com flags it `upcoming: true`
(`com/src/routes/index.tsx`). There is no Home Assistant bridge, no device integration and no
fine-tuning service anywhere in this repo. All server-side logic would live in the `cloud/` gateway;
this directory has no backend of its own.

> **Source of truth:** [`org/docs/`](../org/docs/README.md) (lmthing.org). This README states nothing
> about tiers, pricing, markup, pods or auth — those are owned by
> [`org/docs/cloud/billing-and-tiers.md`](../org/docs/cloud/billing-and-tiers.md) and
> [`org/docs/devops/infrastructure.md`](../org/docs/devops/infrastructure.md). The SPA shells as a
> group → [`org/docs/product-spas/`](../org/docs/product-spas/README.md).

## Real routes

From `casa/src/routes/`:

| Route | File | State |
|---|---|---|
| `/` | `index.tsx` | placeholder — renders the title "lmthing.casa" |
| `/notifications` | `notifications.tsx` | placeholder |
| `/profile` | `profile.tsx` | placeholder |
| `/settings` | `settings.tsx` | placeholder |

## Ideas (not implemented)

The original product vision — self-learning HA agent, dashboard/devices/automations routes, a
fine-tuning revenue line — is preserved, unimplemented and non-authoritative, in
[`./IDEAS.md`](./IDEAS.md).

Stack, design-system rules and local dev → [`casa/CLAUDE.md`](./CLAUDE.md).
