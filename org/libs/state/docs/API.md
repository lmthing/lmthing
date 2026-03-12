# API Reference

## Core Classes

### AppFS

The root file system class that owns all data and the event bus.

```ts
class AppFS implements FSInterface {
  constructor(initialData?: FileTree)

  // Read operations
  readFile(path: string): string | null
  readDir(path: string): DirEntry[]
  glob(pattern: string): string[]
  globRead(pattern: string): FileTree

  // Write operations
  writeFile(path: string, content: string): void
  appendFile(path: string, content: string): void
  deleteFile(path: string): void
  deletePath(prefix: string): void
  renamePath(oldPrefix: string, newPrefix: string): void
  duplicatePath(source: string, dest: string): void
  batch(ops: FileOp[]): void

  // Streaming
  streamWriteFile(path: string, stream: AsyncIterable<string>): Promise<void>
  streamAppendFile(path: string, stream: AsyncIterable<string>): Promise<void>

  // Events - any
  onAny(cb: (event: FSEvent) => void): Unsubscribe

  // Events - file-level
  onFile(path: string, cb: (event: FSEvent) => void): Unsubscribe
  onFileCreate(path: string, cb: (content: string) => void): Unsubscribe
  onFileUpdate(path: string, cb: (content: string) => void): Unsubscribe
  onFileDelete(path: string, cb: () => void): Unsubscribe
  onFileRename(path: string, cb: (newPath: string) => void): Unsubscribe

  // Events - directory-level
  onDir(dir: string, cb: (event: DirEvent) => void): Unsubscribe
  onDirAdd(dir: string, cb: (entry: string, content: string) => void): Unsubscribe
  onDirRemove(dir: string, cb: (entry: string) => void): Unsubscribe
  onDirRename(dir: string, cb: (oldEntry: string, newEntry: string) => void): Unsubscribe

  // Events - prefix-level
  onPrefix(prefix: string, cb: (event: FSEvent) => void): Unsubscribe

  // Events - glob-level
  onGlob(pattern: string, cb: (event: FSEvent) => void): Unsubscribe

  // Events - batch
  onBatch(cb: (event: BatchEvent) => void): Unsubscribe

  // Utilities
  getEventBus(): FSEventBus
  export(): FileTree
  import(data: FileTree): void
}
```

### StudioFS, SpaceFS

Scoped FS classes that transparently strip their prefix from all operations.

```ts
class StudioFS implements FSInterface
class SpaceFS implements FSInterface

// Same interface as AppFS, but all paths are relative to the scope
```

Factory method:
```ts
SpaceFS.fromStudioFS(studioFS: StudioFS, spaceId: string): SpaceFS
```

---

## FSEventBus

The internal event bus with trie-based prefix dispatch.

```ts
class FSEventBus {
  // Emit
  emit(event: FSEvent): void
  emitBatch(events: FSEvent[]): void

  // Subscribe - any
  onAny(cb: (event: FSEvent) => void): Unsubscribe

  // Subscribe - file
  onFile(path: string, cb: (event: FSEvent) => void): Unsubscribe
  onFileCreate(path: string, cb: (content: string) => void): Unsubscribe
  onFileUpdate(path: string, cb: (content: string) => void): Unsubscribe
  onFileDelete(path: string, cb: () => void): Unsubscribe
  onFileRename(path: string, cb: (newPath: string) => void): Unsubscribe

  // Subscribe - directory
  onDir(dir: string, cb: (event: DirEvent) => void): Unsubscribe
  onDirAdd(dir: string, cb: (entry: string, content: string) => void): Unsubscribe
  onDirRemove(dir: string, cb: (entry: string) => void): Unsubscribe
  onDirRename(dir: string, cb: (oldEntry: string, newEntry: string) => void): Unsubscribe

  // Subscribe - prefix
  onPrefix(prefix: string, cb: (event: FSEvent) => void): Unsubscribe

  // Subscribe - glob
  onGlob(pattern: string, cb: (event: FSEvent) => void): Unsubscribe

  // Subscribe - batch
  onBatch(cb: (event: BatchEvent) => void): Unsubscribe

  // Batch control
  beginBatch(): void
  endBatch(): void
  batch<T>(fn: () => T): Promise<T>
}
```

---

## DraftStore

Manages pending edits (unsaved changes).

