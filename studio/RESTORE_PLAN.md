# Restore Plan: Assistant & Knowledge Components

Re-implement lost features from commit `9fd73f7` using the new architecture:
- Element components (no Tailwind in TSX)
- `@lib/state` hooks (FS-based state)
- TanStack File Router (file-based routing, NOT Next.js App Router)
- CSS class approach (`.btn`, `.panel`, `.card`, etc.)

---

## Reference: Entity Name Mapping

| Old (FS paths) | New (UI labels) |
|---|---|
| agent | assistant |
| flow | workflow |
| task | step |
| domain | field |
| workspace | space |

File paths stay unchanged (`agents/`, `flows/`, `knowledge/`). Only UI labels change.
JSON keys on disk stay unchanged until a data-migration script is in place.

---

## Reference: Knowledge Hierarchy (from PLAN.md)

The knowledge structure is a multi-level tree, NOT flat:

```
knowledge(dir) → field(dir) → subject(dir) → topic(dir) → detail(md)
```

Component naming follows this hierarchy:
- `FieldTree` (was `KnowledgeTree` / domain list)
- `SubjectList` (subjects within a field)
- `TopicDetail` (was file node / markdown editor)

The old `DomainCatalog` was flat — the new field selector must respect this tree
but can present a flat list of top-level fields for assistant configuration purposes.

---

## Reference: Key Hooks from @lib/state

| Hook | Returns | Used For |
|---|---|---|
| `useAssistant(id)` | `{ instruct, config, values }` | Load assistant data (composite) |
| `useAssistantList()` | `AgentListItem[]` | List all assistants (composite) |
| `useKnowledgeFields()` | `DomainMeta[]` | List top-level knowledge fields (composite) |
| `useKnowledgeField(dir)` | `{ config, entries }` | Load single field config + entries (composite) |
| `useKnowledge(dir)` | `{ config, entries }` | Load field config + entries |
| `useKnowledgeFile(file)` | `string \| null` | Read a knowledge doc |
| `useTopicDetail(file)` | wraps `useKnowledgeFile(file)` | Topic editor (composite) |
| `useWorkflowList()` | `FlowListItem[]` | List workflows (composite) |
| `useWorkFlow(id)` | `{ index, tasks }` | Load workflow + steps (composite) |
| `useAgentConversations(id)` | `ConversationMeta[]` | List conversations |
| `useAgentConversation(agentId, convId)` | `Conversation` | Load conversation |
| `useSpaceFS()` | `SpaceFS` | Direct FS write access |
| `useSpace()` | `{ packageJson, agents, flows, domains }` | Space overview (composite) |
| `useFile(path)` | `string \| null` | Read any file |
| `useDraft(path)` / `useDraftMutations()` | draft state | Unsaved changes |
| `useFileWithDraft(path)` | `string \| null` | File content with draft overlay |
| `P.instruct(id)` / `P.agentConfig(id)` | path strings | Build file paths |

---

## Reference: Route Structure (TanStack File Router)

Routes live under `app/src/routes/$username/$studioId/$storageId/$spaceId/`:

```
assistant/
  index.tsx              -> AssistantBuilder (list + create)
  $assistantId/
    index.tsx            -> AssistantBuilder (edit)
    chat/
      index.tsx          -> Chat with assistant
      $conversationId/
        index.tsx        -> Specific conversation
    workflow/$workflowId/
      index.tsx          -> Workflow editor (was FlowBuilderModal — now a ROUTE, not a modal)

knowledge/
  index.tsx              -> Knowledge field list
  $fieldId/
    index.tsx            -> Field detail (subjects)
    $subjectId/$topicId/
      index.tsx          -> TopicViewer (uses useTopicDetail)
```

### Modal → Route Promotion (from PLAN.md)

Old modals are now routes — do NOT restore them as modals:
- `FlowBuilderModal` / `FlowEditorModal` → `/assistant/$assistantId/workflow/$workflowId`
- `ToolLibraryModal` → `/settings/packages/` or dedicated route
- `SaveAgentModal` → **inline form** within the assistant page (no separate route, no modal)

---

## Reference: State Write Pattern

All writes go through `SpaceFS.writeFile()` directly — NO mutation hooks, NO TanStack Query mutations:

```typescript
const spaceFS = useSpaceFS()

// Save assistant
spaceFS.writeFile(P.instruct(id), serializeInstruct({ name, description, instructions }))
spaceFS.writeFile(P.agentConfig(id), JSON.stringify(config, null, 2))

// Delete assistant
spaceFS.deletePath(P.agent(id))

// Duplicate assistant
const files = spaceFS.globRead(P.globs.agentFiles(id))
spaceFS.batch(Object.entries(files).map(([path, content]) => ({
  op: 'write', path: path.replace(id, newId), content
})))
```

---

## Phase 1: AssistantBuilder (the main builder view)

**File:** `app/src/components/assistant/builder/assistant-builder/index.tsx`
**Current:** ~175-line stub with basic layout, no save, no load, no domain selection
**Old ref:** `sections/agent-builder/AgentBuilderView.tsx` (628 lines)

