# Space Specification

A space is a directory that defines one or more agents, the tasklists they can run, the knowledge they can load, the TypeScript functions they can call, and the UI components they can render. The file tree is the source of truth — both Studio (the editor) and the core runtime parse it independently.

---

## On-Disk Layout

```
<space-root>/
├── agents/
│   └── <slug>/
│       └── instruct.md
├── tasklists/
│   └── <name>/
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
│       └── <Name>/
│           ├── web.tsx
│           └── ink.tsx
└── package.json                      (optional)
```

Files excluded from the runnable set (filtered by `isRunnableSpaceFile` on both read and write to/from the pod):
```
agents/<slug>/conversations/          — conversation history
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
  ////CHANGE: I want to be able to preload specific options on a knowledge field. So `cooking/style/greek` should preload the `cooking/style/greek.md` file. The agent should not have access to the other options in that field. 
  ////VALIDATE: When `cooking/style` is set in the array this means that in the system prompt the agent will be informed about the field and its options. The agent has to explicitly load specific options using `loadKnowledge([domain, field, option])`.
  - cooking/style
  - cooking/ingredients
functions:
  ////VALIDATE: the functions listed here must be passed by the typescript ast lib to extract their signatures and inject them into the system prompt. The agent must NOT be shown the full source code. 
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
////CHANGE: dependencies should renamed to canDelegateTo. This is a list of other agents that this agent can delegate to. The agent can have only specific actions that it can trigger on the other agent. The agent should have access to all actions of the other agent only if no specific actions are defined.
////CHANGE: There can be 4 types of delegates. agents of the same space, agents of other spaces under the same project, agents of other spaces under other user's projects, agents of spaces under the installed npm packages. The agent should be able to delegate to any of these types of agents. The agent should be able to delegate to all actions of the other agent if no specific actions are defined. If specific actions are defined, the agent should only have access to those actions. The agent metadata, desctription, available actions and their metadata should be available to the agent in the system prompt. The agent should be able to delegate to other agents using the `delegate()` function. examples: `'agent-slug'` (same space), `'agent-slug#action'` (same space, specific action),  `'space-name/agent-slug'` (other space in same project),`'space-name/agent-slug#action'` (other space in same project, specific action), `'npm:package/agent-slug'` (npm package), `'npm:package/agent-slug#action'` (npm package, specific action)
dependencies:
  - sommelier-space/pairing
////CHANGE: runtimeFields is not needed anymore. This feature is handled by the knowledge field preloading.
runtimeFields:
  SaltinessSlider:
    - cooking/style/saltiness
////CHANGE: formValues is not needed anymore. This feature is handled by the knowledge field/option preloading.
formValues:
  SaltinessSlider:
    level: 5
---

You are an expert chef. You help users cook delicious pasta dishes.
Use the available functions to manage ingredients and cooking equipment.
```

### Frontmatter fields

| Field | Required | Type | Description |
|---|---|---|---|
| `title` | ✅ | string | Display name for the agent |
| `knowledge` | ✅ | string[] | Refs into `knowledge/` — each entry is `"<domain>/<field>"` |
| `functions` | ✅ | string[] | Function names from `functions/` (without `.ts`) |
| `components` | ✅ | string[] | Component names from `components/view/` or `components/form/` |
| `actions` | ✅ | ActionDef[] | Actions the agent can run (see below) |
| `defaultAction` | optional | string | If set, freeform sessions skip the model-driven turn loop and run this action's tasklist deterministically |
| `dependencies` | ✅ | string[] | Other agents this agent can delegate to (see formats below) |
| `runtimeFields` | optional | `Record<string, string[]>` | Per-component runtime field selections: `componentName → [fieldRef, ...]`. Studio UI state only — not used by the core runtime |
| `formValues` | optional | `Record<string, Record<string, unknown>>` | Per-component saved form values: `componentName → { key: value }`. Studio UI state only |

### `actions` item shape

```ts
{
  id: string          // action identifier
  label: string       // display label
  description: string // shown to the model in the system block
  tasklist: string    // name of a tasklist directory under tasklists/
}
```

### `dependencies` formats
////CHANGE: supports these`'agent-slug'` (same space), `'agent-slug#action'` (same space, specific action),  `'space-name/agent-slug'` (other space in same project),`'space-name/agent-slug#action'` (other space in same project, specific action), `'npm:package/agent-slug'` (npm package), `'npm:package/agent-slug#action'` (npm package, specific action)
- `"space-name/agent-slug"` — specific agent in a space
- `"space-name/*"` — all agents in a space
- `"@npm-org/package/agent-slug"` — agent in an npm-published space
- `"@npm-org/package/*"` — all agents in an npm-published space

