# Plan: Add `--agent` flag to CLI

## Context

The CLI (`src/cli/bin.ts`) currently supports loading user `.ts/.tsx` files, catalog modules, and space knowledge — but has no concept of an "agent." The goal is to support:

```
tsx src/cli/bin.ts --space ./spaces/cooking --agent general-advisor
```

This loads the agent's config, instructions, functions, components, and flows — wiring everything up automatically.

---

## Files to modify

| File                              | Action     | Purpose                                                                              |
| --------------------------------- | ---------- | ------------------------------------------------------------------------------------ |
| `src/cli/args.ts`                 | Modify     | Add `--agent` / `-a` flag, update validation                                         |
| `src/cli/agent-loader.ts`         | **Create** | Agent config/instruct parsing, flow parsing, function/component/knowledge resolution |
| `src/cli/bin.ts`                  | Modify     | Integrate agent loading path alongside existing file-based path                      |
| `src/cli/agent-loop.ts`           | Modify     | Add `actions` option, slash command interception in `handleMessage`                  |
| `src/cli/server.ts`               | Modify     | Send available actions to web client on connection                                   |
| `src/web/components/InputBar.tsx` | Modify     | Add slash action autocomplete to the input textarea                                  |
| `src/web/rpc-client.ts`           | Modify     | Handle incoming `actions` message, expose to components                              |

## Reusable utilities (no changes needed)

- `src/cli/loader.ts` — `classifyExports()`, `formatExportsForPrompt()`, `scanFormMarkers()`
- `src/catalog/index.ts` — `loadCatalog()`, `mergeCatalogs()`, `formatCatalogForPrompt()`
- `src/knowledge/index.ts` — `buildKnowledgeTree()`, `loadKnowledgeFiles()`, `formatKnowledgeTreeForPrompt()`

---

## Step 1: `src/cli/args.ts`

- Add `agent?: string` to `CLIArgs` interface
- Parse `--agent` / `-a` in `parseArgs()` (after the `--space` branch)
- Update validation: `--agent` satisfies the "must specify something" check; `--agent` requires `--space`

---

## Step 2: `src/cli/agent-loader.ts` — New file

### Exported types

- **`AgentAction`** — `{ id, label, description, flow }`
- **`LoadedAgent`** — `{ title, model?, instruct, actions[], knowledgeDefaults, catalogModules[], localFunctions[], componentRefs[] }`
- **`FlowStep`** — `{ number, name, id, description, instructions, outputTarget, outputSchema }`
- **`ParsedFlow`** — `{ name, description, steps[] }`
- **`KnowledgeConfig`** — `{ hiddenFields: Map<string, Set<string>>, preloadOptions: Array<{domain, field, option}> }`
- **`ResolvedComponents`** — `{ localPaths: string[], catalogGroups: string[] }`

### Exported functions

#### `loadAgent(spaceDir, agentSlug): LoadedAgent`

1. Read `<spaceDir>/agents/<agentSlug>/config.json` — extract `knowledge`, `functions`, `components`
2. Read `<spaceDir>/agents/<agentSlug>/instruct.md` — parse frontmatter for `title`, `model`, `actions`; body becomes `instruct`
3. Separate `functions` array: entries starting with `catalog/` → strip prefix → `catalogModules`; rest → `localFunctions`. Handle tuple format `["catalog/fetch", { config }]` — extract ID, store config for future use
4. Store `config.components` as `componentRefs`

#### `parseInstructFrontmatter(content): { title, model?, actions[], body }`

Minimal YAML parser for the constrained format. Handles:

- Scalar values: `title: Food Assistant`, `model: anthropic:claude-3-5-sonnet`
- Array of objects: `actions:` with `- id:`, `label:`, `description:`, `flow:` items
- Returns body as everything after the `---` block

#### `resolveLocalFunctions(spaceDir, names): string[]`

Maps each function name to `<spaceDir>/functions/<name>.tsx` (fallback `.ts`). Returns absolute paths that exist. **Only config-listed entries are loaded.** These files may export functions OR classes — the existing `classifyExports()` handles both.

