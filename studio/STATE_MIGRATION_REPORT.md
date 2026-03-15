# React State Usage Audit & Migration Plan

Every `useState`, `useRef`, `useContext`, and `createContext` in `app/src` — why it exists, and how to replace it with `@lmthing/state`.

---

## How @lmthing/state works

`@lmthing/state` is a **file-system-based state model**. All state lives in an in-memory `Map<string, string>` (AppFS), accessed through scoped views (StudioFS, SpaceFS). Changes propagate via a trie-based event bus (FSEventBus) and bridge to React through `useSyncExternalStore`.

**Key primitives:**

- `useFile(path)` — subscribe to a file's content
- `useGlob(pattern)` — subscribe to matching paths
- `useDir(path)` — subscribe to directory listing
- `useDraft(path)` / `useFileWithDraft(path)` — in-memory pending changes
- `useApp()` / `useStudio()` / `useSpaceFS()` — context access
- Domain hooks: `useAgent()`, `useAgentList()`, `useFlowList()`, `usePackageJson()`, etc.
- Parsers: frontmatter, instruct, config, task formats
- Path builder `P` with glob patterns

**What it doesn't have (yet):**

- UI state primitives (toggles, expanded/collapsed, form drafts)
- Ephemeral/transient state management
- Async operation tracking (loading/error/success)

---

## Categories of React state found

### Category A: Data state that duplicates the FS

State that holds data already in (or that should be in) the file system. **Direct replacement — use FS hooks.**

### Category B: UI/view state

Ephemeral visual state: expanded sections, open modals, selected items, sidebar collapsed. **Needs a UI state layer in @lmthing/state or a convention.**

### Category C: Form draft state

Text inputs, form fields being edited before save. **Replace with DraftStore.**

### Category D: Async operation state

Loading spinners, streaming indicators, error messages. **Needs async state pattern in @lmthing/state.**

### Category E: Refs (DOM + mutable containers)

`useRef` for DOM elements, timers, debounce. **Keep as-is — these are React plumbing, not state.**

---

## File-by-file analysis

---

### `shell/components/StudioShell.tsx` — 22 useStates, 7 useRefs

The worst offender. This is essentially a god component holding the entire studio editing session.

| State                        | Category  | Migration                                                           |
| ---------------------------- | --------- | ------------------------------------------------------------------- |
| `isSidebarCollapsed`         | B (UI)    | Store in FS as user preference: `P.studioConfig` or a UI prefs file |
| `agentViewMode`              | B (UI)    | UI state — store as view pref in FS or new UI state layer           |
| `selectedFile`               | B (UI)    | Navigation state — could be a FS file like `.ui/selected-file`      |
| `expandedFolders`            | B (UI)    | UI state — FS file `.ui/expanded-folders.json`                      |
| `unsavedChanges`             | A (Data)  | **Already tracked by DraftStore** — use `useUnsavedPaths()`         |
| `selectedDomainIds`          | A (Data)  | Part of agent config — write to `agentValues` or `agentConfig`      |
| `formValues`                 | C (Form)  | Use DraftStore: `drafts.set('agent/<id>/values', serialized)`       |
| `mainInstruction`            | C (Form)  | Use `useFileWithDraft(P.instruct(agentId))`                         |
| `enabledTools`               | A (Data)  | Part of agent config — write to `agentConfig`                       |
| `runtimeFields`              | A (Data)  | Derived — compute from formValues + agent schema                    |
| `toolLibraryOpen`            | B (UI)    | UI state layer                                                      |
| `flowBuilderOpen`            | B (UI)    | UI state layer                                                      |
| `attachedFlows`              | A (Data)  | Store in agent config or a dedicated file                           |
| `runtimeChatLoading`         | D (Async) | Async state pattern                                                 |
| `isExportingWorkspace`       | D (Async) | Async state pattern                                                 |
| `isExportingGithubRepo`      | D (Async) | Async state pattern                                                 |
| `thingStatus`                | D (Async) | Async state pattern                                                 |
| `githubExportProgress`       | D (Async) | Async state pattern                                                 |
| `hydratedAgentIdRef`         | E (Ref)   | Keep as-is                                                          |
| `lastAutoSavedSnapshotRef`   | E (Ref)   | Keep as-is                                                          |
| `contentEditDebounceRef`     | E (Ref)   | Keep as-is                                                          |
| `frontmatterEditDebounceRef` | E (Ref)   | Keep as-is                                                          |
| `pendingContentEditRef`      | E (Ref)   | Keep as-is                                                          |
| `pendingFrontmatterEditRef`  | E (Ref)   | Keep as-is                                                          |
| `runtimeResponseTimeoutRef`  | E (Ref)   | Keep as-is                                                          |

