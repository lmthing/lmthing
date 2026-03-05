# LMTHING UI Refactor Plan

## Overview

This document outlines a full architectural refactor of the LMThing frontend. The goals are:

1. Introduce a layered CSS/element/component architecture that cleanly separates styling from logic.
2. Migrate to Next.js App Router for file-based routing and inner UI state management.
3. Rename all domain entities to their new canonical names.
4. Restructure the data hierarchy from `workspaces → agents/flows/knowledge` to `username → studios → spaces → assistants/workflows/knowledge`.

---

## Entity Rename Map

| Old Name | New Name | Notes |
|----------|----------|-------|
| `workspace` | `space` | The workspace concept becomes a "space" within a studio |
| `agent` | `assistant` | Agents are now called assistants |
| `flow` | `workflow` | Flows become workflows |
| `task` | `step` | Tasks within flows become steps |
| `domain` | `field` | Knowledge domains become fields |

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

## Target Architecture

```
app/
├── src/
│   ├── css/
│   │   └── elements/
│   │       ├── nav/
│   │       │   ├── sidebar/index.css
│   │       │   ├── breadcrumb/index.css
│   │       │   ├── tab-bar/index.css
│   │       │   └── top-bar/index.css
│   │       ├── content/
│   │       │   ├── card/index.css
│   │       │   ├── panel/index.css
│   │       │   ├── list-item/index.css
│   │       │   ├── badge/index.css
│   │       │   ├── avatar/index.css
│   │       │   └── separator/index.css
│   │       ├── typography/
│   │       │   ├── heading/index.css
│   │       │   ├── label/index.css
│   │       │   ├── caption/index.css
│   │       │   └── code/index.css
│   │       ├── forms/
│   │       │   ├── input/index.css
│   │       │   ├── button/index.css
│   │       │   ├── select/index.css
│   │       │   └── textarea/index.css
│   │       └── overlays/
│   │           ├── dialog/index.css
│   │           ├── dropdown/index.css
│   │           └── sheet/index.css
│   │
│   ├── elements/
│   │   ├── nav/
│   │   │   ├── sidebar/index.tsx, index.test.tsx
│   │   │   ├── breadcrumb/index.tsx, index.test.tsx
│   │   │   ├── tab-bar/index.tsx, index.test.tsx
│   │   │   └── top-bar/index.tsx, index.test.tsx
│   │   ├── content/
│   │   │   ├── card/index.tsx, index.test.tsx
│   │   │   ├── panel/index.tsx, index.test.tsx
│   │   │   ├── list-item/index.tsx, index.test.tsx
│   │   │   ├── badge/index.tsx, index.test.tsx
│   │   │   ├── avatar/index.tsx, index.test.tsx
│   │   │   └── separator/index.tsx, index.test.tsx
│   │   ├── typography/
│   │   │   ├── heading/index.tsx, index.test.tsx
│   │   │   ├── label/index.tsx, index.test.tsx
│   │   │   ├── caption/index.tsx, index.test.tsx
│   │   │   └── code/index.tsx, index.test.tsx
│   │   ├── forms/
│   │   │   ├── input/index.tsx, index.test.tsx
│   │   │   ├── button/index.tsx, index.test.tsx
│   │   │   ├── select/index.tsx, index.test.tsx
│   │   │   └── textarea/index.tsx, index.test.tsx
│   │   ├── overlays/
│   │   │   ├── dialog/index.tsx, index.test.tsx
│   │   │   ├── dropdown/index.tsx, index.test.tsx
│   │   │   └── sheet/index.tsx, index.test.tsx
│   │   └── layouts/
│   │       ├── page/index.tsx, index.test.tsx
│   │       ├── split-pane/index.tsx, index.test.tsx
│   │       └── stack/index.tsx, index.test.tsx
│   │
│   ├── components/
│   │   ├── auth/
│   │   │   └── github-login/index.tsx, index.test.tsx
│   │   ├── studio/
│   │   │   ├── studio-list/index.tsx, index.test.tsx
│   │   │   └── studio-card/index.tsx, index.test.tsx
│   │   ├── space/
│   │   │   ├── space-list/index.tsx, index.test.tsx
│   │   │   ├── space-card/index.tsx, index.test.tsx
│   │   │   └── space-selector/index.tsx, index.test.tsx
│   │   ├── assistant/
│   │   │   ├── builder/
│   │   │   │   ├── assistant-builder/index.tsx, index.test.tsx
│   │   │   │   ├── assistant-form/index.tsx, index.test.tsx
│   │   │   │   ├── field-selector/index.tsx, index.test.tsx
│   │   │   │   ├── tools-panel/index.tsx, index.test.tsx
│   │   │   │   ├── actions-panel/index.tsx, index.test.tsx
│   │   │   │   ├── prompt-preview/index.tsx, index.test.tsx
│   │   │   │   └── save-assistant-modal/index.tsx, index.test.tsx
│   │   │   ├── runtime/
│   │   │   │   ├── assistant-list/index.tsx, index.test.tsx
│   │   │   │   ├── chat-panel/index.tsx, index.test.tsx
│   │   │   │   ├── runtime-panel/index.tsx, index.test.tsx
│   │   │   │   └── tool-call-display/index.tsx, index.test.tsx
│   │   │   └── assistant-card/index.tsx, index.test.tsx
│   │   ├── workflow/
│   │   │   ├── workflow-list/index.tsx, index.test.tsx
│   │   │   ├── workflow-card/index.tsx, index.test.tsx
│   │   │   ├── workflow-editor/index.tsx, index.test.tsx
│   │   │   ├── step/
│   │   │   │   ├── step-card/index.tsx, index.test.tsx
│   │   │   │   ├── step-config-panel/index.tsx, index.test.tsx
│   │   │   │   └── step-schema-editor/index.tsx, index.test.tsx
│   │   │   └── save-workflow-modal/index.tsx, index.test.tsx
│   │   ├── knowledge/
│   │   │   ├── field/
│   │   │   │   ├── field-tree/index.tsx, index.test.tsx
│   │   │   │   ├── field-card/index.tsx, index.test.tsx
│   │   │   │   └── create-field-inline/index.tsx, index.test.tsx
│   │   │   ├── subject/
│   │   │   │   ├── subject-list/index.tsx, index.test.tsx
│   │   │   │   └── subject-item/index.tsx, index.test.tsx
│   │   │   └── topic-detail/
│   │   │       ├── topic-editor/index.tsx, index.test.tsx
│   │   │       └── topic-viewer/index.tsx, index.test.tsx
│   │   ├── thing/
│   │   │   ├── thing-panel/index.tsx, index.test.tsx
│   │   │   └── thing-message/index.tsx, index.test.tsx
│   │   └── shell/
│   │       ├── studio-shell/index.tsx, index.test.tsx
│   │       ├── studio-sidebar/index.tsx, index.test.tsx
│   │       └── settings-view/index.tsx, index.test.tsx
│   │
│   ├── app/                              ← Next.js App Router
│   │   ├── layout.tsx                    ← Root layout (providers)
│   │   ├── page.tsx                      ← Landing page /
│   │   ├── marketplace/
│   │   │   └── page.tsx                  ← /marketplace
│   │   └── [username]/
│   │       ├── layout.tsx                ← Username layout
│   │       ├── page.tsx                  ← /[username] → studio list
│   │       └── [studioId]/
│   │           ├── layout.tsx            ← Studio layout
│   │           ├── page.tsx              ← /[username]/[studioId] → space list
│   │           └── [spaceId]/
│   │               ├── layout.tsx        ← Space layout (StudioShell + sidebar)
│   │               ├── page.tsx          ← Space overview
│   │               ├── settings/
│   │               │   ├── page.tsx      ← /settings (general)
│   │               │   ├── env/page.tsx  ← /settings/env
│   │               │   └── packages/page.tsx ← /settings/packages
│   │               ├── knowledge/
│   │               │   ├── page.tsx      ← /knowledge (field tree)
│   │               │   └── [fieldId]/
│   │               │       ├── page.tsx  ← /knowledge/[fieldId] (subject list)
│   │               │       └── [subjectId]/
│   │               │           └── [topicId]/
│   │               │               └── page.tsx ← topic-detail editor
│   │               ├── assistant/
│   │               │   ├── page.tsx      ← /assistant (assistant list)
│   │               │   ├── new/page.tsx  ← /assistant/new (builder)
│   │               │   └── [assistantId]/
│   │               │       ├── page.tsx  ← /assistant/[assistantId] (builder/editor)
│   │               │       ├── chat/
│   │               │       │   ├── page.tsx ← /assistant/[assistantId]/chat
│   │               │       │   └── [conversationId]/page.tsx ← specific conversation
│   │               │       └── workflow/
│   │               │           └── [workflowId]/page.tsx ← workflow editor (was modal)
│   │               └── workflow/
│   │                   ├── page.tsx      ← /workflow (workflow list)
│   │                   ├── new/page.tsx  ← /workflow/new
│   │                   └── [workflowId]/
│   │                       ├── page.tsx  ← /workflow/[workflowId] (editor)
│   │                       └── step/
│   │                           └── [stepId]/page.tsx ← step detail
│   │
│   ├── hooks/
│   │   ├── useSpaceData.ts          (was useWorkspaceData.ts)
│   │   ├── useAssistants.ts         (was useAgents.ts)
│   │   ├── useWorkflows.ts          (was useFlows.ts)
│   │   ├── useKnowledge.ts          (unchanged API, renamed internals)
│   │   ├── useSpaceMutation.ts      (was useWorkspaceMutation.ts)
│   │   ├── usePackageJson.ts        (unchanged)
│   │   └── useSpaces.ts             (was useWorkspaces.ts)
│   │
│   ├── lib/
│   │   ├── spaceDataContext.tsx     (was workspaceDataContext.tsx)
│   │   ├── spaceContext.tsx         (was workspaceContext.tsx)
│   │   ├── utils.ts                 (unchanged)
│   │   ├── envCrypto.ts             (unchanged)
│   │   ├── flowExecution.ts         → workflowExecution.ts
│   │   ├── buildKnowledgeXml.ts     (unchanged)
│   │   ├── spaceExport.ts           (was workspaceExport.ts)
│   │   └── github/
│   │       ├── GithubContext.tsx    (unchanged)
│   │       └── spaceLoader.ts       (was workspaceLoader.ts)
│   │
│   └── types/
│       ├── space-data.ts            (was workspace-data.ts — full rename of all types)
│       ├── product.ts               (unchanged)
│       └── section.ts               (unchanged)
```

