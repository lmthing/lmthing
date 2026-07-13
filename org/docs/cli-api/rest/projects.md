# REST — `/api/projects`

The project surface of the pod CLI server: list/create/delete a project, edit its `instructions.md` and `documents/`, list its sessions and spaces, read/write its space files, and fetch `@`-autocomplete words. This is the contract Studio and Chat drive; the pod's disk is authoritative (`sdk/org/libs/cli/src/server/routes/projects.ts`; mounted in `sdk/org/libs/cli/src/server/serve.ts:171-187`).

For the project *format* on disk (the app layer: `database/ api/ pages/ hooks/`), see [../../format/project/README.md](../../format/project/README.md). For the rest of the pod API, see [./README.md](./README.md).

---

## Route table

Every route below is registered on the pod's `Router` in `sdk/org/libs/cli/src/server/serve.ts:171-187`. `:param` matches one non-slash segment; a trailing `/*` captures the remainder as `params.rest` (`sdk/org/libs/cli/src/server/router.ts#compilePattern`). First match wins, in registration order (`sdk/org/libs/cli/src/server/router.ts#Router.dispatch`).

| Method | Path | Handler | Success |
|---|---|---|---|
| GET | `/api/projects` | `handleListProjects` | `200 { projects: ProjectMeta[] }` |
| POST | `/api/projects` | `handleCreateProject` | `201 { id }` |
| DELETE | `/api/projects/:projectId` | `handleDeleteProject` | `204` (no body) |
| GET | `/api/projects/:projectId/instructions` | `handleGetProjectInstructions` | `200 { content }` |
| PUT | `/api/projects/:projectId/instructions` | `handlePutProjectInstructions` | `200 { ok: true }` |
| GET | `/api/projects/:projectId/documents` | `handleListDocuments` | `200 { documents: string[] }` |
| POST | `/api/projects/:projectId/documents` | `handleCreateDocument` | `201 { ok: true }` |
| GET | `/api/projects/:projectId/sessions` | `handleListProjectSessions` | `200 { sessions: PersistedSessionMeta[] }` |
| GET | `/api/projects/:projectId/spaces/:spaceId/sessions` | `handleListSpaceSessions` | `200 { sessions: PersistedSessionMeta[] }` |
| GET | `/api/projects/:projectId/spaces/:spaceId/files` | `handleGetProjectSpaceFiles` | `200 { files: Record<relPath,string> }` |
| PUT | `/api/projects/:projectId/spaces/:spaceId/files` | `handlePutProjectSpaceFiles` | `200 { ok: true }` (wipe-and-rewrite) |
| POST | `/api/projects/:projectId/spaces/:spaceId/files` | `handlePostProjectSpaceFile` | `201 { ok: true }` |
| PUT | `/api/projects/:projectId/spaces/:spaceId/files/*` | `handlePutProjectSpaceFile` | `200 { ok: true }` |
| DELETE | `/api/projects/:projectId/spaces/:spaceId/files/*` | `handleDeleteProjectSpaceFile` | `204` (no body) |
| GET | `/api/projects/:projectId/spaces` | `handleListProjectSpaces` | `200 { spaces: SpaceMeta[] }` |
| GET | `/api/projects/:projectId/completions` | `handleGetProjectCompletions` | `200 { completions: string[] }` |
| GET | `/api/projects/:projectId/integrations` | `handleListProjectIntegrations` | `200 { integrations: [] }` → [./store-spaces.md](./store-spaces.md) |

Other route families share the `/api/projects/:projectId/` prefix but are documented elsewhere: the project-app admin surface `/api/projects/:projectId/app*` (`sdk/org/libs/cli/src/server/serve.ts:240-246`) → [./apps.md](./apps.md); the hook run/disable endpoints (`sdk/org/libs/cli/src/server/serve.ts:222-226`) → [./hooks.md](./hooks.md).

**There is no "select project" route.** A project is *selected* by the caller passing `projectId` in the body of `POST /api/sessions` (`sdk/org/libs/cli/src/server/routes/sessions.ts:20-35`), which `createSession` defaults to `DEFAULT_PROJECT_ID` when omitted (`sdk/org/libs/cli/src/server/session-manager.ts:1003`) and resolves to `projectRoot = join(root, projectId)` (`sdk/org/libs/cli/src/server/session-manager.ts:1136`) → [./sessions.md](./sessions.md). The agent-facing `createProject()` / `selectProject()` globals are a *different* thing: they operate on the **store catalog** (`store/projects/<id>/`), not the pod root (`sdk/org/libs/cli/src/app/authoring/globals.ts:145-191`).

---

## The pod root layout

