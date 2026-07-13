# lmthing.team

The static SPA shell for private agent rooms. **Today this is a route scaffold, not a built product** —
every page renders a title placeholder, and lmthing.com flags it `upcoming: true`
(`com/src/routes/index.tsx`). There is no room backend, no shared VFS and no membership model. All
server-side logic would live in the `cloud/` gateway; this directory has no backend of its own.

> **Source of truth:** [`org/docs/`](../org/docs/README.md) (lmthing.org). This README states nothing
> about tiers, pricing, markup, pods or auth — those are owned by
> [`org/docs/cloud/billing-and-tiers.md`](../org/docs/cloud/billing-and-tiers.md) and
> [`org/docs/devops/infrastructure.md`](../org/docs/devops/infrastructure.md). The SPA shells as a
> group → [`org/docs/product-spas/`](../org/docs/product-spas/README.md).

## Real routes

From `team/src/routes/`:

| Route | File | State |
|---|---|---|
| `/` | `index.tsx` | placeholder — renders the title "lmthing.team" |
| `/create` | `create.tsx` | placeholder |
| `/room/$roomId` | `room/$roomId/index.tsx` | placeholder |
| `/room/$roomId/members` | `room/$roomId/members.tsx` | placeholder |
| `/room/$roomId/settings` | `room/$roomId/settings.tsx` | placeholder |

## Ideas (not implemented)

The original product vision — private shared-context rooms, publish-to-Social, and its revenue model —
is preserved, unimplemented and non-authoritative, in [`./IDEAS.md`](./IDEAS.md).

Stack, design-system rules and local dev → [`team/CLAUDE.md`](./CLAUDE.md).
