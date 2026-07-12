# Pod REST — spaces

Everything the pod exposes for **listing, reading and writing spaces**. Two families:

- **Project-scoped space routes** — `/api/projects/:projectId/spaces…` — the authoritative Studio ↔ pod contract for a space's files on disk `sdk/org/libs/cli/src/server/serve.ts:179-185`.
- **The sync route** — `POST /api/spaces` — writes an *edited* space to disk and hands back an absolute `spaceDir` to start a session against `sdk/org/libs/cli/src/server/serve.ts:190`.

Related: the route index → [./README.md](./README.md) · what a space *is* on disk → [../../format/space/README.md](../../format/space/README.md) · installing a space from the store → [./store-spaces.md](./store-spaces.md) · starting a session on one → [./sessions.md](./sessions.md).

---

## Route table

| Method | Path | Handler | Response |
|---|---|---|---|
| GET | `/api/projects/:projectId/spaces` | `handleListProjectSpaces` `routes/projects.ts:311-324` | `200 { spaces: SpaceMeta[] }` |
| GET | `/api/projects/:projectId/spaces/:spaceId/files` | `handleGetProjectSpaceFiles` `routes/projects.ts:172-189` | `200 { files: Record<relPath,string> }` |
| PUT | `/api/projects/:projectId/spaces/:spaceId/files` | `handlePutProjectSpaceFiles` `routes/projects.ts:191-225` | `200 { ok: true }` — **wipe-and-rewrite** |
| POST | `/api/projects/:projectId/spaces/:spaceId/files` | `handlePostProjectSpaceFile` `routes/projects.ts:227-254` | `201 { ok: true }` |
| PUT | `/api/projects/:projectId/spaces/:spaceId/files/*` | `handlePutProjectSpaceFile` `routes/projects.ts:256-283` | `200 { ok: true }` |
| DELETE | `/api/projects/:projectId/spaces/:spaceId/files/*` | `handleDeleteProjectSpaceFile` `routes/projects.ts:285-309` | `204` (`404` when missing) |
| GET | `/api/projects/:projectId/spaces/:spaceId/sessions` | `handleListSpaceSessions` `routes/projects.ts:153-170` | `200 { sessions: PersistedSessionMeta[] }` |
| POST | `/api/spaces` | `handleCreateSpace` `routes/spaces.ts:22-56` | `201 { spaceDir: string }` |

All eight are registered in the one `Router`, first-match-wins in registration order `sdk/org/libs/cli/src/server/serve.ts:179-190` · `sdk/org/libs/cli/src/server/router.ts:48-56`. The bulk `…/files` route is registered *before* the per-file `…/files/*` route, which matters because a trailing `/*` pattern compiles to `(?:/(.*))?` and therefore also matches the prefix with no rest segment `sdk/org/libs/cli/src/server/router.ts:33-46`.

The pod itself performs **no authentication** on these routes — there is no token check in `router.ts` or the space handlers; the pod is protected by its network position (one pod per user namespace behind the gateway). See [./README.md](./README.md).

---

## How a space maps onto disk

A space is a directory: `<lmthingRoot>/<projectId>/spaces/<spaceId>/` `sdk/org/libs/cli/src/server/projects.ts:157-159`. `:spaceId` is the **directory basename** — the same id the space format doc calls the space id ([../../format/space/README.md](../../format/space/README.md)) — and its contents are the `agents/ functions/ knowledge/ tasklists/ components/ events/ hooks/` tree that `loadSpace` reads.

The **system spaces are reachable through the same routes**: `<root>/system/spaces/<id>` matches the generic `<root>/<projectId>/spaces/<id>` shape, so the pod surfaces a synthetic project id `system` (`SYSTEM_PROJECT_ID`) and Studio browses/edits `system-global`, `user-thing`, … via `/api/projects/system/spaces/<id>/files` with no special-casing in the space routes `sdk/org/libs/cli/src/server/projects.ts:10-31`. `system` is reserved — it cannot be created or deleted as a normal project `sdk/org/libs/cli/src/server/projects.ts:33-43`.

Both `:projectId` and `:spaceId` are validated with `safeProjectId` — single segment, ≤200 chars, `^[a-zA-Z0-9_-]+$`; anything else is a `400` `sdk/org/libs/cli/src/server/projects.ts:58-67` · `routes/projects.ts:179-182`. Every relative file path is validated with `isSafeRelPath` — relative, no empty/`.`/`..` segment, no NUL `sdk/org/libs/cli/src/server/projects.ts:71-74` — and re-checked with a resolved-under-target assertion before any write (`assertUnder`, `sdk/org/libs/cli/src/server/projects.ts:127-133`).

