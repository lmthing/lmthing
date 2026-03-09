# REIMPLEMENTATION PLAN

> Comparison of the old implementation at commit `9fd73f7aa6acf023733b1d63094366c1831419c2` vs the current refactored codebase.
> This document maps every lost feature, the exact old source lines, and where changes must be applied in the new file tree.

---

## Table of Contents

1. [Summary of Losses](#1-summary-of-losses)
2. [Agent Builder](#2-agent-builder)
3. [Agent Runtime](#3-agent-runtime)
4. [Workflow Builder (Flow Builder)](#4-workflow-builder-flow-builder)
5. [Thing Panel](#5-thing-panel)
6. [Knowledge Explorer & Editor](#6-knowledge-explorer--editor)
7. [Shell, Layout & Navigation](#7-shell-layout--navigation)
8. [Entirely Removed Sections](#8-entirely-removed-sections)
9. [CSS & Styling Differences](#9-css--styling-differences)
10. [Hooks & State Management](#10-hooks--state-management)

---

## 1. Summary of Losses

| Area | Old Total Lines | New Total Lines | Lines Lost | % Lost |
|---|---|---|---|---|
| Agent Builder (20 files) | ~5,528 | ~2,218 | ~3,310 | 60% |
| Agent Runtime (6 files) | ~1,824 | ~880 | ~944 | 52% |
| Workflow Builder (7 files) | ~2,479 | ~2,148 | ~331 | 13% |
| Thing Panel (2 files) | ~3,327 | ~1,098 | ~2,229 | 67% |
| Knowledge Explorer | ~437 | ~398 | ~39 | 9% |
| Shell & Layouts (8 files) | ~5,794 | ~1,234 | ~4,560 | 79% |
| Prompt Library (2 files) | ~1,959 | 0 | ~1,959 | 100% |
| Tool Library (5 files) | ~1,481 | 0 | ~1,481 | 100% |
| **TOTAL** | **~22,829** | **~7,976** | **~14,853** | **65%** |

---

## 2. Agent Builder

### 2.1 OLD: `app/src/sections/agent-builder/AgentBuilderView.tsx` (628 lines)
### NEW: `app/src/components/assistant/builder/assistant-builder/index.tsx` (379 lines)

**Lost features (to restore in `assistant-builder/index.tsx`):**

| Feature | Old Lines | Description | Status in New |
|---|---|---|---|
| Domain-to-knowledge mapping | L44-140 | `useMemo` that converts `knowledgeSections` to `Domain[]` with full schema/field nodes | **MISSING** - new file uses simpler field hooks |
| Flow data integration | L80-93 | `useMemo` mapping `flowList` to `Flow[]` format with status/tags/taskCount | **MISSING** - new file has attach-workflow-modal but no flow data mapping |
| View toggle (builder/agents) | L200-201, L556-588 | Tabbed UI switching between "Agent Builder" and "Saved Agents" with count badge | **MISSING** - no tab toggle in new |
| Tool library modal orchestration | L208, L272-293, L590-599 | `toolLibraryOpen` state + open/close/add/remove/configure handlers | **MISSING** - ToolLibraryModal entirely removed |
| Flow builder modal orchestration | L209-212, L336-473, L601-625 | `flowBuilderOpen` + `flowEditorOpen` + editing flow/tasks state management | **PARTIALLY MISSING** - attach-workflow-modal exists but no inline flow editing |
| Agent CRUD operations | L296-333 | `handleNewAgent`, `handleLoadAgent`, `handleDeleteAgent`, `handleDuplicateAgent` with full state reset | **SIMPLIFIED** - new has basic save/load but no duplicate |
| Nested field value updates | L233-257 | `handleFieldValueChange` with path-based nested object updates (`fieldId.includes('/')`) | **MISSING** - new assistant-form uses flat updates |
| Runtime field enablement | L259-265 | `handleEnableFieldForRuntime`/`handleDisableFieldForRuntime` toggling individual fields for runtime input | **MISSING** |
| Conversation extraction | L478-502 | `useMemo` extracting conversations from all agents for runtime preview | **MISSING** |
| Full props plumbing | L504-543 | 30+ props object wired to `AgentFormBuilder` | **REDUCED** - new passes fewer props |

### 2.2 OLD: `app/src/sections/agent-builder/components/AgentFormBuilder.tsx` (682 lines)
### NEW: `app/src/components/assistant/builder/assistant-form/index.tsx` (147 lines)

**Lost features (to restore in `assistant-form/index.tsx`):**

| Feature | Old Lines | Description | Status in New |
|---|---|---|---|
| Schema tree rendering | L22-34, L105-155 | `extractFields()`, `getDomainFields()`, `SchemaNodeRenderer` - recursive rendering of domain schema trees with section/field discrimination | **MISSING** - no schema tree rendering |
| Nested form value resolution | L37-65 | `getFormFieldValue()` with path-based nested lookups and fallback resolution | **MISSING** |
| File path resolution | L67-100 | `resolveFieldOptionFilePaths()` - resolves selected values to file paths for knowledge content | **MISSING** |
| Domain grouping by category | L230-237 | `groupedDomains` useMemo grouping domains by `domain.category` ("General", etc.) | **MISSING** |
| Collapsible domain sections | L201, L211-222 | `expandedDomains` state with toggle per domain ID | **MISSING** |
| Runtime field entries computation | L247-261 | `runtimeFieldEntries` + `enabledFilePaths` memos computing which fields are runtime-enabled | **MISSING** |
| Tool mapping computation | L263-282 | `enabledToolMappings` memo mapping enabledTools to full tool objects with status | **MISSING** |
| Runtime toggle per field | L284-332 | `isRuntimeEnabled`, `handleToggleRuntime`, `handleEnableAllForRuntime` callbacks | **MISSING** |
| Save form inline | L199, L337-345 | `showSaveForm` toggle + `handleSaveAgent` callback | **SIMPLIFIED** |
| Runtime preview modal trigger | L200, L345-348 | `runtimePreviewOpen` state + `handleOpenRuntimePreview` | **MISSING** - AgentRuntimePreviewModal entirely removed |
| 4-column layout | L352+ | Split layout: left sidebar (domains), center (form fields), right (tools/actions tabs), bottom (prompt preview) | **SIMPLIFIED** to simpler stacked layout |

### 2.3 OLD: `app/src/sections/agent-builder/components/AgentRuntimePreviewModal.tsx` (1102 lines)
### NEW: **COMPLETELY REMOVED** — No equivalent

**Lost features (needs new file or integration into `runtime-panel/index.tsx`):**

| Feature | Old Lines | Description |
|---|---|---|
| Full embedded runtime | L1-1102 | Complete in-modal agent runtime with `runPrompt` from `lmthing`, streaming, tool execution |
| Knowledge XML building | L5-6 | `buildKnowledgeXml` integration for context injection |
| Flow execution engine | L6, L46-50 | `executeFlow` with `FlowTask[]` support for slash-action triggered workflows |
| Tool event parsing | L11-19 | `THING_TOOL_EVENT` markers for parsing tool call events from streaming |
| Runtime field form | L35-44 | `RuntimeFieldSummary` type with dynamic form fields for user input at runtime |
| Streaming message display | entire | Real-time message streaming with tool call display, error handling |
| Conversation save | L43-44 | `onSaveConversation` callback for persisting runtime conversations |

### 2.4 Other Removed Agent Builder Components

| Old File | Lines | Lost Features | New Target |
|---|---|---|---|
| `DomainCatalog.tsx` | 206 | Visual catalog of knowledge domains with icons, colors, descriptions, select/deselect UI | **REMOVED** → restore in `area-knowledge/index.tsx` or new component |
| `DomainSelector.tsx` | 73 | Domain multi-select dropdown with checkboxes | Partially in `field-selector/index.tsx` (72 lines) |
| `FlowBuilderModal.tsx` | 289 | Modal to browse/attach existing flows with search, flow cards, attach buttons | **REDUCED** → `attach-workflow-modal/index.tsx` (136 lines) missing search and flow cards |
| `FlowEditorModal.tsx` | 68 | Modal wrapper to edit flow inline from agent builder | **REMOVED** → restore in `assistant-builder/` |
| `FormField.tsx` | 275 | Dynamic form field rendering (text, textarea, select, multiselect, toggle) with runtime toggle button per field | **REMOVED** → restore as `form-field/index.tsx` or in `configuration-form/index.tsx` |
| `PromptPreviewPanel.tsx` | 92 | Side panel showing generated prompt with token count and copy button | **REMOVED** → restore in `prompt-preview/index.tsx` (currently 123 lines but missing token count and copy) |
| `SaveAgentInline.tsx` | 86 | Inline name+description save form embedded in builder | **REDUCED** → `create-assistant-inline/index.tsx` (61 lines) |
| `ToolLibraryModal.tsx` | 331 | Full tool library browser with categories, search, enable/disable toggles, configuration panels | **REMOVED** → restore as new component in `assistant/builder/` |

---

## 3. Agent Runtime

### 3.1 OLD: `app/src/sections/agent-runtime/components/ChatPanel.tsx` (483 lines)
### NEW: `app/src/components/assistant/runtime/chat-panel/index.tsx` (232 lines)

**Lost features (to restore in `chat-panel/index.tsx`):**

| Feature | Old Lines | Description | Status in New |
|---|---|---|---|
| Slash action badge | L14-42 | `SlashActionBadge` component showing `/{action}` with parameter display | **MISSING** |
| Structured output display | L45-200+ | `StructuredOutputDisplay` - recursive YAML-like beautified display of structured JSON output with color coding, expand/collapse | **MISSING** |
| Message timestamp formatting | L7-12 | `formatTime()` with locale-aware time formatting | **MISSING** |
| Typing indicator animation | ~L350+ | Animated dots indicator while assistant is generating | **MISSING** or simplified |
| Message editing | ~L250+ | Edit button on user messages to modify and re-run | **MISSING** |
| Rich message rendering | ~L200-450 | Full markdown-like rendering with code blocks, tool event parsing, structured output detection | **SIMPLIFIED** |
| Auto-scroll with smart detection | ~L400+ | Scroll-to-bottom with detection of user scroll position | **SIMPLIFIED** |

### 3.2 OLD: `app/src/sections/agent-runtime/components/RuntimePanel.tsx` (413 lines)
### NEW: `app/src/components/assistant/runtime/runtime-panel/index.tsx` (167 lines)

**Lost features (to restore in `runtime-panel/index.tsx`):**

| Feature | Old Lines | Description | Status in New |
|---|---|---|---|
| Runtime field form rendering | ~L50-150 | Dynamic form with fields from `runtimeFields[]` (text, select, multiselect, toggle) that user fills before chatting | **MISSING** |
| Agent configuration display | ~L30-50 | Panel header showing loaded agent name, description, domain count | **SIMPLIFIED** |
| Knowledge context preview | ~L150-200 | Preview of injected knowledge XML context with expand/collapse | **MISSING** |
| Streaming with tool events | ~L200-350 | Full `runPrompt` integration with tool call event parsing and display | **SIMPLIFIED** |
| Conversation history | ~L350-413 | Conversation list with load/delete, conversation title editing | **MISSING** |

### 3.3 OLD: `app/src/sections/agent-runtime/components/AgentRuntime.tsx` (416 lines) — **REMOVED**
### OLD: `app/src/sections/agent-runtime/components/AgentRuntimeView.tsx` (166 lines) — **REMOVED**

These were orchestrator components connecting the runtime to workspace data. The agent-to-runtime data mapping, model resolution, and env checking are now **missing** from `runtime-panel`.

---

## 4. Workflow Builder (Flow Builder)

### 4.1 OLD: `app/src/sections/flow-builder/components/JsonSchemaEditor.tsx` (807 lines)
### NEW: `app/src/components/workflow/step/step-schema-editor/index.tsx` (666 lines)

**Lost features (to restore in `step-schema-editor/index.tsx`):**

| Feature | Old Lines | Description | Status in New |
|---|---|---|---|
| Advanced type support | ~L100-300 | Full JSON Schema types: object, array, oneOf, anyOf with nested editing | **REDUCED** |
| Drag-and-drop reorder | ~L300-400 | Property reordering via drag handles | **MISSING** |
| Schema validation | ~L400-500 | Real-time validation of schema structure with error display | **REDUCED** |
| Import/export schema | ~L500-600 | Copy/paste schema as JSON, import from file | **MISSING** |
| Preview panel | ~L600-700 | Live preview of the form that the schema would generate | **MISSING** |

### 4.2 OLD: `app/src/sections/flow-builder/components/TaskConfigPanel.tsx` (460 lines)
### NEW: `app/src/components/workflow/step/step-config-panel/index.tsx` (391 lines)

**Lost features (to restore in `step-config-panel/index.tsx`):**

| Feature | Old Lines | Description | Status in New |
|---|---|---|---|
| Task type switching | ~L50-100 | Dropdown to switch between task types (prompt, tool-call, condition, etc.) | **REDUCED** |
| Prompt template editor | ~L100-200 | Rich textarea with variable insertion for prompt templates | **SIMPLIFIED** |
| Input/output mapping | ~L200-300 | Visual mapping of task inputs from previous task outputs | **MISSING** |
| Condition builder | ~L300-400 | Visual condition expression builder for conditional tasks | **MISSING** |

### 4.3 OLD: `app/src/sections/flow-builder/components/FlowDetailEditor.tsx` (322 lines)
### NEW: `app/src/components/workflow/workflow-editor/index.tsx` (295 lines)

**Lost features (to restore in `workflow-editor/index.tsx`):**

| Feature | Old Lines | Description | Status in New |
|---|---|---|---|
| Flow metadata editing | ~L30-80 | Edit flow name, description, tags, status | **REDUCED** |
| Task visual timeline | ~L80-200 | Vertical timeline showing task sequence with connecting lines | **SIMPLIFIED** |
| Add task between steps | ~L200-250 | Insert task at specific position in flow | **MISSING** |
| Task reordering | ~L250-322 | Drag-and-drop reordering of tasks | **MISSING** |

---

## 5. Thing Panel

### 5.1 OLD: `app/src/shell/components/ThingPanel.tsx` (2682 lines)
### NEW: `app/src/components/thing/thing-panel/index.tsx` (739 lines)

**This is the single largest regression — 1,943 lines lost (72%).**

**Lost features (to restore in `thing-panel/index.tsx`):**

| Feature | Old Lines | Description | Status in New |
|---|---|---|---|
| **30 workspace actions** | L36-67 | `viewWorkspaceData`, `listWorkspaceRoots`, `listChildren`, `searchWorkspace`, `getEntity`, `resolveReference`, `findBacklinks`, `getBreadcrumbs`, `recentlyTouched`, `snapshotWorkspace`, `diffSnapshots`, `suggestNextNavigation`, `createWorkspace`, `setCurrentWorkspace`, `reload`, `updatePackageJson`, `upsertAgent`, `deleteAgent`, `upsertFlow`, `deleteFlow`, `upsertEnvFile`, `deleteEnvFile`, `updateKnowledgeFileContent`, `updateKnowledgeFileFrontmatter`, `updateKnowledgeDirectoryConfig`, `addKnowledgeNode`, `updateKnowledgeNodePath`, `deleteKnowledgeNode`, `duplicateKnowledgeNode` | **REDUCED to 7 basic actions**: `listStudios`, `createStudio`, `deleteStudio`, `listFiles`, `readFile`, `writeFile`, `deleteFile` |
| Workspace path resolution | L122-148 | `parseWorkspacePath()`, `getValueAtWorkspacePath()` for navigating nested workspace data | **MISSING** |
| Workspace value summarization | L151-203 | `summarizeWorkspaceValue()` — intelligent truncation of large data structures for display | **MISSING** |
| Knowledge node utilities | L99-100, L209-296 | `countKnowledgeNodes()`, `normalizeKnowledgePath()`, `flattenKnowledgeNodes()`, `findKnowledgeEntryByPath()` | **MISSING** |
| Pagination engine | L243-260 | `paginateItems()` — cursor-based pagination for large result sets | **MISSING** |
| Search functionality | L262-286 | `stringifyForSearch()`, `toSearchSnippet()` — full-text search across workspace data | **MISSING** |
| Entity reference resolution | L288-305 | `parseEntityReference()` — parse `agent:my-agent`, `flow:my-flow` style references | **MISSING** |
| Snapshot diff engine | L308-392 | `cloneSnapshot()`, `buildSnapshotDiff()` — create/compare workspace state snapshots | **MISSING** |
| Env configuration check | L394-423 | `checkHasEnvConfigured()` — detailed env file checking with multiple fallbacks | **SIMPLIFIED** to `checkHasEnv()` (shorter) |
| Model resolution | L425-442 | `resolveThingModelId()` — resolve model from env vars with provider:model format | **SIMPLIFIED** |
| Conversation persistence | L465-493, L522, L593-640 | Full localStorage persistence of conversations with load/save/migrate | **SIMPLIFIED** |
| Conversation title editing | L526-529, L615-640 | `editingConversationId`/`editingConversationTitle` state, `startEditingConversationTitle`, `saveConversationTitle` | **MISSING** |
| Message editing & re-run | L526-527, L2274-2327 | `editingMessageId`/`editingMessageContent`, `startEditingMessage`, `saveEditedMessage` with option to re-run from edited point | **MISSING** |
| Resizable panel | L530-537, L2328-2365 | `panelWidth` state with min/max/default, `handleResizeStart`/`handleResizeMove`/`handleResizeEnd` + `cursor-col-resize` drag handle | **MISSING** — new panel is not resizable |
| Collapsible panel | L537-545, L2410-2460 | `isCollapsed` state with localStorage persistence, collapsed FAB with status indicator | **MISSING** — new has `fullPage` prop but no collapse/expand toggle |
| Status indicator animations | L2435-2450 | Multi-state animated dot: orange (no env), red (error), gradient pulsing (working), green (ready) | **MISSING** |
| Tool definition system | L643-2200 (entire) | The full `handleThingMessage` function defining every tool with Zod schemas, descriptions, and execution logic | **REPLACED** with basic tool approach (7 actions vs 30) |
| Agent CRUD tools | ~L800-1100 | `upsertAgent`, `deleteAgent` with full workspace data mutation | **MISSING** |
| Flow CRUD tools | ~L1100-1400 | `upsertFlow`, `deleteFlow` with task management | **MISSING** |
| Knowledge CRUD tools | ~L1400-1900 | `updateKnowledgeFileContent`, `updateKnowledgeFileFrontmatter`, `updateKnowledgeDirectoryConfig`, `addKnowledgeNode`, `updateKnowledgeNodePath`, `deleteKnowledgeNode`, `duplicateKnowledgeNode` | **MISSING** |
| Env file tools | ~L1900-2000 | `upsertEnvFile`, `deleteEnvFile` | **MISSING** |
| Navigation tools | ~L2000-2100 | `suggestNextNavigation` with workspace context awareness | **MISSING** |
| Snapshot tools | ~L2100-2200 | `snapshotWorkspace`, `diffSnapshots` for comparing workspace states | **MISSING** |
| Workspace tree amber/stone gradient styling | L2406-2410 | `bg-gradient-to-b from-amber-50 to-stone-100 dark:from-stone-900 dark:to-stone-950` | **MISSING** — new uses plain background |
| Header with collapse/new-chat/status | L2460-2510 | Amber-themed header with Bot icon, CozyThingText branding, collapse button, "Workspace actions" label, New chat button | **SIMPLIFIED** |
| Env not-configured warning | L2520-2560 | Orange warning banner with step-by-step instructions to configure env | **MISSING** |
| Conversation sidebar list | L2560+ | Sidebar list of conversations with rename, delete, switch | **MISSING** |

### 5.2 OLD: `app/src/shell/components/ToolCallDisplay.tsx` (645 lines)
### NEW: `app/src/components/assistant/runtime/tool-call-display/index.tsx` (359 lines)

**Lost features (to restore in `tool-call-display/index.tsx`):**

| Feature | Old Lines | Description | Status in New |
|---|---|---|---|
| Recursive value rendering | ~L50-200 | Deep recursive rendering of nested objects/arrays with type-colored syntax (boolean=violet, number=amber, string=green, null=slate) | **SIMPLIFIED** |
| Expandable sections | ~L200-300 | Collapsible tool input/output sections with animated transitions | **REDUCED** |
| Tool status indicators | ~L300-400 | Success/failure/pending status badges per tool call | **SIMPLIFIED** |
| Multiple tool call grouping | ~L400-500 | Group consecutive tool calls visually | **MISSING** |
| Copy tool output | ~L500-550 | Copy button for tool call results | **MISSING** |
| Tool call timing | ~L550-600 | Display execution duration per tool call | **MISSING** |

---

## 6. Knowledge Explorer & Editor

### 6.1 OLD: `app/src/shell/components/KnowledgeTree.tsx` (437 lines)
### NEW: `app/src/components/knowledge/field/field-tree/index.tsx` (398 lines)

**Lost features (to restore in `field-tree/index.tsx`):**

| Feature | Old Lines | Description | Status in New |
|---|---|---|---|
| react-arborist Tree integration | L2, L89-150 | Full `react-arborist` `<Tree>` component with virtualized rendering, 28px row height, indent | **CHECK** — may be preserved |
| Context menu actions | L75-100 | Right-click menu: Rename, Duplicate, Delete, New File, New Folder | **PRESERVED** (mostly) |
| Drag-and-drop move | L11 (onMove prop) | `onMove` callback for drag-and-drop file/folder reordering | **CHECK** |
| Config/frontmatter display | L63-68 | TreeNode carries `config` and `frontmatter` for display | **REDUCED** |
| Custom tree CSS | KnowledgeTree.css | Custom styles for tree nodes, hover states, selection states | **Renamed** to `FieldTree.css` — verify parity |

### 6.2 OLD: `app/src/sections/prompt-library/components/PromptLibrary.tsx` (1834 lines) — **ENTIRELY REMOVED**

**This was the full knowledge content editor. Must be rebuilt across multiple new files:**

| Feature | Old Lines | Target New File | Description |
|---|---|---|---|
| File system tree with context menu | L101-170, L1202-1300 | `field-tree/index.tsx` | Tree navigation with right-click actions | **PARTIALLY** in field-tree |
| Unsaved changes modal | L304-368 | New component needed | Warning dialog when navigating away from unsaved edits |
| Delete confirmation modal | L370-432 | New component needed | Confirmation dialog with file/folder name |
| New file modal | L434-560 | `new-file-modal/index.tsx` (119 lines) | Create file with parent selector — **EXISTS but reduced** |
| New folder modal | L562-687 | `new-folder-modal/index.tsx` (102 lines) | Create folder with parent selector — **EXISTS but reduced** |
| Rename modal | L688-774 | New component needed | Rename with validation |
| Metadata panel (file) | L776-862 | New component needed | Edit frontmatter: title, description, tags, order |
| Directory metadata panel | L863-1022 | New component needed | Edit config: label, description, icon, color, fieldType, variableName, required |
| WYSIWYG markdown editor | L1024-1200 | `topic-editor/index.tsx` (76 lines) | Full editor with preview toggle, toolbar (bold, italic, headers, links, code, lists), tab indentation, auto-save — **SEVERELY REDUCED** (76 vs ~176 lines) |
| Split pane layout | L1202+ | `topic-viewer/index.tsx` (118 lines) | Left tree + right editor split with resizable pane — **REDUCED** |
| File/folder CRUD operations | L1300-1834 | Distributed across hooks | Create, rename, move, delete, duplicate with workspace data mutations |

---

## 7. Shell, Layout & Navigation

### 7.1 OLD: `app/src/shell/components/StudioShell.tsx` (1603 lines)
### NEW: `app/src/components/shell/studio-shell/index.tsx` (114 lines) — **1,489 lines lost (93%)**

**Lost features (to restore in `studio-shell/index.tsx` or distribute to route files):**

| Feature | Old Lines | Target | Description |
|---|---|---|---|
| Full section routing | L247-280 | Route files | `activeSection` state with section component rendering (agent-builder, agent-runtime, flow-builder, prompt-library, tool-library, workspaces) |
| Agent builder state management | L262-269 | `assistant-builder/index.tsx` | `selectedDomainIds`, `formValues`, `mainInstruction`, `enabledTools`, `emptyFieldsForRuntime`, `toolLibraryOpen`, `flowBuilderOpen`, `attachedFlows` |
| Agent view mode toggle | L248 | Route files | `agentViewMode` ('edit' \| 'view') |
| Knowledge file selection | L257-259 | Route files | `selectedFile`, `expandedFolders`, `unsavedChanges` |
| Agent CRUD handlers | L300-600 | `assistant-builder/index.tsx` | Full save/load/delete/duplicate agent with workspace data mutation via `saveChanges()` |
| Flow attach/detach handlers | L600-700 | Workflow components | Flow attachment management with slash action creation |
| Knowledge file system conversion | L164-210 | Hooks | `knowledgeNodeToFileSystem()` converting workspace data to file system tree |
| Runtime field computation | L700-800 | Runtime components | Computing runtime fields from form values and domain schemas |
| Workspace export | L278-280, L800-900 | Settings or toolbar | `isExportingWorkspace`, `isExportingGithubRepo` with progress tracking |
| Loading state with progress | L1236-1245 | Route files | GitHub load progress display during workspace fetch |
| Dashboard view | L1324-1600 | Route page | Grid layouts showing agents, flows, knowledge domains with stats |

### 7.2 OLD: `app/src/shell/components/StudioSidebar.tsx` (638 lines)
### NEW: `app/src/components/shell/studio-sidebar/index.tsx` (242 lines)

**Lost features (to restore in `studio-sidebar/index.tsx`):**

| Feature | Old Lines | Description | Status in New |
|---|---|---|---|
| Collapsible domain/agent/conversation sections | L119-123 | `domainsExpanded`, `agentsExpanded`, `conversationsExpanded` toggle states | **CHECK** |
| Create local workspace inline | L122-123 | `isCreateLocalWorkspaceOpen` + `newLocalWorkspaceName` | **MISSING** |
| Domain list with icons/colors | L340+ | Rendered domain items with icon, color dot, description, select action | **REDUCED** |
| Agent list with status indicators | L404+ | Agent items with model badge, domain count, conversation count | **REDUCED** |
| Conversation list with agent grouping | L483+ | Conversations grouped by agent with timestamp, message count | **MISSING** |
| Section navigation items | entire | Full sidebar with: Workspace overview, Knowledge Domains, Agents, Conversations, Flows, Settings | **REDUCED** |

### 7.3 OLD: `app/src/shell/components/SettingsView.tsx` (1011 lines)
### NEW: `app/src/components/shell/settings-view/index.tsx` (184 lines)

**Lost features (to restore in `settings-view/index.tsx`):**

| Feature | Old Lines | Description | Status in New |
|---|---|---|---|
| Tab navigation (env / package-json) | L98-103, L469-495 | Two-tab interface switching between env and package.json editors | **MISSING** — verify |
| Package.json editor | L115-245 | Full JSON editor with draft state, validation, error display, save/reset | **MISSING** |
| NPM search | L118-121 | `npmSearchQuery`, `isNpmSearching`, `npmSearchResults`, `npmSearchError` | **MISSING** |
| Dependency management | L122-245 | Add/remove dependencies, switch sections (dependencies/devDependencies), manual input | **MISSING** |
| Env file management | L126-134 | Multi-env file support (`.env.local`, `.env.production`, etc.) with file selector | **CHECK** |
| Env encryption | L128-134 | Password-based env encryption/decryption with expiry | **CHECK** |
| Env example dialog | L134 | Dialog to view `.env.example` template | **MISSING** |
| Session-based env caching | L51-78 | `getEnvSessionCacheKey`, `readSessionEnvPlaintext`, `writeSessionEnvPlaintext`, `removeSessionEnvPlaintext` | **MISSING** |

### 7.4 OLD: `app/src/shell/components/WorkspaceSelector.tsx` (643 lines)
### NEW: `app/src/components/space/space-selector/index.tsx` (110 lines)

**Lost features (to restore in `space-selector/index.tsx`):**

| Feature | Old Lines | Description | Status in New |
|---|---|---|---|
| Demo workspace loading | ~L50-200 | Load demo workspaces from `/public/demos/` with JSON import | **MISSING** |
| GitHub repo import | ~L200-350 | Import workspace from GitHub repository URL | **MISSING** |
| Workspace creation wizard | ~L350-500 | Multi-step wizard: name, template, GitHub connection | **MISSING** |
| Workspace card grid | ~L500-643 | Visual grid of workspaces with stats (agent count, flow count, knowledge size) | **REDUCED** |

### 7.5 OLD: `app/src/shell/StudioLayout.tsx` (573 lines)
### NEW: `app/src/components/shell/studio-layout/index.tsx` (88 lines)

**Lost features (to restore in `studio-layout/index.tsx`):**

| Feature | Old Lines | Description | Status in New |
|---|---|---|---|
| Section-based routing | ~L50-200 | Route parsing and section component selection | **MOVED** to TanStack routes |
| StudioShell integration | ~L200-400 | Wrapping StudioShell with workspace data provider | **SIMPLIFIED** |
| Error boundary | ~L400-500 | Error handling with workspace load failures | **MISSING** |
| Breadcrumb generation | ~L500-573 | Dynamic breadcrumbs from route segments | **MISSING** |

### 7.6 OLD: `app/src/shell/WorkspacesLayout.tsx` (683 lines)
### NEW: `app/src/components/shell/spaces-layout/index.tsx` (202 lines)

**Lost features (to restore in `spaces-layout/index.tsx`):**

| Feature | Old Lines | Description | Status in New |
|---|---|---|---|
| Workspace list with stats | ~L100-300 | Cards showing workspace name, agent count, flow count, last modified | **REDUCED** |
| Create workspace inline | ~L300-400 | Inline form to create new workspace | **CHECK** |
| Delete workspace | ~L400-500 | Delete with confirmation dialog | **CHECK** |
| Import from demo | ~L500-600 | Import demo workspaces button | **MISSING** |
| GitHub workspace sync | ~L600-683 | Sync workspace with GitHub repository | **MISSING** |

### 7.7 OLD: `app/src/shell/LandingLayout.tsx` (811 lines)
### NEW: `app/src/components/auth/login-screen/index.tsx` (169 lines)

**Lost features:**

| Feature | Old Lines | Description | Status in New |
|---|---|---|---|
| Marketing landing page | L1-400 | Full landing page with hero, features, pricing, call-to-action | **REMOVED** |
| Demo workspace showcase | L400-600 | Interactive demo workspace previews | **REMOVED** |
| GitHub stars display | L600-700 | Live GitHub stars count | **MOVED** to separate component |
| Animated logo/branding | L700-811 | Animated logo, gradient backgrounds, marketing copy | **REMOVED** |

---

## 8. Entirely Removed Sections

### 8.1 Prompt Library (1,959 lines total — **NO EQUIVALENT**)

| Old File | Lines | Key Features |
|---|---|---|
| `PromptLibraryView.tsx` | 125 | View wrapper with workspace data integration |
| `PromptLibrary.tsx` | 1,834 | Full WYSIWYG markdown editor, file tree, context menus, metadata panels, directory config editor, new file/folder modals, rename modal, unsaved changes handling, split pane layout |

**Restoration target:** Must be rebuilt as a combination of:
- `app/src/components/knowledge/topic-detail/topic-editor/index.tsx` (expand from 76 to ~300+ lines)
- `app/src/components/knowledge/topic-detail/topic-viewer/index.tsx` (expand from 118 to ~200+ lines)
- New components for metadata panels, rename modal, unsaved changes modal

### 8.2 Tool Library (1,481 lines total — **NO EQUIVALENT**)

| Old File | Lines | Key Features |
|---|---|---|
| `ToolLibraryView.tsx` | 82 | View wrapper |
| `ToolLibrary.tsx` | 125 | Tab-based layout (Tools, Environment, Packages) |
| `ToolsView.tsx` | 419 | Tool listing with categories, enable/disable, configuration |
| `EnvironmentView.tsx` | 413 | Env file editor with encryption, multi-file support |
| `PackagesView.tsx` | 442 | NPM package browser, search, install, dependency management |

**Restoration target:** Must be rebuilt into:
- `app/src/components/shell/settings-view/index.tsx` (expand from 184 to ~800+ lines)
- Potentially new sub-components: `tools-view/`, `packages-view/`, `env-editor/`

### 8.3 Create Domain Components (263 lines total)

| Old File | Lines | Key Features |
|---|---|---|
| `CreateAgentInline.tsx` | 86 | Inline agent creation form in sidebar |
| `CreateDomainInline.tsx` | 86 | Inline domain creation form in sidebar |
| `CreateDomainModal.tsx` | 91 | Modal for domain creation with config fields |

**Restoration target:** `app/src/components/knowledge/field/create-field-inline/index.tsx` (partially exists at 81 lines)

---

## 9. CSS & Styling Differences

### 9.1 Theme & Colors

The old implementation used:
- **Violet/indigo** accent colors for agent builder (`text-violet-600`, `bg-violet-100`)
- **Amber/stone** theme for Thing panel (`bg-amber-50`, `border-stone-300`, gradient backgrounds)
- **Slate** dark mode backgrounds (`dark:bg-slate-950`, `dark:border-slate-800`)
- **Orange** for warning states (`bg-orange-50`, `text-orange-600`)
- **Green/emerald** for success states
- **Tab-style** navigation with border-bottom indicators

The new implementation:
- Uses a custom `spectrum-palette.json` and `theme-vars.css` with CSS custom properties
- Lost many of the gradient backgrounds and rich color transitions
- Thing panel lost its distinctive amber/stone identity
- Many inline Tailwind classes were simplified

### 9.2 Layout Patterns

**Old layout (StudioShell):**
```
┌─────────────────────────────────────────────┐
│ TopBar (breadcrumbs, workspace name, export) │
├──────────┬──────────────────────┬───────────┤
│ Sidebar  │  Main Content Area   │  Thing    │
│ (nav,    │  (section-specific)  │  Panel    │
│  agents, │                      │  (resize) │
│  domains)│                      │           │
└──────────┴──────────────────────┴───────────┘
```

**New layout:**
```
┌─────────────────────────────────┐
│ TopBar (simplified)             │
├──────────┬──────────────────────┤
│ Sidebar  │  Route Content       │
│ (reduced)│  (TanStack Router)   │
└──────────┴──────────────────────┘
```

Lost: Resizable Thing panel as permanent right sidebar, integrated top bar with export/workspace actions.

### 9.3 Component-Specific Styling Losses

| Component | Old Styling | New Styling | Lost |
|---|---|---|---|
| Agent Builder | 4-column layout with domain sidebar, form center, tools/actions right, preview bottom | Simpler stacked layout | Rich grid layout |
| Runtime Chat | Full message bubbles with timestamps, slash-action badges, structured output display | Basic message list | Message decoration |
| Thing Panel | Resizable sidebar with amber gradient, collapse FAB, status indicators | Fixed-width or full-page | Identity and interactivity |
| Knowledge Tree | react-arborist with custom CSS, context menus, drag-drop | Similar but check parity | Verify CSS completeness |
| Settings | Two-tab layout with full forms | Minimal | Rich form elements |

---

## 10. Hooks & State Management

### 10.1 Removed Hooks

| Old Hook/Context | Location | Purpose | New Equivalent |
|---|---|---|---|
| `useWorkspaceData` | `lib/workspaceDataContext.tsx` (982 lines) | Central workspace data provider with full CRUD mutations | **REMOVED** — replaced by individual FS hooks |
| `useWorkspaceMutation` | `hooks/useWorkspaceMutation.ts` (91 lines) | Workspace data mutation utilities | **REMOVED** |
| `useWorkspaceData` (hook) | `hooks/useWorkspaceData.ts` (75 lines) | Hook consuming workspace data context | **REMOVED** |
| `workspaceContext.tsx` | `lib/workspaceContext.tsx` (138 lines) | Context providing `useAgents`, `useFlows`, `useKnowledgeSections` | **REMOVED** — replaced by individual hooks |
| `workspaces.ts` | `lib/workspaces.ts` (73 lines) | Workspace ID/route utilities | **PARTIALLY** in `space-url.ts` |

### 10.2 New Hooks (not in old)

The new codebase added many granular FS-based hooks:
- `hooks/fs/` — `useAppFS`, `useDir`, `useDirWatch`, `useFile`, `useFileConfig`, `useFileFrontmatter`, `useFileWatch`, `useGlob`, `useGlobRead`, `useGlobWatch`, `useSpaceFS`, `useStreamAppend`, `useStreamWrite`, `useStudioFS`
- `hooks/agent/` — `useAgentConfig`, `useAgentConversation`, `useAgentConversations`, `useAgentInstruct`, `useAgentValues`
- `hooks/flow/` — `useFlowIndex`, `useFlowTask`, `useFlowTaskList`
- `hooks/knowledge/` — `useKnowledgeConfig`, `useKnowledgeDir`, `useKnowledgeFile`
- `hooks/space/` — `useEnvFile`, `useEnvFileList`, `usePackageJson`
- `hooks/studio/` — `useApp`, `useStudio`, `useStudioConfig`, `useStudioEnv`, `useStudioEnvList`

These hooks are more granular but many features from the old monolithic contexts haven't been rebuilt using them yet.

### 10.3 Migration Path for State

The old `workspaceDataContext` (982 lines) provided a single `saveChanges()` function that handled all mutations. In the new codebase, mutations must be performed through the individual FS hooks. Each component that previously called `saveChanges({ agents: ... })` now needs to use the appropriate hook directly.

**Key migration points:**
1. Agent save/load: Old `saveChanges({ agents })` → New `useAgentConfig` + `useAgentInstruct` + `useAgentValues` + write operations
2. Flow save/load: Old `saveChanges({ flows })` → New `useFlowIndex` + `useFlowTask` + write operations
3. Knowledge mutations: Old `saveChanges({ knowledge })` → New `useKnowledgeFile` + `useKnowledgeDir` + write operations
4. Env file management: Old `saveChanges({ envFiles })` → New `useEnvFile` + `useEnvFileList`
5. Package.json: Old `saveChanges({ packageJson })` → New `usePackageJson`

---

## Priority Order for Reimplementation

### P0 — Critical (core functionality broken)
1. **Thing Panel actions** — Restore 23 missing workspace actions (`thing-panel/index.tsx`)
2. **Thing Panel UI** — Restore resizable panel, collapse/expand, conversation management, message editing
3. **Agent Builder form fields** — Restore `FormField.tsx` with runtime toggle, restore schema tree rendering
4. **Knowledge editor** — Restore WYSIWYG editor with toolbar, preview, metadata panels from PromptLibrary

### P1 — High (significant features missing)
5. **Agent Runtime Preview Modal** — Restore the 1,102-line embedded runtime for testing agents
6. **Settings view** — Restore env management, package.json editor, NPM search
7. **Studio Shell dashboard** — Restore dashboard grid view with agent/flow/domain cards
8. **Chat Panel** — Restore slash-action badges, structured output display, message editing

### P2 — Medium (quality-of-life features)
9. **Tool Library Modal** — Restore browsable tool library with categories
10. **Flow Builder Modal** — Restore flow attachment from agent builder
11. **Domain Catalog** — Restore visual domain browser
12. **Sidebar** — Restore conversation list, domain icons, agent status indicators

### P3 — Low (nice-to-have)
13. **Landing page** — Restore marketing content (if needed)
14. **Workspace selector** — Restore demo import, GitHub import, creation wizard
15. **CSS theming** — Restore amber/stone Thing panel identity, gradient backgrounds
