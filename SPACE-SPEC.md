# Space Specification

A space is a directory that defines one or more agents, the tasklists they can run, the knowledge they can load, the TypeScript functions they can call, and the UI components they can render. The file tree is the source of truth — Studio (the editor), the CLI/pod server, and the core runtime each parse it independently.

---

## On-Disk Layout

```
<space-root>/
├── agents/
│   └── <slug>/
│       └── instruct.md
├── tasklists/
│   └── <name>/
│       ├── index.md                  (optional tasklist manifest: input schema + description)
│       ├── 01-<id>.md
│       ├── 02-<id>.md
│       └── ...
├── knowledge/
│   └── <domain>/
│       ├── index.md                  (optional domain descriptor)
│       └── <field>/
│           ├── index.md              (required field manifest)
│           ├── <option-slug>.md
│           └── ...
├── functions/
│   ├── <name>.ts
│   └── ...
├── components/
│   ├── view/
│   │   └── <Name>.tsx
│   └── form/
│       └── <Name>.tsx
└── package.json                      (optional)
```

Files excluded from the runnable set (filtered by `isRunnableSpaceFile` on both read and write to/from the pod):
```
agents/<slug>/conversations/          — conversation history
sessions/                             — persisted sessions
.env                                  — environment variables
.env.*                                — any .env variant
```

---

## `agents/<slug>/instruct.md`

A single file per agent. YAML frontmatter block followed by the system-prompt body.

### Format

```markdown
---
title: Chef
knowledge:
  - cooking/style/greek      # option-level preload (see below)
  - cooking/ingredients      # field-level (agent loads options on demand)
functions:
  - addIngredient
  - putPotOnHeat
  - getPotTemperature
components:
  - SaltinessSlider
  - PotStatus
actions:
  - id: cook_pasta
    label: Cook Pasta
    description: Make a full pasta dish from scratch
    tasklist: make_pasta
defaultAction: cook_pasta
canDelegateTo:
  - sommelier-space/pairing#recommend
---

You are an expert chef. You help users cook delicious pasta dishes.
Use the available functions to manage ingredients and cooking equipment.
```

### Frontmatter fields

| Field | Required | Type | Description |
|---|---|---|---|
| `title` | ✅ | string | Display name for the agent |
| `knowledge` | ✅ | string[] | Refs into `knowledge/` — `"<domain>/<field>"` (field-level) or `"<domain>/<field>/<option>"` (option-level preload) |
| `functions` | ✅ | string[] | Function names from `functions/` (without `.ts`) |
| `components` | ✅ | string[] | Component names from `components/view/` or `components/form/` |
| `actions` | ✅ | ActionDef[] | Actions the agent can run (see below) |
| `defaultAction` | optional | string | If set, freeform sessions skip the model-driven turn loop and run this action's tasklist deterministically |
| `canDelegateTo` | ✅ | string[] | Delegation targets (formats below). Replaces the former `dependencies` field |

> **Compatibility:** the legacy `dependencies:` key is still accepted on read (deprecated, one release) and mapped to `canDelegateTo`. Serializers only write `canDelegateTo`. The former Studio-only `runtimeFields` and `formValues` fields have been **removed** — per-option preloading (knowledge `domain/field/option` refs) replaces them.

### Knowledge refs — field-level vs option-level preload

Each `knowledge` entry is either:

- **Field-level** (`"<domain>/<field>"`, 2 parts) — the agent is informed about the field and its available options in the system prompt; it explicitly loads a specific option at runtime with `loadKnowledge([domain, field, option])`.
- **Option-level preload** (`"<domain>/<field>/<option>"`, 3 parts) — the resolved option content is injected **directly** into the system prompt at boot. The agent does **not** see the field's other options and does not need to call `loadKnowledge` for it.

In both cases, the referenced domain's `index.md` body (its description) is prepended once to the knowledge section.

### `actions` item shape

```ts
{
  id: string          // action identifier
  label: string       // display label
  description: string // shown to the model in the system block
  tasklist: string    // name of a tasklist directory under tasklists/
}
```

### `canDelegateTo` formats

An agent may delegate to other agents. Three scopes are supported (cross-user delegation is **not** supported):

| Ref | Scope | Actions allowed |
|---|---|---|
| `agent-slug` | same space | all actions |
| `agent-slug#action` | same space | only `action` |
| `space-name/agent-slug` | other space in the same project | all actions |
| `space-name/agent-slug#action` | other space, same project | only `action` |
| `npm:package/agent-slug` | agent in an installed npm-published space | all actions |
| `npm:package/agent-slug#action` | npm package | only `action` |
| `space-name/*` | other space, same project | all agents, all actions |

