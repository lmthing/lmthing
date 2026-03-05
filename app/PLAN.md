# LMThing FS Architecture Plan

## Overview

A layered, scoped file system with a fine-grained event bus, supporting a
three-level hierarchy of `username → studioname → spacename`. All state lives
in a flat `Map<string, string>` inside `AppFS`. Every other FS class is a
transparent prefix-scoped proxy over that single store.

---

## 1. File Tree Hierarchy

```
{username}/
  {studioId}/
    lmthing.json                      ← studio config (name, spaces, settings)
    .env                              ← studio-level shared env
    .env.local
    .env.production
    {spaceId}/
      package.json
      agents/
        {agentId}/
          instruct.md
          config.json
          values.json
          conversations/
            {convId}.json
      flows/
        {flowId}/
          index.md
          {order}.{name}.md
      knowledge/
        {domainPath}/
          config.json
          {file}.md
```

All paths in `AppFS` are fully-qualified. Scoped FS classes (`UserFS`,
`StudioFS`, `SpaceFS`) strip their own prefix, so hooks at the space layer
never see `username/` or `studioId/` segments.

---

## 2. Core Types

```ts
// src/types/studio.ts

export type FileTree = Record<string, string>          // filePath → raw string content

export interface SpaceConfig {
  name: string
  description?: string
  tags?: string[]
  createdAt?: string
  updatedAt?: string
}

export interface StudioSettings {
  defaultSpace?: string
  theme?: 'light' | 'dark' | 'system'
  [key: string]: unknown
}

export interface StudioConfig {
  id: string
  name: string
  version?: string
  spaces: Record<string, SpaceConfig>  // spaceId → config
  settings?: StudioSettings
}

export interface StudioData {
  id: string
  username: string
  files: FileTree   // all paths relative to AppFS root: {spaceId}/agents/... + lmthing.json + .env*
}

export interface AppData {
  studios: Record<string, StudioData>  // key: "{username}/{studioId}"
  currentStudioKey: string | null
  currentSpaceId: string | null
}
```

---

## 3. Fine-Grained Event System

### 3.1 Event Types

```ts
// src/lib/fs/events.ts

export type FSEventType = 'create' | 'update' | 'delete' | 'rename'

export interface FSEvent {
  type: FSEventType
  path: string          // full path in the FS scope that emits
  oldPath?: string      // populated on 'rename'
  content?: string      // populated on 'create' | 'update'
  timestamp: number
}

export type DirEventType = 'add' | 'remove' | 'rename'

export interface DirEvent {
  type: DirEventType
  dir: string           // the watched directory (no trailing slash)
  entry: string         // immediate child name that changed
  oldEntry?: string     // populated on 'rename'
  content?: string      // populated on 'add'
}

export interface BatchEvent {
  events: FSEvent[]
}
```

### 3.2 `FSEventBus`

The single internal event bus owned by `AppFS`. All scoped FS classes emit
through the same bus (prefixing paths before emitting), and subscribe through
it (the bus strips the scope prefix before delivering).

