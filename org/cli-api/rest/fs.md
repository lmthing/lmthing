# Pod REST — `fs` (raw workspace filesystem)

Three routes over the pod's workspace root: list every file, read one file, write one file. They are the transport under the `/computer` IDE's file tree and editor. See [`./README.md`](./README.md) for the full pod route index.

| Method | Path | Handler |
|---|---|---|
| `GET` | `/api/fs/tree` | `handleFsTree` `sdk/org/libs/cli/src/server/serve.ts:201` |
| `GET` | `/api/fs/read?path=<rel>` | `handleFsRead` `sdk/org/libs/cli/src/server/serve.ts:202` |
| `PUT` | `/api/fs/write` | `handleFsWrite` `sdk/org/libs/cli/src/server/serve.ts:203` |

All three are implemented in `sdk/org/libs/cli/src/server/routes/fs.ts` and reply with JSON via the shared `sendJson(res, status, obj)` helper `sdk/org/libs/cli/src/server/routes/utils.ts:9-12`.

> **There is no delete route.** `rg 'api/fs' sdk/org/libs sdk/org/apps` returns only these three. The IDE's "delete" is a client-side optimistic removal with the comment `// Optimistically remove from local state; no delete API yet` `sdk/org/apps/web/src/routes/computer/use-ide-files.ts:108-110`. The only server-side deletion path for the raw workspace is the terminal PTY, whose cwd is the *same* root (`terminalCwd = effectiveLmthingRoot ?? process.cwd()` `sdk/org/libs/cli/src/server/serve.ts:373`, opened at `WS /api/terminals/:termId` `sdk/org/libs/cli/src/server/serve.ts:382-384`). Per-file `DELETE` does exist for *space* files — a different API (`DELETE /api/projects/:projectId/spaces/:spaceId/files/*`, see [`./projects.md`](./projects.md)).

## The root

Every handler resolves paths against one root: `resolve(ctx.effectiveLmthingRoot ?? process.cwd())` `sdk/org/libs/cli/src/server/routes/fs.ts:14` (also `:42`, `:62`). `effectiveLmthingRoot` is threaded through the router's `ServerContext` `sdk/org/libs/cli/src/server/router.ts:6-11` and computed once at boot as `manager.lmthingRoot ?? opts.lmthingRoot` `sdk/org/libs/cli/src/server/serve.ts:109` — i.e. the pod runtime root (`LMTHING_ROOT`, prod `/data/.lmthing`; else `<cwd>/.lmthing`). When the server runs outside project mode the root falls back to the process cwd `sdk/org/libs/cli/src/server/routes/fs.ts:14`.

## Path safety

`GET /api/fs/read` and `PUT /api/fs/write` apply the same two-step guard `sdk/org/libs/cli/src/server/routes/fs.ts:45-47` / `:68-70`:

1. `isSafeRelPath(p)` — rejects a non-string, the empty string, any leading `/`, a `\0`, and any `''` / `.` / `..` segment `sdk/org/libs/cli/src/server/projects.ts:71-74`. Failure ⇒ `400 { "error": "invalid path" }`.
2. A resolved-prefix check: `abs = resolve(fsRoot, filePath)` must equal `fsRoot` or start with `fsRoot + sep` `sdk/org/libs/cli/src/server/routes/fs.ts:46-47`. Failure ⇒ `400 { "error": "path traversal" }`.

The check uses `path.resolve`, not `fs.realpath` `sdk/org/libs/cli/src/server/routes/fs.ts:46` — a symlink *inside* the root that points outside it is not detected. The pod itself is the security boundary (one pod per user namespace); these routes carry no auth of their own.

## `GET /api/fs/tree`

Recursively walks the root and returns every **file** path, relative, `/`-joined `sdk/org/libs/cli/src/server/routes/fs.ts:18-33`.

