# team/ — lmthing.team

Private agent rooms. A static SPA; all server-side logic lives in the `cloud/` gateway API.

## Stack

React 19 + Vite 7 + TanStack Router (file-based routing) · Tailwind CSS v4 via `@tailwindcss/vite` · shared libs `@lmthing/ui`, `@lmthing/css`, `@lmthing/state`, `lmthing` · Vite config from `@lmthing/utils/vite`.

## Design system (mandatory)

Uses the shared lmthing design system (`@lmthing/css` tokens + `@lmthing/ui`). **Never write a
raw color** (hex, literal `rgb()/hsl()`, or stock Tailwind colors like `gray-*`/`blue-*`/`green-500`);
use a token (`var(--foreground)`, `bg-primary`, `text-agent`, …). To change a color, edit
`sdk/org/libs/css/src/tokens/tokens.json` then `pnpm --filter @lmthing/css generate`. Enforced by
`pnpm lint:tokens` (hard CI gate). Full rules → root `@.claude/skills/design-system.md`
(spec: [../sdk/org/libs/css/DESIGN.md](../sdk/org/libs/css/DESIGN.md)).

## Running Locally

```bash
cd team && pnpm dev
```