Each target resolves to a `ResolvedDep { space, agent, target, allowedActions? }`. When `#action` suffixes restrict a target, `allowedActions` lists the permitted action ids; otherwise it is undefined (all actions allowed). If the same agent is referenced multiple times, the allowances are unioned — and any unrestricted entry makes all actions allowed. The agent calls `delegate(...)` to invoke a target; calling a disallowed action throws an actionable error naming the permitted actions. The delegatable agents' metadata, description, and permitted actions are rendered into the system prompt.

### Body

Everything after the closing `---` is the system-prompt markdown, injected verbatim into the LLM system block.

### Parser notes

The serializer always writes block-format YAML (multi-line lists, not inline `[a, b, c]`). Both formats are accepted on read. The `slug` is the directory name under `agents/`.

---

## `tasklists/<name>/`

Each tasklist is a directory containing an optional manifest (`index.md`) and ordered task files. The `NN-` numeric prefix on task files determines **file order** (used to sort files and to pick the default goal); actual execution order is determined by the `dependsOn` DAG.

### `tasklists/<name>/index.md` (optional manifest)

```markdown
---
input:
  dish: string
  servings: number
---

Cook a full pasta dish end to end. Use when the user wants a complete recipe executed.
```

| Field | Required | Type | Description |
|---|---|---|---|
| `input` | optional | `Record<string, string>` | Input schema the tasklist expects. The runtime `seed` passed to `tasklist(name, seed)` is validated against it; a missing/mistyped field throws. When absent, any seed is accepted |

The body is a description of what the tasklist does and when to use it. `index.md` is excluded from the ordered task-file set.

### `tasklists/<name>/NN-<id>.md`

```
01-boil_water.md
02-add_pasta.md
03-check_done.md
```

- Prefix must be numeric digits followed by `-` or `_` (e.g. `01-`, `002_`)
- The part after the prefix is the task ID (when no `id` frontmatter field is present)
- Extension must be `.md`

### Format

```markdown
---
id: boil_water
input:
  pot_size: number
output:
  water_ready: boolean
  temperature: number
dependsOn:
  - prev_task_id
optional: false
goal: false
condition: "some_var === true"
---

Fill a large pot with water, add salt, and bring to a boil.
Use putPotOnHeat and monitor with getPotTemperature.
```

### Frontmatter fields

| Field | Required | Type | Description |
|---|---|---|---|
| `id` | optional | string | Task identifier. If absent, derived from filename by stripping the numeric prefix (`01-boil_water.md` → `boil_water`) |
| `input` | optional | `Record<string, string>` | Information needed to start this task (type map, same form as `output`) |
| `output` | optional | `Record<string, string>` | Information returned when the task completes — field name → type (`string`, `boolean`, `number`, `array`, `object`) |
| `dependsOn` | optional | string[] | Task IDs from the same tasklist this task depends on (DAG edges) |
| `optional` | optional | boolean | If true, failure does not abort the tasklist. Defaults to false |
| `goal` | optional | boolean | **At most one** task may set `goal: true`. If none is set, the **last task** (by file order) is the goal |
| `condition` | optional | string | DSL expression evaluated at runtime to decide whether to run the task |

### Tasklist output schema

The tasklist's output schema is the **effective goal task's** `output` (the explicit `goal: true` task, or the last task when none is marked). If the goal task declares no `output`, the tasklist has no output schema.

### Body

Everything after the closing `---` is the instruction text passed to the agent for this task step.

---

## `knowledge/<domain>/index.md`

Optional domain-level descriptor. If absent the domain still exists (derived from its subdirectories).

### Format

```markdown
---
label: "Cooking Styles"
icon: 🍳
color: "#f5a623"
renderAs: tabs
---

Description of what this knowledge domain covers and when to use it.
```

| Field | Required | Type | Description |
|---|---|---|---|
| `label` | optional | string | Display name |
| `icon` | optional | string | Emoji or icon identifier |
| `color` | optional | string | Hex color |
| `renderAs` | optional | `tabs` \| `list` | **Studio UI hint** for rendering the domain's fields. `tabs` renders fields as a tab bar; defaults to `list`. Not used by the core runtime |

### Body

Plain markdown description of the domain. **The body is injected into the agent's system prompt** (once per referenced domain).

---

## `knowledge/<domain>/<field>/index.md`