### Body

Everything after the closing `---` is the system-prompt markdown. Injected verbatim into the LLM system block. No special format — plain markdown prose.

### Parser notes

The serializer always writes block-format YAML (multi-line lists, not inline `[a, b, c]`). Both formats are accepted on read. The `slug` is the directory name under `agents/`.

---
////CHANGE: tasklists should also have a `tasklists/<name>/index.md`. this file frontmatter can have an optional input schema which is the input that the tasklist expects.  The input schema is used by the agent to know what input to provide to the tasklist and. The file will also have a description of what the tasklist does and when to use it.

## `tasklists/<name>/NN-<id>.md`

Each tasklist is a directory containing ordered task files. The `NN-` numeric prefix determines execution order.

### Filename format

```
01-boil_water.md
02-add_pasta.md
03-check_done.md
```

- Prefix must be numeric digits followed by `-` or `_` (e.g. `01-`, `002_`)
- The part after the prefix is the task ID (if no `id` field in frontmatter)
- Files are sorted numerically before loading — the prefix controls execution order
- Extension must be `.md`

### Format

```markdown
---
id: boil_water
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
////CHANGE: the task frontmatter can have an optional input and output schema which is the information needed to be able to start this task and the information that will be returned after the task is completed. 
| Field | Required | Type | Description |
|---|---|---|---|
| `id` | optional | string | Task identifier. If absent, derived from filename by stripping the numeric prefix (`01-boil_water.md` → `boil_water`) |
| `output` | ✅ | `Record<string, string>` | Map of output field name → type string (`string`, `boolean`, `number`, `array`, `object`) |
| `dependsOn` | optional | string[] | Task IDs from the same tasklist this task depends on (DAG edges) |
| `optional` | optional | boolean | If true, failure does not abort the tasklist. Defaults to false |
////CHANGE: if the `goal` field is set to true, and the task has output schema then this output schema will be used as the output schema of the tasklist. If the task has no output schema, then the tasklist will have no output schema. If no task has `goal: true`, then the last task in the tasklist is treated as the goal and its output schema is used as the output schema of the tasklist.
| `goal` | optional | boolean | Exactly one task per tasklist should have `goal: true`. If none is set, the last task is treated as the goal |
| `condition` | optional | string | DSL expression evaluated at runtime to decide whether to run the task |

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
////CHANGE: renderAs is a hint to the UI on how to render the knowledge domain. It can be `tabs` or `list`. If not set, the default is `list`. THIS MUST BE IMPLEMENTED on the studio UI. The agent does not use this information.
renderAs: tabs
---
////CHANGE: the body of the knowledge domain index.md is passed to the agent in the system prompt.
Description of what this knowledge domain covers and when to use it.
```

### Frontmatter fields

| Field | Required | Type | Description |
|---|---|---|---|
| `label` | optional | string | Display name |
| `icon` | optional | string | Emoji or icon identifier |
| `color` | optional | string | Hex color |
| `renderAs` | optional | string | UI rendering hint |

### Body

Plain markdown description of the domain.

---

## `knowledge/<domain>/<field>/index.md`

Required field manifest. Defines the type and variable name for the field.

### Format

```markdown
---
type: string
////VALIDATE: if the `variable` is not set it is inferred from the <field> part of the file path.
variable: cooking_style
default: italian
label: "Cooking Style"
fieldType: select
required: true
renderAs: dropdown
---

Controls the overall cooking style applied to all recipes in this session.
```

### Frontmatter fields

| Field | Required | Type | Description |
|---|---|---|---|
| `type` | ✅ | string | Value type: `string` \| `number` \| `boolean` \| `object` \| `array` |
| `variable` | ✅ | string | Variable name injected into `loadKnowledge()` results |
| `default` | optional | string | Fallback value when no option is selected |
| `label` | optional | string | Display name |
////VALIDATE: the `fieldType` is a hint to the UI on how to render the knowledge field in the studio or in the chat. The elements must be available in the catalog of components. The agent can use this information when they want to ask the user based on the knowledge they have access.
| `fieldType` | optional | string | UI hint: `select`, `text`, `toggle`, etc. |
| `required` | optional | boolean | Whether a value must be selected |
////CHANGE: this can be removed since it can be inferred from the `fieldType`.
| `renderAs` | optional | string | UI rendering hint |

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
////CHANGE: the frontmatter must have required the fields `description`. The description is used by the agent in the system prompt to know what this option is about. NO arbitrary frontmatter fields are allowed. Other optional fields are `icon`, `color`, `label`. The agent does not use these optional fields. They are used by the studio UI to render the option in a more user friendly way.
```markdown
---
someKey: someValue
anotherKey: 42
---

Body content for this option.
```

