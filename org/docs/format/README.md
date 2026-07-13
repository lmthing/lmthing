# `format/` — the on-disk artifact format

This section is the reference for the **shape of the files you author**: what a directory must contain, what each file's frontmatter/exports/JSON keys mean, and which loader or validator reads them. Everything else in [`org/`](../README.md) documents *behaviour* — the runtime globals an agent may call ([`../runtime-globals/README.md`](../runtime-globals/README.md)), the CLI and its REST API ([`../cli-api/README.md`](../cli-api/README.md)), and the four web surfaces.

There are exactly **two authorable artifact kinds**, and both are plain directory trees of Markdown, TypeScript and JSON:

| Kind | What it is | Loaded by | Doc |
|---|---|---|---|
| **project** | A project-as-application: a project-rooted SQLite db, worker-isolated Node API handlers, client-side React pages, in-proc hooks — plus its own project-scoped spaces | `loadProjectApp(projectRoot)` reads `database/ pages/ api/ hooks/` and reports `hasApp` (`sdk/org/libs/cli/src/app/loader.ts:55-68`) | [`./project/README.md`](./project/README.md) |
| **space** | A portable bundle of AI specialists (agents) plus the tooling they reference — `functions/ knowledge/ tasklists/ components/ events/` | `loadSpace(dir)` — throws unless the dir has an `agents/` directory with at least one agent subdir (unless `requireAgents:false`) (`sdk/org/libs/core/src/spaces/load.ts#loadSpace`) | [`./space/README.md`](./space/README.md) |

The two nest: a project owns a `spaces/` directory, so every space doc applies unchanged to a project-scoped space (`sdk/org/libs/cli/src/server/session-manager.ts:1067` — `projectSpacesDir = join(root, projectId, 'spaces')`).

---

## The pod runtime loads these trees directly

There is no build step, bundle format, or registry between what you write and what runs. The compute pod reads the directories as-is:

- **Spaces** — a session resolves its space dir under `<root>/<projectId>/spaces/<spaceId>` and hands it to `loadSpace` (`sdk/org/libs/cli/src/server/session-manager.ts:1063-1067`). On first boot the CLI materializes the ten shipped system spaces into `<root>/system/spaces/<name>/` (`sdk/org/libs/cli/src/cli/runtime-init.ts#materializeRuntime`; names in `sdk/org/libs/core/src/spaces/system.ts#SYSTEM_SPACE_NAMES`) and scaffolds the default `user` project skeleton with `spaces/`, `documents/`, `instructions.md` and `project.json` (`sdk/org/libs/cli/src/cli/runtime-init.ts:113-120`).
- **Projects** — every project lives at `<root>/<projectId>/` with `project.json`, `instructions.md`, `documents/` and `spaces/` (`sdk/org/libs/cli/src/server/projects.ts:6-8`). The default project id is `user` and `system` is a synthetic, reserved project id (`sdk/org/libs/cli/src/server/projects.ts#DEFAULT_PROJECT_ID,31,39-40`). The app layer (`database/ api/ pages/ hooks/`) is optional — a project with none of those four dirs is a spaces-only project and reports `hasApp:false` rather than throwing (`sdk/org/libs/cli/src/app/loader.ts#loadProjectApp`).

What an agent is allowed to *do* with the app layer is not part of the on-disk shape of the project — it is granted per-agent, in the space format, by the `capabilities:` frontmatter key. The twelve grant ids are `db:read`, `db:write`, `db:schema`, `pages:write`, `api:write`, `hooks:write`, `api:call`, `connections:use`, `project:manage`, `store:read`, `store:install`, `events:emit` (`sdk/org/libs/core/src/spaces/capabilities.ts:42-56`), parsed fail-loud by `parseCapabilities` (`sdk/org/libs/core/src/spaces/capabilities.ts#parseConnectionsConfig,267-269`). See [`./space/agents/capabilities.md`](./space/agents/capabilities.md) and [`../runtime-globals/README.md`](../runtime-globals/README.md).

---

## The store distributes the same trees

The catalog is nothing but these two directory shapes, checked in and served statically. The generator resolves exactly two source dirs — `APPS_DIR = store/projects` and `SPACES_DIR = store/spaces` — and writes `store/projects/manifest.json` as a **generated** browse index (never hand-edited), excluding `.data/`, `types/` and `node_modules/` from the download lists (`store/scripts/gen-apps-manifest.mjs:40-47`).

```
store/
├── projects/
│   ├── <id>/            # a complete project template  → ./project/README.md
│   └── manifest.json    # GENERATED { apps[], spaces[] }
└── spaces/
    └── <id>/            # a complete space template    → ./space/README.md
```

Six project templates and thirteen integration spaces ship today — `blog`, `demo-feed`, `health`, `homes`, `kitchen`, `trips`, and `integration-{demo,discord,github,google,line,lmthing,mattermost,nextcloud-talk,slack,sms,synology-chat,telegram,whatsapp}` (`store/projects/manifest.json` — `apps[].id`, `spaces[].id`).

