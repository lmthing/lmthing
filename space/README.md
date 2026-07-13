# lmthing.space

The static SPA shell for deploying spaces / publishing agents. lmthing.com does **not** flag it
`upcoming` (`com/src/routes/index.tsx`), and unlike the other shells its routes contain real UI (a
space directory, an admin panel with start/stop controls). But its API client
(`space/src/lib/api.ts`) calls `<cloud>/functions/v1/list-spaces`, `get-space`, … and **no such
handlers exist in `cloud/gateway/src`** — so the surface does not work end-to-end today. Treat it as
an unfinished shell, not a shipped product.

> **Source of truth:** [`org/docs/`](../org/docs/README.md) (lmthing.org). This README states nothing
> about tiers, pricing, markup, or the pod/K8s lifecycle — those are owned by
> [`org/docs/cloud/billing-and-tiers.md`](../org/docs/cloud/billing-and-tiers.md) and
> [`org/docs/devops/infrastructure.md`](../org/docs/devops/infrastructure.md). What a *space* is as an
> authored format → [`org/docs/format/space/`](../org/docs/format/space/README.md). The SPA shells as
> a group → [`org/docs/product-spas/`](../org/docs/product-spas/README.md).

## Real routes

From `space/src/routes/`:

| Route | File |
|---|---|
| `/` | `index.tsx` — space directory + create |
| `/$spaceSlug` | `$spaceSlug/index.tsx` (layout: `$spaceSlug/route.tsx`) |
| `/$spaceSlug/app` · `/$spaceSlug/app/$page` | `$spaceSlug/app/index.tsx` · `app/$page.tsx` |
| `/$spaceSlug/admin` | `$spaceSlug/admin/index.tsx` — status + start/stop |
| `/$spaceSlug/admin/{agents,builder,database,logs,pages,settings,terminal,users}` | one file each under `$spaceSlug/admin/` |

## Ideas (not implemented)

The original vision text — the "three pillars: Agents, Flows, Knowledge" framing (the runtime has no
"Flows" concept; it has tasklists), the K8s lifecycle narrative, and the revenue model — is preserved,
unimplemented and non-authoritative, in [`./IDEAS.md`](./IDEAS.md).

Stack, design-system rules and local dev → [`space/CLAUDE.md`](./CLAUDE.md).
