# `@lmthing/state` — the in-memory VFS

`@lmthing/state` is the browser-side state layer for the web SPAs (Studio/Chat/Computer). It is a **single in-memory virtual filesystem** (`AppFS` — a `Map<string, string>` of `path → content`) with a fine-grained event bus, scoped views (`ProjectFS`/`SpaceFS`), a React context/hook API, an unsaved-edit `DraftStore`, format parsers, and a `PodTransport` that makes the VFS a **write-through cache over the compute pod's PVC** (`sdk/org/libs/state/package.json` `"name": "@lmthing/state"`). It never talks to `@lmthing/auth`; the host injects a token getter (`sdk/org/libs/state/src/lib/pod/transport.ts:5-24`).

Public entry: `sdk/org/libs/state/src/index.ts:1-18` re-exports the types, `lib/fs`, `lib/pod`, `lib/contexts`, and every hook, plus the named providers `AppProvider`/`ProjectProvider`/`SpaceProvider`.

See also: [org/libs README](./README.md) · the on-disk shape this VFS mirrors → [../format/space/README.md](../format/space/README.md) · [../format/project/README.md](../format/project/README.md).

## The VFS model

All file data lives in one flat `Map<string, string>` inside `AppFS` (`sdk/org/libs/state/src/lib/fs/AppFS.ts:9-16`). A "path" is a `/`-joined key; there are no directory objects — directories are inferred from key prefixes at read time (`readDir`, `sdk/org/libs/state/src/lib/fs/AppFS.ts:32-55`). `FileTree` is the exported alias `Record<string, string>` (`sdk/org/libs/state/src/types/project.ts:3`).

Key layout (no username segment — the pod is per-user; `sdk/org/libs/state/src/lib/fs/paths.ts:3-12`):

```
<projectId>/
  lmthing.json                       # project config (P.projectConfig)
  .env, .env.<suffix>                # env files (P.projectEnv)
  <spaceId>/
    package.json
    agents/<slug>/
      instruct.md                    # frontmatter + system-prompt body
      conversations/<cid>.json
    tasklists/<name>/
      index.md                       # optional manifest
      NN-<id>.md                     # zero-padded ordered task files
    functions/<name>.ts
    components/view/<name>.tsx · components/form/<name>.tsx
    knowledge/<domain>/
      index.md                       # domain descriptor (optional)
      <field>/index.md               # field descriptor (required — identifies a field)
      <field>/<slug>.md              # selectable option / aspect
```

These are exactly the keys the `P` path-builder object emits (`sdk/org/libs/state/src/lib/fs/paths.ts:13-108`); `P.globs.*` supplies the matching glob patterns (e.g. `allAgents: 'agents/*/instruct.md'`, `allKnowledgeIndexes: 'knowledge/*/*/index.md'`, `tasklistTasks(name)`; `sdk/org/libs/state/src/lib/fs/paths.ts:71-107`).

### `AppFS` public API (`FSInterface`)

`AppFS` and every scoped class implement `FSInterface` (`sdk/org/libs/state/src/lib/fs/FSInterface.ts:12-60`):

| Group | Methods | Source |
|---|---|---|
| Store snapshot (React) | `subscribe(cb)`, `getSnapshot()` | `AppFS.ts:19-25` |
| Read | `readFile(path)`, `readDir(path)`, `glob(pattern)`, `globRead(pattern)` | `AppFS.ts:28-73` |
| Write (sync) | `writeFile`, `appendFile`, `deleteFile`, `deletePath`, `renamePath`, `duplicatePath`, `batch(ops)`, plus `has(path)` — `has` is **AppFS-only**, it is not in `FSInterface` (`FSInterface.ts:23-30`) and `ScopedFS` does not implement it | `AppFS.ts:76-191` (`has` at `84-86`) |
| Write (streaming) | `streamWriteFile(path, AsyncIterable<string>)`, `streamAppendFile(...)` — accumulate the stream then commit one write | `AppFS.ts:194-208` |
| Events | `onAny`, `onFile`, `onFileCreate/Update/Delete/Rename`, `onDir`, `onDirAdd/Remove/Rename`, `onPrefix`, `onGlob`, `onBatch`, `getEventBus()` | `AppFS.ts:211-271` |
| Data | `export()`, `import(data)` | `AppFS.ts:274-287` |