```ts
// src/lib/fs/FSEventBus.ts

class FSEventBus {
  // ── Emit ──────────────────────────────────────────────────────────
  emit(event: FSEvent): void
  emitBatch(events: FSEvent[]): void   // fires individual + batch listeners

  // ── Subscribe: any ────────────────────────────────────────────────
  /** Fires on every FS event under this bus's scope */
  onAny(cb: (event: FSEvent) => void): Unsubscribe

  // ── Subscribe: file-level ─────────────────────────────────────────
  /** Fires when a specific file is created, updated, deleted, or renamed */
  onFile(path: string, cb: (event: FSEvent) => void): Unsubscribe

  /** Fires only when the file is written for the first time */
  onFileCreate(path: string, cb: (content: string) => void): Unsubscribe

  /** Fires only when the file exists and is overwritten */
  onFileUpdate(path: string, cb: (content: string) => void): Unsubscribe

  /** Fires when the file is deleted */
  onFileDelete(path: string, cb: () => void): Unsubscribe

  /** Fires when the file is renamed (old path → new path) */
  onFileRename(path: string, cb: (newPath: string) => void): Unsubscribe

  // ── Subscribe: directory-level (immediate children only) ──────────
  /** Fires when any immediate child is added, removed, or renamed */
  onDir(dir: string, cb: (event: DirEvent) => void): Unsubscribe

  /** Fires when a new immediate child appears */
  onDirAdd(dir: string, cb: (entry: string, content: string) => void): Unsubscribe

  /** Fires when an immediate child is removed */
  onDirRemove(dir: string, cb: (entry: string) => void): Unsubscribe

  /** Fires when an immediate child is renamed */
  onDirRename(dir: string, cb: (oldEntry: string, newEntry: string) => void): Unsubscribe

  // ── Subscribe: prefix-level (all descendants) ─────────────────────
  /** Fires on any change under the given path prefix */
  onPrefix(prefix: string, cb: (event: FSEvent) => void): Unsubscribe

  // ── Subscribe: glob-level ─────────────────────────────────────────
  /** Fires when a file matching the glob pattern is created, updated, or deleted */
  onGlob(pattern: string, cb: (event: FSEvent) => void): Unsubscribe

  // ── Subscribe: batch ──────────────────────────────────────────────
  /** Fires once after a batch() call completes, with all events in the batch */
  onBatch(cb: (event: BatchEvent) => void): Unsubscribe
}
```

**Dispatch order on a single write:**
1. `onAny` listeners
2. `onFile(path)` listeners
3. `onPrefix(p)` listeners where `path.startsWith(p)`
4. `onDir(d)` listeners where `dirname(path) === d`
5. `onGlob(g)` listeners where `micromatch(path, g)`
6. `onBatch` listeners (only when emitted via `emitBatch`)

**Performance notes:**
- Prefix subscribers are stored in a trie for O(depth) lookup.
- Glob matchers are compiled once and cached (keyed by pattern string).
- `onDir` uses a Map keyed by `dirname` for O(1) lookup.
- `onFile` uses a Map keyed by exact path for O(1) lookup.
- Batch notifications are debounced to the end of the `batch()` call via
  microtask queue — no intermediate events fire during the batch.

### 3.3 `FSInterface` — Events Surface

Every FS class (AppFS and all scoped proxies) exposes the full event API.
Scoped classes transparently strip their own prefix before delivering events to
subscribers, so consumers always work with local (scope-relative) paths.

```ts
interface FSInterface {
  // ── useSyncExternalStore (coarse-grained, legacy compat) ──────────
  subscribe(cb: () => void): Unsubscribe
  getSnapshot(): Readonly<FileTree>

  // ── Read ──────────────────────────────────────────────────────────
  readFile(path: string): string | null
  readDir(path: string): DirEntry[]
  glob(pattern: string): string[]
  globRead(pattern: string): FileTree

  // ── Write (sync) ──────────────────────────────────────────────────
  writeFile(path: string, content: string): void
  appendFile(path: string, content: string): void
  deleteFile(path: string): void
  deletePath(prefix: string): void
  renamePath(oldPrefix: string, newPrefix: string): void
  duplicatePath(source: string, dest: string): void
  batch(ops: FileOp[]): void

  // ── Write (streaming) ─────────────────────────────────────────────
  streamWriteFile(path: string, stream: AsyncIterable<string>): Promise<void>
  streamAppendFile(path: string, stream: AsyncIterable<string>): Promise<void>

  // ── Events: any ───────────────────────────────────────────────────
  onAny(cb: (event: FSEvent) => void): Unsubscribe

  // ── Events: file-level ────────────────────────────────────────────
  onFile(path: string, cb: (event: FSEvent) => void): Unsubscribe
  onFileCreate(path: string, cb: (content: string) => void): Unsubscribe
  onFileUpdate(path: string, cb: (content: string) => void): Unsubscribe
  onFileDelete(path: string, cb: () => void): Unsubscribe
  onFileRename(path: string, cb: (newPath: string) => void): Unsubscribe

  // ── Events: directory-level ───────────────────────────────────────
  onDir(dir: string, cb: (event: DirEvent) => void): Unsubscribe
  onDirAdd(dir: string, cb: (entry: string, content: string) => void): Unsubscribe
  onDirRemove(dir: string, cb: (entry: string) => void): Unsubscribe
  onDirRename(dir: string, cb: (oldEntry: string, newEntry: string) => void): Unsubscribe

  // ── Events: prefix-level ──────────────────────────────────────────
  onPrefix(prefix: string, cb: (event: FSEvent) => void): Unsubscribe

  // ── Events: glob-level ────────────────────────────────────────────
  onGlob(pattern: string, cb: (event: FSEvent) => void): Unsubscribe

  // ── Events: batch ─────────────────────────────────────────────────
  onBatch(cb: (event: BatchEvent) => void): Unsubscribe
}
```

