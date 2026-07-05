# store/ — lmthing.store

Agent marketplace **and project-app catalog**. A static SPA; all server-side logic lives in the `cloud/` gateway API (and, for app install, on the user's compute pod — see below).

## Project-app catalog (`projects/`)

The store distributes **project-applications** (a project's `database/ pages/ api/ hooks/` + `spaces/` app — see [../sdk/org/project-as-application.md](../sdk/org/project-as-application.md) and [../sdk/org/SPACE_DEVELOPMENT.md](../sdk/org/SPACE_DEVELOPMENT.md) §7):

- `projects/<id>/` — one full app template each (`blog`, `health`, `kitchen`, `trips`, `demo-feed`), with `database/ pages/ api/ hooks/ components/ spaces/` + `package.json`/`project.json`.
- `projects/manifest.json` — generated browse index (`{ apps: [{ id, title, description, icon, tables, pages, endpoints, hooks, files }] }`). **Never hand-edit it** — regenerate via `scripts/gen-apps-manifest.mjs` (auto-run by the `lmthing-apps-manifest` Vite plugin in `vite.config.ts`, which also copies templates into the dist output for static serving at `/projects/<id>/`).
- `src/lib/apps-manifest.ts` — typed accessor (`listCatalogApps()`, `getCatalogApp(id)`, `CatalogApp`) over the inlined manifest. `src/routes/projects/` — catalog browse + `$appId` detail.
- **Install is not done here.** The static store only browses; `src/lib/pod-api.ts` hands off to the lmthing.app install page, which calls the pod CLI server's `POST /api/apps/install {appId}` (the pod's `GET /api/apps` serves this same public catalog). App authoring is done by THING via the `system-appbuilder` space, not in the store.

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
cd store && pnpm dev
```