- `writeFile` emits `create` if the key is new, else `update` (`sdk/org/libs/state/src/lib/fs/AppFS.ts:76-81`). `deletePath`/`renamePath`/`duplicatePath` operate on a **prefix** (the key itself plus everything under `prefix + '/'`), emitting one event per affected key (`sdk/org/libs/state/src/lib/fs/AppFS.ts:103-164`).
- `batch(ops)` wraps a `FileOp[]` (`write`/`append`/`delete`/`rename`/`duplicate`; `sdk/org/libs/state/src/types/project.ts:50-55`) in `bus.beginBatch()/endBatch()` so subscribers get one coalesced `BatchEvent` (`sdk/org/libs/state/src/lib/fs/AppFS.ts:166-191`).
- `import(data)` clears the store, re-seeds it, then re-emits a `create` per key (`sdk/org/libs/state/src/lib/fs/AppFS.ts:278-287`).

### Scoped views: `ProjectFS` / `SpaceFS`

`ScopedFS` wraps a root `AppFS` with a path prefix and transparently joins the prefix on the way in and strips it on the way out — for reads, writes, glob results, **and events** (`sdk/org/libs/state/src/lib/fs/ScopedFS.ts:30-294`). `joinPath`/`stripPrefix`/`normalizePrefix` (`ScopedFS.ts:8-28`) handle the prefix arithmetic. So a `SpaceFS` consumer only ever sees space-relative paths like `agents/bot/instruct.md`.

- `ProjectFS` scopes to `<projectId>` (`sdk/org/libs/state/src/lib/fs/ScopedFS.ts:304-308`).
- `SpaceFS` scopes to `<projectId>/<spaceId>` (`sdk/org/libs/state/src/lib/fs/ScopedFS.ts:310-322`); `SpaceFS.fromProjectFS(projectFS, spaceId)` derives it from a `ProjectFS` (`ScopedFS.ts:315-321`).
- Every scoped method delegates to the root (e.g. `writeFile → root.writeFile(joinPath(prefix, path))`, `ScopedFS.ts:100-102`), and event callbacks re-map `path`/`oldPath`/`dir` back to scope-local before firing (`ScopedFS.ts:165-284`). `getRoot()`/`getPrefix()` expose the underlying `AppFS` and prefix (`ScopedFS.ts:286-293`).

## The event bus (`FSEventBus`)

`AppFS` owns one `FSEventBus` (`sdk/org/libs/state/src/lib/fs/AppFS.ts:11-16`). Every mutation calls `bus.emit(event)`; when a batch is open the event is queued instead (`sdk/org/libs/state/src/lib/fs/FSEventBus.ts:46-54`). `dispatchEvent` fans a single `FSEvent` (`{type, path, oldPath?, content?, timestamp}`; `sdk/org/libs/state/src/lib/fs/events.ts:3-11`) to the listener families below, in this order (`FSEventBus.ts:71-141`):

1. **`onAny`** — every event (`FSEventBus.ts:73-75`).
2. **`onFile` / `onFileCreate` / `onFileUpdate` / `onFileDelete` / `onFileRename`** — exact-path maps; the typed variants unwrap to `content` / `newPath` (`FSEventBus.ts:80-123`, subscribe at `239-277`).
3. **`onPrefix`** — a **trie** keyed by path segment; walking the event path fires every ancestor node's callbacks, so `onPrefix('a')` receives events for `a/b/c` (`FSEventBus.ts:143-155`, `313-332`). This is what powers scoped subscriptions and the space write-back (below).
4. **directory listeners** — `onDir`/`onDirAdd`/`onDirRemove`/`onDirRename` fire only for the file's **immediate** parent dir, translating `create/delete/rename` into `add/remove/rename` `DirEvent`s (`sdk/org/libs/state/src/lib/fs/events.ts:13-21`; dispatch `FSEventBus.ts:157-220`).
5. **`onGlob`** — patterns compiled to regex (with brace expansion) and tested against the path (`FSEventBus.ts:134-140`, `335-364`).

Batch control: `beginBatch`/`endBatch` are ref-counted; on the outermost `endBatch` the queued events are flushed via `emitBatch`, which dispatches each individually **and** notifies `onBatch` subscribers (`sdk/org/libs/state/src/lib/fs/FSEventBus.ts:56-69`, `373-396`). Every `on*` method returns an `Unsubscribe` (`sdk/org/libs/state/src/types/project.ts:57`).