---

## 4. Four FS Scopes

```
AppFS                        full path: {username}/{studioId}/{spaceId}/agents/...
  └── UserFS                 strips {username}/
        └── StudioFS         strips {username}/{studioId}/
                             → sees: lmthing.json  .env*  {spaceId}/**
              └── SpaceFS    strips {username}/{studioId}/{spaceId}/
                             → sees: package.json  agents/**  flows/**  knowledge/**
```

`AppFS` owns the `Map<string, string>` and the `FSEventBus`. All scoped
classes hold a `prefix: string` and delegate every read, write, and event call
by prepending/stripping that prefix. No data is duplicated.

**`ScopedFS`** is the generic base class:

```ts
class ScopedFS implements FSInterface {
  constructor(private root: AppFS, private prefix: string) {}

  // All reads/writes resolve paths as `${this.prefix}/${path}`
  // All events subscribe on root bus with prefix-aware filtering
  // Event callbacks receive prefix-stripped paths
}

class UserFS  extends ScopedFS {}   // prefix: {username}
class StudioFS extends ScopedFS {}  // prefix: {username}/{studioId}
class SpaceFS  extends ScopedFS {}  // prefix: {username}/{studioId}/{spaceId}
```

---

## 5. `P` — Path Builder (all four levels)

```ts
// src/lib/fs/paths.ts

export const P = {

  // ── App level (AppFS) ─────────────────────────────────────────────
  user:        (username: string) =>
                 `${username}`,
  studio:      (username: string, studioId: string) =>
                 `${username}/${studioId}`,
  studioSpace: (username: string, studioId: string, spaceId: string) =>
                 `${username}/${studioId}/${spaceId}`,

  // ── Studio level (StudioFS — prefix already stripped) ─────────────
  studioConfig: 'lmthing.json',
  studioEnv:   (suffix?: string) => suffix ? `.env.${suffix}` : '.env',
  space:       (spaceId: string) => spaceId,

  // ── Space level (SpaceFS — prefix already stripped) ───────────────
  packageJson: 'package.json',

  agent:         (id: string) => `agents/${id}`,
  instruct:      (id: string) => `agents/${id}/instruct.md`,
  agentConfig:   (id: string) => `agents/${id}/config.json`,
  agentValues:   (id: string) => `agents/${id}/values.json`,
  conversations: (id: string) => `agents/${id}/conversations`,
  conversation:  (id: string, cid: string) => `agents/${id}/conversations/${cid}.json`,

  flow:          (id: string) => `flows/${id}`,
  flowIndex:     (id: string) => `flows/${id}/index.md`,
  flowTask:      (id: string, order: number, name: string) =>
                   `flows/${id}/${order}.${name}.md`,

  knowledgeDir:    (dir: string)  => `knowledge/${dir}`,
  knowledgeConfig: (dir: string)  => `knowledge/${dir}/config.json`,
  knowledgeFile:   (file: string) => `knowledge/${file}.md`,

  // ── Glob patterns ─────────────────────────────────────────────────
  globs: {
    // App-scope
    allStudios: (username: string) =>
                  `${username}/*/lmthing.json`,
    allSpaces:  (username: string, studioId: string) =>
                  `${username}/${studioId}/*/package.json`,

    // Studio-scope
    studioEnvFiles: '.env*',
    spaceRoots:     '*/package.json',

    // Space-scope
    allAgents:        'agents/*/instruct.md',
    agentFiles:       (id: string) => `agents/${id}/**`,
    allFlows:         'flows/*/index.md',
    flowTasks:        (id: string) => `flows/${id}/[0-9]*.*.md`,
    allConversations: (id: string) => `agents/${id}/conversations/*.json`,
    knowledgeDomains: 'knowledge/*/config.json',
    allKnowledge:     'knowledge/**',
  },
} as const
```

---

## 6. Context Hierarchy

```
AppContext
  AppFS instance, studio list, current studio key
  └── StudioContext
        StudioFS scoped to current studio
        spaces list, current space id
        └── SpaceContext
              SpaceFS scoped to current space