Required field manifest. Defines the type and variable name for the field.

### Format

```markdown
---
type: string
variable: cooking_style
default: italian
label: "Cooking Style"
fieldType: select
required: true
---

Controls the overall cooking style applied to all recipes in this session.
```

| Field | Required | Type | Description |
|---|---|---|---|
| `type` | ✅ | string | Value type: `string` \| `number` \| `boolean` \| `object` \| `array` |
| `variable` | optional | string | Variable name returned by `loadKnowledge()`. **Inferred from the `<field>` directory name when omitted** |
| `default` | optional | string | Fallback value when no option is selected |
| `label` | optional | string | Display name |
| `fieldType` | optional | string | UI hint for how to render/ask for the field: `select`, `text`, `toggle`, etc. The control is drawn from the component catalog. The agent may use this when it asks the user. UI rendering is inferred from `fieldType` |
| `required` | optional | boolean | Whether a value must be selected |

> The former `renderAs` field has been **removed** — rendering is inferred from `fieldType`.

### Body

Plain markdown description of the field.

---

## `knowledge/<domain>/<field>/<slug>.md`

Option files — the selectable values for a field. Plain markdown, or markdown with optional frontmatter.

### Format (plain)

```markdown
The full description / content for this option.
```

### Format (with frontmatter)

```markdown
---
description: "Mediterranean cooking with olive oil, lemon, and herbs."
icon: 🇬🇷
color: "#2a6fdb"
label: "Greek"
---

Body content for this option.
```

When frontmatter is present, `description` is **required**; `icon`, `color`, and `label` are the only other permitted keys. Any other key fails loud (on both space load and `resolveKnowledge`). `description` is used by the agent (system prompt); `icon`/`color`/`label` are used only by the Studio UI.

When frontmatter is present, `resolveKnowledge([domain, field, slug])` returns `{ ...frontmatterData, body }`. When plain markdown, it returns the body string directly.

The slug is the filename without `.md`. `index.md` is reserved for the field manifest and is never treated as an option.

---

## `functions/<name>.ts`

A TypeScript file exporting a single callable. Injected into the QuickJS VM as a global under the filename stem.

Functions **must** have:
- **TypeScript type annotations** on all parameters and the return value. The signature is extracted from the AST and injected into the system prompt — the agent never sees the function source.
- A **multi-line JSDoc** comment describing what the function does. The description is injected into the system prompt.

### Accepted export shapes

```ts
/**
 * Add an ingredient to the current dish.
 */
export default function addIngredient(name: string, amount: number): void {
  // ...
}

/** Fetch a recipe by query. */
export default async function fetchRecipe(query: string): Promise<string> {
  // ...
}

/** Named (non-default) export also works. */
export function addIngredient(name: string, amount: number): void {
  // ...
}
```

### Rules

- Extension must be `.ts` or `.tsx` — `.js` files are ignored
- One file = one function = one global. The binding name in the VM is always the **filename stem**, not the in-file identifier
- All `export` keywords are stripped before evaluation so the function lands in script scope
- The function is bound as `globalThis['<name>'] = <name>`
- Available to agent-generated code as a plain global call: `addIngredient("salt", 1)`
- Only functions listed in the agent's `functions:` frontmatter array are injected for that agent

### With npm dependencies

If the space has a `package.json` with installed `node_modules/`:
- Each function is bundled with **esbuild** at load time (`format: 'esm'`, `platform: 'browser'`, full npm resolution)
- The bundled JS is used for injection instead of the raw TS source
- Functions without npm imports work identically with or without `node_modules/`

### Injection is best-effort

One broken function logs a warning but does not abort the session. A missing JSDoc or type annotation produces a best-effort warning rather than a hard failure.

---

## `components/view/<Name>.tsx`

A React/TSX file with a default export. Used with `display()` — the model renders it as output.

Requirements:
- Extension must be `.tsx` or `.ts`; component name = filename stem (`PotStatus.tsx` → `PotStatus`)
- Default export required
- A **JSDoc** comment describing the component (injected into the system prompt)
- **TypeScript type annotations** on all props — the props signature is extracted from the AST and injected into the system prompt; the agent never sees the source
- Components may use **only catalog components**, and catalog components **must be imported** (e.g. `import { Stack, Heading } from '@lmthing/ui'`). The catalog import lines are stripped before evaluation and resolve to the injected catalog globals at runtime, while the DTS overlay still types them for typechecking.

### Format