Everything here is rooted at the CLI's `lmthingRoot` (`LMTHING_ROOT`, else `<cwd>/.lmthing`). Each project is one directory under it, and the routes above are thin wrappers over that shape (`sdk/org/libs/cli/src/server/projects.ts:1-17`):

```
<root>/
  system/
    .shipped.json                 # per-space content hash of the shipped source
    spaces/<system-space>/        # materialized system spaces
  <projectId>/
    project.json                  # { id, name, createdAt }
    instructions.md               # project-level instructions
    documents/                    # <name> files
    spaces/<spaceId>/             # project spaces (+ their sessions/)
    sessions/<sessionId>/meta.json
```

- `<root>/<projectId>/{spaces,documents,instructions.md,project.json}` is the whole project skeleton (`sdk/org/libs/cli/src/server/projects.ts:101-119`, `scaffoldProject` at `:257-269`).
- Project sessions live at `<root>/<projectId>/sessions/` (`sdk/org/libs/cli/src/server/projects.ts#sessionsDir`); a session bound to a project **space** lives at `<root>/<projectId>/spaces/<spaceId>/sessions/` instead (`sdk/org/libs/cli/src/server/projects.ts#spaceSessionsDir`) — hence the two separate session-listing routes.
- The app layer (`database/ api/ pages/ hooks/ …`) is a set of *additional* siblings inside `<root>/<projectId>/` — see [../../format/project/README.md](../../format/project/README.md).
- The root is materialized on first boot by `materializeRuntime(root)`, which copies the shipped system spaces into `<root>/system/spaces/` and creates the `user` skeleton (`sdk/org/libs/cli/src/cli/runtime-init.ts#materializeRuntime`).

---

## The default `user` project

`DEFAULT_PROJECT_ID = 'user'` (`sdk/org/libs/cli/src/server/projects.ts#DEFAULT_PROJECT_ID`). Two code paths create it, and they disagree on the display name:

- `materializeRuntime` writes `project.json` as `{ id: 'user', name: 'user', createdAt: <ISO string> }` (`sdk/org/libs/cli/src/cli/runtime-init.ts:120-127`).
- `ensureDefaultProject` — called by the server at boot in project mode (`sdk/org/libs/cli/src/server/serve.ts:115-121`) — scaffolds it with the display name **`'Personal'`**, but only when `project.json` is absent (`sdk/org/libs/cli/src/server/projects.ts#ensureDefaultProject`). `materializeRuntime` runs first on every `bin.ts` path, so `'user'` is the name you normally see.

Note the `createdAt` type mismatch: `ProjectMeta.createdAt` is a **number** (epoch ms) (`sdk/org/libs/cli/src/server/projects.ts#ProjectMeta`), but `materializeRuntime` writes an ISO **string**. `readProjectMeta` therefore ignores the non-numeric value and falls back to the file's own `mtimeMs` (`sdk/org/libs/cli/src/server/projects.ts#readProjectMeta`). It also normalizes the display name `name → title → id`, because store-installed apps synthesize a `project.json` carrying `title` rather than `name` (`sdk/org/libs/cli/src/server/projects.ts:271-297`).

`DELETE /api/projects/user` is refused with `400 { error: 'cannot delete the default project' }` — the route compares the raw id against the literal `'user'` before touching the manager (`sdk/org/libs/cli/src/server/routes/projects.ts#handleDeleteProject`).

---

## The synthetic `system` project

`listProjects` prepends a synthetic `{ id: 'system', name: 'System', createdAt: 0 }` entry whenever `<root>/system/spaces/` is non-empty, and skips the real `system/` directory in the normal scan (`sdk/org/libs/cli/src/server/projects.ts#listProjects`). Because `<root>/system/spaces/<id>` matches the generic `<root>/<projectId>/spaces/<id>` shape, **no space/file route needs a special case** — Studio browses and edits the system spaces through the ordinary `/api/projects/system/spaces/...` endpoints (`sdk/org/libs/cli/src/server/projects.ts:10-16`).

`system` is reserved: `deleteProject` throws `the system project cannot be deleted` (`sdk/org/libs/cli/src/server/projects.ts#deleteProject`) and `createProject` skips it when picking a slug — if the candidate equals `SYSTEM_PROJECT_ID` it is bumped to `<slug>-1`, `<slug>-2`, … instead (`sdk/org/libs/cli/src/server/session-manager.ts:1917-1921`).