## Glob engine

Globbing is a **custom** implementation (not minimatch). `globToRegex` compiles a pattern to an anchored `RegExp` supporting `*` (no `/`), `**` (crosses `/`, with `/**/`→optional-segments handling), `?`, `[a-z]`/`[!a-z]` classes, the extglobs `@()`/`*()`/`+()`/`?()`/`!()`, and a leading `!` negation (`sdk/org/libs/state/src/lib/fs/glob.ts:57-156`). `expandBraces` pre-expands `{a,b}` alternations (`glob.ts:188-210`). `AppFS.glob`/`globRead` expand braces then union the regexes (`sdk/org/libs/state/src/lib/fs/AppFS.ts:57-73`). Helpers: `testPath`, `compileGlob`, `matchAny`, `filterPaths`, `isValidGlob` (`glob.ts:158-230`).

## Auxiliary stores

- **`DraftStore`** — an in-memory `Map` of unsaved edits, entirely separate from `AppFS` (`sdk/org/libs/state/src/lib/fs/DraftStore.ts:13-103`). `set/get/has/delete/clear`, bulk `getAll/getPaths/isEmpty/getCount`, per-path `onChange(path, cb)`, and `useSyncExternalStore`-compatible `subscribe`/`getSnapshot`. Drafts never persist and never touch the pod — the editor writes a draft on keystroke, then commits it to the FS and deletes the draft on save.
- **`UIStore`** — ephemeral transient view state (expanded sections, open modals) as a `Map<string, unknown>` with a memoized snapshot; `get/set/delete/has/clear` + `subscribe`/`getSnapshot`, `set` no-ops when the value is `Object.is`-equal (`sdk/org/libs/state/src/lib/fs/UIStore.ts:12-66`).

## Parsers (`lib/fs/parsers/` + `crypto/`)

Each parser exports a `parseXXX`/`serializeXXX` pair (all re-exported from `sdk/org/libs/state/src/lib/fs/index.ts:13-20`):

- **`frontmatter.ts`** — `parseFrontmatter<T>(content)` → `{frontmatter, content, raw}` and `serializeFrontmatter`. This is a **simple inline** YAML reader: it splits on the first `:` per line and understands quoted scalars, inline `{}`/`[]`, booleans, `null`/`~`, numbers (`sdk/org/libs/state/src/lib/fs/parsers/frontmatter.ts:13-100`). It does **not** handle multi-line block lists/maps — which is why `instruct.ts` and `tasklist.ts` ship their own block-YAML readers.
- **`instruct.ts`** — `parseAgentInstruct` (`sdk/org/libs/state/src/lib/fs/parsers/instruct.ts:235-263`) / `serializeAgentInstruct` (`instruct.ts:276-334`) for `agents/<slug>/instruct.md`. Its own indentation-aware `parseBlockYaml` handles block lists and block mappings (`instruct.ts:39-187`). `AgentInstruct = {title, knowledge[], functions[], components[], actions[]{id,label,description,tasklist}, defaultAction?, canDelegateTo[], body}` (`instruct.ts:13-31`); it accepts the legacy `dependencies` key as a fallback for `canDelegateTo` (`instruct.ts:259-260`).
- **`tasklist.ts`** — `parseTasklistTask(filename, content)`/`serializeTasklistTask` and `parseTasklistIndex`/`serializeTasklistIndex`, plus `tasklistTaskFilename(order, id)`. `TasklistTask = {order, id, instruction, input?, output, dependsOn?, optional?, goal?, condition?}`; `order`/`id` come from the `NN-<id>.md` filename (`sdk/org/libs/state/src/lib/fs/parsers/tasklist.ts:89-148`, `255-257`). A **block-YAML** reader preserves the nested `input`/`output` maps the shared inline parser would flatten (`tasklist.ts:10-78`).
- **`config.ts`** — `parseKnowledgeFieldIndex` (`KnowledgeFieldIndex = {type, variable, default?, label?, fieldType?, required?}` + `description` body) and `parseKnowledgeDomainIndex` (`KnowledgeDomainIndex = {label?, icon?, color?, renderAs?}`), with serializers (`sdk/org/libs/state/src/lib/fs/parsers/config.ts:13-78`).
- **`knowledge-option.ts`** — `parseKnowledgeOption`/`serializeKnowledgeOption` for `<field>/<slug>.md`; enforces the allow-list `KNOWLEDGE_OPTION_ALLOWED_KEYS = [description, icon, color, label]` and **throws** on any other frontmatter key (`sdk/org/libs/state/src/lib/fs/parsers/knowledge-option.ts:22-56`).
- **`conversation.ts`** — `parseConversation`/`serializeConversation` for `conversations/<cid>.json` plus `createConversation`/`addMessage` helpers; `serialize` refreshes `updatedAt`/`messageCount` (`sdk/org/libs/state/src/lib/fs/parsers/conversation.ts:24-94`).
- **`crypto/env.ts`** — `parseEnvFile`/`serializeEnvFile` (plain dotenv), plus **AES-GCM** encryption (`encryptEnvFile`/`decryptEnvFile`, PBKDF2/SHA-256, 100k iterations, `-----BEGIN ENCRYPTED ENV-----` envelope) and a weaker synchronous XOR fallback (`encryptEnvFileSync`/`decryptEnvFileSync`), with `isEncrypted`/`verifyPassword` and key utilities (`sdk/org/libs/state/src/lib/fs/crypto/env.ts:29-315`).