```ts
class DraftStore {
  // Draft operations
  set(path: string, content: string): void
  get(path: string): string | undefined
  has(path: string): boolean
  delete(path: string): void
  clear(): void

  // Bulk operations
  getAll(): Map<string, string>
  getPaths(): string[]
  isEmpty(): boolean
  getCount(): number

  // Change tracking
  onChange(path: string, cb: (hasDraft: boolean) => void): Unsubscribe

  // useSyncExternalStore
  subscribe(cb: () => void): Unsubscribe
  getSnapshot(): Record<string, string>
}
```

---

## Types

### Core Types

```ts
type FileTree = Record<string, string>

interface DirEntry {
  name: string
  path: string
  type: 'file' | 'dir'
}

type FileOp =
  | { type: 'write'; path: string; content: string }
  | { type: 'append'; path: string; content: string }
  | { type: 'delete'; path: string }
  | { type: 'rename'; oldPath: string; newPath: string }
  | { type: 'duplicate'; source: string; dest: string }

type Unsubscribe = () => void
```

### Event Types

```ts
type FSEventType = 'create' | 'update' | 'delete' | 'rename'

interface FSEvent {
  type: FSEventType
  path: string
  oldPath?: string
  content?: string
  timestamp: number
}

type DirEventType = 'add' | 'remove' | 'rename'

interface DirEvent {
  type: DirEventType
  dir: string
  entry: string
  oldEntry?: string
  content?: string
}

interface BatchEvent {
  events: FSEvent[]
}
```

### Studio Types

```ts
interface SpaceConfig {
  name: string
  description?: string
  tags?: string[]
  createdAt?: string
  updatedAt?: string
}

interface StudioConfig {
  id: string
  name: string
  version?: string
  spaces: Record<string, SpaceConfig>
  settings?: StudioSettings
}

interface StudioSettings {
  defaultSpace?: string
  theme?: 'light' | 'dark' | 'system'
  [key: string]: unknown
}
```

### Parser Types

```ts
// Frontmatter
interface FrontmatterResult<T = Record<string, unknown>> {
  frontmatter: T
  content: string
  raw: string
}

// Agent
interface AgentInstruct {
  name: string
  description?: string
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  instructions: string
}

interface AgentConfig {
  enabled?: boolean
  model?: string
  temperature?: number
  maxTokens?: number
  [key: string]: unknown
}

// Flow
interface FlowTask {
  name: string
  description?: string
  agent?: string
  inputs?: Record<string, unknown>
  outputs?: Record<string, unknown>
  content: string
}

interface FlowIndex {
  name: string
  description?: string
  tasks: string[]
}

// Conversation
interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: string
  tokens?: number
}

interface Conversation {
  metadata: {
    id: string
    agentId: string
    title?: string
    createdAt: string
    updatedAt: string
    messageCount: number
  }
  messages: ConversationMessage[]
}

// Knowledge
interface KnowledgeConfig {
  title?: string
  description?: string
  tags?: string[]
  embeddingModel?: string
  chunkSize?: number
  chunkOverlap?: number
  [key: string]: unknown
}
```

---

## React Hooks

### Foundation Hooks

```ts
// FS access
function useAppFS(): AppFS
function useStudioFS(): StudioFS
function useSpaceFS(spaceId?: string): SpaceFS

// File operations
function useFile(path: string): string | null
function useFileFrontmatter<T>(path: string): FrontmatterResult<T> | null
function useFileConfig<T>(path: string): T | null

// Directory operations
function useDir(dir: string): DirEntry[]

// Glob operations
function useGlob(pattern: string): string[]
function useGlobRead(pattern: string): FileTree

// Watch operations (side-effect only)
function useFileWatch(path: string, cb: (content: string | null) => void): void
function useDirWatch(dir: string, cb: (entries: DirEntry[]) => void): void
function useGlobWatch(pattern: string, cb: (paths: string[]) => void): void

// Streaming
function useStreamWrite(path: string): {
  write: (stream: AsyncIterable<string>) => Promise<void>
  isStreaming: boolean
  error: Error | null
}
```

### Studio Hooks