---

## `GET /api/projects/:projectId/spaces` — list

Scans `<root>/<projectId>/spaces/*`, `loadSpace(dir, { requireAgents: false })`s each one, and summarizes it. Spaces that fail to load are **skipped**, not fatal; the list is id-sorted `sdk/org/libs/cli/src/server/session-manager.ts:2052-2083`.

```ts
// sdk/org/libs/cli/src/server/session-manager.ts:72-83
export interface SpaceMeta {
  id: string;            // dir basename — the stable id within the project
  name: string;          // first agent's title, else package name, else id
  description: string;   // first non-heading line of the first agent's instruct body
  agents: { slug: string; title: string; actions: { id: string; label: string }[] }[];
  functionCount: number;
  componentCount: number;
  hasKnowledge: boolean;
}
```

Every field is derived from the space format, not stored anywhere: `name` falls back first-agent-title → `package.json` name → dir basename; `description` is `describeSpace(instructBody)`, the first non-`#` line truncated to 140 chars `sdk/org/libs/cli/src/server/session-manager.ts:2060-2077,2246-2255`. `componentCount` sums `components/view` + `components/form`, and `hasKnowledge` is "the space declares ≥1 knowledge domain" `sdk/org/libs/cli/src/server/session-manager.ts:2074-2076`.

The same agent/action tree also feeds `GET /api/projects/:projectId/completions`, which flattens it into `@space`, `@space.agent`, `@space.agent.action` words for the chat composer `sdk/org/libs/cli/src/server/session-manager.ts:2085-2100`.

---

## `GET …/spaces/:spaceId/files` — read the whole space

Returns a flat `{ relPath: content }` map of every UTF-8 file under the space dir (forward-slash paths, `{}` if the dir does not exist) `sdk/org/libs/cli/src/server/projects.ts:167-193`. Three things are **excluded from the read**:

- a **top-level** `sessions/` dir `projects.ts:177`
- any `conversations/` dir **at any depth** `projects.ts:178`
- a file named exactly `.env` `projects.ts:181`

Unreadable files are skipped rather than failing the request `projects.ts:184-187`.

```bash
curl -s localhost:8080/api/projects/user/spaces/newsroom/files
# { "files": { "agents/researcher/instruct.md": "---\ntitle: …", "functions/fetchFeed.ts": "…" } }
```

---

## `PUT …/spaces/:spaceId/files` — bulk save (wipe-and-rewrite)

Body `{ files: Record<relPath, string> }`. Every key is `isSafeRelPath`-checked (`400` otherwise), non-string values are coerced with `String(...)`, then the handler delegates to `writeSpaceFiles` `routes/projects.ts:202-224`.

`writeSpaceFiles` **`rm -rf`s the space directory and rewrites it** from the map, so deletions made in the editor are reflected on disk `sdk/org/libs/cli/src/server/projects.ts:196-211`. It is not atomic — a plain remove-then-write, so a crash mid-write leaves a partial tree.

This is the single save path for Studio: `SpaceProvider` hydrates the space into the in-memory VFS on mount and writes it back with one debounced `PUT` (`SAVE_DEBOUNCE_MS = 1500`), which is why no Studio editor has its own save endpoint `sdk/org/libs/state/src/lib/contexts/SpaceContext.tsx:35-40,92,151`. The client filters the map with `isRunnableSpaceFile` (drops `*/conversations/*` and any `.env*` basename) before sending `sdk/org/libs/state/src/lib/pod/transport.ts:25-35,140,153`.