#### `resolveAgentComponents(spaceDir, componentRefs): ResolvedComponents`

- Plain names (e.g. `"MealPlanCard"`) → resolve from `<space>/components/view/<Name>.tsx` then `components/form/<Name>.tsx` (try `.ts` too)
- `"catalog/component/form/*"` → extract group name `"form"` for built-in component loading
- Form/view classification is determined by `Component.form === true` (static property), not directory

#### `resolveKnowledgeConfig(knowledgeDefaults): KnowledgeConfig`

Parses the knowledge config object from config.json:

- **`string` value** (e.g. `"type": "italian"`) → add to `preloadOptions` — pre-load that option's markdown into the system prompt
- **`string[]` value** (e.g. `"type": ["japanese", "italian"]`) → add each to `preloadOptions`
- **`false`** (e.g. `"restrictions": false`) → add to `hiddenFields` — hide this field from knowledge tree, keep rest of domain's fields
- **`true`** (e.g. `"technique": true`) → domain/field available, no action needed

#### `parseFlow(flowDir): ParsedFlow | null`

1. Read `index.md` frontmatter for flow `name` and `description`
2. List step files matching `N.Step Name.md`, parse each:
   - Frontmatter: `description`, `model`, `temperature`
   - Body: instructions text (everything after frontmatter, excluding `<output>` block)
   - `<output target="variableName">` block: extract `target` attribute and parse JSON schema inside
   - Generate kebab-cased `id` from step name

#### `formatActionsForPrompt(actions, spaceDir): string`

For each action with a linked flow, include in the prompt:

1. Action header: `### /mealplan — Make a meal plan`
2. Step details with instructions and output schemas so the agent knows what each task requires
3. Note that enforcement happens via `tasklist()` — the agent sees the tasklist already declared when a slash action is triggered

#### `generateTasklistCode(flow: ParsedFlow): string`

Generates the TypeScript `tasklist(...)` call from a parsed flow. Each step becomes a task with `id`, `instructions`, `outputSchema`, and sequential `dependsOn` (step N depends on step N-1).

---

## Step 3: `src/cli/bin.ts` — Integrate agent loading

### Overview

Add a new `if (args.agent)` branch in `main()` that replaces the file-based loading. This branch does an early `return` so it doesn't fall through to the existing path.

### Move model check

The existing model check (`if (!args.model)`) must be moved **after** the agent branch, since agent mode can provide the model from the instruct frontmatter. Model priority: CLI `--model` > agent instruct frontmatter `model:`. Error if neither is set.

### Agent mode branch

1. **Load agent**: `loadAgent(spacePath, args.agent)`
2. **Load local functions & classes**: For each path from `resolveLocalFunctions()`, `import()` to get runtime values and `classifyExports()` + `formatExportsForPrompt()` for signatures. Files may export functions or classes — handle both using the same pattern as the existing file-loading code in `bin.ts` (lines 78–108). For classes: store constructors in a `classConstructors` Map, collect `classExports` for prompt formatting, and wire up `getClassInfo` / `loadClass` on the Session (same as existing code lines 242–266).
3. **Load catalog modules**: Use existing `loadCatalog()` / `mergeCatalogs()` / `formatCatalogForPrompt()` with `agent.catalogModules`
4. **Load components**: Use `resolveAgentComponents()`. For local paths, `import()` + `classifyExports()` with `.form` cross-referencing (same pattern as existing bin.ts). For catalog groups, load from `src/components/<group>/index.ts` using existing `resolveComponentPaths` pattern.
5. **Load knowledge tree**: Use existing `buildKnowledgeTree()` for each space. Then apply `resolveKnowledgeConfig()`:
   - Filter tree: remove hidden fields from domains, remove empty domains
   - Pre-load: read markdown files for pre-load options, strip frontmatter, inject as `## Pre-loaded Knowledge` section in instruct
