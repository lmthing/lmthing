# `spaces/<space>/…` — project-scoped spaces

A project can bundle its own **spaces** — the app's specialist agents and their tooling — under `spaces/`, materialized into the pod at `<root>/<projectId>/spaces/<spaceId>/` (`sdk/org/libs/cli/src/server/projects.ts:5`). Project spaces use the **exact same on-disk format** as any other space; that format is documented in full under [../../space/](../../space/README.md), and each space directory is loaded by the same generic `loadSpace` used for system spaces (`sdk/org/libs/cli/src/cli/bin.ts:84`).

## What's project-scoped about them

- They live inside the project (`<project>/spaces/<space>/` in the store template; `<root>/<projectId>/spaces/<spaceId>/` in a live pod) rather than only in the pod-wide system space root `<root>/system/spaces/` where the built-in `system-*`/`user-*` spaces live (`sdk/org/libs/cli/src/server/projects.ts:4-5`). A project's own tree matches the generic `<root>/<projectId>/spaces/<id>` shape (`sdk/org/libs/cli/src/server/projects.ts:14-15`).
- Because a project app ships `spaces` as one of its template directories, installing the app materializes the whole `spaces/` tree into the pod alongside `database/ pages/ api/ hooks/ components/` (`sdk/org/libs/cli/src/server/routes/apps.ts:69`).
- Project spaces read and write the **same project-rooted SQLite database** as the app's [api/](../api/README.md) and [hooks/](../hooks/README.md): the injected `db` global is the live project database and is gated on both a live project context (`projectRoot`) and a db capability grant (`sdk/org/libs/core/src/exec/app-globals.ts:166-172`, `:189-191`).
- Each agent's access to that db is narrowed by its `capabilities:` frontmatter — `db:read`/`db:write` grants scoped to named tables, enforced per-table at call time by `assertTableAllowed` inside the scoped-db wrapper (`sdk/org/libs/core/src/exec/app-globals.ts:120-155`). See [../../space/agents/capabilities.md](../../space/agents/capabilities.md).
- They are what a project's cron / database / event [hooks](../hooks/README.md) `trigger`: a hook's declarative `trigger: 'space/agent#action'` string is split into `{spaceRef, agentSlug, action}` and delegated to that agent (`sdk/org/libs/cli/src/server/routes/hooks.ts:176-177`, `:328`).
- Being project-scoped, they typically **omit** the store-space `package.json` `lmthing` manifest block — the blog app's `spaces/*` carry no `package.json` at all, unlike a store-distributed integration space (`store/spaces/integration-slack/package.json`).

## Typical shape

Real example — the `blog` app's `newsroom` space (`store/projects/blog/spaces/newsroom/`):

```
<project>/spaces/
├── newsroom/                 # fetcher, researcher, synthesizer
│   ├── agents/{fetcher,researcher,synthesizer}/{charter.md,instruct.md}
│   ├── functions/            # scoreRelevance.ts, formatCitation.ts, …
│   ├── knowledge/journalism/ # synthesis-method, source-evaluation, …
│   ├── tasklists/            # deep-dive, refresh
│   └── components/view/      # ArticlePreview.tsx, ResearchPreview.tsx
├── editorial/  research/  assistant/
```

## Worked example — a project hook triggering a project space

The blog app's daily-digest cron hook delegates straight into the project-scoped `editorial` space (`store/projects/blog/hooks/build-daily-digest.ts:4-9`):

```ts
// hooks/build-daily-digest.ts — every day at 07:00 the editorial curator
// assembles a fresh daily digest from the best recent articles.
export default {
  type: 'cron',
  daily: '07:00',
  trigger: 'editorial/curator#digest',   // space/agent#action
  budget: { maxEpisodes: 20, maxWallClockMs: 600000 },
};
```

The `curator` agent it targets lives at `store/projects/blog/spaces/editorial/agents/curator/`, and project-space agents declare their own table-scoped db grants in `capabilities:` frontmatter (`store/projects/blog/spaces/newsroom/agents/synthesizer/instruct.md:15-17` shows the `db:read`/`db:write` `{ tables: [...] }` shape).

## Format reference

Everything about agents, functions, tasklists, knowledge, components, and events is documented once, canonically, under [../../space/](../../space/README.md):

- [agents/](../../space/agents/README.md) · [agents/capabilities.md](../../space/agents/capabilities.md) · [functions/](../../space/functions/README.md) · [components/](../../space/components/README.md) · [tasklists/](../../space/tasklists/README.md) · [knowledge/](../../space/knowledge/README.md) · [events/](../../space/events/README.md)

Real examples on disk: `store/projects/blog/spaces/{newsroom,editorial,research,assistant}/`.

On disk there are exactly **two** space roots. The pod-wide system root `<root>/system/spaces/` is materialized from the shipped system spaces at runtime init (`sdk/org/libs/cli/src/cli/runtime-init.ts:90`), and the per-project root `<root>/<projectId>/spaces/` — scaffolded for the default `user` project (`sdk/org/libs/cli/src/cli/runtime-init.ts:112-114`) and derived generically for any project id when a session boots (`sdk/org/libs/cli/src/server/session-manager.ts:1170`). A project's own root is the one handed to the sandbox as `LMTHING_PROJECT_SPACES_DIR` (`sdk/org/libs/core/src/globals/host-tools.ts:196-197`); it is what a bare space slug resolves under, falling back to `.lmthing/user/spaces` when unset (`sdk/org/libs/core/src/globals/host-tools.ts:250-254`).