## The pod bridge (`lib/pod/transport.ts`)

`PodTransport` is a thin wrapper over the pod's project/space REST API (see [../cli-api/README.md](../cli-api/README.md)). It is constructed with `{baseUrl, getAccessToken, refresh?}` — `getAccessToken` is read **per request** so a rotated token is always fresh, and a `401` triggers one `refresh()` + retry (`sdk/org/libs/state/src/lib/pod/transport.ts:13-86`). Routes it hits:

| Method | Route | Source |
|---|---|---|
| `listProjects()` | `GET /api/projects` | `transport.ts:98-103` |
| `createProject(name)` | `POST /api/projects` | `transport.ts:106-111` |
| `deleteProject(id)` | `DELETE /api/projects/:id` | `transport.ts:113-118` |
| `listSpaces(projectId)` | `GET /api/projects/:id/spaces` | `transport.ts:123-126` |
| `loadSpaceFiles(projectId, spaceId)` | `GET /api/projects/:id/spaces/:sid/files` | `transport.ts:134-143` |
| `saveSpaceFiles(projectId, spaceId, files)` | `PUT .../files` (wipe-and-rewrite) | `transport.ts:150-159` |
| `listFiles()` / `readFile(path)` / `writeFile(path, content)` | `GET /api/fs/tree`, `GET /api/fs/read`, `PUT /api/fs/write` (raw IDE tree) | `transport.ts:164-183` |
| `connectTerminal(command?)` | `WS /api/terminals/:termId` (PTY; text frames out, JSON control frames in) | `transport.ts:191-231` |

File I/O is **whole-space granularity** — no per-file or watch channel (`sdk/org/libs/state/src/lib/pod/transport.ts:38-46`). Both `loadSpaceFiles` and `saveSpaceFiles` filter through `isRunnableSpaceFile` so `conversations/` history and `.env*` are never round-tripped from the editor (`transport.ts:31-36`, `138-142`, `151-158`).

## React contexts — how Studio reads and writes a space

Three nested providers wire the VFS into React (`sdk/org/libs/state/src/lib/contexts/index.ts:1-7`; mount order `AppProvider` → `ProjectProvider` → `SpaceProvider`):

**`AppProvider`** (`sdk/org/libs/state/src/lib/contexts/AppContext.tsx:74-195`) owns the singleton `AppFS`, `DraftStore`, `UIStore`, and — when given `pod` config — a `PodTransport` (`AppContext.tsx:84-102`). It fetches the project list on mount and on window focus, and exposes `projects`, `currentProjectId`, `refreshProjects`, `setCurrentProject`, `createProject`, `deleteProject` via `useApp()` (`AppContext.tsx:114-203`). Mounting **without** `pod`/`transport` (ephemeral mode, e.g. the Computer app) leaves `transport: null` and turns the pod features into no-ops (`AppContext.tsx:31-48`, `88-102`). Testing seams: `appFS`/`draftStore`/`uiStore`/`transport`/`initialProjectId`/`skipFetch` props (`AppContext.tsx:52-72`).

