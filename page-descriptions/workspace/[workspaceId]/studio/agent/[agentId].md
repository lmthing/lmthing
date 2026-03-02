# URL Analysis: /workspace/[workspaceId]/studio/agent/[agentId] (Agent Details & Configuration)

## 1. Available Features
- **Sidebar Integration:** Consistent global navigation across Knowledge, Agents, Conversations, Workspace Switching, and Settings.
- **Knowledge Context Selection (Grounded Knowledge):** A horizontal selection bar allowing users to dynamically assign or detach entire Knowledge Areas (e.g., Classroom Management, Curriculum Standards, Subject Topics) to the agent as grounding context.
- **System Prompt Editing (Main Instructions):** A dedicated, large markdown editor labeled "Main Instructions" enabling users to shape the primary behavior and role of the AI agent.
- **Attached Knowledge Summary:** An expandable "Area Knowledge" list section detailing precisely what knowledge context is feeding into the agent based on the items selected above.
- **Slash Actions (Workflows) Integration:** A sidebar panel dedicated to "Actions" and "Tools". This lets users map complex, multi-step workflows to specific slash commands (e.g., `/generate`).
- **Real-time Interaction (Chat Sandbox):** A persistent, unmissable "Chat" button fixed at the bottom right that launches a conversation UI specifically for testing the current configuration of this agent.
- **Global Tooling:** High-level application utilities including an "Export" button and a custom "Thing" automation trigger.

## 2. Detailed Mock of the Layout
The page employs a complex three-column configuration layout:

```text
+-----------------------------------------------------------------------------------------+
| Sidebar (Left)     | Header: < AssessmentAgent (Description)        [Thing] [Export]    |
| [Workspace Drop]   |--------------------------------------------------------------------|
|                    | Knowledge (3 selected)                                   Clear all |
| - KNOWLEDGE (4)    |  [users] Classroom [v]  [book] Curriculum [v]  [library] Subject   |
|   ...              |--------------------------------------------------------------------|
|                    | Main Content (Center)                 | Action Panel (Right)       |
| - AGENTS (2)       |                                       |                            |
|  [Active Violet]   | Main Instructions (optional)          |  Actions (1)    Tools (0)  |
|   AssessmentAgent  | [ # Your Agent Instructions      ]    |  ------------------------- |
|   LessonPlanAgent  | [                                ]    |                            |
|                    | [ You are a specialized assistant]    | Slash Actions      [Attach]|
| + Create Agent     | [                                ]    |                            |
|                    | [ ## Guidelines                  ]    | +------------------------+ |
| - CONVERSATIONS    |                                       | | [bolt] /generate Active| |
|   [Chat icon]      |       AREA KNOWLEDGE                  | | Generate Assessment    | |
|   Generating...    | +-----------------------------------+ | | (6 steps)              | |
|                    | | [users] Classroom Management    v | | +------------------------+ |
|                    | +-----------------------------------+ |                            |
| [Settings]         | | [book]  Curriculum Standards    v | |                            |
| [< Collapse]       | +-----------------------------------+ |                            |
|                    | | [library] Subject Topics        v | |                 [Chat]   |
+--------------------+---------------------------------------+----------------------------+
```

## 3. Description for Each Action
- **Knowledge Selection Pills (Top Bar):** Clicking these violet pill-buttons toggles the inclusion of that specific knowledge area into the agent's active memory prompt. Active items are violet; inactive items are light gray.
- **"Clear all" Button:** Instantly detaches all selected knowledge contexts from the agent.
- **Markdown Textarea (Main Instructions):** Authoring environment to define the agent's core identity, constraints, and operational goals.
- **Expandable Area Knowledge Cards (Center):** Clicking the down-arrow `v` on these cards likely expands to reveal a summary or the specific prompt fragments flowing from that domain into this agent.
- **"Actions / Tools" Tabs (Right Pane):** Toggles the right-side configuration panel between workflow actions (triggers) and basic tools (functions).
- **"Attach Flow" Button (Right Pane):** Opens an interface to bind an existing pre-configured multi-step workflow logic to a new slash command for this specific agent.
- **Slash Action Card (`/generate`):** Represents an active capability. Hovering or clicking this card likely provides options to edit, disable, or detach the specific workflow (e.g., the 6-step "Generate Assessment" flow).
- **"Chat" Button (Bottom Right):** The primary Action button for the page. It opens the runtime environment (likely an overlay chat window) to converse with the agent using its current instructions, knowledge, and actions.
- **Sidebar Elements:** Clicking an agent changes the active configuration; clicking a conversation opens its chat history log.

## 4. Style of the Page
- **Color Palette & Accents:**
    - **Primary Brand Color:** **Violet-600** (`#7c3aed` or similar) is heavily emphasized on this page to signify "Agent Logic." The action tabs, the primary Chat button, active knowledge pills, and active sidebar link all utilize variations of this violet.
    - **Backgrounds:** The primary layout uses white and a very light gray (`slate-50`), maintaining a high-contrast ratio for text readability.
    - **Status Indicators:** Emerald Green is used thoughtfully just for status badges (e.g., the "Active" pill next to `/generate`).
- **Typography:**
    - Clean, modern UI text for headers and standard labels.
    - **Monospace Font:** The "Main Instructions" textarea uses a monospace format to emphasize that it is a code-like, raw instruction set.
    - Small caps with increased letter-spacing (`AREA KNOWLEDGE`) denote sub-section divisions.
- **Components & Radius:**
    - Generous border-radius usage (highly rounded corners) for the knowledge pill buttons, action cards, and the main Chat button, conveying an approachable, consumer-friendly aesthetic within a technical application.
    - Structure relies on 1px solid slate borders (`border-slate-200`) rather than drop-shadows to define distinct columns and sections, keeping the UI visually "flat" and light.

## 5. Additional Interactive Elements & Modals
- **Interactive Knowledge Toggling**: Users can interactively click on the Knowledge Pills (e.g., "Classroom Management") to toggle their active state for the agent. Selection is confirmed visually (e.g., changing to an emerald pill with a checkmark). A "Clear all" button dynamically resets this state.
- **Area Knowledge Accordions**: The cards located under the "AREA KNOWLEDGE" heading function as interactive accordions. They can be expanded or collapsed to reveal specific configuration details linked to that domain.
- **"Attach Flow" Modal**: Clicking the "Attach Flow" button in the right-hand panel triggers an **"Attach Workflow" Modal** that contains a searchable index of available flows and slash commands that can be linked to the current agent.
- **Action Status Toggles**: Each attached action card contains interactive elements allowing the user to toggle its operational status (e.g., Active/Disabled) or completely detach it without navigating away.
- **Tabbed Right Panel**: The "Actions" and "Tools" headers function as a tabbed interface, dynamically swapping the active view within the sidebar.