Installing is done by the **pod**, not by the static store: `GET /api/apps` + `POST /api/apps/install` for a project template, `GET /api/store/spaces` + `POST /api/store/spaces/install` for a space (`sdk/org/libs/cli/src/server/serve.ts:258-274`; handlers `handleInstallApp` in `sdk/org/libs/cli/src/server/routes/apps.ts#handleInstallApp` and `handleInstallStoreSpace`/`installStoreSpace` in `sdk/org/libs/cli/src/server/routes/store-spaces.ts#handleInstallStoreSpace,215`). An agent can install a space itself through the `installSpace()` global (`sdk/org/libs/core/src/globals/store.ts#createInstallSpaceGlobal`), which is the one **consent-marked** yield kind — the host prompts the user before the resolver runs (`sdk/org/libs/core/src/globals/consent.ts#CONSENT_MARKED_YIELD_KINDS`). Endpoint detail → [`../cli-api/rest/apps.md`](../cli-api/rest/apps.md) · [`../cli-api/rest/store-spaces.md`](../cli-api/rest/store-spaces.md).

---

## Navigate — project

Start at [`./project/README.md`](./project/README.md) for the directory layout and how the four pillars map onto runtime tiers.

| File you are authoring | Doc |
|---|---|
| `project.json` | [`./project/project.json.md`](./project/project.json.md) |
| `package.json` | [`./project/package.json.md`](./project/package.json.md) |
| `tsconfig.json` | [`./project/tsconfig.json.md`](./project/tsconfig.json.md) |
| `database/<table>.json` | [`./project/database/README.md`](./project/database/README.md) |
| `api/<path>/<METHOD>.ts` | [`./project/api/README.md`](./project/api/README.md) |
| `pages/<route>.tsx` | [`./project/pages/README.md`](./project/pages/README.md) |
| `pages/_app.tsx` | [`./project/pages/app-file.md`](./project/pages/app-file.md) |
| `pages/_layout.tsx` | [`./project/pages/layout-file.md`](./project/pages/layout-file.md) |
| `components/<Name>.tsx` | [`./project/components/README.md`](./project/components/README.md) |
| `hooks/<slug>.ts` | [`./project/hooks/README.md`](./project/hooks/README.md) · [`cron`](./project/hooks/cron.md) · [`event`](./project/hooks/event.md) · [`database` (removed)](./project/hooks/database.md) |
| `events/<name>.ts` | [`./project/events/README.md`](./project/events/README.md) |
| `spaces/<space>/…` | [`./project/spaces/README.md`](./project/spaces/README.md) → [`./space/README.md`](./space/README.md) |

Runtime behaviour of the served app (page build, worker-isolated api runtime, `@app/runtime`) → [`../app/README.md`](../app/README.md).

## Navigate — space

Start at [`./space/README.md`](./space/README.md) for the directory layout and how an agent's frontmatter wires up to its sibling directories.

| File you are authoring | Doc |
|---|---|
| `package.json` (the `lmthing` block) | [`./space/package.json.md`](./space/package.json.md) |
| `agents/<slug>/` | [`./space/agents/README.md`](./space/agents/README.md) |
| `agents/<slug>/charter.md` | [`./space/agents/charter-file.md`](./space/agents/charter-file.md) |
| `agents/<slug>/instruct.md` | [`./space/agents/instruct-file.md`](./space/agents/instruct-file.md) · [frontmatter keys](./space/agents/frontmatter.md) |
| `capabilities:` grants | [`./space/agents/capabilities.md`](./space/agents/capabilities.md) |
| `canDelegateTo:` graph | [`./space/agents/delegation.md`](./space/agents/delegation.md) |
| `functions/<fn>.ts` | [`./space/functions/README.md`](./space/functions/README.md) |
| `components/view/<Name>.tsx` · `components/form/<Name>.tsx` | [`./space/components/README.md`](./space/components/README.md) · [view](./space/components/view.md) · [form](./space/components/form.md) |
| `tasklists/<slug>/index.md` · `NN-<id>.md` | [`./space/tasklists/README.md`](./space/tasklists/README.md) · [index file](./space/tasklists/index-file.md) · [step file](./space/tasklists/step-file.md) |
| `knowledge/<domain>/<field>/index.md` · `<aspect>.md` | [`./space/knowledge/README.md`](./space/knowledge/README.md) · [index file](./space/knowledge/index-file.md) · [aspect file](./space/knowledge/aspect-file.md) |
| `events/<name>.ts` (emitter defs) | [`./space/events/README.md`](./space/events/README.md) · [webhook](./space/events/webhook.md) · [cron](./space/events/cron.md) · [db](./space/events/db.md) · [internal](./space/events/internal.md) |
| `hooks/<slug>.ts` (event consumers) | [`./space/hooks/README.md`](./space/hooks/README.md) |

---

## One event pipeline, two homes

`events/` (emitter defs — the producer) and `hooks/` (the consumer) exist in **both** artifact kinds and are the same pipeline: a project subscribes with an event hook to an event emitted by one of its installed spaces, and a db write auto-emits a synthetic `project/db.<table>.<insert|update|remove>` event. Read the pair together — [`./project/events/README.md`](./project/events/README.md) + [`./project/hooks/event.md`](./project/hooks/event.md) on the project side, [`./space/events/README.md`](./space/events/README.md) + [`./space/hooks/README.md`](./space/hooks/README.md) on the space side.

---

*Up: [`org/README.md`](../README.md). Sibling sections: [`runtime-globals/`](../runtime-globals/README.md) (what an agent can call) · [`cli-api/`](../cli-api/README.md) (the CLI + pod REST API that read and write these trees) · [`app/`](../app/README.md) (how a project app is built and served).*
