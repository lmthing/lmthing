# Flow Builder Specification

## Overview
A visual flow editor within Agent Builder that allows users to create sequential task flows. Flows have exactly two task types: `updateFlowOutput` which updates a specific key in the flow output with structured LLM output, and `executeTask` which performs operations without adding structured output to the flow state. All tasks share a mutable flow output object that accumulates data across task execution. Tasks can define output schemas with target field names, push to array fields, enable prompt fragments based on field values, enable tools, and set task instructions. Flows can be standalone or attached to agents (a single flow can be attached to multiple agents). When attached to an agent, flows are triggered by slash actions (e.g., `/summarize`, `/analyze`) that users type during conversation.

### Task Types

All tasks share a mutable flow output object that accumulates data across execution. Both task types can read from and modify the shared flow state.

#### updateFlowOutput
Updates a specific key in the flow output with structured LLM output. Use when the next task needs to consume the structured output of this task.

**Capabilities:**
- **outputSchema** — JSON schema definition for the LLM's structured output
- **targetFieldName** — The key in the flow output object where the LLM output will be stored (required)
- **isPushable** — If true, the LLM output is pushed to an array at targetFieldName instead of overwriting (use when targetFieldName contains an array)
- **promptFragmentFields** — Enable specific prompt fragments based on field values (fragments defined in Prompt Library)
- **enabledTools** — List of tool IDs from the workspace tool registry that can be used during this task
- **taskInstructions** — Natural language instructions for task execution (supports template variables)
- **model** — LLM model identifier to use (inherits from agent if not specified)
- **temperature** — Temperature setting for LLM generation 0-1 (inherits from agent if not specified)

#### executeTask
Performs operations without adding structured LLM output to the flow state. Use for side effects, tool calls, or operations that shouldn't influence downstream task data.

**Capabilities:**
- **promptFragmentFields** — Enable specific prompt fragments based on field values
- **enabledTools** — List of tool IDs from the workspace tool registry that can be used during this task
- **taskInstructions** — Natural language instructions for task execution (supports template variables)
- **model** — LLM model identifier to use (inherits from agent if not specified)
- **temperature** — Temperature setting for LLM generation 0-1 (inherits from agent if not specified)
- Note: Does not produce structured LLM output stored in flow state; any side effects are managed through tool calls

### Execution Behaviors
- **Sequential execution** — Tasks execute one at a time in order; each task must complete before the next begins
- **Shared flow state** — All tasks read from and write to a mutable flow output object that accumulates across execution
- **Data passing** — updateFlowOutput tasks store their LLM output at the specified targetFieldName in the flow state; executeTask tasks do not add LLM output but can use tools for side effects
- **Failure handling** — If a task fails, it retries with configurable backoff. If all retries are exhausted, the flow stops and shows an error to the user
- **Slash action triggering** — When a user types a slash action, the flow receives the full conversation context as input and runs synchronously with progress indication
- **Flow scope and reusability** — A single flow can be attached to multiple agents; standalone flows can be attached to agents later

## Template Variables
Available in taskInstructions and other text fields:
- `{{input}}` — Full conversation context passed to the flow when triggered by slash action
- `{{previousTask.taskId.fieldName}}` — Reference output from a specific previous task by task ID and field path
- `{{flow.output.fieldName}}` — Reference any field in the accumulated flow output state
- `{{now}}` — Current timestamp
- `{{agent.name}}` — Name of the agent the flow is attached to


## User Flows
- **Browse flows** — View a list of all flows in the current workspace with summary info
- **Create a new flow** — Start with a blank canvas and add the first task
- **Create flow for agent** — When building an agent, create a flow specifically for that agent with a slash action trigger
- **Add tasks to a flow** — Insert tasks of type updateFlowOutput or executeTask
- **Configure task details** — Define output schemas with target field names, array push behavior, enabled tools, prompt fragments, and task instructions
- **Reorder tasks** — Drag and drop tasks to change the execution sequence
- **Delete tasks** — Remove tasks from a flow with confirmation
- **Edit flow metadata** — Set flow name, description, and tags
- **Save a flow** — Persist the flow configuration
- **View data connections** — See how tasks are connected; updateFlowOutput tasks show which target fields they populate in the flow state
- **Attach flow to agent** — Select a flow and define a slash action (action ID, name, description) to trigger it. A single flow can be attached to multiple agents.
- **Configure slash action** — Set the action trigger (e.g., "summarize" → `/summarize`), display name, and description shown to users. One-to-one mapping: one flow = one slash action per agent.
- **Toggle slash actions** — Enable/disable individual slash actions on an agent
- **Detach flow from agent** — Remove a flow and its slash action from an agent (does not delete the flow, only removes the association)

## UI Requirements
- **Flow list view** — Table or card grid showing all flows with name, description, task count, last modified date, status, and scope (standalone/agent-specific)
- **Flow detail view** — Main editor with:
  - Flow metadata header (name, description, status badge, scope indicator)
  - Agent context badge when building for a specific agent
  - Linear vertical list of task cards showing execution order
  - Each task card shows: task type (updateFlowOutput/executeTask), brief description, status indicator
  - Visual distinction: updateFlowOutput tasks have blue left border, executeTask tasks have gray left border
  - Solid connector lines between all tasks indicating execution sequence
  - Task cards are expandable to reveal full configuration
  - Drag handles on task cards for reordering
  - Action buttons (edit, delete, duplicate) on each card
  - "Add task" button between tasks and at the end of the list
  - Task type selector when adding new tasks (updateFlowOutput vs executeTask)
  - Slash action configuration (when in agent context): action ID input, name, description
- **Task configuration panel** — Modal or slide-out panel for editing task details:
  - Task type selector (updateFlowOutput/executeTask)
  - Name and description fields
  - For updateFlowOutput only:
    - Output schema editor (JSON schema with validation)
    - Target field name input (required)
    - Is pushable checkbox (for array targets)
  - Prompt fragment configuration (fragment ID, enabling field values)
  - Tool picker (multi-select from available tools in workspace registry)
  - Task instructions textarea with template variable hints
  - Model selector (defaults to agent's model)
  - Temperature control (defaults to agent's temperature)
  - Validation feedback (real-time schema and reference checking)
- **Slash action card** — Compact display showing:
  - Action trigger with slash prefix (e.g., `/summarize`)
  - Action name and description
  - Associated flow name and task count
  - Enable/disable toggle
  - Edit and detach actions
- **Empty state** — Placeholder when no flows exist with CTA to create first flow
- **Validation feedback** — Show errors for invalid task configurations or schemas:
  - valid: all required fields present, schema is valid JSON, tool IDs exist in workspace registry
  - invalid: missing required fields or invalid schema
  - pending: currently being edited, not yet saved
- **Data flow indicators** — Visual distinction between task types via border colors; updateFlowOutput indicates data contribution to flow state

## Configuration
- shell: true
