# blog/ — lmthing.blog

Personalized AI news. **Today this is a route scaffold, not a built product** — its pages render a
title placeholder and lmthing.com flags it `upcoming: true` (`com/src/routes/index.tsx`). A static
SPA; all server-side logic lives in the `cloud/` gateway API.

> **Source of truth:** [`org/docs/`](../org/docs/README.md) (lmthing.org) — every factual claim there
> is cited to code. This file is an orientation index; knowledge does not live here. A code change is
> not done until the matching `org/docs` page is updated in the same change ([SYNC.md](../org/docs/SYNC.md)).

## Stack

React 19 + Vite 7 + TanStack Router (file-based routing) · Tailwind CSS v4 via `@tailwindcss/vite` · shared libs `@lmthing/ui`, `@lmthing/css`, `@lmthing/state`, `lmthing` · Vite config from `@lmthing/utils/vite`.

## Design system (mandatory)

Uses the shared lmthing design system (`@lmthing/css` tokens + `@lmthing/ui`). **Never write a
raw color** (hex, literal `rgb()/hsl()`, or stock Tailwind colors like `gray-*`/`blue-*`/`green-500`);
use a token (`var(--foreground)`, `bg-primary`, `text-agent`, …). To change a color, edit
`sdk/org/libs/css/src/tokens/tokens.json` then `pnpm --filter @lmthing/css generate`. Enforced by
`pnpm lint:tokens` (hard CI gate). Full rules → [`org/docs/design-system/`](../org/docs/design-system/README.md)
· procedure: root `@.claude/skills/design-system.md`.

## Running Locally

```bash
cd blog && pnpm dev
```