```

### `AppContext`

```ts
interface AppContextValue {
  appFS: AppFS
  drafts: DraftStore
  studios: Array<{ username: string; studioId: string; name: string }>
  currentStudioKey: string | null
  isLoading: boolean
  error: string | null

  setCurrentStudio(username: string, studioId: string): void
  createStudio(username: string, studioId: string, name: string): void
  deleteStudio(username: string, studioId: string): void
  importStudio(username: string, studioId: string, files: FileTree): void
}
```

### `StudioContext`

```ts
interface StudioContextValue {
  studioFS: StudioFS
  username: string
  studioId: string
  studioConfig: StudioConfig | null
  spaces: Array<{ id: string } & SpaceConfig>
  currentSpaceId: string | null

  setCurrentSpace(spaceId: string): void
  createSpace(spaceId: string, config: SpaceConfig): void
  deleteSpace(spaceId: string): void
  renameSpace(spaceId: string, newId: string): void
}
```

### `SpaceContext`

```ts
interface SpaceContextValue {
  spaceFS: SpaceFS
  spaceId: string
}
```

Hooks that need file access call `useSpaceFS()`, which reads from
`SpaceContext` or derives on demand from `StudioContext.studioFS + currentSpaceId`.

---

## 7. Hook Catalogue

### 7.1 Foundation Hooks

All foundation hooks use the fine-grained event subscriptions rather than the
coarse `subscribe()` method. This eliminates spurious re-renders — a component
watching one file will not re-render when an unrelated file changes.

| Hook | Event used internally |
|---|---|
| `useFile(path)` | `fs.onFile(path, ...)` |
| `useFileFrontmatter(path)` | `fs.onFileUpdate(path, ...)` |
| `useFileConfig<T>(path)` | `fs.onFileUpdate(path, ...)` |
| `useDir(dir)` | `fs.onDir(dir, ...)` |
| `useGlob(pattern)` | `fs.onGlob(pattern, ...)` |
| `useGlobRead(pattern)` | `fs.onGlob(pattern, ...)` |
| `useFileWatch(path, cb)` | `fs.onFile(path, cb)` — side-effect only, no state |
| `useDirWatch(dir, cb)` | `fs.onDir(dir, cb)` — side-effect only, no state |
| `useGlobWatch(pattern, cb)` | `fs.onGlob(pattern, cb)` — side-effect only, no state |
| `useStreamWrite(path)` | `fs.streamWriteFile` + `fs.onFileUpdate` |
| `useStreamAppend(path)` | `fs.streamAppendFile` + `fs.onFileUpdate` |

```ts
// Example — fine-grained subscription avoids global re-renders
function useFile(path: string): string | null {
  const fs = useSpaceFS()
  return useSyncExternalStore(
    cb  => fs.onFile(path, cb),          // subscribe to ONE file
    ()  => fs.readFile(path),
  )
}