### Restore these capabilities:

1. **Save assistant to FS**
   - Use `useSpaceFS()` to get `spaceFS`
   - On save: write instruct.md (frontmatter + instructions body) and config.json
   - For new assistants: generate ID from name (slugify)
   - For existing: overwrite current files

2. **Load assistant from route param**
   - Already reads `agentId` from `useParams()` — needs proper `useEffect` sync
   - Replace the `useMemo` side-effect hack with `useEffect`

3. **Delete assistant**
   - `spaceFS.deletePath(P.agent(id))`
   - Confirm with user before deleting (use Dialog element)
   - Navigate to `/assistant/` after delete via `useNavigate()`

4. **Duplicate assistant**
   - Use `spaceFS.globRead()` + `spaceFS.batch()` to copy all agent files
   - Navigate to the new assistant

5. **Selected knowledge fields**
   - Store in agent config: `config.json → { domains: ["field1", "field2"] }`
   - Use `useKnowledgeFields()` to list available top-level fields
   - Load from `useAssistant(id).config.domains` on edit
   - Persist on save

6. **Attached workflows**
   - Store in agent config: `config.json → { flows: ["wf1", "wf2"] }`
   - Use `useWorkflowList()` to list available workflows
   - Workflow detail is now a ROUTE (`/assistant/$assistantId/workflow/$workflowId`), not a modal
   - Persist on save

7. **Navigation**
   - Assistant card click → `navigate({ to: '/assistant/$assistantId', params: { assistantId } })`
   - Workflow link → navigates to workflow route (not opens modal)
   - Use `useNavigate()` from TanStack Router

### Component composition:

```
AssistantBuilder
  ├── Tab bar (builder | saved assistants)
  ├── [builder view]
  │   ├── AssistantHeader (name, description, save/delete buttons, status)
  │   ├── AssistantForm (instructions, field selection, workflow selection)
  │   ├── PromptPreview (generated prompt from instructions + selected fields)
  │   ├── ActionsPanel (slash actions from attached workflows) [exists, functional]
  │   └── ToolsPanel (available tools) [exists, functional]
  └── [saved assistants view]
      └── SavedAssistantsList [exists but needs navigation wiring]
```

### Save serialization:

```typescript
// instruct.md format (YAML frontmatter + markdown body)
function serializeInstruct(data: { name: string, description?: string, model?: string }) {
  const frontmatter = yaml.dump({ name: data.name, description: data.description, model: data.model })
  return `---\n${frontmatter}---\n\n${data.instructions}`
}

// config.json format
{ "domains": ["field1"], "flows": ["wf1"], "enabled": true, ... }
```

---

## Phase 2: AssistantForm (the form editor)

**File:** `app/src/components/assistant/builder/assistant-form/index.tsx`
**Current:** ~95-line stub with basic inputs, no state persistence
**Old ref:** `sections/agent-builder/components/AgentFormBuilder.tsx` (682 lines)

### Restore these capabilities:

1. **Controlled form with lifted state**
   - Parent (AssistantBuilder) owns all draft state
   - AssistantForm receives props + onChange callbacks
   - No internal state for form values

2. **Knowledge field selector with detail**
   - Show each field as a toggleable card (not just a badge)
   - Use `useKnowledgeField(fieldId)` (singular composite hook) per field for metadata
   - Show field title from config, entry count, description
   - Visual distinction: selected = `badge--primary`, unselected = `badge--muted`

3. **Workflow attachment selector**
   - Show each workflow as a toggleable card
   - Use `useWorkFlow(wfId)` for metadata (name, step count)
   - Link to workflow route (not modal): navigate to `/assistant/$assistantId/workflow/$workflowId`

4. **Create inline** (was SaveAgentModal)
   - Inline form for creating new assistant (name input + create button)
   - NOT a modal — per PLAN.md: "inline form within the assistant page"
   - On create: `spaceFS.writeFile(P.instruct(newId), ...)` then navigate to new assistant

5. **Schema-based dynamic fields** — DEFERRED to Phase 7

### Props interface:

```typescript
interface AssistantFormProps {
  name: string
  description: string
  instructions: string
  selectedFieldIds: string[]
  selectedWorkflowIds: string[]
  onNameChange: (name: string) => void
  onDescriptionChange: (desc: string) => void
  onInstructionsChange: (text: string) => void
  onFieldToggle: (fieldId: string) => void
  onWorkflowToggle: (workflowId: string) => void
}
```

---

## Phase 3: PromptPreview (prompt generation display)

**File:** `app/src/components/assistant/builder/prompt-preview/index.tsx`
**Current:** ~72-line stub
**Old ref:** `sections/agent-builder/components/PromptPreview.tsx` (~200 lines)

### Restore these capabilities:

1. **Generate prompt from selected fields**
   - Read content of each selected knowledge field using `useKnowledge(fieldId)`
   - Concatenate instructions + knowledge content into a preview string
   - Display in a `<Code block>` element