**Recommendation:** Break this component apart. Agent editing state → FS hooks. UI prefs → FS or new UI layer. Async ops → async state pattern.

---

### `components/assistant/builder/assistant-builder/index.tsx` — 12 useStates, 1 useRef

| State                 | Category  | Migration                                           |
| --------------------- | --------- | --------------------------------------------------- |
| `rightTab`            | B (UI)    | UI state layer                                      |
| `isThingOpen`         | B (UI)    | UI state layer                                      |
| `isExporting`         | D (Async) | Async state pattern                                 |
| `isAttachModalOpen`   | B (UI)    | UI state layer                                      |
| `draftName`           | C (Form)  | DraftStore — `drafts.set('agent/<id>/name', value)` |
| `draftDescription`    | C (Form)  | DraftStore                                          |
| `draftInstructions`   | C (Form)  | DraftStore — or `useFileWithDraft(P.instruct(id))`  |
| `selectedFieldIds`    | A (Data)  | Part of agent config — persist to FS                |
| `selectedWorkflowIds` | A (Data)  | Part of agent config — persist to FS                |
| `formValues`          | C (Form)  | DraftStore                                          |
| `askAtRuntimeIds`     | A (Data)  | Part of agent config — persist to FS                |
| `lastSyncKey`         | E (Ref)   | Keep as-is                                          |

---

### `routes/$username/$studioId/$storageId/$spaceId/knowledge/$fieldId/index.tsx` — 12 useStates, 2 useRefs

