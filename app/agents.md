# LMTHING

LMTHING is a no-code platform designed to help users build, configure, and deploy custom AI agents by leveraging specific domain expertise.

### Core Features

1. **Knowledge Organization (Domains)**
	- Structure domain knowledge (for example, Classroom Management or Teacher Profile) as markdown in a file-tree format.
	- This works as a prompt library that provides context to agents.

2. **Agent Configuration (Studio)**
	- Build specialized agents by combining high-level instructions with selected knowledge domains.
	- Define parameters such as grade level, class size, and teaching style.

3. **Task Workflows (Commands)**
	- Create multi-step visual workflows for repeatable outcomes.
	- Each task can define its own prompt, expected JSON output schema, and model selection.
	- Models can be configured per task (for example, Claude 3.5 Sonnet or Claude 3 Opus).
	- Example workflow: Generate Title and Overview → Generate Objectives → Generate Differentiation Strategies.

4. **Agent Execution (Chat)**
	- Test and run agents in a dedicated chat interface.
	- Provide runtime fields (for example, topic or duration) and trigger workflows to generate structured outputs.

## Project
- Vite + React + TypeScript app.
- Main runtime data source: `src/extracted_data_structure.json`.
- Canonical TS shapes: `src/types/workspace-data.ts`.

## Core Data Model
`workspaces -> { workspaceId -> { agents, flows, knowledge, packageJson } }`

### Agent (required keys)
- `id`
- `frontmatter` (`name`, `description`, `tools`, `selectedDomains`)
- `mainInstruction`
- `slashActions[]` (`name`, `description`, `flowId`, `actionId`)
- `config.emptyFieldsForRuntime`
- `formValues`
- `conversations[]`

### Built-in Agent: `thing`
- `thing` is the Studio-side AI chat agent.
- UI behavior: it opens as a right-side panel and pushes main Studio content to the left.
- Responsibility: execute workspace data mutations and updates through the same in-memory actions used by Studio.

#### Supported workspace actions
- `setCurrentWorkspace`
- `reload`
- `upsertAgent`
- `deleteAgent`
- `upsertFlow`
- `deleteFlow`
- `updateKnowledgeFileContent`
- `updateKnowledgeFileFrontmatter`
- `updateKnowledgeDirectoryConfig`
- `addKnowledgeNode`
- `updateKnowledgeNodePath`
- `deleteKnowledgeNode`
- `duplicateKnowledgeNode`

#### Message format
- `thing` accepts plain commands (`help`, `status`) and JSON envelopes:
- `{"action":"<actionName>","payload":{...}}`

### Flow (required keys)
- `id`
- `frontmatter` (`id`, `name`, `status`, `scope`, `agentId`, `tags`, `taskCount`)
- `description`
- `tasks[]` (`order`, `name`, `frontmatter`, `instructions`, optional `outputSchema`, optional `targetFieldName`)

### Knowledge
- Tree of `directory|file` nodes.
- UI-relevant metadata lives in `config` (`label`, `fieldType`, `variableName`, `renderAs`, etc).

## Implementation Notes
- Data is loaded by `WorkspaceDataProvider` in `src/lib/workspaceDataContext.tsx`.
- Persisted edits can be read from `localStorage` key: `domainsmith-workspace-data`.
- Runtime agent mapping is in `src/hooks/useAgents.ts` (`toRuntimeAgent`).

## File Save/Load (ZIP + GitHub Repo)
- Export uses `src/lib/workspaceExport.ts`.
	- ZIP export: `downloadWorkspaceZip()` / `downloadAllWorkspacesZip()`.
	- GitHub export: `exportWorkspaceToNewGithubRepo()`.
- GitHub load uses `src/lib/github/workspaceLoader.ts` via `WorkspaceDataProvider`.
- File-path mapping follows the same structure shown in `scripts/readMigratedStructure.ts`.

### Path Mapping (workspace object -> files)
- `packageJson` -> `package.json`
- `agents[{agentId}]` -> `agents/{agentId}/`
	- `frontmatter + mainInstruction + slashActions` -> `agents/{agentId}/instruct.md`
	- `config` -> `agents/{agentId}/config.json`
	- `formValues` -> `agents/{agentId}/values.json`
	- `conversations[]` -> `agents/{agentId}/conversations/{conversationId}.json`
- `flows[{flowId}]` -> `flows/{flowId}/`
	- `frontmatter + description` -> `flows/{flowId}/index.md`
	- `tasks[]` -> `flows/{flowId}/{order}.{name}.md`
		- task `outputSchema` + `targetFieldName` are encoded in `<output ...>` tag in each task file
- `knowledge[]` -> `knowledge/**`
	- directory node `config` -> `knowledge/{path}/config.json`
	- file node `frontmatter + content` -> `knowledge/{path}.md`

### Tag/Frontmatter Conventions
- `instruct.md` supports `<slash_action name="..." description="..." flowId="...">/actionId</slash_action>` blocks.
- flow task markdown supports `<output target="fieldName">{...json schema...}</output>`.
- Markdown frontmatter is parsed/serialized as flat key-value YAML-like lines (JSON values allowed for arrays/objects).

### Root Layout Differences
- ZIP export includes a workspace root folder (`{workspace.id}/...`).
- GitHub repo export writes files at repo root (`agents/`, `flows/`, `knowledge/`, `package.json`) without a `{workspace.id}` folder.

## Guardrails
- Keep JSON and TS types in sync.
- Keep IDs stable (`agentId`, `flowId`, workspace keys).
- `config.emptyFieldsForRuntime` must remain compatible with flattening in `src/lib/utils.ts`.
- Do not remove expected `frontmatter` keys used by lists and filters.

## Quick Validation
- App runs with `pnpm dev` (from repo root).
- Build check: `pnpm build` (from repo root).