`RESERVED_PROJECT_IDS = { system, api, assets, install }` exists to keep an app from shadowing a reserved lmthing.app URL path at the production root mount (`sdk/org/libs/cli/src/server/projects.ts:33-44`). It is enforced at **install** time only — `POST /api/apps/install` (`sdk/org/libs/cli/src/server/routes/apps.ts:206-211`) and `POST /api/store/spaces/install` (`sdk/org/libs/cli/src/server/routes/store-spaces.ts:220`, `:315`).

`POST /api/projects` does **not** check `RESERVED_PROJECT_IDS`. `handleCreateProject` validates only that `name` is a non-empty string (`sdk/org/libs/cli/src/server/routes/projects.ts#handleCreateProject`), and `createProject` guards the slug loop against `SYSTEM_PROJECT_ID` alone (`sdk/org/libs/cli/src/server/session-manager.ts:1907-1940`) — the set is imported only by `routes/apps.ts:39` and `routes/store-spaces.ts:37`, never by the create path. So `{"name":"api"}` is accepted and creates the project id `api`, while `{"name":"system"}` is deflected to `system-1`.

---

## List / create / delete

### `GET /api/projects`

Delegates to `manager.listProjects()` → `listProjects(root)`: every sub-directory of `<root>` that has a readable `project.json`, sorted by `createdAt` ascending, with the synthetic `system` entry unshifted to the front (`sdk/org/libs/cli/src/server/projects.ts#listProjects`). Any throw — notably `lmthingRoot not configured` when the server runs without a project root (`requireRoot`, `sdk/org/libs/cli/src/server/session-manager.ts:1887-1890`) — is answered **`503`**, not 400 (`sdk/org/libs/cli/src/server/routes/projects.ts#handleListProjects`).

```json
{ "projects": [
  { "id": "system", "name": "System",   "createdAt": 0 },
  { "id": "user",   "name": "user",     "createdAt": 1751000000000 },
  { "id": "blog",   "name": "Blog",     "createdAt": 1751200000000 }
] }
```

### `POST /api/projects`

Body `{ name: string }` — a **display name**, not an id. Rejected with `400` when it is not a non-empty string (`sdk/org/libs/cli/src/server/routes/projects.ts#handleCreateProject`). The id is derived by `slugify(name)` (lower-case, non-alphanumeric runs → `-`, trimmed, capped at 60 chars, `'project'` as the fallback — `sdk/org/libs/cli/src/server/projects.ts#slugify`) and made unique by appending `-1`, `-2`, … until `readProjectMeta` fails for that id, i.e. no `project.json` exists (`sdk/org/libs/cli/src/server/session-manager.ts:1912-1931`). The scaffold creates `spaces/`, `documents/`, `project.json` and an empty `instructions.md` (`sdk/org/libs/cli/src/server/projects.ts#scaffoldProject`), then emits the internal signal `project.created` with `fanOutAll: true` (`sdk/org/libs/cli/src/server/session-manager.ts:1938`).

```bash
curl -sX POST localhost:8080/api/projects \
  -H 'content-type: application/json' \
  -d '{"name":"My Blog"}'
# → 201 {"id":"my-blog"}
```

### `DELETE /api/projects/:projectId`

`204` on success; the whole `<root>/<projectId>/` tree is `rm -rf`'d (`sdk/org/libs/cli/src/server/projects.ts#deleteProject`). `400` for `user` (route-level guard, above) and `400` for `system` (thrown by `deleteProject`, surfaced by the route's catch — `sdk/org/libs/cli/src/server/routes/projects.ts#handleDeleteProject`). An invalid id (see *Path safety*) is also `400` (`sdk/org/libs/cli/src/server/session-manager.ts#SessionManager.requireRoot`).

---

## Instructions & documents

- `GET .../instructions` reads `<root>/<id>/instructions.md`, returning `{ content: '' }` when the file does not exist (`sdk/org/libs/cli/src/server/projects.ts#getInstructions`).
- `PUT .../instructions` takes `{ content }`; a missing or non-string `content` degrades to `''` rather than erroring (`sdk/org/libs/cli/src/server/routes/projects.ts#handlePutProjectInstructions`), and the parent dir is `mkdir -p`'d (`sdk/org/libs/cli/src/server/projects.ts#setInstructions`).
- `GET .../documents` lists the **file names** (not contents) in `<root>/<id>/documents/`, sorted (`sdk/org/libs/cli/src/server/projects.ts#listDocuments`).
- `POST .../documents` takes `{ name, content? }` → writes `<root>/<id>/documents/<name>`. `name` must be a non-empty string at the route (`sdk/org/libs/cli/src/server/routes/projects.ts#handleCreateDocument`) and a safe single segment at the manager (`safeDocumentName` — `sdk/org/libs/cli/src/server/projects.ts#safeDocumentName`, enforced at `session-manager.ts:1985-1986`); the write additionally re-asserts the resolved path stays under `documents/` (`sdk/org/libs/cli/src/server/projects.ts#addDocument`). A successful write emits the `document.written` internal signal (`sdk/org/libs/cli/src/server/session-manager.ts:1991`).