- Excluded directories: `.git`, `node_modules`, `.cache` `sdk/org/libs/cli/src/server/routes/fs.ts:16,24`.
- Directories are not listed — only entries where `entry.isFile()` `sdk/org/libs/cli/src/server/routes/fs.ts:26-28`. An empty directory is therefore invisible to the tree (hence the IDE's `.gitkeep` trick, below). A `Dirent` that is neither a file nor a directory (e.g. a symlink) is skipped.
- A `readdir` failure on a subdirectory is swallowed and that subtree is skipped `sdk/org/libs/cli/src/server/routes/fs.ts:20`.
- No depth cap, no pagination, no mtime/size — the response is a flat string array.

```
GET /api/fs/tree
200 { "files": ["user/project.json", "user/instructions.md", "system/spaces/user-thing/package.json", ...] }
```

## `GET /api/fs/read?path=<rel>`

Reads the file as **utf8** and returns its text `sdk/org/libs/cli/src/server/routes/fs.ts:48-53`.

| Outcome | Status / body |
|---|---|
| ok | `200 { "content": "<utf8 text>" }` |
| `path` fails `isSafeRelPath` | `400 { "error": "invalid path" }` |
| resolves outside the root | `400 { "error": "path traversal" }` |
| `ENOENT` | `404 { "error": "file not found" }` |
| any other read error | `400 { "error": "cannot read file (binary or unreadable)" }` |

There is no binary mode: the handler is text-only (`readFile(abs, 'utf8')` `sdk/org/libs/cli/src/server/routes/fs.ts:49`). A missing `path` query param becomes `''`, which fails `isSafeRelPath` ⇒ `400 invalid path` `sdk/org/libs/cli/src/server/routes/fs.ts:44-45`. Note the router matches on `pathname` only, so the query string never affects route matching `sdk/org/libs/cli/src/server/router.ts:62`.

## `PUT /api/fs/write`

Body: JSON `{ path, content }` `sdk/org/libs/cli/src/server/routes/fs.ts:63-67`.

- A body that is not valid JSON ⇒ `400 { "error": "invalid JSON body" }` `sdk/org/libs/cli/src/server/routes/fs.ts:64-65`.
- A non-string `path` degrades to `''` and then fails the safety check (`400 invalid path`); a non-string/absent `content` degrades to `''` — i.e. **a write with no `content` truncates the file** `sdk/org/libs/cli/src/server/routes/fs.ts:66-67`.
- Parent directories are created (`mkdir(dirname(abs), { recursive: true })`) before the utf8 write `sdk/org/libs/cli/src/server/routes/fs.ts:72-73`. Create-file and overwrite are the same call; there is no `If-Match`/mtime check, so concurrent writers are last-write-wins.
- Any fs error ⇒ `500 { "error": "<message>" }` `sdk/org/libs/cli/src/server/routes/fs.ts:74-76`; success ⇒ `200 { "ok": true }` `sdk/org/libs/cli/src/server/routes/fs.ts:77`.

```bash
curl -X PUT http://localhost:8080/api/fs/write \
  -H 'content-type: application/json' \
  -d '{"path":"user/instructions.md","content":"# Notes\n"}'
# {"ok":true}
```

## Relation to `@lmthing/state`

`@lmthing/state` exposes these three routes verbatim on `PodTransport` — the REST client every web surface uses `sdk/org/libs/state/src/lib/pod/transport.ts:161-183`:

```ts
/** `GET /api/fs/tree` → `{ files: string[] }` — all file paths relative to pod workspace root. */
async listFiles(): Promise<string[]> { … }
/** `GET /api/fs/read?path=<encoded>` → `{ content: string }`. */
async readFile(path: string): Promise<string> { … }
/** `PUT /api/fs/write` `{ path, content }` — write a file at `path`. */
async writeFile(path: string, content: string): Promise<void> { … }
```

There is no `deleteFile` on the transport — the class's method list stops at `writeFile` and `connectTerminal` `sdk/org/libs/state/src/lib/pod/transport.ts:163-190`. Every request attaches `authorization: Bearer <token>` from `getAccessToken()` and retries **once** after `refresh()` on a `401` `sdk/org/libs/state/src/lib/pod/transport.ts:50-70`. The transport is constructed by `AppProvider` from its `pod: { podBaseUrl, getAccessToken, refresh }` config `sdk/org/libs/state/src/lib/contexts/AppContext.tsx:92-102` and reached as `useApp().transport`.

**These routes are *not* the VFS.** `@lmthing/state`'s in-memory VFS (`AppFS` / `SpaceFS`, the `useFile`/`useGlob`/`useDir` hooks — see [`sdk/org/libs/state/CLAUDE.md`](../../../sdk/org/libs/state/CLAUDE.md)) is hydrated from and flushed to the **space-file** API (`GET`/`PUT /api/projects/:projectId/spaces/:spaceId/files`, whole-space wipe-and-rewrite) via `loadSpaceFiles`/`saveSpaceFiles` `sdk/org/libs/state/src/lib/pod/transport.ts:134-158` — documented in [`./projects.md`](./projects.md). The transport's own doc comment says so: *"File I/O is whole-space granularity … There is no per-file or watch channel"* `sdk/org/libs/state/src/lib/pod/transport.ts:38-46`.

`/api/fs/*` is the **raw workspace** escape hatch that bypasses AppFS entirely: it is per-file, root-relative, and has no event bus. Its only consumer in the tree is the `/computer` IDE (`useIdeFiles`), which:

- calls `transport.listFiles()` once on mount and feeds `buildTree()` `sdk/org/apps/web/src/routes/computer/use-ide-files.ts:44-65`;
- lazily `transport.readFile(path)` on tab open, caching content in local React state (no FSEventBus) `sdk/org/apps/web/src/routes/computer/use-ide-files.ts:67-81`;
- writes back through a **1500 ms per-path debounce** `sdk/org/apps/web/src/routes/computer/use-ide-files.ts:23-41,122-126`;
- creates a file by writing empty content, and creates a *directory* by writing `<dir>/.gitkeep` — because `GET /api/fs/tree` only returns files `sdk/org/apps/web/src/routes/computer/use-ide-files.ts:83-106`.

## Related

- [`./README.md`](./README.md) — pod REST index
- [`./projects.md`](./projects.md) — the project/space file API that backs the `@lmthing/state` VFS
- [`../../computer/features.md`](../../computer/features.md) — the IDE built on these routes