When frontmatter is present, `resolveKnowledge([domain, field, slug])` returns `{ ...frontmatterData, body }`. When plain markdown, it returns the body string directly.

The slug is the filename without `.md`. `index.md` is reserved for the field manifest and is never treated as an option.

---

## `functions/<name>.ts`

A TypeScript file exporting a single callable. Injected into the QuickJS VM as a global under the filename stem.
////CHANGE: the functions must have typescript type annotations for all parameters and return values. These will be extracted from AST and injected into the system prompt. The agent will not see the source code of the function, only its signature. The agent can call the function with the correct parameters and get the return value. The functions can have npm dependencies which will be bundled with esbuild at load time. The function MUST have multiline jsdoc for description of what it does. The description will be injected into the system prompt for the agent to know what the function does.  

### Accepted export shapes

```ts
// 1. Named default function
export default function addIngredient(name: string, amount: number): void {
  // ...
}

// 2. Default arrow / async
export default async function fetchRecipe(query: string): Promise<string> {
  // ...
}

// 3. Named export (non-default)
export function addIngredient(name: string, amount: number): void {
  // ...
}
```

### Rules

- Extension must be `.ts` or `.tsx` — `.js` files are ignored
- One file = one function = one global. The binding name in the VM is always the **filename stem**, not the in-file identifier
- All `export` keywords are stripped before evaluation so the function lands in script scope
- The function is then bound as `globalThis['<name>'] = <name>`
- Available to agent-generated code as a plain global call: `addIngredient("salt", 1)`
- Only functions listed in the agent's `functions:` frontmatter array are injected for that agent

### With npm dependencies

If the space has a `package.json` with installed `node_modules/`:
- Each function is bundled with **esbuild** at load time (`format: 'esm'`, `platform: 'browser'`, full npm resolution)
- The bundled JS is used for injection instead of the raw TS source
- Functions without npm imports work identically with or without `node_modules/`

### Injection is best-effort

One broken function logs a warning but does not abort the session. The remaining functions are still injected.

---

## `components/view/<Name>.tsx`
////VALIDATE: The view components must ONLY components from the catalog.
////CHANGE: the view components MUST ALWAYS have a jsdoc comment describing what the component does. The description will be injected into the system prompt for the agent to know what the component does. The view components must always have typescript type annotations for all props. The agent will not see the source code of the component, only its signature. The signature must be extracted from the AST and injected into the system prompt. 

A React/TSX file with a default export. Used with `display()` — the model renders it as output.

### Format

```tsx
export default function PotStatus({ temperature, ready }: { temperature: number; ready: boolean }) {
  return (
    <Stack>
      <Heading level={2}>Pot Status</Heading>
      <KeyValue pairs={{ Temperature: temperature, Ready: String(ready) }} />
    </Stack>
  );
}
```
////CHANGE: the view components are always tsx
- Extension must be `.tsx` or `.ts`
- Component name = filename stem (`PotStatus.tsx` → `PotStatus`)
- Default export required
////CHANGE: Catalog components MUST be imported
- Catalog components (`Stack`, `Heading`, `KeyValue`, etc.) are always in scope — no import needed

---
////CHANGE: there should NOT be web and ink components for form components. The form components must be created ONLY using the catalog components either from form or the view catalog.
////CHANGE: the form components must have typescript type annotations for all props. The agent will not see the source code of the component, only its signature. The signature must be extracted from the AST and injected into the system prompt.
## `components/form/<Name>/web.tsx` and `components/form/<Name>/ink.tsx`

Two variants of the same form component. Used with `ask()` — the model collects user input.

- `web.tsx` — rendered by the browser renderer
- `ink.tsx` — rendered by the terminal (Ink) renderer
- Component name = directory name under `form/`
- At least one of the two files is required; the other becomes an empty string if absent

### Format

```tsx
// web.tsx
export default function SaltinessSlider({ onSubmit }: { onSubmit: (v: number) => void }) {
  return <Slider name="level" label="Saltiness" min={0} max={10} onSubmit={onSubmit} />;
}
```

```tsx
// ink.tsx
export default function SaltinessSlider({ onSubmit }: { onSubmit: (v: number) => void }) {
  return <Stepper name="level" label="Saltiness" min={0} max={10} onSubmit={onSubmit} />;
}
```

