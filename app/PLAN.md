# LMTHING UI Refactor Plan

## Overview

This document outlines a full architectural refactor of the LMThing frontend. The goals are:

1. Introduce a layered CSS/element/component architecture that cleanly separates styling from logic.
2. Migrate to Next.js App Router for file-based routing and inner UI state management.
3. Rename all domain entities to their new canonical names.
4. Restructure the data hierarchy from `workspaces → agents/flows/knowledge` to `username → studios → spaces → assistants/workflows/knowledge`.
5. Replace the current GitHub-API-driven context+TanStack Query state layer with the new `AppFS`/`ScopedFS` event-bus architecture defined in `lib/state/PLAN.md`.

---

## State Architecture Dependency

All data access in the refactored UI is built on the FS layer described in
`lib/state/PLAN.md`. Key points that affect the UI plan:

- **Single source of truth:** `AppFS` owns a `Map<string, string>` — one entry
  per file. All derived state is computed from file contents.
- **Scoped proxies:** `UserFS → StudioFS → SpaceFS` strip path prefixes so
  hooks write clean relative paths (`agents/x/instruct.md`, not full paths).
- **Fine-grained reactivity:** Components subscribe via `onFile`, `onDir`,
  `onGlob` — not a global re-render on any state change. No TanStack Query for
  space data.
- **Context hierarchy:** `AppContext → StudioContext → SpaceContext` replaces
  the old `WorkspaceDataContext`/`WorkspaceDataProvider`.
- **FS-level paths keep existing names** (`agents/`, `flows/`) as defined in the
  `P` path builder. Only the UI layer (component names, hooks, routes) uses the
  new canonical names (`assistant`, `workflow`).
- **Persistence:** localStorage (`lmthing-studio:{username}/{studioId}`), not
  GitHub API at runtime. GitHub data is loaded lazily into `AppFS` on studio
  selection.

---

## Entity Rename Map

| Old Name | New Name | Scope |
|----------|----------|-------|
| `workspace` | `space` | UI + types |
| `agent` | `assistant` | UI + types + hooks |
| `flow` | `workflow` | UI + types + hooks |
| `task` | `step` | UI + types + hooks |
| `domain` | `field` | UI + types + hooks |

> **FS path exception:** The underlying file paths stay `agents/` and `flows/`
> as specified in `lib/state/PLAN.md` (`P.agent`, `P.flow`, etc.). Renaming
> the paths on disk is a separate data-migration concern, deferred to avoid
> breaking existing GitHub repositories.

### Knowledge Hierarchy

Old: flat domain → files
New: `knowledge → field → subject → topic-detail (md)`

Component naming follows this hierarchy:
- `FieldTree` (was `KnowledgeTree` / domain list)
- `SubjectList` (subjects within a field)
- `TopicDetail` (was file node / markdown editor)

### Data Hierarchy

Old: `workspaces → { workspaceId → { agents, flows, knowledge, packageJson } }`
New: `username → studios → spaces → { assistants, workflows, knowledge, packageJson }`

---

## Target Directory Structure

