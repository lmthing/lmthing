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
- `thing` runs **on the user's compute pod** (the `user-thing` system space, merged
  in at session runtime), NOT in the browser. No in-browser LLM call and no
  localStorage workspace-action protocol any more.
- UI: an **always-on, right-side docked chat panel** in the Studio shell, toggled
  from the "THING" entry in the sidebar footer. Toggling does **not** navigate or
  change the URL — the dock persists across space navigation while enabled
  (state key `studio-shell.thing.open`).
- Implementation:
  - Reusable `<AgentChatPanel>` exported from `@lmthing/agent-ui` (`sdk/org/packages/ui`)
    encapsulates ensure-pod → `ReplRpcClient.createSession` → `useReplSession`
    streaming → block rendering → input. Target modes: `{mode:'agentOnly',agentSlug}`
    (pod resolves the space), `{mode:'spaceDir',…}`, `{mode:'sync',spaceName,files,…}`.
    It captures the resolved bearer token in state and feeds it to `useReplSession`
    so the WebSocket carries `?access_token=` (a JWT-gated gateway rejects it
    otherwise — that was a real bug).
  - Studio passes it in as `StudioLayout rightPanel={<…AgentChatPanel agentSlug:'thing'…>}`
    (built in `studio/src/routes/$projectId/$spaceId/route.tsx`, since it needs auth +
    compute origin); `StudioShell` owns the toggle and renders the dock.
  - The old browser `ThingPanel` (`sdk/libs/ui/components/thing/thing-panel`) and its
    workspace-action JSON envelope are **deprecated/unused** by Studio.
- The same `<AgentChatPanel>` powers the standalone `/thing` route and is what the
  pod's `lmthing --web` served UI renders **when embedded** (iframe / `?embed=1`);
  a direct visit to lmthing.chat keeps the full project/session shell + DevPanel.

> **React dedupe (gotcha):** `@lmthing/agent-ui` is aliased to its submodule source
> (which has its own `node_modules/react@18`); the SPA vite config
> (`sdk/libs/utils/src/vite.mjs`) sets `resolve.dedupe` for react/react-dom/jsx-runtime
> so its components don't pull a 2nd React and crash hooks ("Cannot read properties
> of null (reading 'useState')"). Keep that dedupe.

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
- Build check: `pnpm build` (from repo root). NB: `vp build` uses esbuild and does
  **not** typecheck — `tsc` reports ~1100 pre-existing errors (mostly `@lmthing/ui`
  `children`/prop-type debt). The build is the real gate; use `git stash` A/B to
  prove a change adds zero *new* tsc errors.

## Projects & Spaces shown in Studio
- `GET /api/projects` returns the user's projects **plus a synthetic `system` project**
  (added pod-side in `sdk/org/.../server/projects.ts`) that surfaces the system spaces
  (`system-global`/`system-engineer`/`system-architect`/`system-deep-research`) and the
  per-user spaces (`user-thing`, `user-memory`). They live at `<root>/system/spaces/<id>`
  and are viewable+editable through the normal `/api/projects/system/spaces/...` routes.
- "New Space" (sidebar / spaces-layout): seeds a minimal valid `agents/<slug>/instruct.md`
  via `transport.saveSpaceFiles` and navigates in. **Hidden when the active project is
  `system`** (system spaces aren't user-created).

## Sidebar & per-pillar editors (`@lmthing/ui` shell)
- Sidebar (`components/shell/studio-sidebar`) lists, per space: **Knowledge** fields,
  **Agents**, **Tasklists**, **Functions** (`functions/*.ts`), **Components**
  (`components/view` + `components/form`), and the THING dock toggle.
- **Knowledge discovery**: fields come from the **required** field manifest
  `knowledge/*/*/index.md` (`useKnowledgeFieldList`), linking to the field-detail route
  with the id encoded `domain---field`. Do NOT rely on the **optional** domain
  `knowledge/<domain>/index.md` to discover knowledge — that was the "knowledge not
  loading" bug (`useDomainDirectory` now derives domains from field indexes too).
- Editors (routes under `$projectId/$spaceId/`): `agent/$agentId` (AgentBuilder, incl.
  2-part + 3-part knowledge refs, `canDelegateTo`), `workflow/$workflowId` (TasklistEditor —
  loads real task content via `useTasklistTasks`/`useTasklistIndex`, per-task `input`,
  `index.md` manifest), `knowledge/$fieldId` (`domain---field`) + `knowledge/domain/$domainId`
  (DomainMetadataPanel), `functions` (FunctionsEditor), `components` (ComponentEditor),
  `raw`, `settings/env`.
- New parsers/serializers live in `@lmthing/state` (`lib/fs/parsers/*`): `parseTasklistTask`
  (block-YAML aware: nested `input`/`output` maps), `parseTasklistIndex`,
  `parseKnowledgeOption` (allow-list: `description` required, `icon`/`color`/`label`).

## Pod base URLs (env)
- `VITE_COMPUTER_BASE_URL` — pod origin for sessions/WS. In prod, unset → defaults to
  `window.location.origin` (Envoy proxies `/api/*` to the user's pod). `VITE_CLOUD_URL`
  → gateway (defaults `https://lmthing.cloud`).

## Testing Studio on PRODUCTION
Full how-to (mint a JWT, load pod env, deploy gotchas) is in the parent repo memory
`reference-prod-test-user-and-deploy`. In short:
- `POST https://lmthing.cloud/api/auth/register {email,password}` creates a user, but
  `POST /api/auth/login` is **broken** (Zitadel "password not supported"; see
  `.issues/zitadel-password-login-disabled.md`). So mint a gateway HS256 JWT directly
  with `GATEWAY_JWT_SECRET` (`cloud/gateway/src/lib/tokens.ts` shape) for the returned
  `user_id`, and inject `localStorage.lmthing_session = {accessToken,refreshToken,expiresAt,userId,email,…}`.
- `POST /api/compute/ensure` provisions a free-tier pod; `PUT /api/compute/env {vars}`
  loads API keys (merge with existing — it replaces all). Drive with Chrome DevTools MCP.