| State                  | Category  | Migration                                                       |
| ---------------------- | --------- | --------------------------------------------------------------- |
| `selectedFilePath`     | B (UI)    | UI state — could be URL param or FS `.ui/` file                 |
| `selectedNodeType`     | B (UI)    | Derived from selectedFilePath — just check FS                   |
| `searchQuery`          | C (Form)  | Ephemeral — UI state layer (or keep useState, it's truly local) |
| `isNewFileModalOpen`   | B (UI)    | UI state layer                                                  |
| `isNewFolderModalOpen` | B (UI)    | UI state layer                                                  |
| `isThingOpen`          | B (UI)    | UI state layer                                                  |
| `isExporting`          | D (Async) | Async state pattern                                             |
| `hasUnsavedChanges`    | A (Data)  | **Use DraftStore** — `useHasDraft(path)`                        |
| `pendingFilePath`      | B (UI)    | UI state layer (navigation guard)                               |
| `pendingNodeType`      | B (UI)    | Derived                                                         |
| `showUnsavedModal`     | B (UI)    | UI state layer                                                  |
| `deleteTarget`         | B (UI)    | UI state layer (confirmation modal)                             |
| `renameTarget`         | B (UI)    | UI state layer (rename modal)                                   |
| `treeRef`              | E (Ref)   | Keep                                                            |
| `topicEditorRef`       | E (Ref)   | Keep                                                            |

---

### `components/workflow/step/step-config-panel/index.tsx` — 12 useStates

All form draft state for editing a workflow step.

| State                  | Category | Migration                  |
| ---------------------- | -------- | -------------------------- |
| `selectedType`         | C (Form) | DraftStore for step config |
| `stepName`             | C (Form) | DraftStore                 |
| `stepDescription`      | C (Form) | DraftStore                 |
| `outputSchema`         | C (Form) | DraftStore                 |
| `targetFieldName`      | C (Form) | DraftStore                 |
| `isPushable`           | C (Form) | DraftStore                 |
| `promptFragmentFields` | C (Form) | DraftStore                 |
| `enabledTools`         | C (Form) | DraftStore                 |
| `stepInstructions`     | C (Form) | DraftStore                 |
| `model`                | C (Form) | DraftStore                 |
| `temperature`          | C (Form) | DraftStore                 |

**Recommendation:** Use DraftStore with a single draft key per step: `drafts.set('flow/<flowId>/step/<stepId>', JSON.stringify(formState))`. Or use `useFileWithDraft(P.flowTask(flowId, stepId))` and write the entire serialized step as a draft.

---

### `components/shell/settings-view/index.tsx` — 8 useStates

| State                | Category  | Migration                                            |
| -------------------- | --------- | ---------------------------------------------------- |
| `packageJsonDraft`   | C (Form)  | `useFileWithDraft(P.packageJson)`                    |
| `packageJsonError`   | D (Async) | Async state pattern                                  |
| `packageJsonSavedAt` | D (Async) | Transient feedback — UI state layer                  |
| `selectedEnvFile`    | B (UI)    | UI state layer                                       |
| `envPassword`        | C (Form)  | Sensitive — keep local or use DraftStore transiently |
| `envContent`         | C (Form)  | `useFileWithDraft(P.studioEnv(name))`                |
| `envStatus`          | D (Async) | Async state pattern                                  |
| `envError`           | D (Async) | Async state pattern                                  |

---

### `lib/github/GithubContext.tsx` — createContext + 7 useStates

| State                     | Category  | Migration                                                                      |
| ------------------------- | --------- | ------------------------------------------------------------------------------ |
| `octokit`                 | D (Async) | External service client — not FS state. Could store token in FS, derive client |
| `user`                    | A (Data)  | Store GitHub user info as FS file: `.github/user.json`                         |
| `isLoadingAuth`           | D (Async) | Async state pattern                                                            |
| `isLoadingRepoSelections` | D (Async) | Async state pattern                                                            |
| `selectedWorkspaceRepos`  | A (Data)  | Already persisted to Gist — also store in FS                                   |
| `workspaceReposGistId`    | A (Data)  | Store in FS: `.github/gist-id`                                                 |
| `deviceCodePrompt`        | D (Async) | Transient auth flow state                                                      |

**Recommendation:** Store persistent GitHub data in FS files. Auth flow state is inherently transient — needs async state pattern.

---

### `lib/auth/AuthContext.tsx` — createContext + 4 useStates

| State             | Category  | Migration                                                                       |
| ----------------- | --------- | ------------------------------------------------------------------------------- |
| `username`        | A (Data)  | Store in FS — this IS the app identity, could be part of AppFS root             |
| `isAuthenticated` | A (Data)  | Derived from username presence                                                  |
| `isLoading`       | D (Async) | Async state pattern                                                             |
| `encryptionKey`   | Special   | Crypto key — must stay in memory, never persist. Keep as ref or in-memory store |

**Recommendation:** Auth is a special case. Username/auth status can move to FS. Encryption key must stay in memory. Consider a dedicated slot in AppFS or a parallel in-memory-only store.

---

### `components/auth/login-screen/index.tsx` — 5 useStates

| State            | Category  | Migration                                    |
| ---------------- | --------- | -------------------------------------------- |
| `username`       | C (Form)  | DraftStore or keep local — it's a login form |
| `password`       | C (Form)  | **Never persist** — keep local               |
| `error`          | D (Async) | Async state pattern                          |
| `loading`        | D (Async) | Async state pattern                          |
| `isExistingUser` | D (Async) | Async state pattern                          |

**Recommendation:** Login form is an edge case. Password must never enter any store. This is one of the few places where local useState is arguably correct for security. Could use DraftStore for username only.

---

### `shell/PresentationLayout.tsx` — 1 useState

| State          | Category | Migration                  |
| -------------- | -------- | -------------------------- |
| `currentSlide` | B (UI)   | URL hash or UI state layer |

---

### `shell/MarketplaceLayout.tsx` — 4 useStates

| State               | Category  | Migration                                      |
| ------------------- | --------- | ---------------------------------------------- |
| `demoSpaces`        | D (Async) | Fetched from server — async data state         |
| `installedSpaces`   | A (Data)  | Derived from FS — `useGlob(P.globs.allSpaces)` |
| `installingSpace`   | D (Async) | Async operation tracking                       |
| `studioPickerSpace` | B (UI)    | UI state layer                                 |

---

### `shell/LandingLayout.tsx` — 3 useStates

| State              | Category  | Migration                          |
| ------------------ | --------- | ---------------------------------- |
| `isSpaceModalOpen` | B (UI)    | UI state layer                     |
| `searchQuery`      | C (Form)  | Ephemeral — UI state or keep local |
| `demoSpaces`       | D (Async) | Fetched data — async state pattern |

---

### `components/shell/studio-shell/index.tsx` — 1 useState

| State              | Category | Migration                      |
| ------------------ | -------- | ------------------------------ |
| `sidebarCollapsed` | B (UI)   | FS user pref or UI state layer |

---

### `components/shell/studio-sidebar/index.tsx` — 3 useStates

| State                   | Category | Migration      |
| ----------------------- | -------- | -------------- |
| `fieldsExpanded`        | B (UI)   | UI state layer |
| `assistantsExpanded`    | B (UI)   | UI state layer |
| `conversationsExpanded` | B (UI)   | UI state layer |

---

### `components/shell/spaces-layout/index.tsx` — 5 useStates

| State                | Category | Migration             |
| -------------------- | -------- | --------------------- |
| `isSidebarCollapsed` | B (UI)   | UI state layer        |
| `searchQuery`        | C (Form) | Ephemeral             |
| `isCreateLocalOpen`  | B (UI)   | UI state layer        |
| `newLocalSpaceName`  | C (Form) | DraftStore            |
| `selectedSpaceId`    | B (UI)   | URL param or UI state |

---

### `components/shell/studios-layout/index.tsx` — 3 useStates

| State           | Category | Migration      |
| --------------- | -------- | -------------- |
| `isCreateOpen`  | B (UI)   | UI state layer |
| `newStudioName` | C (Form) | DraftStore     |
| `confirmDelete` | B (UI)   | UI state layer |

---

### `components/shell/studio-layout/index.tsx` — 3 useStates

| State                     | Category | Migration                                                                        |
| ------------------------- | -------- | -------------------------------------------------------------------------------- |
| `state` (StudioState)     | A (Data) | **Should be fully derived from FS** — selected agent, selected field, active tab |
| `showCreateFieldForm`     | B (UI)   | UI state layer                                                                   |
| `showCreateAssistantForm` | B (UI)   | UI state layer                                                                   |

---

### `components/assistant/runtime/chat-panel/index.tsx` — 3 useStates, 2 useRefs

| State              | Category | Migration                 |
| ------------------ | -------- | ------------------------- |
| `value`            | C (Form) | DraftStore for chat input |
| `showAutocomplete` | B (UI)   | UI state layer            |
| `selectedIndex`    | B (UI)   | UI state layer            |
| `inputRef`         | E (Ref)  | Keep                      |
| `messagesEndRef`   | E (Ref)  | Keep                      |

---

### `components/assistant/runtime/runtime-panel/index.tsx` — 1 useState

| State           | Category | Migration      |
| --------------- | -------- | -------------- |
| `toolsExpanded` | B (UI)   | UI state layer |

---

### `components/assistant/runtime/structured-output-display/index.tsx` — 1 useState

| State      | Category | Migration                              |
| ---------- | -------- | -------------------------------------- |
| `expanded` | B (UI)   | UI state layer — recursive tree expand |

---

### `components/assistant/runtime/tool-call-display/index.tsx` — 1 useState

| State  | Category | Migration      |
| ------ | -------- | -------------- |
| `open` | B (UI)   | UI state layer |

---

### `routes/$username/$studioId/$storageId/$spaceId/assistant/$assistantId/chat/index.tsx` — 4 useStates

| State           | Category  | Migration                                              |
| --------------- | --------- | ------------------------------------------------------ |
| `runtimeValues` | C (Form)  | DraftStore keyed by assistant ID                       |
| `conversation`  | A (Data)  | `useFile(P.conversation(assistantId, conversationId))` |
| `isLoading`     | D (Async) | Async state pattern                                    |
| `isStreaming`   | D (Async) | `useStreamWrite` already provides this                 |

---

### `components/thing/thing-panel/index.tsx` — 5 useStates, 1 useRef

| State            | Category  | Migration                            |
| ---------------- | --------- | ------------------------------------ |
| `input`          | C (Form)  | DraftStore                           |
| `conversations`  | A (Data)  | FS — `useGlob` on conversation files |
| `currentId`      | B (UI)    | URL param or UI state                |
| `isWorking`      | D (Async) | Async state pattern                  |
| `hasError`       | D (Async) | Async state pattern                  |
| `messagesEndRef` | E (Ref)   | Keep                                 |

---

### `components/thing/old/ThingPanel.tsx` — 15 useStates, 4 useRefs

Legacy file. Same patterns as above but worse. **Should be deleted once `thing-panel/index.tsx` fully replaces it.**

---

### `components/knowledge/topic-detail/topic-editor/index.tsx` — 4 useStates, 1 useRef

| State               | Category | Migration                                                         |
| ------------------- | -------- | ----------------------------------------------------------------- |
| `draftBody`         | C (Form) | `useFileWithDraft(path)` — this is exactly what DraftStore is for |
| `hasUnsavedChanges` | A (Data) | `useHasDraft(path)`                                               |
| `mode`              | B (UI)   | UI state layer                                                    |
| `showMetadata`      | B (UI)   | UI state layer                                                    |
| `textareaRef`       | E (Ref)  | Keep                                                              |

---

### `components/knowledge/topic-detail/topic-editor/file-metadata-panel.tsx` — 5 useStates

| State      | Category | Migration                      |
| ---------- | -------- | ------------------------------ |
| `title`    | C (Form) | DraftStore — frontmatter draft |
| `category` | C (Form) | DraftStore                     |
| `tags`     | C (Form) | DraftStore                     |
| `author`   | C (Form) | DraftStore                     |
| `isDirty`  | A (Data) | Derived from DraftStore        |

---

### `components/knowledge/topic-detail/topic-viewer/index.tsx` — 3 useStates

| State               | Category  | Migration                |
| ------------------- | --------- | ------------------------ |
| `draft`             | C (Form)  | `useFileWithDraft(path)` |
| `hasUnsavedChanges` | A (Data)  | `useHasDraft(path)`      |
| `savedAt`           | D (Async) | Transient feedback       |

---

### `components/knowledge/field/field-tree/index.tsx` — 1 useState, 1 useRef

| State         | Category | Migration      |
| ------------- | -------- | -------------- |
| `contextMenu` | B (UI)   | UI state layer |
| `treeRef`     | E (Ref)  | Keep           |

---

### `components/knowledge/field/new-folder-modal/index.tsx` — 2 useStates

| State            | Category | Migration                             |
| ---------------- | -------- | ------------------------------------- |
| `folderName`     | C (Form) | DraftStore or keep local (modal form) |
| `parentLocation` | C (Form) | DraftStore or keep local              |

---

### `components/knowledge/field/new-file-modal/index.tsx` — 2 useStates

| State      | Category | Migration                |
| ---------- | -------- | ------------------------ |
| `filename` | C (Form) | DraftStore or keep local |
| `location` | C (Form) | DraftStore or keep local |

---

### `components/knowledge/field/rename-modal/index.tsx` — 2 useStates, 1 useRef

| State      | Category  | Migration                     |
| ---------- | --------- | ----------------------------- |
| `name`     | C (Form)  | DraftStore or keep local      |
| `error`    | D (Async) | Validation error — keep local |
| `inputRef` | E (Ref)   | Keep                          |

---

### `components/knowledge/field/create-field-inline/index.tsx` — 2 useStates

| State         | Category | Migration  |
| ------------- | -------- | ---------- |
| `name`        | C (Form) | DraftStore |
| `description` | C (Form) | DraftStore |

---

### `components/knowledge/field/directory-metadata-panel/index.tsx` — 2 useStates

| State     | Category | Migration                                      |
| --------- | -------- | ---------------------------------------------- |
| `config`  | C (Form) | `useFileWithDraft(P.knowledgeConfig(fieldId))` |
| `isDirty` | A (Data) | `useHasDraft(path)`                            |

---

### `components/workflow/workflow-editor/index.tsx` — 4 useStates

| State               | Category | Migration      |
| ------------------- | -------- | -------------- |
| `isEditingMeta`     | B (UI)   | UI state layer |
| `expandedStepId`    | B (UI)   | UI state layer |
| `isConfigPanelOpen` | B (UI)   | UI state layer |
| `editingStepId`     | B (UI)   | UI state layer |

---

### `components/workflow/workflow-list/index.tsx` — 2 useStates

| State         | Category | Migration                      |
| ------------- | -------- | ------------------------------ |
| `viewMode`    | B (UI)   | FS user pref or UI state layer |
| `searchQuery` | C (Form) | Ephemeral                      |

---

### `components/workflow/save-workflow-modal/index.tsx` — 1 useState

| State  | Category | Migration                |
| ------ | -------- | ------------------------ |
| `name` | C (Form) | DraftStore or keep local |

---

### `components/workflow/step/step-schema-editor/index.tsx` — 5 useStates

| State        | Category | Migration      |
| ------------ | -------- | -------------- |
| `isExpanded` | B (UI)   | UI state layer |
| `enumInput`  | C (Form) | DraftStore     |
| `properties` | C (Form) | DraftStore     |
| `viewMode`   | B (UI)   | UI state layer |
| `codeValue`  | C (Form) | DraftStore     |

---

### `components/space/space-selector/index.tsx` — 4 useStates

| State          | Category | Migration      |
| -------------- | -------- | -------------- |
| `isOpen`       | B (UI)   | UI state layer |
| `searchQuery`  | C (Form) | Ephemeral      |
| `showCreate`   | B (UI)   | UI state layer |
| `newSpaceName` | C (Form) | DraftStore     |

---

### `components/space/space-list/index.tsx` — 3 useStates

| State        | Category | Migration                |
| ------------ | -------- | ------------------------ |
| `email`      | C (Form) | DraftStore or keep local |
| `role`       | C (Form) | DraftStore or keep local |
| `showInvite` | B (UI)   | UI state layer           |

---

### `components/space/user-detail-panel/index.tsx` — 3 useStates

| State          | Category | Migration      |
| -------------- | -------- | -------------- |
| `isEditing`    | B (UI)   | UI state layer |
| `selectedRole` | C (Form) | DraftStore     |
| `showConfirm`  | B (UI)   | UI state layer |

---

### `components/assistant/builder/prompt-preview/index.tsx` — 2 useStates

| State        | Category | Migration                                   |
| ------------ | -------- | ------------------------------------------- |
| `isExpanded` | B (UI)   | UI state layer                              |
| `copied`     | B (UI)   | Transient feedback — UI state or keep local |

---

### `components/assistant/builder/area-knowledge/index.tsx` — 2 useStates

| State      | Category | Migration                                  |
| ---------- | -------- | ------------------------------------------ |
| `expanded` | B (UI)   | UI state layer                             |
| `hovered`  | B (UI)   | Keep local — hover is inherently DOM-level |

---

### `components/assistant/builder/save-assistant-modal/index.tsx` — 2 useStates

| State         | Category | Migration  |
| ------------- | -------- | ---------- |
| `name`        | C (Form) | DraftStore |
| `description` | C (Form) | DraftStore |

---

### `components/assistant/builder/attach-workflow-modal/index.tsx` — 1 useState

| State    | Category | Migration |
| -------- | -------- | --------- |
| `search` | C (Form) | Ephemeral |

---

### `components/assistant/builder/create-assistant-inline/index.tsx` — 2 useStates

| State         | Category | Migration  |
| ------------- | -------- | ---------- |
| `name`        | C (Form) | DraftStore |
| `description` | C (Form) | DraftStore |

---

### `routes/$username/$studioId/$storageId/$spaceId/knowledge/index.tsx` — 1 useState

| State        | Category | Migration      |
| ------------ | -------- | -------------- |
| `showCreate` | B (UI)   | UI state layer |

---

### `components/auth/system-studio-bootstrap.tsx` — 1 useRef

| State             | Category | Migration             |
| ----------------- | -------- | --------------------- |
| `bootstrappedRef` | E (Ref)  | Keep — run-once guard |

---

### `components/assistant/builder/thing-panel/index.tsx` — 1 useRef

| State      | Category | Migration |
| ---------- | -------- | --------- |
| `panelRef` | E (Ref)  | Keep      |

---

## Summary by category

| Category                    | Count      | Action                                                                                       |
| --------------------------- | ---------- | -------------------------------------------------------------------------------------------- |
| **A — Data duplicating FS** | ~20 states | Replace now with existing FS hooks (`useFile`, `useGlob`, `useFileWithDraft`, `useHasDraft`) |
| **B — UI/view state**       | ~55 states | Needs new `UIState` primitive in @lmthing/state (see proposal below)                         |
| **C — Form drafts**         | ~45 states | Replace with DraftStore (`useFileWithDraft`, `useDraft`)                                     |
| **D — Async operations**    | ~25 states | Needs new async state pattern in @lmthing/state (see proposal below)                         |
| **E — Refs**                | ~20 refs   | Keep as-is — DOM refs and mutable containers are React plumbing                              |

---

## What @lmthing/state needs to fully replace useState

### 1. UI State Layer

A lightweight ephemeral state store for view-level concerns. Not persisted to FS. Scoped to component trees.

```typescript
// Proposal: UIStore — a simple Map<string, unknown> with event subscriptions
// Similar to DraftStore but for UI state, auto-cleared on unmount

// In @lmthing/state:
export function useUIState<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void];
export function useToggle(key: string, initial?: boolean): [boolean, () => void];

// Usage:
const [sidebarCollapsed, setSidebarCollapsed] = useUIState("studio.sidebar.collapsed", false);
const [isModalOpen, toggleModal] = useToggle("new-file-modal");
```

Alternatively, store UI preferences in FS files (e.g. `.ui/prefs.json`) for persistence across sessions. This is more aligned with the FS-first model.

### 2. Async State Pattern

A hook for tracking async operations:

```typescript
// Proposal:
export function useAsyncAction<T>(): {
  execute: (fn: () => Promise<T>) => Promise<T>;
  isLoading: boolean;
  error: Error | null;
  data: T | null;
  reset: () => void;
};

// Usage:
const exportAction = useAsyncAction();
// ...
await exportAction.execute(() => exportWorkspace());
// exportAction.isLoading, exportAction.error available reactively
```

### 3. Form State via DraftStore (already available)

The DraftStore already supports this pattern but it's underused:

```typescript
// Already available:
const draft = useFileWithDraft(P.instruct(agentId)); // returns draft if exists, else file
const { set, delete: clearDraft } = useDraftMutations();

// Set draft on edit:
set(P.instruct(agentId), newContent);

// Save: write to FS + clear draft
spaceFS.writeFile(P.instruct(agentId), draft);
clearDraft(P.instruct(agentId));
```

For structured form state (multiple fields), serialize as JSON in a single draft key.

---

## Migration priority

### Phase 1 — Quick wins (Category A: data state duplicating FS)

Replace ~20 states with existing hooks. No library changes needed.

**Top targets:**

- `unsavedChanges` everywhere → `useHasDraft(path)` or `useUnsavedPaths()`
- `conversations` in thing-panel → `useGlob(P.globs.allConversations)`
- `installedSpaces` in MarketplaceLayout → derive from FS
- `state` in studio-layout → derive from FS

### Phase 2 — Form drafts (Category C)

Replace ~45 states with DraftStore. No library changes needed.

**Top targets:**

- `topic-editor` and `topic-viewer` — `useFileWithDraft` is a perfect fit
- `file-metadata-panel` and `directory-metadata-panel` — frontmatter drafts
- `step-config-panel` — serialize step config as draft
- `assistant-builder` — serialize agent config as draft

### Phase 3 — Add UI state layer to @lmthing/state (Category B)

Add `useUIState` / `useToggle` or adopt FS-stored `.ui/` convention. Then migrate ~55 states.

### Phase 4 — Add async state pattern (Category D)

Add `useAsyncAction` hook. Then migrate ~25 states.

### Keep as-is

- All `useRef` (~20 instances) — DOM and timer refs stay
- `password` field in login — security requirement
- `encryptionKey` in AuthContext — must stay in memory
- `hovered` state — inherently DOM-level