```
app/
└── src/
    ├── css/
    │   └── elements/
    │       ├── nav/
    │       │   ├── sidebar/index.css
    │       │   ├── breadcrumb/index.css
    │       │   ├── tab-bar/index.css
    │       │   └── top-bar/index.css
    │       ├── content/
    │       │   ├── card/index.css
    │       │   ├── panel/index.css
    │       │   ├── list-item/index.css
    │       │   ├── badge/index.css
    │       │   ├── avatar/index.css
    │       │   └── separator/index.css
    │       ├── typography/
    │       │   ├── heading/index.css
    │       │   ├── label/index.css
    │       │   ├── caption/index.css
    │       │   └── code/index.css
    │       ├── forms/
    │       │   ├── input/index.css
    │       │   ├── button/index.css
    │       │   ├── select/index.css
    │       │   └── textarea/index.css
    │       └── overlays/
    │           ├── dialog/index.css
    │           ├── dropdown/index.css
    │           └── sheet/index.css
    │
    ├── elements/
    │   ├── nav/
    │   │   ├── sidebar/index.tsx, index.test.tsx
    │   │   ├── breadcrumb/index.tsx, index.test.tsx
    │   │   ├── tab-bar/index.tsx, index.test.tsx
    │   │   └── top-bar/index.tsx, index.test.tsx
    │   ├── content/
    │   │   ├── card/index.tsx, index.test.tsx
    │   │   ├── panel/index.tsx, index.test.tsx
    │   │   ├── list-item/index.tsx, index.test.tsx
    │   │   ├── badge/index.tsx, index.test.tsx
    │   │   ├── avatar/index.tsx, index.test.tsx
    │   │   └── separator/index.tsx, index.test.tsx
    │   ├── typography/
    │   │   ├── heading/index.tsx, index.test.tsx
    │   │   ├── label/index.tsx, index.test.tsx
    │   │   ├── caption/index.tsx, index.test.tsx
    │   │   └── code/index.tsx, index.test.tsx
    │   ├── forms/
    │   │   ├── input/index.tsx, index.test.tsx
    │   │   ├── button/index.tsx, index.test.tsx
    │   │   ├── select/index.tsx, index.test.tsx
    │   │   └── textarea/index.tsx, index.test.tsx
    │   ├── overlays/
    │   │   ├── dialog/index.tsx, index.test.tsx
    │   │   ├── dropdown/index.tsx, index.test.tsx
    │   │   └── sheet/index.tsx, index.test.tsx
    │   └── layouts/
    │       ├── page/index.tsx, index.test.tsx
    │       ├── split-pane/index.tsx, index.test.tsx
    │       └── stack/index.tsx, index.test.tsx
    │
    ├── components/
    │   ├── auth/
    │   │   ├── github-login/index.tsx, index.test.tsx
    │   │   └── github-deployment-status/index.tsx, index.test.tsx
    │   ├── studio/
    │   │   ├── studio-list/index.tsx, index.test.tsx
    │   │   └── studio-card/index.tsx, index.test.tsx
    │   ├── space/
    │   │   ├── space-list/index.tsx, index.test.tsx
    │   │   ├── space-card/index.tsx, index.test.tsx
    │   │   └── space-selector/index.tsx, index.test.tsx
    │   ├── assistant/
    │   │   ├── builder/
    │   │   │   ├── assistant-builder/index.tsx, index.test.tsx
    │   │   │   ├── assistant-form/index.tsx, index.test.tsx
    │   │   │   ├── field-selector/index.tsx, index.test.tsx
    │   │   │   ├── tools-panel/index.tsx, index.test.tsx
    │   │   │   ├── actions-panel/index.tsx, index.test.tsx
    │   │   │   ├── prompt-preview/index.tsx, index.test.tsx
    │   │   │   ├── save-assistant-modal/index.tsx, index.test.tsx
    │   │   │   └── create-assistant-inline/index.tsx, index.test.tsx
    │   │   ├── runtime/
    │   │   │   ├── assistant-list/index.tsx, index.test.tsx
    │   │   │   ├── chat-panel/index.tsx, index.test.tsx
    │   │   │   ├── runtime-panel/index.tsx, index.test.tsx
    │   │   │   └── tool-call-display/index.tsx, index.test.tsx
    │   │   └── assistant-card/index.tsx, index.test.tsx
    │   ├── workflow/
    │   │   ├── workflow-list/index.tsx, index.test.tsx
    │   │   ├── workflow-card/index.tsx, index.test.tsx
    │   │   ├── workflow-editor/index.tsx, index.test.tsx
    │   │   ├── step/
    │   │   │   ├── step-card/index.tsx, index.test.tsx
    │   │   │   ├── step-config-panel/index.tsx, index.test.tsx
    │   │   │   └── step-schema-editor/index.tsx, index.test.tsx
    │   │   └── save-workflow-modal/index.tsx, index.test.tsx
    │   ├── knowledge/
    │   │   ├── field/
    │   │   │   ├── field-tree/index.tsx, index.test.tsx
    │   │   │   ├── field-card/index.tsx, index.test.tsx
    │   │   │   └── create-field-inline/index.tsx, index.test.tsx
    │   │   ├── subject/
    │   │   │   ├── subject-list/index.tsx, index.test.tsx
    │   │   │   └── subject-item/index.tsx, index.test.tsx
    │   │   └── topic-detail/
    │   │       ├── topic-editor/index.tsx, index.test.tsx
    │   │       └── topic-viewer/index.tsx, index.test.tsx
    │   ├── thing/
    │   │   ├── thing-panel/index.tsx, index.test.tsx
    │   │   └── thing-message/index.tsx, index.test.tsx
    │   └── shell/
    │       ├── studio-shell/index.tsx, index.test.tsx
    │       ├── studio-sidebar/index.tsx, index.test.tsx
    │       └── settings-view/index.tsx, index.test.tsx
    │
    ├── app/                              ← Next.js App Router
    │   ├── layout.tsx                    ← Root layout (Providers: AppContext, GithubProvider)
    │   ├── page.tsx                      ← Landing page /
    │   ├── marketplace/
    │   │   └── page.tsx
    │   └── [username]/
    │       ├── layout.tsx                ← mounts UserFS / StudioContext
    │       ├── page.tsx                  ← studio list
    │       └── [studioId]/
    │           ├── layout.tsx            ← mounts StudioFS / SpaceContext
    │           ├── page.tsx              ← space list
    │           └── [spaceId]/
    │               ├── layout.tsx        ← mounts SpaceFS; renders StudioShell+sidebar
    │               ├── page.tsx          ← space overview
    │               ├── settings/
    │               │   ├── page.tsx
    │               │   ├── env/page.tsx
    │               │   └── packages/page.tsx
    │               ├── knowledge/
    │               │   ├── page.tsx
    │               │   └── [fieldId]/
    │               │       ├── page.tsx
    │               │       └── [subjectId]/
    │               │           └── [topicId]/page.tsx
    │               ├── assistant/
    │               │   ├── page.tsx
    │               │   ├── new/page.tsx
    │               │   └── [assistantId]/
    │               │       ├── page.tsx
    │               │       ├── chat/
    │               │       │   ├── page.tsx
    │               │       │   └── [conversationId]/page.tsx
    │               │       └── workflow/
    │               │           └── [workflowId]/page.tsx
    │               └── workflow/
    │                   ├── page.tsx
    │                   ├── new/page.tsx
    │                   └── [workflowId]/
    │                       ├── page.tsx
    │                       └── step/
    │                           └── [stepId]/page.tsx
    │
    ├── hooks/                            ← all hooks defined by lib/state/PLAN.md
    │   ├── fs/
    │   │   ├── useAppFS.ts
    │   │   ├── useStudioFS.ts
    │   │   ├── useSpaceFS.ts             ← primary entry point for all space hooks
    │   │   ├── useFile.ts
    │   │   ├── useFileFrontmatter.ts
    │   │   ├── useFileConfig.ts
    │   │   ├── useDir.ts
    │   │   ├── useGlob.ts
    │   │   ├── useGlobRead.ts
    │   │   ├── useFileWatch.ts
    │   │   ├── useDirWatch.ts
    │   │   ├── useGlobWatch.ts
    │   │   ├── useStreamWrite.ts
    │   │   └── useStreamAppend.ts
    │   ├── studio/
    │   │   ├── useApp.ts
    │   │   ├── useStudio.ts
    │   │   ├── useStudioConfig.ts
    │   │   ├── useStudioEnv.ts
    │   │   └── useStudioEnvList.ts
    │   ├── agent/                        ← FS hook names stay "agent" (paths); UI aliases below
    │   │   ├── useAgentInstruct.ts
    │   │   ├── useAgentConfig.ts
    │   │   ├── useAgentValues.ts
    │   │   ├── useAgentConversations.ts
    │   │   └── useAgentConversation.ts
    │   ├── flow/                         ← FS hook names stay "flow" (paths); UI aliases below
    │   │   ├── useFlowIndex.ts
    │   │   ├── useFlowTask.ts
    │   │   └── useFlowTaskList.ts
    │   ├── knowledge/
    │   │   ├── useKnowledgeConfig.ts
    │   │   ├── useKnowledgeFile.ts
    │   │   └── useKnowledgeDir.ts
    │   └── space/
    │       ├── usePackageJson.ts
    │       ├── useEnvFile.ts
    │       └── useEnvFileList.ts
    │
    ├── lib/
    │   ├── fs/                           ← implemented in lib/state (shared package)
    │   │   └── (re-exported from lib/state)
    │   ├── contexts/
    │   │   ├── AppContext.tsx            ← AppFS instance, studio list
    │   │   ├── StudioContext.tsx         ← StudioFS scope, spaces list
    │   │   └── SpaceContext.tsx          ← SpaceFS scope for current space
    │   ├── utils.ts                      ← cn(), unchanged
    │   ├── envCrypto.ts                  ← unchanged (moved into lib/fs/crypto/)
    │   ├── workflowExecution.ts          (was flowExecution.ts)
    │   ├── buildKnowledgeXml.ts          ← unchanged
    │   └── github/
    │       ├── GithubContext.tsx         ← OAuth (unchanged)
    │       └── spaceLoader.ts            ← loads GitHub repo into AppFS
    │
    └── types/
        ├── space-data.ts                 (was workspace-data.ts)
        ├── product.ts                    (unchanged)
        └── section.ts                    (unchanged)
```