function useDir(dir: string): DirEntry[] {
  const fs = useSpaceFS()
  return useSyncExternalStore(
    cb  => fs.onDir(dir, cb),            // subscribe to ONE directory
    ()  => fs.readDir(dir),
  )
}

function useGlob(pattern: string): string[] {
  const fs = useSpaceFS()
  return useSyncExternalStore(
    cb  => fs.onGlob(pattern, cb),       // subscribe to ONE glob pattern
    ()  => fs.glob(pattern),
  )
}
```

### 7.2 New App & Studio Hooks

| Hook | Purpose |
|---|---|
| `useApp()` | Studio list, create/delete/import studios |
| `useStudio()` | Current studio config + spaces list, create/delete spaces |
| `useStudioConfig()` | Read/write `lmthing.json` via `useFileFrontmatter` |
| `useStudioEnv(name)` | Encrypted `.env*` file at studio root |
| `useStudioEnvList()` | `useGlob(P.globs.studioEnvFiles)` on `StudioFS` |
| `useSpaceFS(spaceId?)` | Returns scoped `SpaceFS` — primary input to all space hooks |

### 7.3 Space-Level Hooks (unchanged API, new FS subscription internals)

**Agent:**

| Hook | FS event used |
|---|---|
| `useAgentInstruct(id)` | `onFile(P.instruct(id))` |
| `useAgentConfig(id)` | `onFileUpdate(P.agentConfig(id))` |
| `useAgentValues(id)` | `onFileUpdate(P.agentValues(id))` |
| `useAgentConversations(id)` | `onDirAdd / onDirRemove` on `P.conversations(id)` |
| `useAgentConversation(id, cid)` | `onFileUpdate(P.conversation(id, cid))` |
| `useAgentList()` | `onGlob(P.globs.allAgents)` |

**Flow:**

| Hook | FS event used |
|---|---|
| `useFlowIndex(id)` | `onFile(P.flowIndex(id))` |
| `useFlowTask(id, order, name)` | `onFile(P.flowTask(id, order, name))` |
| `useFlowTaskList(id)` | `onGlob(P.globs.flowTasks(id))` |
| `useFlowList()` | `onGlob(P.globs.allFlows)` |

**Knowledge:**

| Hook | FS event used |
|---|---|
| `useKnowledgeConfig(dir)` | `onFileUpdate(P.knowledgeConfig(dir))` |
| `useKnowledgeFile(file)` | `onFile(P.knowledgeFile(file))` |
| `useKnowledgeDir(dir)` | `onDirAdd / onDirRemove` on `P.knowledgeDir(dir)` |
| `useDomainDirectory()` | `onGlob(P.globs.knowledgeDomains)` |

**Space:**

| Hook | FS event used |
|---|---|
| `usePackageJson()` | `onFileUpdate(P.packageJson)` |
| `useEnvFile(name)` | `onFileUpdate(P.studioEnv(name))` |
| `useEnvFileList()` | `onGlob(P.globs.studioEnvFiles)` |
| `useUnsavedChanges()` | `DraftStore` subscription (separate from FS) |

**Composite:**

| Hook | Composes |
|---|---|
| `useAgent(id)` | `useAgentInstruct` + `useAgentConfig` + `useAgentValues` |
| `useWorkFlow(id)` | `useFlowIndex` + `useFlowTaskList` |
| `useKnowledge(dir)` | `useKnowledgeConfig` + `useKnowledgeDir` |
| `useDomain(dir)` | `useKnowledgeConfig` + `useKnowledgeDir` |
| `useDomainDocument(file)` | `useKnowledgeFile` |
| `useSpace()` | `usePackageJson` + `useAgentList` + `useFlowList` + `useDomainDirectory` |

---

## 8. Persistence

LocalStorage keys:

```
lmthing-app                               → AppData (studio list + current selections)
lmthing-studio:{username}/{studioId}      → FileTree for that studio (all spaces)
```

Load sequence:
1. Read `lmthing-app` → restore `currentStudioKey`, `currentSpaceId`, manifest
2. For each known studio key, read `lmthing-studio:{key}` → hydrate into `AppFS`
3. GitHub-backed studios load lazily on selection: fetch files → write into
   `AppFS` under `{username}/{studioId}/`

Persistence is triggered by `AppFS.onAny()` — a debounced subscriber serializes
changed studio blobs back to their `lmthing-studio:*` keys.

---

## 9. File Structure

```
src/
  types/
    studio.ts            StudioConfig, SpaceConfig, AppData, FileTree, StudioData

  lib/
    fs/
      events.ts          FSEvent, DirEvent, BatchEvent, FSEventType, DirEventType
      FSEventBus.ts      FSEventBus class (trie for prefix, Map for file/dir, glob cache)
      AppFS.ts           owns Map<string,string> + FSEventBus; implements FSInterface
      ScopedFS.ts        generic prefix-scoped proxy; UserFS / StudioFS / SpaceFS extend this
      DraftStore.ts      pending edits (path → draft content), separate change bus
      paths.ts           P path builder (all four levels + glob patterns)
      parsers/
        frontmatter.ts
        instruct.ts
        task.ts
        config.ts
        conversation.ts
      crypto/
        env.ts

    contexts/
      AppContext.tsx      AppFS instance, studio list
      StudioContext.tsx   StudioFS scope, spaces list
      SpaceContext.tsx    SpaceFS scope for current space

  hooks/
    fs/
      useAppFS.ts
      useStudioFS.ts
      useSpaceFS.ts              ← primary entry point for all space-level hooks
      useFile.ts                 onFile (fine-grained)
      useFileFrontmatter.ts      onFileUpdate (fine-grained)
      useFileConfig.ts           onFileUpdate (fine-grained)
      useDir.ts                  onDir (fine-grained)
      useGlob.ts                 onGlob (fine-grained)
      useGlobRead.ts             onGlob (fine-grained)
      useFileWatch.ts            onFile side-effect
      useDirWatch.ts             onDir side-effect
      useGlobWatch.ts            onGlob side-effect
      useStreamWrite.ts
      useStreamAppend.ts

    studio/
      useApp.ts
      useStudio.ts
      useStudioConfig.ts
      useStudioEnv.ts
      useStudioEnvList.ts

    agent/
      useAgentInstruct.ts
      useAgentConfig.ts
      useAgentValues.ts
      useAgentConversations.ts
      useAgentConversation.ts

    flow/
      useFlowIndex.ts
      useFlowTask.ts
      useFlowTaskList.ts

    knowledge/
      useKnowledgeConfig.ts
      useKnowledgeFile.ts
      useKnowledgeDir.ts

    workspace/
      usePackageJson.ts
      useEnvFile.ts
      useEnvFileList.ts

    useAgent.ts
    useWorkFlow.ts
    useKnowledge.ts
    useDomain.ts
    useDomainDirectory.ts
    useDomainDocument.ts
    useSpace.ts
    useAgentList.ts
    useFlowList.ts
    useUnsavedChanges.ts
```

---

## 10. Key Design Decisions

| Decision | Rationale |
|---|---|
| Single `Map` in `AppFS` | One source of truth; scoped views are zero-copy proxies |
| Fine-grained event bus | Components subscribe only to what they read; no spurious re-renders |
| Trie for prefix dispatch | O(depth) fan-out vs O(n-subscribers) scan |
| Glob cache | Patterns compiled once; reused across all subscribers and emits |
| `onDir` uses `dirname` index | O(1) lookup for the common case of watching a folder's immediate children |
| Batch debounced to microtask | `batch()` callers get one notification per logical operation, not per file |
| Scoped classes strip prefix | Hooks at any level write clean paths (`agents/x/instruct.md`), not full paths |
| Studio env at studio root | Secrets shared across spaces live outside any space; reduces duplication |
| `username` as top-level dir | Enables GitHub-style namespacing and future multi-user / org scenarios |
