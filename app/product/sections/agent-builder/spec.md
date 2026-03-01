# Agent Builder Specification

## Overview
A multi-view control panel where users configure specialized agents by selecting domains, filling out auto-generated forms, manually managing tools, and attaching flows with slash actions. Flows can be attached to agents with custom slash action triggers (e.g., `/summarize`, `/analyze`) that users can type during conversations to invoke multi-step task sequences. Agents are saved for reuse in the Agent Runtime.

## User Flows
- **Create new agent** — Write main instruction (optional markdown) → select domains → auto-generated form appears → fill values → add tools from library → attach flows with slash actions → save agent
- **Write main instruction** — Enter custom markdown instructions in the main instruction textarea → content is prepended to domain prompts in the system prompt → optional field for agent-specific guidance
- **Add tools from library** — Open tool library modal → search/browse tools → select tool → configure tool parameters → tool is added to enabled tools list
- **Attach flow to agent** — Open flow selector modal → select existing flow → configure slash action (action ID, name, description) → attach to agent
- **Configure slash action** — Set the action trigger word (e.g., "summarize" → users type `/summarize`), display name, and description shown to users in conversation
- **Manage attached flows** — View all flows attached to the agent with their slash actions → enable/disable actions → edit action configuration → detach flows
- **Save agent** — Configure agent → enter agent name and description → save → appears in saved agents list for future reuse
- **Enable fields for runtime configuration** — Click "Runtime" toggle on any field → field becomes non-editable placeholder showing "Configured at Runtime" → field will be filled later in Agent Runtime
- **Enable all domain fields for runtime** — Click "All Runtime" button in domain header (visible when domain is expanded) → all fields in that domain switch to runtime mode → individually deselect fields by clicking "Edit Now" on specific fields
- **Pre-fill fields with values** — Fill in form fields normally → values are saved with the agent configuration

## UI Requirements
- **Agent Builder View**: Domain selector sidebar, main instruction textarea (markdown-enabled), auto-generated form fields based on selected domains (fields grouped by domain in UI, each domain section shows domain name and its fields), enabled tools list, tool configuration status indicators, slash actions section, live system prompt preview
- **Multi-Domain Agents**: When multiple domains are selected, their domain prompts are concatenated with newlines between them. Field IDs are scoped per domain (each domain has its own namespace, no conflicts)
- **Slash Actions Section**: Panel showing all attached flows with their slash actions — each card displays `/action`, flow name, task count, enable/disable toggle, and actions (edit, detach)
- **Add Slash Action Button**: Opens flow selector modal to select existing flow, then configure action trigger
- **Slash Action Validation**: Action IDs must be lowercase letters, numbers, and hyphens only (regex: `^[a-z0-9-]+$`), must be unique within an agent, duplicates show validation error. No reserved actions. System matches against agent's attached actions at runtime (no global registry)
- **Field Runtime Toggle**: Every field has a "Runtime" toggle button that switches the field between "pre-fill now" mode and "configure at runtime" mode
- **All Runtime Button**: When a domain is expanded, an "All Runtime" button appears in the domain header next to the expand/collapse icon. Clicking enables runtime mode for all fields in that domain at once. Uses amber styling to match runtime theme, shows clock icon, and includes tooltip "Enable all fields in this domain for runtime configuration"
- **Runtime Field Display**: When runtime mode is active, field shows as amber-dashed placeholder with "Configured at Runtime" message, not editable in the builder
- **Normal Field Display**: When runtime mode is off, field is editable and can be pre-filled with values
- **Field Type Controls**: `select` = dropdown menu (single selection), `multiselect` = dropdown with checkbox multi-select or tag-based input with autocomplete, `textarea` = 4 rows minimum resizable by user, `toggle` = switch component (not checkbox), `text` = single-line text input
- **Tool Library Modal**: Searchable list of available tools with categories, tool selection, configuration panel for tool parameters (when tool requires configuration), add/remove toggle
- **Tool Configuration Schema**: Each tool defines its own config schema (JSON Schema), modal reads schema and generates appropriate form fields, validates config before adding, errors shown inline
- **Enabled Tools Display**: Shows all manually added tools with configuration status (installed/needs config/ready)
- **Flow Selector Modal**: List of existing flows with search/filter from Flow Builder section (prop: `availableFlows`), select a flow → configure slash action (action ID, name, description) → attach. Flow editing done in Flow Builder section, not this modal
- **Saved Agents List**: Grid/list of saved agent configurations with name, description, last modified, quick actions (edit, duplicate, delete)
- **Save Behavior**: Agents stored in backend and retrieved via props. No deploy action; deployment happens when user selects agent in Agent Runtime section
- **Agent Deletion**: Show confirmation dialog before deletion. No recovery (permanently removed). If agent deleted, existing runtime instances continue working but agent unavailable for new instances
- **Main Instruction Field**: Textarea at top of form for custom agent instructions in markdown format. Content is prepended to domain prompts in the generated system prompt. Optional field - if empty, only domain prompts are used. Minimum 4 rows, resizable by user. Supports markdown syntax with live preview in the prompt preview panel.
- **Prompt Preview**: Live-generated preview using Handlebars syntax — main instruction (if provided) appears first, followed by domain prompts with variables `{{fieldName}}`, conditionals `{{#if fieldName}}...{{/if}}`. Multi-select values joined with ", ". Empty fields render as empty string. Runtime fields show "(configured at runtime)" placeholder in preview
- **Prompt Preview Update Timing**: Regenerated on main instruction change, domain change, field value change, or slash action attachment. 500ms debounce after field changes. Show skeleton/spinner while regenerating
- **Shell Integration**: View renders inside the app shell with navigation header

## Configuration
- shell: true