---

## Phase 1: CSS Element Layer

**Goal:** Create `src/css/elements/` with `@apply`-based classes that encapsulate Tailwind utilities.

### Rules
- Each file exports only CSS class definitions using `@apply`.
- No Tailwind utility classes appear in any `.tsx` file.
- Classes follow BEM-like naming: `.element-name`, `.element-name--modifier`, `.element-name__part`.
- One `index.css` per element, grouped by category.

### Categories & Elements

#### `nav/`
| Element | Classes |
|---------|---------|
| `sidebar` | `.sidebar`, `.sidebar--collapsed`, `.sidebar__item`, `.sidebar__item--active` |
| `breadcrumb` | `.breadcrumb`, `.breadcrumb__segment`, `.breadcrumb__separator` |
| `tab-bar` | `.tab-bar`, `.tab-bar__tab`, `.tab-bar__tab--active` |
| `top-bar` | `.top-bar`, `.top-bar__title`, `.top-bar__actions` |

#### `content/`
| Element | Classes |
|---------|---------|
| `card` | `.card`, `.card__header`, `.card__body`, `.card__footer`, `.card--interactive` |
| `panel` | `.panel`, `.panel__header`, `.panel__body`, `.panel--split` |
| `list-item` | `.list-item`, `.list-item--selected`, `.list-item__label`, `.list-item__meta` |
| `badge` | `.badge`, `.badge--primary`, `.badge--muted`, `.badge--success` |
| `avatar` | `.avatar`, `.avatar--sm`, `.avatar--lg` |
| `separator` | `.separator`, `.separator--vertical` |

