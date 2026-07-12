# `spaces/<space>/…` — project-scoped spaces

A project bundles its own **spaces** — the app's specialist agents and their tooling — under
`spaces/`. They have the **exact same format** as any other space, documented in full at
**[../../space/](../../space/)**.

## What's project-scoped about them

- They live inside the project (`<project>/spaces/<space>/`) rather than in the pod's shared space
  roots (`.lmthing/{system,user,my}/spaces/`), so they ship and install with the app.
- They read and write the **same project-rooted SQLite db** as the app's [api/](../api/) and
  [hooks/](../hooks/), gated by each agent's `capabilities:` grants (`db:read`/`db:write`, narrowed
  to named tables). See [../../space/agents/](../../space/agents/).
- They are what a project's [cron/db/event hooks](../hooks/) `trigger` — e.g.
  `trigger: 'newsroom/synthesizer#synthesize'` delegates to the `synthesizer` agent in the
  project's `newsroom` space.
- Being project-scoped, they typically **omit** the store-space `package.json` `lmthing` manifest
  block (that's for store-distributed integration spaces).

## Typical shape

```
<project>/spaces/
├── newsroom/          # e.g. fetcher, synthesizer, researcher
│   ├── agents/
│   ├── functions/
│   ├── knowledge/
│   ├── tasklists/
│   └── components/view/
└── editorial/…
```

## Format reference

Everything about agents, functions, tasklists, knowledge, components, and events is documented once,
canonically, under **[../../space/](../../space/)**:

- [agents/](../../space/agents/) · [functions/](../../space/functions/) ·
  [components/](../../space/components/) · [tasklists/](../../space/tasklists/) ·
  [knowledge/](../../space/knowledge/) · [events/](../../space/events/)

Real example: `store/projects/blog/spaces/{newsroom,editorial,research,assistant}/`.