---

## How components are injected at runtime

All components (catalog + space) are injected as stub objects `{ displayName: "Name" }` on `globalThis` before the session starts. A React shim is installed as `React` that implements `createElement` to produce `JSXDescriptor` objects `{ type, props, children }`. The TypeScript compiler (DTS overlay) types every component as a callable that returns `JSXDescriptor`, so the model can write JSX that the host renderer later interprets.

Space component names override catalog names on collision.

---

## Built-in catalog components (always available, no files needed)

These come from the core runtime and are injected into every VM automatically. The model can use them directly in JSX without any import or space file.

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

- The runtime reads the `name` field as the space's package name (used for dependency resolution with `@scope/package/agent` refs)
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
| `[domain]` | Array of domain slugs |
| `[domain, field]` | `{ type, variableName, default, options: [slugs] }` |
| `[domain, field, option]` | `{ ...frontmatterData, body }` if option has frontmatter, else raw body string |

---

## System spaces

Seven baseline spaces are always merged into every user space at runtime. They live in `sdk/org/packages/core/system-spaces/`:
////CHANGE: remove the solver space and all it's references.
////CHANGE: the system spaces must be prepended with the project they will be deployed when running `lmthing init`. So rename: system-global, system-engineer, system-architect, system-deep-research, user-memory, user-thing.
```
global        engineer        architect       solver
deep_research memory          thing
```

Merge rules:
- System spaces are merged at **low priority** — user space wins on collision
- **Exception:** a user agent that has no `instructBody` text AND no actions is treated as an empty placeholder and does **not** shadow the system agent
- **Exception:** a user tasklist with zero files does **not** shadow the system tasklist
- The `global` space is special — its functions are injected into **every** session regardless of agent. All other system space functions are scoped to their own agents only
- All system agents are universally delegatable from any user agent

---

## Wire shape — Pod REST API

Studio syncs spaces to/from the compute pod via these endpoints:

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

### `GET /api/projects/:id/spaces/:spaceId` → `{ files: FileTree }`

```ts
type FileTree = Record<string, string>  // relative filePath → raw string content
```

Returns the full runnable file set. Studio filters with `isRunnableSpaceFile(path)` before use (drops `conversations/`, `.env*`).
////CHANGE: add 3 new endpoint for creating, updating and deleting a file on a space.
### `PUT /api/projects/:id/spaces/:spaceId/files`


Body: `{ files: FileTree }`. **Wipe-and-rewrite** — atomically replaces the entire runnable file set on the pod. Used for all routine edits.

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

The canonical serializers (used for export and state lib write-back):

**`serializeAgentInstruct(instruct)`** → block YAML frontmatter + body. Arrays always written as block lists (multi-line), not inline.

**`serializeTasklistTask(task)`** → block YAML frontmatter + instruction body.

**`serializeKnowledgeFieldIndex(index, description)`** → YAML frontmatter + description body.

**`serializeKnowledgeDomainIndex(index, description)`** → YAML frontmatter + description body.

All serializers produce `---\n<fields>\n---\n\n<body>` format. The body is trimmed before output.

---

## Complete agent boot sequence (runtime)

1. `Session.start()` calls `loadSpace(spaceDir)` — scans filesystem, produces `Space`
2. System spaces loaded from `defaultSystemSpaceDirs()`, merged in via `mergeSystemInto()`
3. Agent resolved from `agents/<slug>/instruct.md` — if `agentSlug = 'default'` and no agent literally named `default` exists, the first agent is used
4. QuickJS VM created
5. Value-yielding globals injected: `ask`, `display`, `inspect`, `sleep`, `loadKnowledge`, `fork`, `delegate`, `tasklist`, `solve`, `registerSpace`
6. Host tool globals injected: `console.log/warn/error`, `execShell`, `process.env`, `fetch`, `readFileRaw`, `writeFileRaw`, `progress`
7. Space functions injected (system `global` functions + agent-scoped functions)
8. JSX runtime injected (`React.createElement` shim + catalog stubs + space component stubs)
9. System block built: runtime preamble → globals summary → UI catalog → system space tools → agent `instruct.md` body → actions → function signatures → knowledge tree → available components → delegatable dependencies
10. If agent has `defaultAction`: freeform session delegates deterministically to that action's tasklist instead of running the model-driven turn loop
11. Otherwise: `runTurnLoop()` — LLM streams TS statements → typecheck → transpile → eval in QuickJS → yields resolved → variables bound on `globalThis` → loop until done or error