#### `typography/`
| Element | Classes |
|---------|---------|
| `heading` | `.heading-1` – `.heading-4`, `.heading--muted` |
| `label` | `.label`, `.label--sm`, `.label--required` |
| `caption` | `.caption`, `.caption--muted` |
| `code` | `.code-inline`, `.code-block` |

#### `forms/`
| Element | Classes |
|---------|---------|
| `input` | `.input`, `.input--error`, `.input--sm` |
| `button` | `.btn`, `.btn--primary`, `.btn--ghost`, `.btn--destructive`, `.btn--sm`, `.btn--lg` |
| `select` | `.select`, `.select__trigger`, `.select__content` |
| `textarea` | `.textarea`, `.textarea--sm` |

#### `overlays/`
| Element | Classes |
|---------|---------|
| `dialog` | `.dialog`, `.dialog__backdrop`, `.dialog__content`, `.dialog__header` |
| `dropdown` | `.dropdown`, `.dropdown__trigger`, `.dropdown__content`, `.dropdown__item` |
| `sheet` | `.sheet`, `.sheet--right`, `.sheet__content`, `.sheet__header` |

#### `layouts/`
| Element | Classes |
|---------|---------|
| `page` | `.page`, `.page--full`, `.page__header`, `.page__body` |
| `split-pane` | `.split-pane`, `.split-pane__primary`, `.split-pane__secondary` |
| `stack` | `.stack`, `.stack--row`, `.stack--gap-sm`, `.stack--gap-md`, `.stack--gap-lg` |

### Example: `src/css/elements/forms/button/index.css`

```css
@import "tailwindcss";

.btn {
  @apply inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium
         transition-colors focus-visible:outline-none focus-visible:ring-2
         focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50;
}

.btn--primary   { @apply bg-primary text-primary-foreground hover:bg-primary/90; }
.btn--ghost     { @apply hover:bg-accent hover:text-accent-foreground; }
.btn--destructive { @apply bg-destructive text-white hover:bg-destructive/90; }
.btn--sm        { @apply h-8 px-3 text-xs; }
.btn--lg        { @apply h-11 px-8 text-base; }
```

---

## Phase 2: Element Components

**Goal:** Build pure UI elements that use only the CSS classes defined in Phase 1. Zero Tailwind utilities in TSX files.

### Rules
- Each element is stateless or uses only local UI state (open/closed, hover).
- Import the sibling CSS file at the top of `index.tsx`.
- Props are generic — no domain knowledge (no `assistant`, `workflow`, etc.).
- Every element has a corresponding `index.test.tsx` with basic render tests.

### Key Elements to Build

| Element | Replaces | Notes |
|---------|----------|-------|
| `elements/forms/button` | `components/ui/button.tsx` | Accepts `variant`, `size`, `asChild` |
| `elements/forms/input` | `components/ui/input.tsx` | `.input`, `.input--error` |
| `elements/content/card` | `components/ui/card.tsx` | Compound: Card, CardHeader, CardBody, CardFooter |
| `elements/overlays/dialog` | `components/ui/dialog.tsx` | Wraps Radix Dialog |
| `elements/overlays/sheet` | `components/ui/sheet.tsx` | Used for ThingPanel |
| `elements/nav/sidebar` | StudioSidebar layout shell | Collapse state |
| `elements/layouts/split-pane` | StudioShell two-column layout | primary + secondary slots |
| `elements/layouts/stack` | ad-hoc flex wrappers | vertical/horizontal gap helper |

---

## Phase 3: FS State Layer Integration

**Goal:** Wire the FS state layer from `lib/state` into the app via the three contexts, and expose domain hooks that components will consume.

### 3.1 Context Setup

Replace `WorkspaceDataContext` and `WorkspaceDataProvider` entirely.
The new context hierarchy (defined in `lib/state/PLAN.md`) is:

```
AppContext          AppFS instance, studio list, create/delete/import studios
  └── StudioContext StudioFS scoped to current studio; spaces list
        └── SpaceContext SpaceFS scoped to current space
```

Files to create in `src/lib/contexts/`:

```ts
// AppContext.tsx — wraps AppFS and exposes studio list
// StudioContext.tsx — wraps StudioFS, derived from AppContext + [studioId] param
// SpaceContext.tsx — wraps SpaceFS, derived from StudioContext + [spaceId] param
```

The root `app/layout.tsx` mounts `AppContext` (and `GithubContext` for OAuth).
Each route layout mounts the appropriate scoped context:

```
app/layout.tsx              → <AppContext>
  [username]/layout.tsx     → <StudioContext username={username}>  (UserFS scope)
    [studioId]/layout.tsx   → <StudioContext studioId={studioId}>  (StudioFS scope)
      [spaceId]/layout.tsx  → <SpaceContext spaceId={spaceId}>     (SpaceFS scope)
```

### 3.2 Foundation Hooks

All foundation hooks use fine-grained FS events. No `useSyncExternalStore` on
the full snapshot — each hook subscribes to exactly the files it reads:

| Hook | Subscribes to | Returns |
|------|--------------|---------|
| `useFile(path)` | `fs.onFile(path)` | `string \| null` |
| `useFileFrontmatter(path)` | `fs.onFileUpdate(path)` | parsed frontmatter object |
| `useFileConfig<T>(path)` | `fs.onFileUpdate(path)` | `T \| null` |
| `useDir(dir)` | `fs.onDir(dir)` | `DirEntry[]` |
| `useGlob(pattern)` | `fs.onGlob(pattern)` | `string[]` |
| `useGlobRead(pattern)` | `fs.onGlob(pattern)` | `FileTree` |

Side-effect variants (no state, useful in event handlers):
`useFileWatch`, `useDirWatch`, `useGlobWatch`, `useStreamWrite`, `useStreamAppend`

### 3.3 Domain Hook Catalogue

FS-level hook names keep the file path naming (`agent`, `flow`) per the `P`
path builder spec. UI components consume these or the higher-level composite
hooks below.

**Agent hooks** (map to `agents/` FS paths):

| Hook | FS path watched |
|------|----------------|
| `useAgentInstruct(id)` | `agents/{id}/instruct.md` |
| `useAgentConfig(id)` | `agents/{id}/config.json` |
| `useAgentValues(id)` | `agents/{id}/values.json` |
| `useAgentConversations(id)` | `agents/{id}/conversations/` dir |
| `useAgentConversation(id, cid)` | `agents/{id}/conversations/{cid}.json` |
| `useAgentList()` | glob `agents/*/instruct.md` |

**Flow hooks** (map to `flows/` FS paths):

| Hook | FS path watched |
|------|----------------|
| `useFlowIndex(id)` | `flows/{id}/index.md` |
| `useFlowTask(id, order, name)` | `flows/{id}/{order}.{name}.md` |
| `useFlowTaskList(id)` | glob `flows/{id}/[0-9]*.*.md` |
| `useFlowList()` | glob `flows/*/index.md` |

**Knowledge hooks:**

| Hook | FS path watched |
|------|----------------|
| `useKnowledgeConfig(dir)` | `knowledge/{dir}/config.json` |
| `useKnowledgeFile(file)` | `knowledge/{file}.md` |
| `useKnowledgeDir(dir)` | `knowledge/{dir}/` dir |
| `useDomainDirectory()` | glob `knowledge/*/config.json` |

**Space hooks:**

| Hook | FS path watched |
|------|----------------|
| `usePackageJson()` | `package.json` |
| `useStudioEnv(name?)` | `.env` / `.env.{name}` at studio root |
| `useStudioEnvList()` | glob `.env*` on StudioFS |

**Composite hooks** (used directly by components):

| Hook | Composes | UI name maps to |
|------|----------|-----------------|
| `useAssistant(id)` | `useAgentInstruct` + `useAgentConfig` + `useAgentValues` | assistant builder/editor |
| `useAssistantList()` | `useAgentList()` | assistant list |
| `useWorkflow(id)` | `useFlowIndex` + `useFlowTaskList` | workflow editor |
| `useWorkflowList()` | `useFlowList()` | workflow list |
| `useKnowledgeField(dir)` | `useKnowledgeConfig` + `useKnowledgeDir` | field detail |
| `useKnowledgeFields()` | `useDomainDirectory()` | field tree |
| `useTopicDetail(file)` | `useKnowledgeFile(file)` | topic editor |
| `useSpace()` | `usePackageJson` + `useAssistantList` + `useWorkflowList` + `useKnowledgeFields` | space overview |