> **Hazard — a naive GET → PUT round-trip destroys runtime state.** The bulk `PUT` validates keys with `isSafeRelPath` only; it does **not** apply `isExcludedSpaceRelPath` `projects.ts:196-201`. Since it wipes the dir first, anything the `GET` withheld — `sessions/` (which is where a space-bound chat's snapshots live, `spaceSessionsDir` `projects.ts:455-457`), `conversations/`, `.env` — is deleted unless the caller re-sends it. The per-file routes below *do* enforce the exclusion list; the bulk route does not.

---

## Per-file routes

- **`POST …/spaces/:spaceId/files`** — body `{ path, content? }`; `path` must be a non-empty string (`400`), content is coerced to a string; `201 { ok: true }` `routes/projects.ts:238-253`.
- **`PUT …/spaces/:spaceId/files/<relPath>`** — the rest of the path is the file. The body is parsed as `{ content }`, and if it is not JSON (or has no `content`) **the raw body is used verbatim as the file content** `routes/projects.ts:268-276`.
- **`DELETE …/spaces/:spaceId/files/<relPath>`** — `204` on success; an `ENOENT` maps to `404 { error: 'file not found: …' }`, anything else to `400` `routes/projects.ts:297-308`.

All three land in `writeProjectSpaceFile` / `deleteProjectSpaceFile`, which enforce **both** `isSafeRelPath` and `isExcludedSpaceRelPath` — the latter rejecting a top-level `sessions/`, any `conversations/` segment, and any `.env`-prefixed basename (so `.env.local` is refused here even though the bulk `GET` would have leaked it… it does not, because `readSpaceFiles` only skips the exact name `.env`) `sdk/org/libs/cli/src/server/projects.ts:219-253`.

> Read and write exclusions are therefore **asymmetric**: the read filter drops exactly `.env`, the per-file write filter drops every `.env*` `projects.ts:181,224`.

```bash
# write one file
curl -X PUT localhost:8080/api/projects/user/spaces/newsroom/files/agents/researcher/instruct.md \
     -H 'content-type: application/json' -d '{"content":"---\ntitle: Researcher\n---\n"}'
# → 200 {"ok":true}

# delete one file
curl -X DELETE localhost:8080/api/projects/user/spaces/newsroom/files/functions/old.ts
# → 204
```

---

## `GET …/spaces/:spaceId/sessions` — that space's chats

Lists the persisted session metas under `<root>/<projectId>/spaces/<spaceId>/sessions/`, newest-first, with live status/title/cost overlaid for any session currently in memory, plus live sessions not yet persisted `sdk/org/libs/cli/src/server/session-manager.ts:2001-2045`. A space-bound chat is one created with `spaceRef` — it persists per-space rather than under `<project>/sessions/` `sdk/org/libs/cli/src/server/session-manager.ts:851-857,881-889`. Session shapes → [./sessions.md](./sessions.md).

---

## `POST /api/spaces` — sync an edited space, then run it

Body `{ name, files }`. `name` must be a single safe segment (no `/`, `\`, NUL, `.`/`..`, ≤200 chars) `routes/spaces.ts:9-14`; every `files` key must pass `isSafeRelPath` and resolve under the target dir `routes/spaces.ts:37-51`. The target dir is **wiped first** so editor deletions are reflected, then each file is written `routes/spaces.ts:47-54`. Response `201 { spaceDir }` — an **absolute path**, meant to be passed straight to `POST /api/sessions { spaceDir, agentSlug }` `routes/spaces.ts:17-20,55`.

The target root is not the caller's project: `spacesRoot` is `<lmthingRoot>/user/spaces` when the server runs in project mode, else `$SPACES_DIR` (default `/data/spaces`) `sdk/org/libs/cli/src/server/serve.ts:111-114` · `sdk/org/libs/cli/src/server/router.ts:5-11`.

This is the "edit in the browser, run it now" path used by `ReplRpcClient.syncSpace` before `createSession` (Studio's agent-chat route and the embeddable `AgentChatPanel` in `sync` mode) `sdk/org/libs/ui/src/chat/client/rpc-client.ts:48-62`.

```bash
curl -X POST localhost:8080/api/spaces -H 'content-type: application/json' \
  -d '{"name":"scratch","files":{"agents/default/instruct.md":"---\ntitle: Scratch\n---\nSay hi.\n"}}'
# → 201 {"spaceDir":"/data/.lmthing/user/spaces/scratch"}
```

---

## How spaces get onto the pod in the first place

| Origin | Mechanism |
|---|---|
| Shipped system spaces | `materializeRuntime` copies each `defaultSystemSpaceDirs()` entry into `<root>/system/spaces/<name>/` on boot `sdk/org/libs/cli/src/cli/runtime-init.ts` — see [../commands.md](../commands.md) |
| Store install | `POST /api/store/spaces/install` writes `<root>/<projectId>/spaces/<spaceId>/` `sdk/org/libs/cli/src/server/routes/store-spaces.ts:215-229` — see [./store-spaces.md](./store-spaces.md) |
| Studio authoring | the space-file routes above |
| Browser scratch sync | `POST /api/spaces` (always into the `user` project's `spaces/`) |
| Agent authoring | the `registerSpace` / `installSpace` runtime globals — see [../../runtime-globals/store-and-consent.md](../../runtime-globals/store-and-consent.md) |

Once a space directory exists under a project, it is addressable by `spaceRef` (`"<spaceId>/<agentSlug>"`, agent optional) when creating a session `sdk/org/libs/cli/src/server/session-manager.ts:2223-2226` — see [./sessions.md](./sessions.md).
