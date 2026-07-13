# `blog` — lmthing.blog as a project-application

Personalized AI news. The `blog` project owns an app that polls the sources you follow, synthesizes
what's new into cited articles, and runs a deeper research dive on request — driven by a project-scoped
`newsroom` space of agents on a cron/database hook loop.

- The model it's built on (`database/ api/ pages/ hooks/ components/ spaces/`) →
  [org/docs/format/project/](../../../org/docs/format/project/README.md); how an app is built, served and
  executed → [org/docs/app/](../../../org/docs/app/README.md).
- The full behavioral spec → [`app-specifications/blog-application.md`](../../../app-specifications/blog-application.md).
- **The authoritative inventory of tables, endpoints, pages, hooks and agents is the tree itself** —
  read the directories, not a list in this file.

## Run locally

Materialize this dir into a pod root at `<root>/blog/` and `lmthing serve`; the app serves at
`localhost:8080/app/blog/` and its endpoints at `localhost:8080/app/blog/api/<name>`.

`types/` and `.data/` are generated/runtime and git-ignored.