2. **Token count estimation**
   - Simple estimation: `Math.ceil(text.length / 4)` tokens
   - Display in a Caption

3. **Copy to clipboard**
   - Button to copy generated prompt
   - Brief "Copied!" feedback state (useState + setTimeout)

4. **Collapsible/expandable section**
   - Default collapsed
   - Click panel header to toggle

---

## Phase 4: AssistantHeader (header bar for builder)

**File:** `app/src/components/assistant/builder/assistant-header/index.tsx` (NEW)
**Old ref:** `sections/agent-builder/components/AgentHeader.tsx` (217 lines)

### Capabilities:

1. **Display assistant name + description**
2. **Save button** — calls parent onSave
3. **Save as New button** — duplicates to new ID
4. **Delete button** — with Dialog confirmation (use Dialog element, NOT window.confirm)
5. **Status indicator** — "Ready" (has name + instructions) vs "Incomplete"
6. **Unsaved changes badge** — compare draft vs saved

### Props interface:

```typescript
interface AssistantHeaderProps {
  name: string
  description: string
  isNew: boolean
  hasUnsavedChanges: boolean
  isValid: boolean
  onSave: () => void
  onSaveAsNew: () => void
  onDelete: () => void
}
```

---

## Phase 5: FieldSelector (rich knowledge field selector)

**File:** `app/src/components/assistant/builder/field-selector/index.tsx` (exists, needs enhancement)
**Old ref:** `sections/agent-builder/components/DomainCatalog.tsx` (206 lines) + `DomainSelector.tsx`

### Restore these capabilities:

1. **List all top-level fields with metadata**
   - Use `useKnowledgeFields()` for field list
   - Use `useKnowledgeField(fieldId)` (singular) per field for config.title, entry count
   - Respect the knowledge hierarchy but show flat list of top-level fields for selection

2. **Multi-select with visual feedback**
   - Selected fields: `card--interactive` with primary accent
   - Unselected fields: muted
   - Click to toggle

3. **Entry count and description**
   - Show how many subjects/entries each field contains
   - Show description from config if available

### Props interface:

```typescript
interface FieldSelectorProps {
  fields: DomainMeta[]
  selectedIds: string[]
  onToggle: (fieldId: string) => void
}
```

---

## Phase 6: Knowledge Tree (file management)

**Old ref:** `shell/components/KnowledgeTree.tsx` (~400 lines)

React-arborist file tree with CRUD. Defer unless explicitly requested.
Current TopicViewer/TopicEditor handle viewing/editing individual files.
The knowledge hierarchy (`field → subject → topic → detail`) would need
proper tree rendering respecting all 4 levels.

---

## Phase 7: ConfigurationForm (dynamic schema forms) 

**File:** `app/src/components/assistant/builder/configuration-form/index.tsx` (NEW)
**Old ref:** `sections/agent-builder/components/ConfigurationForm.tsx` (275 lines)

### Capabilities:

1. **Render form fields from JSON schema** in `config.json`
2. **Field types:** text, textarea, select, multiselect, toggle
3. **Store values** in `values.json` via `useAgentValues()`
4. **Validation** — required fields, pattern matching

---

## Implementation Order

```
Phase 1: AssistantBuilder     — core save/load/delete, wiring, state management
Phase 2: AssistantForm        — proper controlled form with field/workflow selection
Phase 3: PromptPreview        — prompt generation + copy + tokens + collapsible
Phase 4: AssistantHeader      — header bar with actions + status
Phase 5: FieldSelector        — rich knowledge field selector with metadata
Phase 6: KnowledgeTree        — file management (deferred)
Phase 7: ConfigurationForm    — dynamic schema forms (deferred)
```

Phases 1-5 restore the core builder experience.
Phases 6-7 are enhancements that can follow later.

---

## Key Principles (from PLAN.md)

1. **No Tailwind in TSX** — use CSS classes (`.btn`, `.panel`, `.card`) and element components only
2. **State via @lib/state hooks** — `useAssistant()`, `useSpaceFS()`, `P.*` paths
3. **Write to FS directly** — `spaceFS.writeFile()`, NOT TanStack Query mutations
4. **Route params for context** — `useParams()` from TanStack Router
5. **Navigate with router** — `useNavigate()` for transitions; workflow editing is a route, not a modal
6. **Keep FS paths unchanged** — `agents/`, `flows/`, `knowledge/` — only UI labels change
7. **No JSON key renames on disk** — until a data-migration script exists
8. **Unsaved changes tracking** — `useDraftMutations()` or local state diffing
9. **Test files** — each new component gets `index.test.tsx` (basic render test minimum)
10. **Each commit must keep `pnpm build` passing**
11. **Context hierarchy** — `AppContext → StudioContext → SpaceContext` — never mount SpaceContext above space layout
12. **Composite hooks for UI** — use `useAssistant`/`useWorkflow` (new names), not raw `useAgent`/`useFlow`