---

## Phase 1: CSS Element Layer

**Goal:** Create `src/css/elements/` with `@apply`-based classes that encapsulate Tailwind utilities.

### Rules
- Each file exports only CSS class definitions using `@apply`.
- No Tailwind utility classes appear anywhere outside this directory.
- Classes follow BEM-like naming: `.element-name`, `.element-name--modifier`.
- One `index.css` per element, grouped by category.

### Categories & Elements to Create

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
| `heading` | `.heading-1` through `.heading-4`, `.heading--muted` |
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

.btn--primary {
  @apply bg-primary text-primary-foreground hover:bg-primary/90;
}

.btn--ghost {
  @apply hover:bg-accent hover:text-accent-foreground;
}

.btn--destructive {
  @apply bg-destructive text-white hover:bg-destructive/90;
}

.btn--sm {
  @apply h-8 px-3 text-xs;
}

.btn--lg {
  @apply h-11 px-8 text-base;
}
```

---

## Phase 2: Element Components

**Goal:** Build pure UI elements that use only the CSS classes defined in Phase 1. Zero Tailwind utilities in TSX files.

### Rules
- Each element is a stateless/lightly-stateful React component.
- Import corresponding CSS file at the top of `index.tsx`.
- Props are generic (no domain knowledge — no "assistant", "workflow", etc.).
- Every element has a corresponding `index.test.tsx` with basic render tests.

### Key Elements to Build

#### `elements/forms/button/index.tsx`
Replaces `src/components/ui/button.tsx`. Accepts `variant`, `size`, `asChild`. Uses `.btn`, `.btn--{variant}`, `.btn--{size}` classes.

#### `elements/forms/input/index.tsx`
Replaces `src/components/ui/input.tsx`. Uses `.input`, `.input--error`.

#### `elements/content/card/index.tsx`
Replaces `src/components/ui/card.tsx`. Compound component exposing `Card`, `CardHeader`, `CardBody`, `CardFooter`.

#### `elements/overlays/dialog/index.tsx`
Wraps Radix UI Dialog. Uses `.dialog`, `.dialog__content`, etc.

#### `elements/overlays/sheet/index.tsx`
Wraps Radix UI Dialog as side sheet. Used for ThingPanel.

#### `elements/nav/sidebar/index.tsx`
Encapsulates sidebar layout (collapses, item states). Used by `StudioSidebar`.

#### `elements/layouts/split-pane/index.tsx`
Two-column layout with primary/secondary panes. Used by StudioShell.

#### `elements/layouts/stack/index.tsx`
Flexbox stack helper for vertical/horizontal spacing.

---

## Phase 3: Domain Renames in Types and Hooks

**Goal:** Rename all TypeScript types, hooks, and context providers to reflect the new entity names.

### Types (`src/types/space-data.ts`)

Rename all types within `workspace-data.ts`:

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
| `SlashAction` | `SlashAction` (unchanged) |
| `RuntimeAgent` | `RuntimeAssistant` |

New types to add:

```ts
// Hierarchy
type Studio = {
  id: string;
  name: string;
  spaces: Record<string, SpaceData>;
};