**`ProjectProvider`** (`sdk/org/libs/state/src/lib/contexts/ProjectContext.tsx:38-103`) builds a `ProjectFS` for the active project id (its own prop, else `currentProjectId`) and loads that project's space list via `transport.listSpaces`, exposing `projectFS`, `spaces`, `currentSpaceId`, `setCurrentSpace`, `refreshSpaces` through `useProject()`.

**`SpaceProvider`** (`sdk/org/libs/state/src/lib/contexts/SpaceContext.tsx:37-179`) is where read/write against the pod actually happens, absorbing the old studio sync logic:

- **Hydrate on entry** — on first visit to a `projectId/spaceId` prefix it calls `transport.loadSpaceFiles` and merges the pod files into `AppFS`, keyed `projectId/spaceId/<relPath>`. It **skips any path already present** and never wipes, so a stale pod snapshot can't clobber a newer local edit; a `hydratedRef` set prevents re-fetching, and a fetch failure clears the marker to allow retry (`SpaceContext.tsx:64-120`).
- **Debounced write-back** — it subscribes to `appFS.onPrefix(prefix)` and, `saveDebounceMs` (default **1500 ms**) after the last change, collects the space's current file map (filtered by `isRunnableSpaceFile`) and fires `transport.saveSpaceFiles` — fire-and-forget, errors only logged, with a best-effort flush on unmount (`SpaceContext.tsx:31-35`, `122-169`).
- It exposes `spaceFS` (a `SpaceFS`), `spaceId`, `isLoading`, `error` via `useSpaceContext()` (`SpaceContext.tsx:17-24`, `171-187`).

This is the full loop: **pod PVC → `loadSpaceFiles` → `AppFS` → hooks render → editor writes → `AppFS` events → debounced `saveSpaceFiles` → pod PVC.** `AppFS` is the write-through cache in the middle.

## Hooks (consuming the VFS)

Hooks are re-exported from `sdk/org/libs/state/src/hooks/index.ts:1-22`. All FS-reading hooks use `useSyncExternalStore` over the bus so a component re-renders exactly when its slice changes.

**Context accessors:** `useApp()` (`AppContext.tsx:197-203`), `useProject()` (`ProjectContext.tsx:105-111`), `useSpaceContext()` (`SpaceContext.tsx:181-187`); also aliased `useAppContext`/`useProjectContext` (`contexts/index.ts:3-5`).

**FS-instance hooks** (`sdk/org/libs/state/src/hooks/fs/index.ts:3-12`): `useAppFS()` → the root `AppFS` (`useAppFS.ts:7-10`); `useProjectFS()` → `ProjectFS | null` (`useProjectFS.ts:6-9`); `useSpaceFS(spaceId?)` → `SpaceFS | null`, defaulting to the context space (else deriving one from `currentSpaceId`, or from an explicit `spaceId`) (`sdk/org/libs/state/src/hooks/fs/useSpaceFS.ts:7-18`).

**File/dir/glob hooks — all of them read through `useSpaceFS()`, i.e. they are SPACE-scoped** (see the gotcha below): `useFile(path)` subscribes to that one file and returns its content or `null` (`sdk/org/libs/state/src/hooks/fs/useFile.ts:8-14`); `useFileWatch` (`useFile.ts:16-22`); `useDir`/`useDirWatch` (`useDir.ts:10-48`); `useGlob`/`useGlobWatch` (`useGlob.ts:10-58`); `useGlobRead` → `FileTree` (`useGlobRead.ts:10-33`); `useFileFrontmatter<T>` (`useFileFrontmatter.ts:10-24`); `useFileConfig<T>` (`useFileConfig.ts:9-25`); `useStreamWrite`/`useStreamAppend` (`useStreamWrite.ts:6-46`).

**Draft hooks** (`sdk/org/libs/state/src/hooks/useDraft.ts`): `useDraft(path)` (`:11-22`), `useHasDraft(path)` (`:24-34`), `useDraftsByPattern(regex)` (`:36-54`), `useDraftMutations()` (`:60-98`), `useFileWithDraft(path)` — draft-shadowed read (`:104-112`), `useUnsavedPaths()` (`:117-135`); plus `useUnsavedChanges()` (draft count), `useHasUnsavedChanges()` and `useDraftPaths()` (`sdk/org/libs/state/src/hooks/useUnsavedChanges.ts:6-36`).