> Composite hooks are thin wrappers that give components domain-semantic names
> (`useAssistant`) without duplicating FS logic.

### 3.4 Removing Old State Machinery

| Old file | Action |
|----------|--------|
| `src/lib/workspaceDataContext.tsx` | Delete — replaced by `AppContext` / `SpaceContext` |
| `src/lib/workspaceContext.tsx` | Delete — legacy, unused |
| `src/hooks/useWorkspaceData.ts` | Delete — replaced by `useSpaceFS` + foundation hooks |
| `src/hooks/useAgents.ts` | Replace body with `useAssistantList()` composite |
| `src/hooks/useFlows.ts` | Replace body with `useWorkflowList()` composite |
| `src/hooks/useKnowledge.ts` | Replace body with `useKnowledgeFields()` composite |
| `src/hooks/useWorkspaceMutation.ts` | Delete — writes go through `SpaceFS.writeFile` directly |
| `src/hooks/useWorkspaces.ts` | Replace body with `useStudio().spaces` from `StudioContext` |
| `src/lib/workspaces.ts` | Delete — workspace utilities superseded by `StudioContext` |
| TanStack React Query (for space data) | Remove — `useSyncExternalStore` + FS events replace it |

> TanStack Query may remain for non-FS data (e.g. GitHub API calls for stars,
> deployment status). Remove only the workspace/space data usage.

---

## Phase 4: Domain Type Renames

**Goal:** Rename all TypeScript types to reflect the new entity names. Keep JSON
key names on disk compatible (FS paths stay `agents/`, `flows/`).

### `src/types/space-data.ts` (was `workspace-data.ts`)

| Old Type | New Type |
|----------|----------|
| `WorkspaceData` | `SpaceData` |
| `WorkspaceListItem` | `SpaceListItem` |
| `Agent` | `Assistant` |
| `AgentListItem` | `AssistantListItem` |
| `AgentFrontmatter` | `AssistantFrontmatter` |
| `AgentConfig` | `AssistantConfig` |
| `Flow` | `Workflow` |
| `FlowListItem` | `WorkflowListItem` |
| `FlowFrontmatter` | `WorkflowFrontmatter` |
| `FlowTask` | `WorkflowStep` |
| `KnowledgeDomain` | `KnowledgeField` |
| `KnowledgeDomainItem` | `KnowledgeFieldItem` |
| `RuntimeAgent` | `RuntimeAssistant` |
| `SlashAction` | `SlashAction` (unchanged) |

Adopt the canonical types from `lib/state/PLAN.md` for the hierarchy:

```ts
// src/types/space-data.ts
export type { StudioConfig, SpaceConfig, AppData, FileTree, StudioData } from 'lib/state'
```

---

## Phase 5: Feature Components Migration

**Goal:** Move all sections and shell components into
`src/components/{feature}/{subfeature}/{component}/index.tsx`.
Components read state exclusively through the composite hooks from Phase 3.

### Migration Map

#### Auth
| Old | New |
|-----|-----|
| `components/GithubLoginButton.tsx` | `components/auth/github-login/index.tsx` |
| `components/GithubDeploymentStatus.tsx` | `components/auth/github-deployment-status/index.tsx` |
| `components/GithubStars.tsx` | `components/auth/github-stars/index.tsx` |

#### Space (was Workspace)
| Old | New | Hook used |
|-----|-----|-----------|
| `sections/workspaces/Workspaces.tsx` | `components/space/space-list/index.tsx` | `useStudio().spaces` |
| `sections/workspaces/components/WorkspaceList.tsx` | merged into above | |
| `sections/workspaces/components/UserDetailPanel.tsx` | `components/space/user-detail-panel/index.tsx` | `useApp()` |
| `shell/WorkspacesLayout.tsx` | `components/shell/spaces-layout/index.tsx` | |
| `shell/components/WorkspaceSelector.tsx` | `components/space/space-selector/index.tsx` | `useStudio()` |

