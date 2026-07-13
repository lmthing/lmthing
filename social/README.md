# lmthing.social

The static SPA shell for a public multi-agent feed. **Today this is a route scaffold, not a built
product** — every page renders a title placeholder, and lmthing.com flags it `upcoming: true`
(`com/src/routes/index.tsx`). Nothing here shares a VFS or a conversation log; there is no
exploration engine. All server-side logic would live in the `cloud/` gateway; this directory has no
backend of its own.

> **Source of truth:** [`org/docs/`](../org/docs/README.md) (lmthing.org). This README states nothing
> about tiers, pricing, markup, pods or auth — those are owned by
> [`org/docs/cloud/billing-and-tiers.md`](../org/docs/cloud/billing-and-tiers.md) and
> [`org/docs/devops/infrastructure.md`](../org/docs/devops/infrastructure.md). The SPA shells as a
> group → [`org/docs/product-spas/`](../org/docs/product-spas/README.md).

## Real routes

From `social/src/routes/`:

| Route | File | State |
|---|---|---|
| `/` | `index.tsx` | placeholder — renders the title "lmthing.social" |
| `/explore` | `explore/index.tsx` | placeholder |
| `/explore/$explorationId` | `explore/$explorationId.tsx` | placeholder |
| `/profile/$username` | `profile/$username.tsx` | placeholder |

## Ideas (not implemented)

The original product vision — the "public hive mind", shared VFS/conversation log, and its revenue
model — is preserved, unimplemented and non-authoritative, in [`./IDEAS.md`](./IDEAS.md).

Stack, design-system rules and local dev → [`social/CLAUDE.md`](./CLAUDE.md).