**UI-state hooks:** `useUIState<T>(key, initial)` and `useToggle(key, initial)` over `UIStore` (`sdk/org/libs/state/src/hooks/useUIState.ts:16-54`); `useAsyncAction<T>(key)` → `{isLoading, error, data, execute, reset}`, its state parked in `UIStore` under `key` (`sdk/org/libs/state/src/hooks/useAsyncAction.ts:23-51`).

**Typed-format hooks** (parser + FS composed) — the full catalog, all re-exported from `hooks/index.ts:3-22`. Every one of them is a `useFile`/`useDir`/`useGlob(Read)` read piped through the matching parser inside a `useMemo`, and every one **swallows parse errors and returns `null`** rather than throwing (`sdk/org/libs/state/src/hooks/agent/useAgentInstruct.ts:13-20`, `hooks/tasklist/useTasklistIndex.ts:29-36`, `hooks/knowledge/useKnowledgeFieldIndex.ts:15-22`, `hooks/workspace/usePackageJson.ts:19-26`):

| Group | Hooks | Source |
|---|---|---|
| `agent/` | `useAgentInstruct(id)` → `AgentInstruct \| null`; `useAgentConversations(id)` → `ConversationMeta[]` (a `useDir` over `agents/<id>/conversations`, filtered to `*.json`); `useAgentConversation(agentId, cid)` → `Conversation \| null`; `useAgentConversationsWithMeta(agentId)` → `ConversationSummary[]` — one `useGlobRead` over `agents/<id>/conversations/*.json`, parsed and sorted by `updatedAt` descending | `hooks/agent/useAgentInstruct.ts:10-21`, `useAgentConversations.ts:12-23`, `useAgentConversation.ts:8-19`, `useAgentConversationsWithMeta.ts:16-37` |
| `tasklist/` | `useTasklistTask(path)` → `TasklistTask \| null` (the `NN-<id>.md` basename is passed to the parser); `useTasklistTaskList(name)` → `TasklistTaskItem[]` (glob `tasklists/<name>/[0-9][0-9]-*.md`) — **metadata only**: it returns `{path, order, id}` derived from the filename and never fills the type's optional `task` field, so it does not read task bodies at all; `useTasklistTasks(name)` → parsed `TasklistTaskEntry[]` via a **single** `useGlobRead` subscription, sorted by the `NN-` prefix — this is the one to use when you need task content; `useTasklistIndex(name)` → the optional `index.md` manifest | `hooks/tasklist/useTasklistTask.ts:7-19`, `useTasklistTaskList.ts:9-14`, `22-38`, `useTasklistTasks.ts:47-72`, `useTasklistIndex.ts:26-37` |
| `knowledge/` | `useKnowledgeFile(file)` (raw string of `knowledge/<file>.md`; marked `@deprecated` — pass the full path instead), `useKnowledgeDir(dir)` → `KnowledgeEntry[]` (a `useDir` over `knowledge/<dir>`), `useKnowledgeFieldIndex(domain, field)`, `useKnowledgeDomainIndex(domain)` | `hooks/knowledge/useKnowledgeFile.ts:5-8`, `useKnowledgeDir.ts:13-23`, `useKnowledgeFieldIndex.ts:12-23`, `useKnowledgeDomainIndex.ts:16-27` |
| `workspace/` | `usePackageJson()`, `useEnvFile(name='.env')`, `useEnvFileList()` | `hooks/workspace/usePackageJson.ts:16-27`, `useEnvFile.ts:8-20`, `useEnvFileList.ts:6-10` |
| `project/` | `useApp()`/`useProject()` (context passthroughs), `useProjects()`, `useProjectSpaces()`, `useProjectConfig()`/`useProjectConfigValue(key)`/`useUpdateProjectConfig()`, `useProjectEnv(name)`/`useProjectEnvWritable(name)`, `useProjectEnvList()` | `hooks/project/useApp.ts:5-35`, `useProject.ts:5-27`, `useProjects.ts:9-31`, `useProjectSpaces.ts:9-19`, `useProjectConfig.ts:12-54`, `useProjectEnv.ts:14-68`, `useProjectEnvList.ts:9-12` |
| top-level aggregates | `useAgent(id)` → `{id, instruct}`; `useAgentList()` → `AgentListItem[]` from the glob `agents/*/instruct.md`, the id taken from the second-to-last segment — note its `path` field is set to the **id**, not to the file path; `useTasklist(name)` → `{name, tasks}`, `tasks` being the metadata-only items of `useTasklistTaskList`; `useTasklistList()` (dedupes the tasklist names out of the task-file glob); `useKnowledge(dir)` (its `config` field is permanently `null` — the old `config.json` is retired); `useDomain` = alias of `useKnowledge`; `useDomainDocument` = alias of `useKnowledgeFile`; `useDomainDirectory()` (a domain exists if it has `knowledge/<d>/index.md` **or** any `knowledge/<d>/<f>/index.md` — the domain descriptor is optional; result sorted by domain); `useKnowledgeFieldList()` (every `knowledge/<d>/<f>/index.md`, keyed `<domain>---<field>`, sorted by domain then field) | `hooks/useAgent.ts:12-19`, `useAgentList.ts:12-25` (`path: id` at `19-22`), `useTasklist.ts:15-22`, `useTasklistList.ts:14-33`, `useKnowledge.ts:7-22`, `useDomain.ts:5-7`, `useDomainDocument.ts:5-7`, `useDomainDirectory.ts:12-34`, `useKnowledgeFieldList.ts:25-43` |
| the whole space | `useSpace()` → `{packageJson, agents, tasklists, domains}` — composes `usePackageJson` + `useAgentList` + `useTasklistList` + `useDomainDirectory`; Studio renders a whole space from it | `hooks/useSpace.ts:13-32` |

