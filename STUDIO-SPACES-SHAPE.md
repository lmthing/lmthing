# Studio — Project & Spaces Data Shape, Runtime, and Save Path

A complete reference for how the **studio** service models projects and spaces, how the **agent runtime** (`sdk/org/libs/core`) consumes a space, and how studio persists changes back to the **compute pod**.

There are three distinct "shapes" to keep apart:

1. **The wire shape** — JSON the pod REST API returns (`PodProject`, `PodSpaceMeta`, `FileTree`).
2. **The parsed internal shape** — studio's in-memory projection (`SpaceData`, `AgentFrontmatter`, …).
3. **The on-disk layout** — the file tree both studio and the runtime agree on (the actual source of truth).

---

## Table of Contents

1. [The Wire Shape — Pod REST API](#1-the-wire-shape--pod-rest-api)
2. [The On-Disk Space Layout](#2-the-on-disk-space-layout)
3. [The Parsed Internal Shape — `SpaceData`](#3-the-parsed-internal-shape--spacedata)
4. [Validation Strategy](#4-validation-strategy)
5. [Part A — The Runtime: How a Space Becomes a Running Agent](#part-a--the-runtime-how-a-space-becomes-a-running-agent)
6. [Part B — The Save Path: Studio → Pod](#part-b--the-save-path-studio--pod)
7. [Full Round-Trip Summary](#full-round-trip-summary)

---

## 1. The Wire Shape — Pod REST API

Studio talks to the compute pod via `PodTransport` (`sdk/libs/state/src/lib/pod/transport.ts`). All types below are defined in `sdk/libs/state/src/types/project.ts`.

### Projects — `GET /api/projects`

Returns `{ projects: PodProject[] }`.

```ts
// project.ts:62
/** Project metadata, as returned by `GET /api/projects`. */
export interface PodProject {
  id: string
  name: string
  /** Epoch milliseconds OR ISO string — the pod serializes `number`; tolerate both. */
  createdAt?: number | string
}
```

### Spaces — `GET /api/projects/:id/spaces`

Returns `{ spaces: PodSpaceMeta[] }`.

```ts
// project.ts:73
/**
 * Space metadata, as returned by `GET /api/projects/:id/spaces`.
 * Shape mirrors `SpaceMeta` in `sdk/org/libs/cli/src/server/session-manager.ts`.
 */
export interface PodSpaceMeta {
  id: string
  name: string
  description?: string
  agents?: Array<{
    slug: string
    title: string
    actions: Array<{ id: string; label: string }>
  }>
  functionCount?: number
  componentCount?: number
  hasKnowledge?: boolean
}
```

### Space file tree — `GET /api/projects/:id/spaces/:spaceId`

Returns `{ files: FileTree }`.

```ts
// project.ts:3
export type FileTree = Record<string, string> // filePath → raw string content
```

Studio filters the returned map through `isRunnableSpaceFile(path)` before use (drops `conversations/`, `.env*`, etc.).

### Project / space config types (legacy + compat)

```ts
// project.ts:5
export interface SpaceConfig {
  name: string
  description?: string
  tags?: string[]
  system?: boolean
  createdAt?: string
  updatedAt?: string
}

// project.ts:14
export interface ProjectSettings {
  theme?: 'light' | 'dark' | 'system'
  [key: string]: unknown
}

// project.ts:19
export interface ProjectConfig {
  id: string
  name: string
  version?: string
  spaces: Record<string, SpaceConfig> // spaceId → config
  settings?: ProjectSettings
}

// project.ts:27
export interface ProjectData {
  id: string
  config: ProjectConfig
}

// project.ts:38
/**
 * App-level state. Under the pod-backed architecture, projects/spaces are
 * the source of truth on the pod; `AppData` is retained for compatibility but
 * `AppProvider` no longer persists it to localStorage.
 */
export interface AppData {
  projects: Record<string, ProjectData> // key: projectId
  currentProjectId: string | null
  currentSpaceId: string | null
}
```

### Other FS / utility types

```ts
// project.ts:44
export interface DirEntry {
  name: string
  path: string
  type: 'file' | 'dir'
}

// project.ts:50
export type FileOp =
  | { type: 'write'; path: string; content: string }
  | { type: 'append'; path: string; content: string }
  | { type: 'delete'; path: string }
  | { type: 'rename'; oldPath: string; newPath: string }
  | { type: 'duplicate'; source: string; dest: string }

export type Unsubscribe = () => void
```

### Field-by-field requirements (wire shape)

**`PodProject`**
- `id`: **required** (string)
- `name`: **required** (string)
- `createdAt`: optional (epoch ms *or* ISO string)

**`PodSpaceMeta`**
- `id`, `name`: **required**
- `description`, `agents`, `functionCount`, `componentCount`, `hasKnowledge`: optional

**Strict requirement:** the pod API **must** return `{ projects: [...] }` and `{ spaces: [...] }` wrapper objects — `PodTransport` reads `.projects` / `.spaces` off the JSON. A bare top-level array will fail.

---

## 2. The On-Disk Space Layout

The file tree the pod's framework loader (`sdk/org/libs/core/src/spaces/*`) and studio agree on. Documented in `studio/src/types/space-data.ts:1-16`:

```
agents/<slug>/instruct.md            — YAML frontmatter + system-prompt body
tasklists/<name>/NN-<id>.md          — zero-padded ordered task files
knowledge/<domain>/<field>/index.md  — field manifest (type/variable/default)
knowledge/<domain>/<field>/<slug>.md — option files (plain markdown)
functions/<name>.ts                  — single-export TypeScript functions
components/view/<Name>.tsx           — view component (default export)
components/form/<Name>/web.tsx       — form component, web variant
components/form/<Name>/ink.tsx       — form component, ink (terminal) variant
```

---

## 3. The Parsed Internal Shape — `SpaceData`

Once studio loads the file tree, `extractWorkspaceData.ts` turns it into the structured types below. All defined in `studio/src/types/space-data.ts`.

### Model + message types

```ts
// space-data.ts:25
/** "<provider>/<modelId>", e.g. "azure/gpt-4o" or "anthropic/claude-3-5-sonnet-20241022" */
export type LmthingModelId = string;

// space-data.ts:28
export type MessageRole = "user" | "assistant" | "system";

// space-data.ts:30
export interface SlashActionParameter { [key: string]: string }

// space-data.ts:34
export interface MessageSlashAction {
  action: string;
  agentId: string;
  tasklistName: string;
  parameters: SlashActionParameter;
}

// space-data.ts:41
export interface StructuredOutput {
  type: string;
  version: string;
  metadata: { generatedAt: string; generatedBy: string; agentId: string };
  [key: string]: unknown;
}

// space-data.ts:52
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  slashAction?: MessageSlashAction;
  structuredOutput?: StructuredOutput;
}
```

### Conversation

```ts
// space-data.ts:62
export interface Conversation {
  id: string;
  agentId: string;
  agentName: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}
```

### Agent

```ts
// space-data.ts:77
/** One action declared in an agent's instruct.md frontmatter. */
export interface AgentAction {
  id: string;
  label: string;
  description: string;
  tasklist: string;   // name of a tasklist directory in tasklists/
}

// space-data.ts:84
/** The YAML frontmatter of agents/<slug>/instruct.md. */
export interface AgentFrontmatter {
  title: string;
  /** refs into knowledge/ — "<domain>/<field>" */
  knowledge: string[];
  /** function names in functions/ */
  functions: string[];
  /** component names in components/view or components/form */
  components: string[];
  actions: AgentAction[];
  /** optional: id of the default action */
  defaultAction?: string;
  /** optional: space-ref/agent-slug dependencies */
  dependencies: string[];
  /** optional: per-component runtime field selections — component name → list of field refs */
  runtimeFields?: Record<string, string[]>;
  /** optional: per-component saved form values — component name → key/value map */
  formValues?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

// space-data.ts:111
/** An agent as extracted from the VFS. */
export interface Agent {
  id: string;
  frontmatter: AgentFrontmatter;
  /** The system-prompt body (everything after the frontmatter --- block) */
  body: string;
  conversations: Conversation[];
}
```

### Tasklist / Task

```ts
// space-data.ts:125
/** Keys are field names, values are type strings ("string".."array"). */
export type TaskOutput = Record<string, string>;

// space-data.ts:130
/** One task file inside tasklists/<name>/NN-<id>.md. */
export interface Task {
  /** The numeric order (1-based, parsed from the NN- prefix) */
  order: number;
  /** The task id (the part after NN-) */
  id: string;
  /** The instruction body (everything after the frontmatter) */
  instruction: string;
  output: TaskOutput;
  dependsOn?: string[];
  optional?: boolean;
  /** Exactly one task per tasklist has goal: true */
  goal?: boolean;
  condition?: string;
}

// space-data.ts:148
/** A complete tasklist with all its task files. */
export interface Tasklist {
  /** The tasklist directory name under tasklists/ */
  name: string;
  tasks: Task[];
}
```

### Knowledge

```ts
// space-data.ts:159
/** The frontmatter of knowledge/<domain>/<field>/index.md. */
export interface KnowledgeFieldIndex {
  type: string;        // "string" | "number" | "boolean" | "object" | "array"
  variable: string;
  default?: string;
  label?: string;
  fieldType?: string;
  required?: boolean;
  renderAs?: string;
}

// space-data.ts:172
/** A knowledge field with its index manifest and option files. */
export interface KnowledgeField {
  /** slug of this field (directory name) */
  slug: string;
  index: KnowledgeFieldIndex;
  /** The description text (body of index.md) */
  description: string;
  /** Map of option slug → full markdown content */
  options: Record<string, string>;
}

// space-data.ts:185
/** A knowledge domain (top-level directory under knowledge/). */
export interface KnowledgeDomain {
  /** slug of this domain (directory name) */
  slug: string;
  fields: Record<string, KnowledgeField>;
  label?: string;       // display label
  icon?: string;        // emoji or icon identifier
  color?: string;       // hex color
  /** description text (body of knowledge/<domain>/index.md) */
  description?: string;
}
```

### Functions / Components / Package / Env

```ts
// space-data.ts:201
export interface FunctionFile {
  name: string;
  /** Raw TypeScript source */
  source: string;
}

// space-data.ts:207
export interface ViewComponent {
  name: string;
  /** Raw TSX source */
  source: string;
}

// space-data.ts:213
export interface FormComponent {
  name: string;
  web: string;
  ink: string;
}

// space-data.ts:219
export interface SpaceComponents {
  view: Record<string, ViewComponent>;
  form: Record<string, FormComponent>;
}

// space-data.ts:225
export interface PackageJson {
  name: string;
  version: string;
  description?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

// space-data.ts:234
export interface EncryptedEnvFile {
  schema: "lmthing-env-v1";
  algorithm: "AES-GCM";
  kdf: "PBKDF2";
  digest: "SHA-256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export type SpaceEnv = Record<string, EncryptedEnvFile>;
```

### The top-level `SpaceData`

```ts
// space-data.ts:256
/**
 * A fully-extracted space — all five pillars: agents, tasklists, knowledge,
 * functions, and components.
 */
export interface SpaceData {
  id: string;
  agents: Record<string, Agent>;
  tasklists: Record<string, Tasklist>;
  knowledge: Record<string, KnowledgeDomain>;
  functions: Record<string, FunctionFile>;
  components: SpaceComponents;
  packageJson: PackageJson | null;
  env?: SpaceEnv;
}

// space-data.ts:267
export interface SpaceState {
  spaces: Record<string, SpaceData>;
  currentSpace: string | null;
}

// space-data.ts:273
export interface ExtractedDataStructure {
  spaces: Record<string, SpaceData>;
}
```

### Helper item types (UI lists)

```ts
// space-data.ts:278
export interface AgentListItem { id: string; title: string; actionCount: number }
export interface TasklistListItem { name: string; taskCount: number }
export interface KnowledgeFieldItem {
  domain: string; field: string; variable: string; type: string;
  default?: string; optionCount: number;
}
```

### Backward-compat aliases

```ts
// space-data.ts:299
/** @deprecated Use SpaceData    */ export type WorkspaceData  = SpaceData;
/** @deprecated Use SpaceState   */ export type WorkspaceState = SpaceState;
/** @deprecated Use SpaceEnv     */ export type WorkspaceEnv   = SpaceEnv;
```

### Field-by-field requirements (`SpaceData`)

| Field | Required | Notes |
|---|---|---|
| `id` | ✅ | string |
| `agents` | ✅ | `Record<string, Agent>` |
| `tasklists` | ✅ | `Record<string, Tasklist>` |
| `knowledge` | ✅ | `Record<string, KnowledgeDomain>` |
| `functions` | ✅ | `Record<string, FunctionFile>` |
| `components` | ✅ | `{ view, form }` |
| `packageJson` | — | `PackageJson \| null` |
| `env` | optional | `SpaceEnv` |

**`AgentFrontmatter`** required fields: `title`, `knowledge`, `functions`, `components`, `actions`, `dependencies`. Optional: `defaultAction`, `runtimeFields`, `formValues`.

### Worked example

Concrete end-to-end fixtures:
- `studio/src/lib/roundTrip.test.ts:37-139` — a full `SAMPLE_SPACE`.
- `sdk/org/fixtures/cooking/` — a real on-disk space.

Example agent `instruct.md`:
```markdown
---
title: Chef
knowledge: []
functions:
  - addIngredient
  - putPotOnHeat
  - getPotTemperature
  - checkPot
components:
  - SaltinessSlider
  - ConfirmDish
  - PotStatus
actions:
  - id: cook_pasta
    label: Cook Pasta
    description: Make a full pasta dish from scratch
    tasklist: make_pasta
dependencies:
  - sommelier-space/pairing
---

You are an expert chef. You help users cook delicious pasta dishes.
Use the available functions to manage ingredients and cooking equipment.
```

Example task `tasklists/make_pasta/01-boil_water.md`:
```markdown
---
id: boil_water
output:
  water_ready: boolean
---

Fill a large pot with water, add salt, and bring to a boil. Use putPotOnHeat
and monitor with getPotTemperature.
```

---

## 4. Validation Strategy

**No Zod, no runtime schema.** Studio parses defensively in `studio/src/lib/extractWorkspaceData.ts`, with `typeof` checks and fallback defaults, e.g.:

```ts
function parseAgentFrontmatter(raw: Record<string, unknown>): AgentFrontmatter {
  return {
    title: typeof raw.title === "string" ? raw.title : "",
    knowledge: toStringArray(raw.knowledge),
    functions: toStringArray(raw.functions),
    // … defensive parsing for every field
  };
}
```

Missing/malformed fields simply become `""` / `[]` / `{}`. So "expects" is loose: the only hard failure mode is a missing `{ projects }` / `{ spaces }` wrapper from the pod API.

---

# Part A — The Runtime: How a Space Becomes a Running Agent

Everything lives in `sdk/org/libs/core/src/`. The full boot sequence runs in `Session.start()` (`session/session.ts:152`).

## A.1 Loading (`spaces/load.ts`)

`loadSpace(dir)` at `load.ts:309` walks the directory and produces a `Space`:

- **`loadAgent()`** (`load.ts:264`) reads `agents/<slug>/instruct.md`, splits YAML frontmatter from the body via `parseFrontmatter()` (`spaces/frontmatter.ts`), and builds an `AgentDef` (title, actions, knowledge/functions/components refs, dependencies, `instructBody`).
- **Tasklists**: scans `tasklists/<name>/`, sorts the `NN-*.md` files numerically, parses each into a `TaskNode` (`spaces/tasklist-load.ts:16`):
  ```ts
  export interface TaskNode {
    id: string;
    instruction: string;            // body of the .md file
    output: Record<string, string>; // field -> type
    dependsOn?: string[];
    condition?: string;             // DSL expression
    optional?: boolean;
    goal?: boolean;
  }
  ```
- **Functions**: `loadFunctions()` (`load.ts:96`) reads `functions/*.ts`/`*.tsx`; if `node_modules/` exists it also bundles each with **esbuild** into a browser-safe variant. Both raw + bundled are returned:
  ```ts
  async function loadFunctions(
    dir: string,
    nodeModulesDir?: string,
  ): Promise<{ functions: Record<string, string>; functionsBundled: Record<string, string> }>
  ```
- **Components**: `loadComponents()` (`load.ts:136`) reads `components/view/<Name>.tsx` and `components/form/<Name>/{web,ink}.tsx`.

## A.2 System spaces (`spaces/system.ts`)

Seven baseline spaces are **always merged into** every user space:

```ts
// system.ts:30
export const SYSTEM_SPACE_NAMES =
  ['global', 'engineer', 'architect', 'solver', 'deep_research', 'memory', 'thing'] as const;

export const GLOBAL_SPACE_NAME = 'global';
```

- `defaultSystemSpaceDirs()` (`system.ts:39`) resolves them from `system-spaces/` (checks both `dist/` and `src/` layouts):
  ```ts
  export function defaultSystemSpaceDirs(): string[] {
    const candidates = [
      resolve(__dirname, '..', 'system-spaces'),       // dist/ layout
      resolve(__dirname, '..', '..', 'system-spaces'), // src/ layout
    ];
    const base = candidates.find((c) => existsSync(c)) ?? candidates[0]!;
    return SYSTEM_SPACE_NAMES.map((n) => join(base, n));
  }
  ```
- `mergeSystemInto()` (`system.ts:101`) layers system spaces in at **low priority**; a user space only shadows a system agent/tasklist if the user's version is **non-empty** (empty user agents/tasklists don't shadow real system ones).
- The `global` space is special — its functions are **universally injected into every session** regardless of agent. Other system spaces' functions are scoped to their own agents only.
  ```ts
  function isGlobalSpace(s: Space): boolean {
    return basename(s.dir) === GLOBAL_SPACE_NAME;
  }
  ```

Each system space follows the standard layout (`agents/`, `functions/`, `tasklists/`, `components/`).

## A.3 Session construction (`session/session.ts:152`)

`Session.start()` runs, in order:

1. **Load + merge spaces** — `this.space = await this.loadMergedSpace(this.opts.spaceDir)` (system spaces merged in).
2. **Resolve agent** — `'default'` falls back to the first agent if none is literally named `default`:
   ```ts
   const agentKeys = Object.keys(this.space.agents);
   const resolvedSlug = this.opts.agentSlug === 'default' && !this.space.agents['default']
     ? agentKeys[0]
     : this.opts.agentSlug;
   const agent = this.space.agents[resolvedSlug];
   ```
3. **Create QuickJS VM** — `this.vm = await createVM();`
4. **Inject globals** — `this.injectGlobals();`
5. **Build system block** —
   ```ts
   const directDeps = resolveDirectDeps(this.space, agent.dependencies);
   const systemFns  = systemFunctionSources(this.systemSpaces);
   const systemBlock = buildSystemBlock({ space: this.space, agent, directDeps, systemFunctions: systemFns });
   ```

### Globals injection (`session.ts:474`)

```ts
injectGlobal(this.vm.ctx, 'ask',            createAskGlobal(pushYield, renderHost));
injectGlobal(this.vm.ctx, 'display',        createDisplayGlobal(renderHost, ...));
injectGlobal(this.vm.ctx, 'inspect',        createInspectGlobal(pushYield));
injectGlobal(this.vm.ctx, 'sleep',          createSleepGlobal(pushYield, this.opts.clock));
injectGlobal(this.vm.ctx, 'loadKnowledge',  createLoadKnowledgeGlobal(pushYield, ...));
injectGlobal(this.vm.ctx, 'fork',           createForkGlobal(pushYield));
injectGlobal(this.vm.ctx, 'delegate',       createDelegateGlobal(pushYield));
injectGlobal(this.vm.ctx, 'tasklist',       createTasklistGlobal(pushYield));
injectGlobal(this.vm.ctx, 'solve',          createSolveGlobal(pushYield));
injectGlobal(this.vm.ctx, 'registerSpace',  createRegisterSpaceGlobal(pushYield));
```

### Host tools injection (`globals/host-tools.ts:70`)

Synchronous host primitives:
- `console.log/warn/error` — routed through `renderHost`
- `execShell(cmd, opts)` — shell execution with timeout
- `process.env` — env vars + `LMTHING_SPACE_DIR`
- `fetch(url, opts)` — HTTP via curl
- `readFileRaw(path, opts)` / `writeFileRaw(path, content)` — binary-safe file I/O
- `progress()` — read-only budget snapshot

### System prompt assembly (`context/system-block.ts:141`)

`buildSystemBlock()` constructs the LLM system prompt from, in order:
1. `RUNTIME_PREAMBLE` — critical TypeScript execution instructions
2. `GLOBALS_SUMMARY` — available-globals docs
3. UI component catalog
4. Built-in tools from system spaces
5. **Agent instructions** — the `instruct.md` body
6. **Agent actions** — from frontmatter
7. Scoped function signatures + docs
8. Knowledge tree
9. Available components
10. Delegatable dependency agents

## A.4 Function calling / tool registration

- **Loading** — `loadFunctions()` (`load.ts:96`); see A.1.
- **Injection** — `injectSpaceFunctions()` (`sandbox/inject-functions.ts:32`):
  ```ts
  export function injectSpaceFunctions(
    vm: VM,
    functions: Record<string, string>,
    functionsBundled: Record<string, string>,
    onWarn: (name: string, error: string) => void,
  ): void
  ```
  Strips ESM export syntax (`export default function foo()` → `function <name>()`), transpiles TS→JS when no bundled version exists, evals in the VM, binds to `globalThis['<name>']`. **Best-effort**: one broken function does not abort the session.
- **Per-agent scoping** — `getAgentFunctions()` (`spaces/agent.ts:13`) returns only the functions listed in `agent.config.functions`.
- **Sandbox** — QuickJS WASM (`sandbox/quickjs.js`): isolated module scope per statement, `globalThis` propagation for cross-statement variable access, host bridge for QuickJS ↔ Node marshalling, pending-yields queue for value-yielding operations.

## A.5 Components at runtime

- **Loading** — `loadComponents()` (`load.ts:136`): view components as raw source, form components as paired `{ web, ink }`.
- **Per-agent scoping** — `getAgentComponents()` (`spaces/components.ts:6`):
  ```ts
  export function getAgentComponents(space: Space, agent: AgentDef): {
    view: Record<string, string>;
    form: Record<string, { web: string; ink: string }>;
  }
  ```
- **JSX runtime** — `injectJSXRuntime()` (`session.ts:521`): installs a React `createElement` shim plus component stub objects carrying a `displayName`. Both catalog components and space components are injected, enabling JSX transpilation to resolve to component references the host can later swap for real renders.

## A.6 Tasklist execution

- **Loading** — `loadTasklist()` (`spaces/tasklist-load.ts:16`), producing `Record<string, TaskNode>`.
- **Runtime global** — `tasklist(name, seed?)` (`tasklist/tasklist.ts:9`); the optional `seed` object passes context into the task run.

## A.7 Knowledge resolution

`resolveKnowledge()` (`spaces/knowledge.ts:9`):

```ts
export async function resolveKnowledge(space: Space, path: string[]): Promise<unknown>
```

Path formats: `[domain]` | `[domain, field]` | `[domain, field, option]`. Reads `knowledge/<domain>/<field>/index.md` for metadata and individual option files for content; returns structured data (frontmatter + body).

## A.8 The turn loop (`eval/turn-loop.ts`)

`runTurnLoop()` (`turn-loop.ts:118`) returns `'done' | 'error'`:

1. Issue LLM request with system block + message history.
2. Stream response chunks.
3. Detect statement boundaries with `BoundaryDetector`.
4. For each statement:
   - Typecheck with the TypeScript compiler.
   - Transpile TS/JSX → JS.
   - Evaluate in the QuickJS VM.
   - Extract variable bindings, propagate via `globalThis`.
5. Handle yields (`fork`, `delegate`, `tasklist`, `solve`, …): resolve, bind values, emit a VARIABLES block.
6. Retry on errors with error feedback.
7. Continue until no statements remain or max retries hit.

**Variable propagation across statements** (`turn-loop.ts:209`):
```ts
const boundNames = extractBindingNames(stmt);
let jsCode = transpileStatement(stmt);
if (boundNames.length > 0) {
  const assigns = boundNames
    .map((n) => `try { globalThis['${n}'] = ${n}; } catch {}`)
    .join('\n');
  jsCode += '\n' + assigns;
}
```

## A.9 Complete agent startup flow

1. `Session.start()` loads user space + system spaces.
2. `loadSpace()` scans filesystem → `Space`.
3. `mergeSystemInto()` merges system spaces in.
4. Agent resolved from `agents/<slug>/instruct.md`.
5. QuickJS VM created.
6. Globals injected (`ask`, `display`, `fork`, `delegate`, …).
7. Host tools injected (`console`, `execShell`, `readFileRaw`, …).
8. Space functions injected (from `functions/*.ts`).
9. JSX runtime injected (`createElement` + component stubs).
10. System block built (runtime instructions + agent instructions).
11. Message history initialized with the initial user message.
12. `runTurnLoop()` executes the eval loop.
13. Statements streamed, typechecked, transpiled, evaluated.
14. Yields resolved (forks, delegates, tasklists).
15. Variables bound + propagated via `globalThis`.
16. Loop continues until done or error.

**Net effect:** the `instruct.md` frontmatter is not just UI metadata. The runtime reads `functions`/`components` to decide *what gets injected into the VM for that agent*, reads `actions[].tasklist` to wire the `tasklist(name)` global, and reads `knowledge` refs to populate both `loadKnowledge()` and the system block.

---

# Part B — The Save Path: Studio → Pod

Strategy: **local-first optimistic + debounced whole-space PUT**. No per-file round-trips.

## B.1 PodTransport write methods

File: `sdk/libs/state/src/lib/pod/transport.ts`.

### `saveSpaceFiles` — main space persistence (`transport.ts:134`)

```ts
async saveSpaceFiles(projectId: string, spaceId: string, files: FileTree): Promise<void> {
  const filtered: FileTree = {}
  for (const [path, content] of Object.entries(files)) {
    if (isRunnableSpaceFile(path)) filtered[path] = content
  }
  await this.request<{ ok: boolean }>(this.spacesUrl(projectId, spaceId, true), {
    method: 'PUT',
    body: JSON.stringify({ files: filtered }),
  })
}
```

- **HTTP**: `PUT /api/projects/:id/spaces/:spaceId/files`
- **Body**: `{ files: FileTree }` — complete space file map
- **Semantics**: **wipe-and-rewrite** — the pod replaces the entire runnable file set atomically. This is the endpoint used for routine editing.

### `writeFile` — IDE direct file primitive (`transport.ts:162`)

```ts
async writeFile(path: string, content: string): Promise<void> {
  await this.request<{ ok: boolean }>(`${this.opts.baseUrl}/api/fs/write`, {
    method: 'PUT',
    body: JSON.stringify({ path, content }),
  })
}
```

- **HTTP**: `PUT /api/fs/write`, body `{ path, content }`
- Used for direct IDE file-tree manipulation, **not** routine space saves.

### `createProject` (`transport.ts:88`)

```ts
async createProject(name: string): Promise<{ id: string }> {
  return this.request<{ id: string }>(`${this.opts.baseUrl}/api/projects`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}
```

- **HTTP**: `POST /api/projects`, body `{ name }` → `{ id }`.

## B.2 Draft system → commit (`hooks/useDraft.ts`)

```ts
// useDraft.ts:11
export function useDraft(path: string): string | undefined {
  const { drafts } = useApp()
  return useSyncExternalStore(
    cb => drafts.onChange(path, cb),
    () => drafts.get(path),
  )
}

// useDraft.ts:88
save: async (path: string) => {
  const draftContent = drafts.get(path)
  if (draftContent === undefined) return
  const { useAppFS } = await import('./fs/useAppFS')
  const appFS = useAppFS()
  appFS.writeFile(path, draftContent)   // in-memory cache ONLY
  drafts.delete(path)
}
```

**Critical:** `save()` writes to `AppFS` (in-memory cache), **not** directly to the pod. Unsaved drafts never reach the cache or the pod. The pod sync happens separately, via the debounced write-back below.

## B.3 Serialization round-trip

Studio editors operate on **raw file strings**, so there is no `SpaceData` → files serializer on the hot path. The serializers that exist are used for **export** and shared parsing:

- `studio/src/lib/workspaceExport.ts` — `serializeAgentInstruct`, `serializeTask` (ZIP export).
- `sdk/libs/state/src/lib/fs/parsers/`:
  - `instruct.ts:300` — `serializeAgentInstruct()`:
    ```ts
    export function serializeAgentInstruct(instruct: AgentInstruct): string {
      const lines: string[] = ['---', `title: ${instruct.title}`]
      if ((instruct.knowledge ?? []).length > 0) {
        lines.push('knowledge:')
        for (const k of instruct.knowledge) lines.push(`  - ${k}`)
      } else {
        lines.push('knowledge: []')
      }
      // … functions, components, actions, dependencies, runtimeFields, formValues
      lines.push('---', '', (instruct.body ?? '').trim())
      return lines.join('\n')
    }
    ```
  - `tasklist.ts:86` — `serializeTasklistTask()`:
    ```ts
    export function serializeTasklistTask(task: TasklistTask): string {
      const lines: string[] = ['---', `id: ${task.id}`, 'output:']
      for (const [k, v] of Object.entries(task.output)) lines.push(`  ${k}: ${v}`)
      const dependsOn = task.dependsOn ?? []
      if (dependsOn.length > 0) {
        lines.push('dependsOn:')
        for (const d of dependsOn) lines.push(`  - ${d}`)
      } else {
        lines.push('dependsOn: []')
      }
      lines.push(`optional: ${task.optional ?? false}`)
      lines.push(`goal: ${task.goal ?? false}`)
      // … condition handling
      lines.push('---', '', task.instruction.trim())
      return lines.join('\n')
    }
    ```
  - `config.ts:37` — `serializeKnowledgeFieldIndex()`:
    ```ts
    export function serializeKnowledgeFieldIndex(index: KnowledgeFieldIndex, description: string): string {
      const lines = ['---', `type: ${index.type}`, `variable: ${index.variable}`]
      if (index.default !== undefined) lines.push(`default: ${index.default}`)
      if (index.label    !== undefined) lines.push(`label: "${index.label.replace(/"/g, '\\"')}"`)
      // … fieldType, required, renderAs
      lines.push('---', '', description.trim())
      return lines.join('\n')
    }
    ```

The canonical YAML-writer the runtime's own scaffolder uses is `system-spaces/architect/functions/scaffoldSpace.ts` (same `---` frontmatter + body layout).

## B.4 Optimistic vs server strategy (`lib/contexts/SpaceContext.tsx`)

The actual pod sync is a **debounced, space-level write-back** (`SpaceContext.tsx:122`, default debounce **1500ms** at line 35):

```ts
// ── Debounced write-back ─────────────────────────────────────────────────
useEffect(() => {
  if (!projectId || !activeSpaceId) return
  const prefix = `${projectId}/${activeSpaceId}`
  let timer: ReturnType<typeof setTimeout> | null = null
  let dirty = false

  const flush = () => {
    timer = null
    if (!dirty) return
    dirty = false
    // Collect the current space file map from the cache, filtering runtime
    // files (conversations/, .env*) defensively before sending to the pod.
    const snapshot = appFS.getSnapshot()
    const files: Record<string, string> = {}
    const base = `${prefix}/`
    for (const [fullPath, content] of Object.entries(snapshot)) {
      if (fullPath.startsWith(base)) {
        const relPath = fullPath.slice(base.length)
        if (relPath && isRunnableSpaceFile(relPath)) {
          files[relPath] = content
        }
      }
    }
    // Fire-and-forget; errors are logged but don't block the editor.
    transport
      .saveSpaceFiles(projectId, activeSpaceId, files)
      .catch((e) => console.error('Failed to save space:', e))
  }

  const unsubscribe = appFS.onPrefix(prefix, () => {
    dirty = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, saveDebounceMs)
  })

  return () => {
    unsubscribe()
    if (timer) {
      clearTimeout(timer)
      flush()   // best-effort flush on unmount
    }
  }
}, [projectId, activeSpaceId, appFS, transport, saveDebounceMs])
```

**Architecture:**
1. **Optimistic writes** — every `spaceFS.writeFile()` immediately updates the `AppFS` in-memory cache.
2. **Event-driven sync** — `FSEventBus` emits on every write.
3. **Debounced pod sync** — after the quiet window, the entire space snapshot is PUT via `saveSpaceFiles`.
4. **No direct draft→pod path** — drafts commit to `AppFS`, then automatic write-back syncs to the pod.

## B.5 Scaffolding a new space / agent (`scaffoldSpace.ts:427`)

Writes the full initial layout from a spec, via `execShell('mkdir -p …')` + `writeFileRaw(...)`.

**Agent (`scaffoldSpace.ts:438`):**
```ts
const agentDir     = joinPath(dir, 'agents', spec.agentSlug)
const functionsDir = joinPath(dir, 'functions')
const tasklistsDir = joinPath(dir, 'tasklists')
execShell(`mkdir -p "${agentDir}" "${functionsDir}" "${tasklistsDir}"`)

const frontmatter = [
  '---',
  `title: ${spec.agentTitle}`,
  knowledgeBlock,
  fnBlock,
  componentsBlock,
  ...(defaultActionBlock ? [defaultActionBlock] : []),
  actionBlock,
  depsBlock,
  '---',
  '',
  spec.systemPrompt,
].join('\n')
writeFileRaw(joinPath(agentDir, 'instruct.md'), frontmatter)
```

**Functions (`scaffoldSpace.ts:512`):**
```ts
for (const fn of (spec.functions ?? [])) {
  const fnName = stripExt(fn.name)
  writeFileRaw(joinPath(functionsDir, `${fnName}.ts`), fn.source)
}
```

**Knowledge tree (`scaffoldSpace.ts:521`):**
```ts
for (const k of (spec.knowledge ?? [])) {
  const fieldDir = joinPath(dir, 'knowledge', k.domain, k.field)
  execShell(`mkdir -p "${fieldDir}"`)

  const idxLines = [
    '---',
    `type: ${k.type ?? 'string'}`,
    `variable: ${k.variable}`,
    ...(k.default !== undefined ? [`default: ${k.default}`] : []),
    '---',
    '',
    k.description,
  ]
  writeFileRaw(joinPath(fieldDir, 'index.md'), idxLines.join('\n'))

  for (const opt of k.options) {
    writeFileRaw(joinPath(fieldDir, `${opt.slug.replace(/\.md$/, '')}.md`), opt.content)
  }
}
```

**Components (`scaffoldSpace.ts:550`):**
```ts
// View components
for (const c of (spec.components?.view ?? [])) {
  const viewDir = joinPath(dir, 'components', 'view')
  execShell(`mkdir -p "${viewDir}"`)
  writeFileRaw(joinPath(viewDir, `${stripExt(c.name)}.tsx`), c.source)
}

// Form components
for (const c of (spec.components?.form ?? [])) {
  const formDir = joinPath(dir, 'components', 'form', stripExt(c.name))
  execShell(`mkdir -p "${formDir}"`)
  writeFileRaw(joinPath(formDir, 'web.tsx'), c.web)
  writeFileRaw(joinPath(formDir, 'ink.tsx'), c.ink)
}
```

**Tasklists (`scaffoldSpace.ts:566`):**
```ts
for (const tl of (spec.tasklists ?? [])) {
  const tlDir = joinPath(tasklistsDir, tl.name)
  execShell(`mkdir -p "${tlDir}"`)

  tl.tasks.forEach((task: TaskSpec, idx: number) => {
    const num = String(idx + 1).padStart(2, '0')
    const filename = `${num}-${task.id}.md`

    const lines = [
      '---',
      `id: ${task.id}`,
      'output:',
      outputYaml,
      dependsOnYaml,
      `optional: ${task.optional ?? false}`,
      `goal: ${task.goal ?? false}`,
      ...(task.condition ? [`condition: "${task.condition}"`] : []),
      '---',
      '',
      task.instruction,
    ]
    writeFileRaw(joinPath(tlDir, filename), lines.join('\n'))
  })
}
```

This scaffolder is the authoritative reference for "what a minimal valid space looks like on disk."

---

## Full Round-Trip Summary

```
draft
  → appFS (optimistic, in-memory)
  →[1500ms debounce]→ snapshot whole space
  → PUT /api/projects/:id/spaces/:sid/files   (atomic wipe-rewrite)

  …pod stores files…
  → on reload: GET /api/projects/:id/spaces/:sid → { files }
  → extractWorkspaceData → SpaceData → UI

  …on run:
  → loadSpace → merge system spaces
  → inject VM (globals, host tools, space functions, JSX runtime)
  → buildSystemBlock (instruct body + actions + functions + knowledge + components)
  → runTurnLoop (stream → boundary → typecheck → transpile → eval → yield/resolve)
```

**The one contract both halves share:** the **file tree is the source of truth**, filtered through `isRunnableSpaceFile` on both read and write. `SpaceData` / `AgentFrontmatter` are studio's in-memory projection of that tree; the runtime re-parses the same files independently.