```tsx
import { Stack, Heading, KeyValue } from '@lmthing/ui';

/** Shows the current pot temperature and readiness. */
export default function PotStatus({ temperature, ready }: { temperature: number; ready: boolean }) {
  return (
    <Stack>
      <Heading level={2}>Pot Status</Heading>
      <KeyValue pairs={{ Temperature: temperature, Ready: String(ready) }} />
    </Stack>
  );
}
```

---

## `components/form/<Name>.tsx`

A **single** TSX file (default export), used with `ask()` — the model collects user input. The previous `web.tsx` / `ink.tsx` two-file split has been **removed**; a form component is now one file, built only from catalog components, exactly like a view component. Props require TypeScript annotations (AST-extracted into the system prompt) and a JSDoc description.

### Format

```tsx
import { Slider } from '@lmthing/ui';

/** Lets the user choose a saltiness level from 0–10. */
export default function SaltinessSlider({ onSubmit }: { onSubmit: (v: number) => void }) {
  return <Slider name="level" label="Saltiness" min={0} max={10} onSubmit={onSubmit} />;
}
```

---

## How components are injected at runtime

All components (catalog + space) are injected as stub objects `{ displayName: "Name" }` on `globalThis` before the session starts. A React shim is installed as `React` that implements `createElement` to produce `JSXDescriptor` objects `{ type, props, children }`. The TypeScript compiler (DTS overlay) types every component as a callable that returns `JSXDescriptor`, so the model can write JSX that the host renderer later interprets. Catalog import lines in authored components are stripped at load time (`stripCatalogImports`).

Space component names override catalog names on collision.

---

## Built-in catalog components (always available)

These come from the core runtime and are injected into every VM automatically. The model imports them from the catalog and uses them in JSX.

**Display (use with `display()`):**

| Component | Description |
|---|---|
| `Heading` | Section heading. Props: `level?: 1\|2\|3\|4` |
| `Paragraph` | Body text block |
| `Text` | Inline text run. Props: `color?`, `bold?`, `dim?`, `italic?` |
| `Strong` | Bold emphasis |
| `Em` | Italic emphasis |
| `Muted` | De-emphasized text |
| `Code` | Inline code |
| `Kbd` | Keyboard key |
| `CodeBlock` | Multi-line code block. Props: `lang?` |
| `Markdown` | Rendered markdown. Props: `text?` |
| `Stack` | Vertical layout container. Props: `gap?` |
| `Row` | Horizontal layout container. Props: `gap?`, `justify?`, `align?` |
| `Columns` | Equal-width column layout. Props: `gap?` |
| `Spacer` | Flexible gap |
| `Divider` | Horizontal rule. Props: `label?` |
| `Card` | Bordered surface. Props: `title?` |
| `Panel` | Titled panel. Props: `title?` |
| `Callout` | Highlighted note. Props: `variant?: 'info'\|'success'\|'warning'\|'error'`, `title?` |
| `Alert` | Alert box (alias of Callout) |
| `Banner` | Full-width banner. Props: `variant?` |
| `Badge` | Small status badge. Props: `color?` |
| `Tag` | Label tag. Props: `color?` |
| `Pill` | Rounded pill label. Props: `color?` |
| `List` | Unordered list. Props: `items?: string[]` |
| `OrderedList` | Ordered list. Props: `items?: string[]` |
| `ListItem` | List item |
| `Table` | Data table. Props: `columns: string[]`, `rows: (string\|number)[][]` |
| `KeyValue` | Key/value pairs. Props: `pairs: Record<string, string\|number>` |
| `ProgressBar` | Progress indicator. Props: `value: number`, `max?`, `label?` |
| `Spinner` | Loading spinner. Props: `label?` |
| `StatCard` | Metric with label. Props: `label: string`, `value: string\|number`, `delta?` |
| `Timeline` | Ordered events. Props: `items: { title, time?, detail? }[]` |
| `Link` | Hyperlink. Props: `href: string` |
| `Quote` | Block quote |
| `Details` | Collapsible section. Props: `summary: string` |

**Form (use with `ask()`):**