## Notes & gotchas

- **No `@/` alias in source.** Every `src` module imports relatively (`sdk/org/libs/state/src/lib/fs/AppFS.ts:3-7`). The `@` → `src` alias exists **only for tests** (`sdk/org/libs/state/vitest.config.ts:7-9`), and only `*.test.tsx` files use it (e.g. `sdk/org/libs/state/src/hooks/useSpace.test.tsx:5-7`) — do not introduce `@/` into shipped code.
- **Every file/dir/glob hook is SPACE-scoped, including the ones named "project".** `useFile`/`useGlob`/`useDir`/`useGlobRead`/`useFileConfig`/`useFileFrontmatter` all resolve through `useSpaceFS()` (`sdk/org/libs/state/src/hooks/fs/useFile.ts:8-9`, `useGlob.ts:10-11`). So the *reads* in `useProjectConfig()` (`useFile('lmthing.json')`, `sdk/org/libs/state/src/hooks/project/useProjectConfig.ts:12-23`), `useProjectEnv()` (`sdk/org/libs/state/src/hooks/project/useProjectEnv.ts:14-30`), `useProjectEnvList()` (`useProjectEnvList.ts:9-12`) and the `workspace/` env hooks (`useEnvFile.ts:8-10`, `useEnvFileList.ts:6-7`) hit `<projectId>/<spaceId>/lmthing.json` and `<projectId>/<spaceId>/.env*`, **not** the project-root keys `P.projectConfig`/`P.projectEnv` describe — and since `SpaceProvider` never hydrates `.env*` into the cache (`isRunnableSpaceFile`, `sdk/org/libs/state/src/lib/pod/transport.ts:31-36`), those env reads return `null` in practice. The *writers* are correct: `useUpdateProjectConfig` and `useProjectEnvWritable` go through `projectFS` (`useProjectConfig.ts:36-54`, `useProjectEnv.ts:32-68`). Use `useProjectFS()` directly for project-root files.
- **Two YAML dialects.** `parseFrontmatter` is inline-only and *flattens* nested maps; agent-instruct and tasklist frontmatter therefore use their own block-YAML readers — reuse those parsers rather than `parseFrontmatter` for `input`/`output`/`actions` maps (`sdk/org/libs/state/src/lib/fs/parsers/tasklist.ts:10-17`).
- **`saveSpaceFiles` is a full wipe-and-rewrite** of the space (minus runtime files); a partial `files` map deletes everything omitted (`sdk/org/libs/state/src/lib/pod/transport.ts:145-159`).
- **Hydration is one-shot and non-destructive per prefix** — the network load is skipped entirely if the cache already holds *any* key under `<projectId>/<spaceId>/`, and on a cold load already-present paths are left alone; so navigating back to a space never re-fetches and never overwrites cached edits (`sdk/org/libs/state/src/lib/contexts/SpaceContext.tsx:67-120`).
