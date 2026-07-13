# lmthing.blog

The static SPA shell for a personalized AI-news product. **Today this is a route scaffold, not a
built product** — every page renders a title placeholder, and lmthing.com flags it `upcoming: true`
(`com/src/routes/index.tsx`). All server-side logic would live in the `cloud/` gateway; this
directory has no backend of its own.

> **Source of truth:** [`org/docs/`](../org/docs/README.md) (lmthing.org). This README states nothing
> about tiers, pricing, markup, pods or auth — those are owned by
> [`org/docs/cloud/billing-and-tiers.md`](../org/docs/cloud/billing-and-tiers.md) and
> [`org/docs/devops/infrastructure.md`](../org/docs/devops/infrastructure.md). The SPA shells as a
> group → [`org/docs/product-spas/`](../org/docs/product-spas/README.md).

## Real routes

From `blog/src/routes/`:

| Route | File | State |
|---|---|---|
| `/` | `index.tsx` | placeholder — renders the title "lmthing.blog" |
| `/post/$slug` | `post/$slug.tsx` | placeholder |
| `/tag/$tag` | `tag/$tag.tsx` | placeholder |

There is no feed, no preferences page, no publishing flow, and no agent behind any of it.

## Ideas (not implemented)

The original product vision — news agent, subscription pricing, an aspirational route tree — is
preserved, unimplemented and non-authoritative, in [`./IDEAS.md`](./IDEAS.md).

Stack, design-system rules and local dev → [`blog/CLAUDE.md`](./CLAUDE.md).
