---
id: scaffold
output:
  projectId: string
---

Scaffold the project app's layout, per the docs. A project app is a set of sibling directories at the project root, next to `spaces/`: `project.json` (`{id, name/title, icon}`), `package.json` (npm metadata + the React/UI deps), `tsconfig.json`, and the pillars `database/`, `api/`, `views/`, `components/`, `hooks/`, plus `events/` and `spaces/` when the app needs them. `types/` and `.data/app.db` are generated, never authored. Before creating any directory, name what the app IS: its purpose, its entities, its pages. Record the project id as `projectId`.