type UserData = {
  username: string;
  studios: Record<string, Studio>;
};
```

### Hooks Renames

| Old Hook | New Hook | Change |
|----------|----------|--------|
| `useWorkspaceData` | `useSpaceData` | Internal refs updated |
| `useWorkspaces` | `useSpaces` | Data shape updated |
| `useAgents` | `useAssistants` | Type refs updated |
| `useFlows` | `useWorkflows` | Type refs updated |
| `useWorkspaceMutation` | `useSpaceMutation` | Internal refs updated |

### Context Renames

| Old | New |
|-----|-----|
| `WorkspaceDataContext` | `SpaceDataContext` |
| `WorkspaceDataProvider` | `SpaceDataProvider` |
| `useWorkspaceDataContext` | `useSpaceDataContext` |

---

## Phase 4: Feature Components Migration

**Goal:** Move all sections and shell components into `src/components/{feature}/{subfeature}/{component}/index.tsx`.

### Migration Map

#### Auth
| Old | New |
|-----|-----|
| `src/components/GithubLoginButton.tsx` | `src/components/auth/github-login/index.tsx` |
| `src/components/GithubDeploymentStatus.tsx` | `src/components/auth/github-deployment-status/index.tsx` |
| `src/components/GithubStars.tsx` | `src/components/auth/github-stars/index.tsx` |

#### Space (was Workspace)
| Old | New |
|-----|-----|
| `sections/workspaces/Workspaces.tsx` | `components/space/space-list/index.tsx` |
| `sections/workspaces/components/WorkspaceList.tsx` | `components/space/space-list/index.tsx` (merged) |
| `sections/workspaces/components/UserDetailPanel.tsx` | `components/space/user-detail-panel/index.tsx` |
| `shell/WorkspacesLayout.tsx` | `components/shell/spaces-layout/index.tsx` |

#### Assistant (was Agent)
| Old | New |
|-----|-----|
| `sections/agent-builder/AgentBuilderView.tsx` | `components/assistant/builder/assistant-builder/index.tsx` |
| `sections/agent-builder/components/AgentFormBuilder.tsx` | `components/assistant/builder/assistant-form/index.tsx` |
| `sections/agent-builder/components/DomainSelector.tsx` | `components/assistant/builder/field-selector/index.tsx` |
| `sections/agent-builder/components/ToolsPanel.tsx` | `components/assistant/builder/tools-panel/index.tsx` |
| `sections/agent-builder/components/ActionsPanel.tsx` | `components/assistant/builder/actions-panel/index.tsx` |
| `sections/agent-builder/components/PromptPreviewPanel.tsx` | `components/assistant/builder/prompt-preview/index.tsx` |
| `sections/agent-builder/components/SaveAgentModal.tsx` | `components/assistant/builder/save-assistant-modal/index.tsx` |
| `sections/agent-builder/components/SavedAgentsList.tsx` | `components/assistant/builder/saved-assistants-list/index.tsx` |
| `sections/agent-builder/components/SlashActionCard.tsx` | `components/assistant/builder/slash-action-card/index.tsx` |
| `sections/agent-runtime/AgentRuntime.tsx` | `components/assistant/runtime/assistant-runtime/index.tsx` |
| `sections/agent-runtime/components/AgentRuntimeView.tsx` | `components/assistant/runtime/runtime-view/index.tsx` |
| `sections/agent-runtime/components/AgentList.tsx` | `components/assistant/runtime/assistant-list/index.tsx` |
| `sections/agent-runtime/components/ChatPanel.tsx` | `components/assistant/runtime/chat-panel/index.tsx` |
| `sections/agent-runtime/components/RuntimePanel.tsx` | `components/assistant/runtime/runtime-panel/index.tsx` |
| `shell/components/CreateAgentInline.tsx` | `components/assistant/builder/create-assistant-inline/index.tsx` |
| `shell/components/ToolCallDisplay.tsx` | `components/assistant/runtime/tool-call-display/index.tsx` |

#### Workflow (was Flow)
| Old | New |
|-----|-----|
| `sections/flow-builder/FlowBuilderView.tsx` | `components/workflow/workflow-editor/index.tsx` |
| `sections/flow-builder/FlowList.tsx` | `components/workflow/workflow-list/index.tsx` |
| `sections/flow-builder/components/FlowDetailEditor.tsx` | `components/workflow/workflow-editor/index.tsx` (merged) |
| `sections/flow-builder/components/FlowCard.tsx` | `components/workflow/workflow-card/index.tsx` |
| `sections/flow-builder/components/TaskCard.tsx` | `components/workflow/step/step-card/index.tsx` |
| `sections/flow-builder/components/TaskConfigPanel.tsx` | `components/workflow/step/step-config-panel/index.tsx` |
| `sections/flow-builder/components/JsonSchemaEditor.tsx` | `components/workflow/step/step-schema-editor/index.tsx` |

#### Knowledge
| Old | New |
|-----|-----|
| `shell/components/KnowledgeTree.tsx` | `components/knowledge/field/field-tree/index.tsx` |
| `shell/components/CreateDomainInline.tsx` | `components/knowledge/field/create-field-inline/index.tsx` |
| `sections/prompt-library/PromptLibraryView.tsx` | `components/knowledge/topic-detail/topic-viewer/index.tsx` |

#### Thing (AI Assistant Panel)
| Old | New |
|-----|-----|
| `shell/components/ThingPanel.tsx` | `components/thing/thing-panel/index.tsx` |

#### Shell
| Old | New |
|-----|-----|
| `shell/StudioLayout.tsx` | `components/shell/studio-layout/index.tsx` |
| `shell/components/StudioShell.tsx` | `components/shell/studio-shell/index.tsx` |
| `shell/components/StudioSidebar.tsx` | `components/shell/studio-sidebar/index.tsx` |
| `shell/components/SettingsView.tsx` | `components/shell/settings-view/index.tsx` |
| `shell/components/WorkspaceSelector.tsx` | `components/space/space-selector/index.tsx` |

---

## Phase 5: Next.js App Router Migration

**Goal:** Replace React Router + Vite with Next.js App Router. Every inner UI state becomes a real URL segment.

### Why App Router
- File-system routing eliminates manual `router.tsx` maintenance.
- Layouts (`layout.tsx`) replace shell wrappers.
- URL-driven state allows deep linking to any assistant, conversation, workflow step, or knowledge topic.
- Server Components can later replace some data-fetching hooks.

### Migration Steps

1. **Install Next.js** and configure `next.config.ts` (replace `vite.config.ts`).
2. **Move global styles** to `app/layout.tsx` (import `src/index.css`).
3. **Providers** go into `app/layout.tsx` via a `<Providers>` client component wrapping `SpaceDataProvider`, `GithubProvider`, `QueryClientProvider`.
4. **Each route segment** maps to a page from the routing table above.
5. **Layouts** replace `StudioLayout`, `LandingLayout`, `MarketplaceLayout`.
6. **Dynamic segments** for `[username]`, `[studioId]`, `[spaceId]`, `[assistantId]`, `[workflowId]`, `[fieldId]`, `[subjectId]`, `[topicId]` replace React Router params.
7. **Modals → Routes:** The `FlowBuilderModal` and `FlowEditorModal` become dedicated route pages at `/assistant/[assistantId]/workflow/[workflowId]`. Use Next.js parallel routes (`@modal` slot) if overlay behavior is needed.

### Route Table

| Path | Page Component | Old Equivalent |
|------|----------------|----------------|
| `/` | `app/page.tsx` | `LandingLayout` |
| `/marketplace` | `app/marketplace/page.tsx` | `MarketplaceLayout` |
| `/[username]` | `app/[username]/page.tsx` | (new — studio list) |
| `/[username]/[studioId]` | `app/[username]/[studioId]/page.tsx` | `WorkspacesLayout` |
| `/[username]/[studioId]/[spaceId]` | `app/[username]/[studioId]/[spaceId]/page.tsx` | `/studio/:workspaceName` |
| `/[username]/[studioId]/[spaceId]/assistant` | `…/assistant/page.tsx` | Assistant list view |
| `/[username]/[studioId]/[spaceId]/assistant/new` | `…/assistant/new/page.tsx` | Agent builder (new) |
| `/[username]/[studioId]/[spaceId]/assistant/[assistantId]` | `…/[assistantId]/page.tsx` | `/studio/:name/assistant/:agentId` |
| `/[username]/[studioId]/[spaceId]/assistant/[assistantId]/chat` | `…/chat/page.tsx` | Chat view |
| `/[username]/[studioId]/[spaceId]/assistant/[assistantId]/chat/[conversationId]` | `…/[conversationId]/page.tsx` | `/studio/:name/assistant/:agentId/conversation/:conversationId` |
| `/[username]/[studioId]/[spaceId]/assistant/[assistantId]/workflow/[workflowId]` | `…/workflow/[workflowId]/page.tsx` | Modal: `/studio/:name/assistant/:agentId/actions/:actionId` |
| `/[username]/[studioId]/[spaceId]/workflow` | `…/workflow/page.tsx` | Flow list |
| `/[username]/[studioId]/[spaceId]/workflow/[workflowId]` | `…/[workflowId]/page.tsx` | Flow builder |
| `/[username]/[studioId]/[spaceId]/workflow/[workflowId]/step/[stepId]` | `…/[stepId]/page.tsx` | Step detail |
| `/[username]/[studioId]/[spaceId]/knowledge` | `…/knowledge/page.tsx` | Knowledge tree |
| `/[username]/[studioId]/[spaceId]/knowledge/[fieldId]` | `…/[fieldId]/page.tsx` | Field view |
| `/[username]/[studioId]/[spaceId]/knowledge/[fieldId]/[subjectId]/[topicId]` | `…/[topicId]/page.tsx` | Topic editor |
| `/[username]/[studioId]/[spaceId]/settings` | `…/settings/page.tsx` | Settings |
| `/[username]/[studioId]/[spaceId]/settings/env` | `…/env/page.tsx` | Env vars |
| `/[username]/[studioId]/[spaceId]/settings/packages` | `…/packages/page.tsx` | Package.json |

---

## Phase 6: File/Path Mapping Updates

The persistence layer path conventions in `workspaceExport.ts`, `workspaceLoader.ts`, and `readMigratedStructure.ts` must be updated to reflect new entity names.

### Updated Path Map

| Entity | Old Path | New Path |
|--------|----------|----------|
| Space config | `package.json` | `package.json` (unchanged) |
| Assistant instruct | `agents/{agentId}/instruct.md` | `assistants/{assistantId}/instruct.md` |
| Assistant config | `agents/{agentId}/config.json` | `assistants/{assistantId}/config.json` |
| Assistant values | `agents/{agentId}/values.json` | `assistants/{assistantId}/values.json` |
| Conversation | `agents/{agentId}/conversations/{id}.json` | `assistants/{assistantId}/conversations/{id}.json` |
| Workflow index | `flows/{flowId}/index.md` | `workflows/{workflowId}/index.md` |
| Step file | `flows/{flowId}/{order}.{name}.md` | `workflows/{workflowId}/{order}.{name}.md` |
| Knowledge field config | `knowledge/{path}/config.json` | `knowledge/{path}/config.json` (unchanged) |
| Knowledge topic | `knowledge/{path}.md` | `knowledge/{path}.md` (unchanged) |

---

## Phase 7: Cleanup

1. Remove `src/shell/` directory (replaced by `src/components/shell/` and `src/app/` layouts).
2. Remove `src/sections/` directory (all components moved to `src/components/`).
3. Remove `src/components/ui/` directory (replaced by `src/elements/`).
4. Remove `src/lib/router.tsx` (replaced by Next.js file routing).
5. Remove legacy `workspaceContext.tsx` (dead code).
6. Remove Vite config and replace with Next.js config.
7. Update all demo data in `src/demos/` to use new field names (`assistants`, `workflows`, `steps`).
8. Update `src/extracted_data_structure.json` shape to match renamed types.

---

## Implementation Order

Execute phases sequentially. Each phase is independently verifiable:

| Phase | Task | Verification |
|-------|------|--------------|
| 1 | Build CSS element layer | All classes render correctly in Storybook / browser |
| 2 | Build element components | Unit tests pass (`index.test.tsx`) |
| 3 | Rename types and hooks | `pnpm build` passes with no type errors |
| 4 | Migrate feature components | Components render with new element classes |
| 5 | Next.js migration | All routes resolve; no 404s |
| 6 | Update file/path mapping | Export/import round-trip works |
| 7 | Cleanup | `pnpm build` clean with no dead imports |

---

## Guardrails During Refactor

- Keep JSON shape compatible during Phase 3 — only rename TypeScript types, not JSON keys, until Phase 6 is ready.
- Use barrel exports (`index.ts`) per feature folder to avoid import churn.
- Do not merge Phase 5 (Next.js) until Phase 4 components are complete — the page files should only wire up ready components.
- Each commit should keep `pnpm build` passing.
- Test file naming: `index.test.tsx` alongside `index.tsx` in the same folder.