| Component | Description |
|---|---|
| `Form` | Form wrapper — collects child field values and submits one object. Props: `submitLabel?` |
| `Fieldset` | Grouped fields with a legend. Props: `label?` |
| `Field` | Label + control + help/error wrapper. Props: `label?`, `help?`, `error?` |
| `TextField` | Single-line text. Props: `name?`, `label?`, `placeholder?`, `defaultValue?` |
| `TextArea` | Multi-line text. Props: `name?`, `label?`, `rows?`, `defaultValue?` |
| `NumberField` | Numeric input. Props: `name?`, `label?`, `min?`, `max?`, `step?`, `defaultValue?` |
| `PasswordField` | Masked text |
| `EmailField` | Email input |
| `UrlField` | URL input |
| `SearchField` | Search input |
| `Select` | Single-choice dropdown. Props: `name?`, `options: (string\|{label,value})[]`, `defaultValue?` |
| `MultiSelect` | Multi-choice list |
| `Combobox` | Autocomplete single-choice |
| `RadioGroup` | Single-choice radios |
| `CheckboxGroup` | Multi-choice checkboxes |
| `Checkbox` | Single boolean. Props: `name?`, `label?`, `defaultValue?` |
| `Switch` | Boolean toggle |
| `Slider` | Range slider. Props: `name?`, `min?`, `max?`, `step?`, `defaultValue?` |
| `Stepper` | Increment/decrement number |
| `DatePicker` | Date input |
| `TimePicker` | Time input |
| `DateTimePicker` | Date + time input |
| `ColorPicker` | Color input (hex on terminal) |
| `FileField` | File path / upload |
| `TagInput` | Free-form tag/chips |
| `Rating` | Star rating. Props: `name?`, `max?`, `defaultValue?` |
| `OtpInput` | One-time-code / PIN. Props: `length?` |
| `PhoneField` | Phone number |
| `CurrencyField` | Currency amount. Props: `currency?` |
| `Button` | Action button. Props: `value?`, `variant?: 'primary'\|'secondary'\|'danger'` |
| `SubmitButton` | Submits the enclosing Form |
| `ButtonGroup` | Row of choice buttons. Props: `options: (string\|{label,value})[]` |
| `ConfirmButtons` | Yes/No confirmation — resolves boolean. Props: `confirmLabel?`, `cancelLabel?` |

A `<Form>` resolves to an object keyed by field `name`. A bare control resolves to the single value.

---

## `package.json`

Standard npm `package.json`. Optional. When present:

- The runtime reads the `name` field as the space's package name (used for dependency resolution with `npm:package/agent` refs)
- If `node_modules/` is installed, functions are bundled with esbuild at load time
- Dependencies declared here can be imported inside `functions/*.ts` files

```json
{
  "name": "@my-org/cooking-space",
  "version": "1.0.0",
  "dependencies": {
    "some-npm-package": "^1.2.0"
  }
}
```

---

## Knowledge resolution at runtime

The `loadKnowledge(path)` global resolves paths lazily at runtime:

| Path | Returns |
|---|---|
| `[domain]` | Field overview for the domain |
| `[domain, field]` | `{ type, variableName, default, options: [slugs] }` |
| `[domain, field, option]` | `{ ...frontmatterData, body }` if the option has frontmatter, else the raw body string |

Option-level preloads declared in an agent's `knowledge` frontmatter are resolved at boot (`resolvePreloadedKnowledge`) and injected directly into the system prompt.

---

## System spaces

Six baseline spaces are always merged into every user space at runtime. They live in `sdk/org/libs/core/system-spaces/` and are prefixed by intended deployment target (`system-*` for the platform toolkit/agents, `user-*` for the per-user agents materialized on `lmthing init`):

```
system-global         system-engineer       system-architect
system-deep-research  user-memory           user-thing
```

Merge rules:
- System spaces are merged at **low priority** — user space wins on collision
- **Exception:** a user agent that has no `instructBody` text AND no actions is treated as an empty placeholder and does **not** shadow the system agent
- **Exception:** a user tasklist with zero files does **not** shadow the system tasklist
- The `system-global` space is special — its functions are injected into **every** session regardless of agent. All other system-space functions are scoped to their own agents only
- All system agents are universally delegatable from any user agent

---

## Wire shape — Pod REST API

Studio syncs spaces to/from the compute pod via these endpoints.

### `GET /api/projects` → `{ projects: PodProject[] }`

```ts
interface PodProject {
  id: string
  name: string
  createdAt?: number | string  // epoch ms OR ISO string
}
```

### `GET /api/projects/:id/spaces` → `{ spaces: PodSpaceMeta[] }`

```ts
interface PodSpaceMeta {
  id: string
  name: string
  description?: string
  agents?: Array<{ slug: string; title: string; actions: Array<{ id: string; label: string }> }>
  functionCount?: number
  componentCount?: number
  hasKnowledge?: boolean
}
```