#### Assistant (was Agent)
| Old | New | Hook used |
|-----|-----|-----------|
| `sections/agent-builder/AgentBuilderView.tsx` | `components/assistant/builder/assistant-builder/index.tsx` | `useAssistant(id)` |
| `sections/agent-builder/components/AgentFormBuilder.tsx` | `components/assistant/builder/assistant-form/index.tsx` | `useAssistant(id)` |
| `sections/agent-builder/components/DomainSelector.tsx` | `components/assistant/builder/field-selector/index.tsx` | `useKnowledgeFields()` |
| `sections/agent-builder/components/ToolsPanel.tsx` | `components/assistant/builder/tools-panel/index.tsx` | — |
| `sections/agent-builder/components/ActionsPanel.tsx` | `components/assistant/builder/actions-panel/index.tsx` | `useWorkflowList()` |
| `sections/agent-builder/components/PromptPreviewPanel.tsx` | `components/assistant/builder/prompt-preview/index.tsx` | — |
| `sections/agent-builder/components/SaveAgentModal.tsx` | `components/assistant/builder/save-assistant-modal/index.tsx` | `SpaceFS.writeFile` |
| `sections/agent-builder/components/SavedAgentsList.tsx` | `components/assistant/builder/saved-assistants-list/index.tsx` | `useAssistantList()` |
| `sections/agent-builder/components/SlashActionCard.tsx` | `components/assistant/builder/slash-action-card/index.tsx` | — |
| `sections/agent-runtime/components/AgentList.tsx` | `components/assistant/runtime/assistant-list/index.tsx` | `useAssistantList()` |
| `sections/agent-runtime/components/ChatPanel.tsx` | `components/assistant/runtime/chat-panel/index.tsx` | `useAgentConversation` |
| `sections/agent-runtime/components/RuntimePanel.tsx` | `components/assistant/runtime/runtime-panel/index.tsx` | `useAssistant(id)` |
| `shell/components/CreateAgentInline.tsx` | `components/assistant/builder/create-assistant-inline/index.tsx` | `SpaceFS.writeFile` |
| `shell/components/ToolCallDisplay.tsx` | `components/assistant/runtime/tool-call-display/index.tsx` | — |

#### Workflow (was Flow)
| Old | New | Hook used |
|-----|-----|-----------|
| `sections/flow-builder/FlowBuilderView.tsx` | `components/workflow/workflow-editor/index.tsx` | `useWorkflow(id)` |
| `sections/flow-builder/FlowList.tsx` | `components/workflow/workflow-list/index.tsx` | `useWorkflowList()` |
| `sections/flow-builder/components/FlowCard.tsx` | `components/workflow/workflow-card/index.tsx` | — |
| `sections/flow-builder/components/TaskCard.tsx` | `components/workflow/step/step-card/index.tsx` | `useFlowTask` |
| `sections/flow-builder/components/TaskConfigPanel.tsx` | `components/workflow/step/step-config-panel/index.tsx` | `useFlowTask` |
| `sections/flow-builder/components/JsonSchemaEditor.tsx` | `components/workflow/step/step-schema-editor/index.tsx` | — |

#### Knowledge
| Old | New | Hook used |
|-----|-----|-----------|
| `shell/components/KnowledgeTree.tsx` | `components/knowledge/field/field-tree/index.tsx` | `useKnowledgeFields()` |
| `shell/components/CreateDomainInline.tsx` | `components/knowledge/field/create-field-inline/index.tsx` | `SpaceFS.writeFile` |
| `sections/prompt-library/PromptLibraryView.tsx` | `components/knowledge/topic-detail/topic-viewer/index.tsx` | `useTopicDetail(file)` |

#### Thing (AI Assistant Panel)
| Old | New | Hook used |
|-----|-----|-----------|
| `shell/components/ThingPanel.tsx` | `components/thing/thing-panel/index.tsx` | `useStreamAppend` |

#### Shell
| Old | New |
|-----|-----|
| `shell/StudioLayout.tsx` | `components/shell/studio-layout/index.tsx` |
| `shell/components/StudioShell.tsx` | `components/shell/studio-shell/index.tsx` |
| `shell/components/StudioSidebar.tsx` | `components/shell/studio-sidebar/index.tsx` |
| `shell/components/SettingsView.tsx` | `components/shell/settings-view/index.tsx` |

---

## Phase 6: Next.js App Router Migration

**Goal:** Replace React Router + Vite with Next.js App Router. Each route
segment mounts the appropriate FS context scope. Every inner UI state (selected
assistant, active conversation, workflow step) becomes a real URL.

### Provider Setup in `app/layout.tsx`

```tsx
// app/layout.tsx  — "use client" wrapper for providers
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AppContextProvider>    {/* AppFS, studio list */}
          <GithubProvider>      {/* OAuth */}
            {children}
          </GithubProvider>
        </AppContextProvider>
      </body>
    </html>
  )
}
```

No `QueryClientProvider` needed for space data. TanStack Query can remain for
GitHub API auxiliary calls (stars, deployment status) if desired.

### Layout Nesting and Context Mounting

```
app/layout.tsx                    → AppContext
  [username]/layout.tsx           → (UserFS — no separate context needed yet)
    [studioId]/layout.tsx         → StudioContext (mounts StudioFS)
      [spaceId]/layout.tsx        → SpaceContext (mounts SpaceFS)
                                    renders <StudioShell> + <StudioSidebar>
```

