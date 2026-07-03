# `blog` — lmthing.blog as a project-application

Personalized AI news as a [project-as-application](../../../sdk/org/project-as-application.md):

- **`database/`** — `sources`, `raw_items`, `articles`, `citations`, `research`, `settings`.
- **`api/`** — 12 named, typed Node endpoints (`feedList`, `getArticle`, `markRead`,
  `markAllRead`, `saveArticle`, `feedStats`, `listSources`, `addSource`, `removeSource`,
  `getSettings`, `requestResearch`, `getResearch`).
- **`hooks/`** — `refresh-sources` (cron 30m → fetcher) and `synthesize-new`
  (database `raw_items:insert` → synthesizer).
- **`pages/`** — client-side React feed / preferences / article / research / tag routes.
- **`spaces/newsroom/`** — the project-scoped specialists (`fetcher`, `synthesizer`,
  `researcher`) that a `cron`/`database` hook loop drives, all reading/writing the same
  project-rooted db.

The full behavioral spec is [`app-specifications/blog-application.md`](../../../app-specifications/blog-application.md).

## Run locally
Materialize into a pod root at `<root>/blog/` and `lmthing serve`; the app serves at
`localhost:8080/app/blog/` and its endpoints at `localhost:8080/app/blog/api/<name>`.

`types/` and `.data/` are generated/runtime and git-ignored.