```ts
function useApp(): {
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

function useStudio(): {
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

### Agent Hooks

```ts
function useAgentInstruct(id: string): AgentInstruct | null
function useAgentConfig(id: string): AgentConfig | null
function useAgentValues(id: string): AgentValues | null
function useAgentConversations(id: string): ConversationMeta[]
function useAgentConversation(agentId: string, conversationId: string): Conversation | null
function useAgent(id: string): { id: string; instruct: AgentInstruct | null; config: AgentConfig | null; values: AgentValues | null }
function useAgentList(): AgentListItem[]
```

### Flow Hooks

```ts
function useFlowIndex(id: string): FlowIndex | null
function useFlowTask(flowId: string, order: number, name: string): FlowTask | null
function useFlowTaskList(flowId: string): FlowTaskItem[]
function useWorkFlow(id: string): { id: string; index: FlowIndex | null; tasks: FlowTaskItem[] }
function useFlowList(): FlowListItem[]
```

### Knowledge Hooks

```ts
function useKnowledgeConfig(dir: string): KnowledgeConfig | null
function useKnowledgeFile(file: string): string | null
function useKnowledgeDir(dir: string): KnowledgeEntry[]
function useKnowledge(dir: string): { dir: string; config: KnowledgeConfig | null; entries: KnowledgeEntry[] }
function useDomainDirectory(): DomainMeta[]
function useDomainDocument(file: string): string | null
```

### Draft Hooks

```ts
function useDraft(path: string): string | undefined
function useHasDraft(path: string): boolean
function useDraftsByPattern(pattern: RegExp): string[]
function useDraftMutations(): {
  set(path: string, content: string): void
  delete(path: string): void
  clearAll(): void
  save(path: string): Promise<void>
}
function useFileWithDraft(path: string): string | null
function useUnsavedPaths(): string[]
function useUnsavedChanges(): number
function useHasUnsavedChanges(): boolean
```

---

## Path Utilities (P)

```ts
const P = {
  // App-level (for AppFS)
  user: (username: string) => string
  studio: (username: string, studioId: string) => string
  studioSpace: (username: string, studioId: string, spaceId: string) => string

  // Studio-level (for StudioFS)
  studioConfig: 'lmthing.json'
  studioEnv: (suffix?: string) => string
  space: (spaceId: string) => string

  // Space-level (for SpaceFS)
  packageJson: 'package.json'
  agent: (id: string) => string
  instruct: (id: string) => string
  agentConfig: (id: string) => string
  agentValues: (id: string) => string
  conversations: (id: string) => string
  conversation: (id: string, cid: string) => string
  flow: (id: string) => string
  flowIndex: (id: string) => string
  flowTask: (id: string, order: number, name: string) => string
  knowledgeDir: (dir: string) => string
  knowledgeConfig: (dir: string) => string
  knowledgeFile: (file: string) => string

  // Glob patterns
  globs: {
    allStudios: (username: string) => string
    allSpaces: (username: string, studioId: string) => string
    studioEnvFiles: string
    spaceRoots: string
    allAgents: string
    agentFiles: (id: string) => string
    allFlows: string
    flowTasks: (id: string) => string
    allConversations: (id: string) => string
    knowledgeDomains: string
    allKnowledge: string
  }
}
```

---

## Glob Patterns

Supported patterns:

| Pattern | Description |
|---------|-------------|
| `*` | Matches any sequence except `/` |
| `**` | Matches any sequence including `/` |
| `?` | Matches any single character except `/` |
| `[a-z]` | Character class |
| `[!a-z]` or `[^a-z]` | Negated character class |
| `@(a\|b)` | Matches one of the given options |
| `*(a\|b)` | Matches zero or more of the given options |
| `+(a\|b)` | Matches one or more of the given options |
| `?(a\|b)` | Matches zero or one of the given options |
| `!(a\|b)` | Matches anything except the given options |
| `{a,b,c}` | Brace expansion (multiple patterns) |
| `!pattern` | Negates the pattern |

Functions:
```ts
function globToRegex(pattern: string): RegExp
function testPath(path: string, pattern: string): boolean
function compileGlob(pattern: string): GlobMatcher
function expandBraces(pattern: string): string[]
```

---

## Encryption

```ts
// Env file parsing (unencrypted)
function parseEnvFile(content: string): Record<string, string>
function serializeEnvFile(env: Record<string, string>): string

// Encryption (AES-GCM with PBKDF2)
function encryptEnvFile(content: string, password: string): Promise<string>
function decryptEnvFile(content: string, password: string): Promise<string>
function isEncrypted(content: string): boolean
function verifyPassword(content: string, password: string): Promise<boolean>

// Key management
function generateEncryptionKey(): Promise<string>
function importEncryptionKey(base64Key: string): Promise<CryptoKey>

// Sync fallbacks (XOR-based, less secure)
function encryptEnvFileSync(content: string, password: string): string
function decryptEnvFileSync(content: string, password: string): string
function isSyncEncrypted(content: string): boolean
```

---

## Context Providers

```ts
function AppProvider({ children }: { children: ReactNode }): JSX.Element
function StudioProvider({ children }: { children: ReactNode }): JSX.Element
function SpaceProvider({ children }: { children: ReactNode }): JSX.Element
```
