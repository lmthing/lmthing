# `package.json` — project npm metadata

A standard package manifest. App pages/components import React + the shared design libraries. When
a project has **no** standalone [`project.json`](./project.json.md), its identity fields
(`name`/`description`) come from here instead.

## Format

```json
{
  "name": "@lmthing/app-blog",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "lmthing.blog — personalized AI news, as a project-application.",
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@lmthing/ui": "workspace:*",
    "@lmthing/css": "workspace:*"
  }
}
```

## Notes

- **`name`** — store project templates use the `@lmthing/app-<id>` convention (`@lmthing/app-blog`).
- **`private: true`** and **`type: "module"`** are standard across the repo.
- **`dependencies`** — the app's client tier pulls `react`/`react-dom` and the shared design system
  (`@lmthing/ui`, `@lmthing/css`) as `workspace:*`. Pages and components style **only** with design
  tokens from `@lmthing/css` (see [pages/](./pages/)).
- The API/hook tiers run in the pod runtime and import from `@app/runtime` / `@app/types` at
  author time — those are runtime-provided, not npm deps.

Real example: `store/projects/blog/package.json`.