Each `layout.tsx` reads its dynamic segment from `params` and initialises the
corresponding context. The `SpaceContext` wraps the space shell so all child
pages can call `useSpaceFS()`.

### Route Table

| Path | Page | Old Equivalent |
|------|------|----------------|
| `/` | `app/page.tsx` | `LandingLayout` |
| `/marketplace` | `app/marketplace/page.tsx` | `MarketplaceLayout` |
| `/[username]` | `app/[username]/page.tsx` | *(new)* studio list |
| `/[username]/[studioId]` | `app/[username]/[studioId]/page.tsx` | `WorkspacesLayout` |
| `/[username]/[studioId]/[spaceId]` | `.../page.tsx` | `/studio/:workspaceName` |
| `/…/[spaceId]/assistant` | `.../assistant/page.tsx` | assistant list |
| `/…/[spaceId]/assistant/new` | `.../new/page.tsx` | agent builder (new) |
| `/…/[spaceId]/assistant/[assistantId]` | `.../[assistantId]/page.tsx` | `/studio/:name/assistant/:agentId` |
| `/…/[assistantId]/chat` | `.../chat/page.tsx` | chat view |
| `/…/[assistantId]/chat/[conversationId]` | `.../[conversationId]/page.tsx` | conversation view |
| `/…/[assistantId]/workflow/[workflowId]` | `.../[workflowId]/page.tsx` | modal: flow editor |
| `/…/[spaceId]/workflow` | `.../workflow/page.tsx` | flow list |
| `/…/[spaceId]/workflow/[workflowId]` | `.../[workflowId]/page.tsx` | flow builder |
| `/…/[workflowId]/step/[stepId]` | `.../[stepId]/page.tsx` | step detail |
| `/…/[spaceId]/knowledge` | `.../knowledge/page.tsx` | knowledge tree |
| `/…/knowledge/[fieldId]` | `.../[fieldId]/page.tsx` | field / subject list |
| `/…/[fieldId]/[subjectId]/[topicId]` | `.../[topicId]/page.tsx` | topic editor |
| `/…/[spaceId]/settings` | `.../settings/page.tsx` | settings |
| `/…/settings/env` | `.../env/page.tsx` | env vars |
| `/…/settings/packages` | `.../packages/page.tsx` | package.json |

### Modal → Route Promotion

- `FlowBuilderModal` / `FlowEditorModal` → `/…/[assistantId]/workflow/[workflowId]`
- `ToolLibraryModal` → `/…/[spaceId]/tool-library` (or parallel route `@modal`)
- `SaveAgentModal` → inline form within the assistant page; no separate route needed

---

## Phase 7: Cleanup

1. Remove `src/shell/` — replaced by `src/components/shell/` and `src/app/` layouts.
2. Remove `src/sections/` — all components migrated to `src/components/`.
3. Remove `src/components/ui/` — replaced by `src/elements/`.
4. Remove `src/lib/router.tsx` — replaced by Next.js file routing.
5. Remove `src/lib/workspaceDataContext.tsx` and `src/lib/workspaceContext.tsx`.
6. Remove `src/hooks/useWorkspaceData.ts`, `useWorkspaceMutation.ts`, `useWorkspaces.ts`.
7. Remove `vite.config.ts` and `index.html`; add `next.config.ts`.
8. Update `src/demos/` JSON to use updated field names where applicable.
9. Remove TanStack Query from the provider tree (keep only if still used for GitHub auxiliary calls).

---

## Implementation Order

| Phase | Task | Verification |
|-------|------|--------------|
| 1 | Build CSS element layer | Classes render correctly in browser |
| 2 | Build element components | `index.test.tsx` unit tests pass |
| 3 | Wire FS state layer; create contexts; write composite hooks | `pnpm build` passes; hooks return data in a test page |
| 4 | Rename TypeScript types | `pnpm build` with no type errors |
| 5 | Migrate feature components | Components render using new hooks and element classes |
| 6 | Next.js migration | All routes resolve; no 404s; FS context mounts correctly per layout |
| 7 | Cleanup | `pnpm build` clean; no dead imports; no Tailwind in `.tsx` files |

---

## Guardrails

- Keep FS file paths (`agents/`, `flows/`) unchanged throughout — only TypeScript
  type names and UI component names use `assistant`/`workflow`.
- Do not rename JSON keys on disk until a data-migration script is in place.
- Each commit must keep `pnpm build` passing.
- Components must never import Tailwind utility classes — only CSS classes from
  `src/css/elements/`.
- Do not mount `SpaceContext` above the `[spaceId]` layout — hooks that call
  `useSpaceFS()` outside a space layout will throw a clear invariant error.
- Test file naming: `index.test.tsx` alongside `index.tsx` in the same folder.
- Use barrel `index.ts` files per feature folder to keep imports tidy.
