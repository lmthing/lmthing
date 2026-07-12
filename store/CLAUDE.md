# store/ — lmthing.store

The public **catalog SPA**: browse the project-app catalog (`projects/`) and the integration-space
catalog (`spaces/`). Static site — no server here; install and publish are authenticated and happen
on the user's compute pod, not in this app.

## Source of truth

**[org/docs/](../org/docs/README.md) (published at lmthing.org) is the single source of truth.**
This file is an orientation index and a place for local procedure — it holds no knowledge of its own.
When it disagrees with `org/docs`, `org/docs` wins; when `org/docs` disagrees with the code, the code
wins and the doc must be fixed.

> **A code change is not done until the matching `org/docs` page is updated in the same change.**
> → [org/docs/SYNC.md](../org/docs/SYNC.md)

## Running locally

```bash
cd store
pnpm dev                # vite-plus dev server
pnpm build              # regenerates projects/manifest.json, copies templates into dist/
pnpm test               # vitest (unit)
pnpm test:spaces        # node --test over spaces/**/tests/
pnpm gen:apps-manifest  # regenerate projects/manifest.json only
```

## Local procedure — the catalog

- `projects/<id>/` — one on-disk project-app template each. **Six ship today**: `blog`, `demo-feed`,
  `health`, `homes`, `kitchen`, `trips`.
- `spaces/<id>/` — installable store spaces (the `integration-*` event sources).
- `projects/manifest.json` — the generated browse index (`{ apps, spaces }`). **Never hand-edit it.**
  Regenerate with `pnpm gen:apps-manifest`; the `lmthing-apps-manifest` Vite plugin
  (`vite.config.ts` → `scripts/gen-apps-manifest.mjs`) also runs it on every build and copies the
  templates into `dist/` for static serving.
- Adding or changing a template means changing its files under `projects/<id>/` (or `spaces/<id>/`),
  then rebuilding — the manifest follows from disk.

## Task Index

| Working on… | Read |
|---|---|
| this SPA — its routes, stack, build, install hand-off, nginx caveat | [org/docs/product-spas/README.md](../org/docs/product-spas/README.md) (`store` section) |
| the on-disk format of a project-app (`database/ api/ pages/ hooks/ events/ components/ spaces/`) | [org/docs/format/project/](../org/docs/format/project/README.md) |
| the on-disk format of a store space (agents, events, functions, hooks) | [org/docs/format/space/](../org/docs/format/space/README.md) |
| how the pod boots, builds and serves an installed app | [org/docs/app/](../org/docs/app/README.md) |
| the pod REST routes that list/install apps and store spaces | [org/docs/cli-api/rest/apps.md](../org/docs/cli-api/rest/apps.md) · [org/docs/cli-api/rest/store-spaces.md](../org/docs/cli-api/rest/store-spaces.md) |
| the agent globals for discovery + consented install (`installSpace`, `@consent`) | [org/docs/runtime-globals/store-and-consent.md](../org/docs/runtime-globals/store-and-consent.md) |
| integrations as event sources (emitter defs + event hooks) | [org/docs/runtime-globals/events-and-integrations.md](../org/docs/runtime-globals/events-and-integrations.md) |
| who authors apps and store listings (`system-appbuilder`, `system-store`) | [org/docs/system-spaces/](../org/docs/system-spaces/README.md) |
| **any styling** — tokens, never a raw color (hard CI gate: `pnpm lint:tokens`) | [org/docs/design-system/](../org/docs/design-system/README.md) |