### `GET /api/projects/:id/spaces/:spaceId/files` → `{ files: FileTree }`

```ts
type FileTree = Record<string, string>  // relative filePath → raw string content
```

Returns the full runnable file set. Studio filters with `isRunnableSpaceFile(path)` before use (drops `conversations/`, `sessions/`, `.env*`).

### `PUT /api/projects/:id/spaces/:spaceId/files`

Body: `{ files: FileTree }`. **Wipe-and-rewrite** — atomically replaces the entire runnable file set on the pod. Used for all routine edits (Studio's debounced save path).

### Per-file endpoints

For targeted single-file operations (alongside the bulk PUT):

- `POST   /api/projects/:id/spaces/:spaceId/files` — body `{ path, content }`; creates a file (201).
- `PUT    /api/projects/:id/spaces/:spaceId/files/<path>` — body `{ content }`; updates a single file (200).
- `DELETE /api/projects/:id/spaces/:spaceId/files/<path>` — deletes a single file (204; 404 if missing).

All per-file routes validate the path with `isSafeRelPath` (rejecting traversal/unsafe segments, 400) and honor the `isRunnableSpaceFile` exclusions.

### `POST /api/projects` → `{ id: string }`

Body: `{ name: string }`. Creates a new project.

---

## Save path (Studio → pod)

1. **User edits** → draft stored in `DraftStore` (in-memory only, never reaches pod)
2. **Save draft** → `useDraftMutations().save(path)` commits draft to `AppFS` (in-memory cache)
3. **AppFS write** → emits event on `FSEventBus`
4. **Debounced write-back** (default 1500ms quiet window) → `SpaceContext` collects the full space snapshot from `AppFS`, filters with `isRunnableSpaceFile`, fires `PUT /api/projects/:id/spaces/:spaceId/files`
5. **Best-effort flush on unmount** — `SpaceContext` flushes dirty state when the component unmounts

Drafts that are never saved never reach `AppFS` and never reach the pod.

---

## Serialization

The canonical serializers used for export and state-lib write-back live in **Studio** (`studio/src/lib/workspaceExport.ts`) and the `@lmthing/state` parsers (`sdk/libs/state/src/lib/fs/parsers/`), not in the core runtime:

- **`serializeAgentInstruct(instruct)`** → block YAML frontmatter (incl. `canDelegateTo`) + body.
- **`serializeTasklistTask(task)`** / **`serializeTasklistIndex(...)`** → task and tasklist-manifest frontmatter + body.
- **`serializeKnowledgeFieldIndex(index, description)`** → field manifest YAML + description body.
- **`serializeKnowledgeDomainIndex(index, description)`** → domain YAML (incl. `renderAs`) + description body.

All serializers produce `---\n<fields>\n---\n\n<body>` format with the body trimmed. Arrays are written as block lists (multi-line), not inline. The core runtime only reads spaces; it does not own the serializers.

---

## Complete agent boot sequence (runtime)

1. `Session.start()` calls `loadSpace(spaceDir)` — scans the filesystem, produces a `Space`
2. System spaces loaded from `defaultSystemSpaceDirs()`, merged in via `mergeSystemInto()`
3. Agent resolved from `agents/<slug>/instruct.md` — if `agentSlug = 'default'` and no agent literally named `default` exists, the first agent is used
4. QuickJS VM created
5. Value-yielding globals injected: `ask`, `display`, `inspect`, `sleep`, `loadKnowledge`, `fork`, `delegate`, `tasklist`, `registerSpace`
6. Host tool globals injected: `console.log/warn/error`, `execShell`, `process.env`, `fetch`, `readFileRaw`, `writeFileRaw`, `typecheckSource`, `progress`
7. Space functions injected (system `system-global` functions + agent-scoped functions)
8. JSX runtime injected (`React.createElement` shim + catalog stubs + space component stubs; catalog imports stripped)
9. Option-level knowledge preloads resolved (`resolvePreloadedKnowledge`)
10. System block built: runtime preamble → globals summary → UI catalog → built-in tools → agent `instruct.md` body → actions → function signatures → knowledge tree (domain descriptions, preloaded options, field options) → available components (AST props + JSDoc) → delegatable agents (metadata + permitted actions)
11. If the agent has `defaultAction`: freeform session delegates deterministically to that action's tasklist instead of running the model-driven turn loop
12. Otherwise: `runTurnLoop()` — LLM streams TS statements → typecheck → transpile → eval in QuickJS → yields resolved → variables bound on `globalThis` → loop until done or error