6. **Parse flows**: For each action, `parseFlow()` the linked flow directory. Pass parsed flows to AgentLoop as `actions`.
7. **Build instruct**: Concatenate agent instruct body + pre-loaded knowledge + formatted actions + CLI `--instruct` flags
8. **Create Session + AgentLoop**: Same as existing path but with agent-derived globals, signatures, instruct, and knowledge tree. Pass `actions` to AgentLoop.
9. **Start server + banner**: Same as existing path but show agent info in banner.

---

## Step 4: `src/cli/agent-loop.ts` — Slash action handling

### New option

Add `actions?: Array<{ id: string, flow: ParsedFlow }>` to `AgentLoopOptions`. Store as `Map<string, ParsedFlow>` in the constructor.

### Intercept slash commands in `handleMessage`

At the start of `handleMessage`, check if the message matches `/actionId`. This works mid-conversation — not just at startup. If the action exists:

1. Generate `tasklist()` code from the parsed flow via `generateTasklistCode()`
2. Feed it to the REPL via `this.runSetupCode(tasklistCode)` — this feeds the code to the session, records it as an assistant message, handles any stop/error events, and refreshes the system prompt. `runSetupCode` works at any point in the conversation, not just before the first turn.
3. Then continue with the normal `handleMessage` flow using the remaining user text (or a default message like `Execute the "Plan Meals" flow`)

The agent then sees the tasklist already declared in its scope and works through the steps.

---

## Step 5: Slash action autocomplete in web chat

### Server → Client: send available actions

In `src/cli/server.ts`, when a WebSocket client connects and requests a snapshot (`getSnapshot`), also send the available actions if the AgentLoop has them. Add a new message type:

```
{ type: 'actions', data: [{ id: 'mealplan', label: 'Make a meal plan', description: '...' }, ...] }
```

The server sends this alongside the snapshot on connection. The AgentLoop needs a `getActions()` method that returns the action list (id, label, description — no flow internals).

### Client: receive and store actions

In `src/web/rpc-client.ts`, handle the `actions` message type in the WebSocket message handler. Store the actions list in the hook's state and expose it as part of the return value (e.g. `actions: AgentAction[]`).

### InputBar: autocomplete dropdown

In `src/web/components/InputBar.tsx`:

- Accept `actions` prop from parent (`App.tsx`)
- When user types `/` as the first character, show a dropdown/popover listing available actions filtered by what follows the `/`
- Each item shows: `/{id}` and the label (e.g. `/mealplan — Make a meal plan`)
- Arrow keys to navigate, Enter or click to select (inserts `/{id} ` into the textarea)
- Escape or blur to dismiss
- The dropdown is positioned above the input bar (it's at the bottom of the screen)
- Simple CSS — no external library needed

---

## Key decisions

1. **Model from agent instruct frontmatter** — CLI `--model` overrides. Error if neither set.
2. **Catalog config options** (allowedURLs, allowedCommands) — extracted but not enforced yet.
3. **Components are config-driven** — listed in `config.json`. Form components identified by `Component.form === true` static property, not by directory.
4. **Flows are enforced tasklists** — when user types a slash action, the system feeds `tasklist()` code to the REPL via `runSetupCode()` before the agent's turn. Step details (instructions + output schemas) are included in the system prompt.
5. **Knowledge config controls visibility and pre-loading** — `string`/`string[]` = pre-load, `false` = hide field, `true` = available.
6. **No YAML library** — minimal frontmatter parser for the constrained format.
7. **Only config-listed functions are loaded** — not all functions in the `functions/` directory.

---

## Verification

1. Run: `tsx src/cli/bin.ts --space ./spaces/cooking --agent general-advisor`
2. Verify banner shows agent name/title, model from frontmatter, space, catalog modules, functions, components
3. Verify system prompt (via `--debug debug.xml`) contains: agent instruct, pre-loaded Italian cuisine knowledge, function/component signatures, knowledge tree (without hidden dietary.restriction field), slash actions
4. Test `/mealplan` — verify tasklist is declared via setup code before agent responds, agent works through the 4 steps
