# lmthing.store

The public **catalog SPA** for lmthing: browse the project-app catalog and the integration-space
catalog, then hand off to your own compute pod to install. It is a **static site** — there is no server
in this directory. Installing and publishing are authenticated and happen on the pod.

> `org/docs/` (published at lmthing.org) is the single source of truth. This README is an orientation
> doc; the SPA itself is documented in [org/docs/product-spas/README.md](../org/docs/product-spas/README.md)
> (`store` section), and the install/list REST routes in
> [org/docs/cli-api/rest/apps.md](../org/docs/cli-api/rest/apps.md) ·
> [org/docs/cli-api/rest/store-spaces.md](../org/docs/cli-api/rest/store-spaces.md).
>
> Unbuilt marketplace/revenue product ideas live in [IDEAS.md](./IDEAS.md) — nothing there is
> implemented.

## Routes (`src/routes/`)

| Route | File | What it is |
|---|---|---|
| `/` | `index.tsx` | Landing page; counts of catalog apps + integrations, links to `/projects` and `/spaces` |
| `/projects` | `projects/index.tsx` | Browse the project-app catalog |
| `/projects/$appId` | `projects/$appId.tsx` | One app's listing + the install hand-off |
| `/spaces` | `spaces/index.tsx` | Browse installable integration spaces |
| `/spaces/$spaceId` | `spaces/$spaceId.tsx` | One integration space's listing |
| `/publish` | `publish.tsx` | **Stub** — renders a heading only |
| `/agent/$agentId` | `agent/$agentId.tsx` | **Stub** — renders the id only |
| `/category/$categoryId` | `category/$categoryId.tsx` | **Stub** — renders the id only |

There is no `/browse`, no `/$username/dashboard`, no `/earnings`, and no purchase or billing flow in
this app.

## The catalog

- **`projects/<id>/`** — one complete on-disk project-app template each (`database/`, `api/`, `pages/`,
  `hooks/`, `components/`, `spaces/`, `package.json`, `project.json`). **Six ship today**: `blog`,
  `demo-feed`, `health`, `homes`, `kitchen`, `trips`. The model these templates conform to →
  [org/docs/format/project/](../org/docs/format/project/README.md).
- **`spaces/<id>/`** — installable store spaces (the `integration-*` event sources). Format →
  [org/docs/format/space/](../org/docs/format/space/README.md).
- **`projects/manifest.json`** — the generated browse index (`{ apps, spaces }`), read by the SPA via
  `src/lib/apps-manifest.ts`. **Never hand-edit it**: it is generated from the templates on disk by
  `scripts/gen-apps-manifest.mjs`, which the `lmthing-apps-manifest` Vite plugin (`vite.config.ts`) runs
  on every build — the same build copies each template into `dist/` so nginx serves them statically at
  `lmthing.store/projects/<id>/<path>`.

Adding or changing a template means changing files under `projects/<id>/` (or `spaces/<id>/`) and
rebuilding; the manifest follows from disk.

## Install hand-off

The static store only **browses**. Its "Install" action hands off (`src/lib/pod-api.ts`) to the
authenticated app, which calls the user's pod: `POST /api/apps/install {appId}` downloads the template,
materializes it into `<lmthingRoot>/<projectId>/`, boots the app and builds its pages; the pod's
`GET /api/apps` lists this same public catalog. Details →
[org/docs/cli-api/rest/apps.md](../org/docs/cli-api/rest/apps.md).

## Running locally

```bash
cd store
pnpm dev                # vite-plus dev server
pnpm build              # regenerates projects/manifest.json, copies templates into dist/
pnpm test               # vitest (unit)
pnpm test:spaces        # node --test over spaces/**/tests/
pnpm gen:apps-manifest  # regenerate projects/manifest.json only
```