---

## Sessions listing

Both session routes read the persisted `meta.json` of each session dir and then **overlay live in-memory status** (`status`, `lastActivity`, `title`, `slug`, `messageCount`, `totalCostUsd`) for any session currently held by the manager, plus unshift live sessions that have not been persisted yet (a session created but not yet messaged). Result is newest-first by `lastActivity` (`sdk/org/libs/cli/src/server/session-manager.ts:1998-2041` and `:2048-2092`).

- `GET .../sessions` → `<root>/<projectId>/sessions/` (`sdk/org/libs/cli/src/server/projects.ts#listProjectSessions`). Live space-bound sessions are deliberately excluded from this list (`sdk/org/libs/cli/src/server/session-manager.ts:2022`).
- `GET .../spaces/:spaceId/sessions` → `<root>/<projectId>/spaces/<spaceId>/sessions/` (`sdk/org/libs/cli/src/server/projects.ts#listSpaceSessions`).

`PersistedSessionMeta` is `{ sessionId, projectId, agentSlug, spaceDir, spaceId?, title, slug?, createdAt, lastActivity, messageCount, status, totalCostUsd? }` (`sdk/org/libs/cli/src/server/projects.ts#PersistedSessionMeta`).

---

## Spaces listing

`GET /api/projects/:projectId/spaces` loads every dir under `<root>/<projectId>/spaces/` with `loadSpace(dir, { requireAgents: false })` and summarizes it. A space that fails to load is **skipped**, not fatal; the list is id-sorted (`sdk/org/libs/cli/src/server/session-manager.ts:2099-2130`).

`SpaceMeta` — every field is required in code, despite client-side types marking some optional (`sdk/org/libs/cli/src/server/session-manager.ts#SpaceMeta`):

| Field | Derivation |
|---|---|
| `id` | dir basename (`session-manager.ts:2113`) |
| `name` | first agent's `title` → `package.json` name → dir basename (`session-manager.ts:2110`) |
| `description` | first non-heading line of the first agent's instruct body (`describeSpace`, `session-manager.ts:2111`) |
| `agents` | `{ slug, title, actions: {id,label}[] }[]` (`session-manager.ts:2116-2120`) |
| `functionCount` | `Object.keys(space.functions).length` (`session-manager.ts:2121`) |
| `componentCount` | view + form components (`session-manager.ts:2122`) |
| `hasKnowledge` | `space.knowledge.domains` non-empty (`session-manager.ts:2123`) |

---

## Space files — the Studio↔pod sync contract

This is how every Studio editor persists: the client hydrates the whole space file map on mount and writes it back with a debounced bulk `PUT`.

### `GET .../spaces/:spaceId/files` → `{ files: Record<relPath, string> }`

Walks the space dir into a flat map with forward-slash keys. **Excluded on read**: a *top-level* `sessions/` dir, any `conversations/` dir at any depth, and the exact filename `.env`. Unreadable files are skipped; a missing dir yields `{}` (`sdk/org/libs/cli/src/server/projects.ts#readSpaceFiles`).

### `PUT .../spaces/:spaceId/files` — wipe-and-rewrite

Body `{ files: Record<relPath, string> }` (non-object → `400 files must be an object`; every key must pass `isSafeRelPath` → `400 unsafe file path: <rel>`; non-string values are coerced with `String(...)` — `sdk/org/libs/cli/src/server/routes/projects.ts:202-218`). The target dir is `rm -rf`'d and rewritten, so **deletions in the editor are reflected on disk** (`sdk/org/libs/cli/src/server/projects.ts:196-211`). It is *not* atomic — a plain remove-then-write; a crash mid-write leaves a partial tree.

> Read/write exclusions are **asymmetric**. The bulk `PUT` validates keys only with `isSafeRelPath` (`sdk/org/libs/cli/src/server/routes/projects.ts:212-214`; `writeSpaceFiles` at `projects.ts:200-203`) — it does **not** apply `isExcludedSpaceRelPath`, so a bulk PUT *can* write a `sessions/`, `conversations/` or `.env*` path that a subsequent `GET` would then filter out. Only the per-file `POST`/`PUT`/`DELETE` routes enforce the exclusion list (`sdk/org/libs/cli/src/server/projects.ts:233-252`).

### Per-file routes

