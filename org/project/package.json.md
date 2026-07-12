# `package.json` — project npm metadata

A project-application ships a standard npm manifest; the store templates set `type: "module"` and mark themselves `private: true` (`store/projects/blog/package.json`). Its client tier (pages/components) depends on React plus the shared design libraries as workspace packages (`store/projects/blog/package.json` `dependencies`).

## Format

```json
{
  "name": "@lmthing/app-blog",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "lmthing.blog — personalized AI news, as a project-application (database + pages + api + hooks + newsroom space).",
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@lmthing/ui": "workspace:*",
    "@lmthing/css": "workspace:*"
  }
}
```

Adapted from `store/projects/blog/package.json`.

## Notes

- **`name`** — the store project templates follow the `@lmthing/app-<id>` convention: `@lmthing/app-blog`, `@lmthing/app-health`, `@lmthing/app-kitchen`, `@lmthing/app-trips` (`store/projects/{blog,health,kitchen,trips}/package.json`). The hand-authored reference project `demo-feed` is the one exception — it is named `@app/demo-feed` (`store/projects/demo-feed/package.json`).
- **`private: true`** and **`type: "module"`** are set across the templates (`store/projects/blog/package.json`).
- **`dependencies`** — the app's client tier pulls `react`/`react-dom` (`^19.0.0`) and the shared design system `@lmthing/ui` + `@lmthing/css` as `workspace:*` (`store/projects/blog/package.json` `dependencies`). Pages and components style **only** with design tokens from `@lmthing/css` (see [`pages/`](./pages/README.md)).
- **`@app/runtime` / `@app/types` are runtime-provided, not npm dependencies.** They never appear in `dependencies`; the page builder aliases the `@app/runtime` bare import to this CLI package's runtime source, and `@app/types` to the project's generated `types/generated.d.ts`, at build time (`sdk/org/libs/cli/src/app/build/pages.ts:473`, `sdk/org/libs/cli/src/app/build/pages.ts:250`). React itself is also single-instanced through build aliases resolved against the pod's `node_modules` (`sdk/org/libs/cli/src/app/build/pages.ts:472-484`).
- **Workspace linkage** — `workspace:*` deps resolve because the shared libs are pnpm workspace members under `sdk/org/libs/*` (`pnpm-workspace.yaml`).

> UNVERIFIED: the draft claim that a project *without* a standalone [`project.json`](./project.json.md) derives its `name`/`description` identity from `package.json` instead. `store/projects/blog/` has no `project.json` while `store/projects/demo-feed/` does, but I found no loader in `sdk/org/libs/cli/src/app` or `sdk/org/libs/core/src` that reads `package.json` for project identity fields (searched `package.json`, `project.json`, `.title`, `projectMeta`). Claim omitted from the doc body pending confirmation.

## See also

- [`project.json`](./project.json.md) — the optional standalone project identity manifest.
