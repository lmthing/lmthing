# LMTHING

LMTHING is a no-code platform designed to help users build, configure, and deploy custom AI agents by leveraging specific domain expertise.

### Core Features

1. **Knowledge Organization (Domains)**
	- Structure domain knowledge (for example, Cooking Styles or Teacher Profile) as markdown in a file-tree format.
	- This works as a prompt library that provides context to agents.
	- Option-level refs (`domain/field/option`) are preloaded directly into the agent system prompt; field-level refs (`domain/field`) are loaded on demand at runtime.

2. **Agent Configuration (Studio)**
	- Build specialized agents by combining high-level instructions with selected knowledge domains.
	- Each agent is a single `instruct.md` file: YAML frontmatter + system-prompt body.

3. **Task Workflows (Tasklists)**
	- Create multi-step workflows for repeatable outcomes.
	- Each task file (`NN-<id>.md`) defines its own instruction, optional input/output schema, and DAG dependencies (`dependsOn`).
	- Execution order follows the `dependsOn` DAG; the goal task (explicit `goal: true` or the last task by file order) determines the tasklist's output schema.

4. **Agent Execution (Chat)**
	- Test and run agents in a dedicated chat interface.
	- Agents call `ask()`, `display()`, `tasklist()`, `delegate()`, and other globals to drive the conversation.

## Project
- Vite + React + TypeScript app.
- Canonical TS shapes: `src/types/`.

## Core Data Model
`spaces -> { spaceId -> { agents, tasklists, knowledge, functions, components, packageJson } }`

### Agent (required keys)
- `slug` — directory name under `agents/`
- `title` — display name
- `knowledge: string[]` — `domain/field` or `domain/field/option` refs
- `functions: string[]` — function stems from `functions/`
- `components: string[]` — component names from `components/view/` or `components/form/`
- `actions: ActionDef[]` — `{ id, label, description, tasklist }`
- `defaultAction?: string`
- `canDelegateTo: string[]` — delegation targets (same-space agent, `space/agent`, `npm:pkg/agent`, etc.)
- `body: string` — system-prompt markdown

### Built-in Agent: `thing` (in space `user-thing`)
- `thing` is the Studio-side AI chat agent.
- UI behavior: it opens as a right-side panel and pushes main Studio content to the left.
- Responsibility: execute space data mutations and updates through the same in-memory actions used by Studio.

#### Supported workspace actions
- `createWorkspace`
- `setCurrentWorkspace`
- `reload`
- `upsertAgent`
- `deleteAgent`
- `upsertTasklist`
- `deleteTasklist`
- `updateKnowledgeFileContent`
- `updateKnowledgeFileFrontmatter`
- `updateKnowledgeDomainIndex`
- `addKnowledgeNode`
- `updateKnowledgeNodePath`
- `deleteKnowledgeNode`
- `duplicateKnowledgeNode`

#### Message format
- `thing` accepts plain commands (`help`, `status`) and JSON envelopes:
- `{"action":"<actionName>","payload":{...}}`

### Tasklist (required structure)
- Directory `tasklists/<name>/`
- Optional `index.md` manifest: YAML `input` schema + description body
- Task files `NN-<id>.md`: frontmatter (`id`, `input`, `output`, `dependsOn`, `optional`, `goal`, `condition`) + instruction body

### Knowledge
- Tree of domain/field/option directories under `knowledge/`.
- Domain descriptor: `knowledge/<domain>/index.md` (`label`, `icon`, `color`, `renderAs: tabs|list`)
- Field manifest: `knowledge/<domain>/<field>/index.md` (`type`, `variable`, `default`, `label`, `fieldType`, `required`)
- Options: `knowledge/<domain>/<field>/<slug>.md` (plain markdown or frontmatter with `description` required, `icon`/`color`/`label` optional)

## Implementation Notes
- Data is loaded by `SpaceContext` / `AppFS` from the pod via `GET /api/projects/:id/spaces/:spaceId/files`.
- Save path: edits → `DraftStore` → `AppFS` → debounced `PUT /api/projects/:id/spaces/:spaceId/files` (wipe-and-rewrite bulk save).
- Per-file operations also available: `POST`, `PUT /<path>`, `DELETE /<path>` on the same base URL.
- Runtime agent mapping: `@lmthing/core` parses `instruct.md` via `loadSpace()`.

## File Save/Load (Pod REST API + GitHub Repo)
- Export uses `src/lib/workspaceExport.ts` (`serializeAgentInstruct`, `serializeTasklistTask`, etc.).
- GitHub load uses `src/lib/github/workspaceLoader.ts` via `WorkspaceDataProvider`.

### Path Mapping (space object -> files)
- `packageJson` -> `package.json`
- `agents[{slug}]` -> `agents/{slug}/instruct.md`
	- frontmatter: `title`, `knowledge`, `functions`, `components`, `actions`, `defaultAction`, `canDelegateTo`
	- body: system-prompt markdown
	- `conversations[]` -> `agents/{slug}/conversations/{conversationId}.json`
- `tasklists[{name}]` -> `tasklists/{name}/`
	- optional manifest -> `tasklists/{name}/index.md`
	- tasks -> `tasklists/{name}/NN-<id>.md`
- `knowledge[]` -> `knowledge/**`
	- domain descriptor -> `knowledge/{domain}/index.md`
	- field manifest -> `knowledge/{domain}/{field}/index.md`
	- option -> `knowledge/{domain}/{field}/{slug}.md`
- `functions[]` -> `functions/<name>.ts`
- `components/view[]` -> `components/view/<Name>.tsx`
- `components/form[]` -> `components/form/<Name>.tsx` (single file; the old `web.tsx`/`ink.tsx` split is removed)

### Frontmatter Conventions
- `instruct.md`: block-format YAML (multi-line lists, not inline). Serializer always writes `canDelegateTo` (the legacy `dependencies` key is accepted on read only).
- Task files: frontmatter + instruction body. `id` inferred from filename stem when absent.
- Knowledge `index.md` files: YAML frontmatter + description body.

## Guardrails
- Keep TS types in sync with SPACE-SPEC.md.
- Keep slugs/IDs stable (`agentSlug`, tasklist names, knowledge paths).
- Do not re-introduce `runtimeFields`, `formValues`, `config.json`, `values.json`, or `web.tsx`/`ink.tsx` splits — these have been removed.
- Do not add `solve()` or a `solver` system space — `solve()` has been removed. Use `fork`, `tasklist`, or `delegate` instead.

## Quick Validation
- App runs with `pnpm dev` (from repo root).
- Build check: `pnpm build` (from repo root).