- `POST .../files` — body `{ path, content }`, `201`. `path` must be a non-empty string at the route (`sdk/org/libs/cli/src/server/routes/projects.ts#handlePostProjectSpaceFile`).
- `PUT .../files/<rel/path>` — the rel path comes from the wildcard `params.rest`. The body is parsed as `{ content }`; **if it is not JSON (or has no string `content`) the raw body is used verbatim as the file content** (`sdk/org/libs/cli/src/server/routes/projects.ts#handlePutProjectSpaceFile`).
- `DELETE .../files/<rel/path>` — `204`; an `ENOENT` from the fs is mapped to `404 { error: 'file not found: <rel>' }`, anything else to `400` (`sdk/org/libs/cli/src/server/routes/projects.ts#handleDeleteProjectSpaceFile`).

All three go through `writeProjectSpaceFile` / `deleteProjectSpaceFile`, which reject an unsafe rel path (`unsafe file path`) **and** an excluded one — any `conversations/` segment, a top-level `sessions/`, or a `.env`-prefixed basename (`excluded file path`) (`sdk/org/libs/cli/src/server/projects.ts:219-252`).

```bash
# read the whole space
curl -s localhost:8080/api/projects/user/spaces/cooking/files

# write one file (JSON body)
curl -sX PUT localhost:8080/api/projects/user/spaces/cooking/files/agents/chef/instruct.md \
  -H 'content-type: application/json' \
  -d '{"content":"---\ntitle: Chef\n---\nYou are a chef.\n"}'
# → 200 {"ok":true}

# delete one file
curl -sX DELETE localhost:8080/api/projects/user/spaces/cooking/files/functions/old.ts
# → 204
```

---

## Completions

`GET /api/projects/:projectId/completions` → `{ completions: string[] }`, the `@`-autocomplete vocabulary for the chat composer. It unions three sources, each in its own `try/catch` so one bad space cannot empty the list: the project's own spaces, every system space under `<root>/system/spaces/`, and the project dir loaded as a space itself. Each contributes `@<spaceId>`, `@<spaceId>.<agentSlug>`, and `@<spaceId>.<agentSlug>.<actionId>` (`getAutocompleteWords`, `sdk/org/libs/cli/src/server/session-manager.ts:2132-2174`).

---

## Path safety & validation

- `safeProjectId(id)` — non-empty, ≤200 chars, no `/`, `\`, NUL, not `.`/`..`, and matching `^[a-zA-Z0-9_-]+$` (`sdk/org/libs/cli/src/server/projects.ts#safeProjectId`). Applied to `:spaceId` **at the route** for every space route (`400 invalid space id: <id>`) and to `:projectId` **inside the manager**, whose throw the route catches as `400 invalid project id: <id>`.
- `isSafeRelPath(p)` — relative, no NUL, and no empty / `.` / `..` segment (`sdk/org/libs/cli/src/server/projects.ts#isSafeRelPath`).
- `assertUnder(base, sub)` — every write additionally re-resolves the path and throws `path traversal detected` if it escapes the base (`sdk/org/libs/cli/src/server/projects.ts#assertUnder`).

## Auth

**None at this layer.** The pod server performs no token check on any project route; isolation comes from the pod's network position (one pod per user namespace, behind Envoy, which validates the gateway JWT). Only `/api/budget`, `/api/report-bug` (relay) and `/api/inbound` (HMAC) touch auth at all — see [./README.md](./README.md).

## Error shape

Every failure is `{ error: string }` via `sendJson` (`sdk/org/libs/cli/src/server/routes/utils.ts`). Common statuses:

| Status | When |
|---|---|
| `400` | invalid JSON body; missing/blank `name`/`path`; invalid project or space id; unsafe or excluded rel path; delete of `user` or `system` |
| `404` | `DELETE .../files/*` on a missing file (`ENOENT`) |
| `503` | `GET /api/projects` when the server has no `lmthingRoot` (non-project mode) |
| `500` | an unhandled handler rejection, injected by the router (`sdk/org/libs/cli/src/server/router.ts#Router.dispatch`) |

---

## See also

- [../../format/project/README.md](../../format/project/README.md) — what lives inside `<root>/<projectId>/`
- [./README.md](./README.md) — the full pod REST surface
- [./sessions.md](./sessions.md) — `POST /api/sessions { projectId }` (how a project is "selected")
- [./spaces.md](./spaces.md) — `POST /api/spaces` (the synced-space write path, separate from project spaces)
- [./apps.md](./apps.md) — `/api/projects/:projectId/app*` and store app install
- [./store-spaces.md](./store-spaces.md) — `/api/projects/:projectId/integrations`
- [./hooks.md](./hooks.md) — `/api/projects/:projectId/hooks/:slug/{run,disabled}`
