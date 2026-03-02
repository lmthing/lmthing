# URL Analysis: /workspace/[workspaceId]/studio (Studio Dashboard)

## 1. Available Features
- **Knowledge Management**: A section to manage data sources (folders/files). Currently lists areas such as *Classroom Management*, *Curriculum Standards*, *Subject Topics*, and *Teacher Profile*.
- **Agent Management**: A section to configure AI agents. Shows existing agents like *AssessmentAgent* and *LessonPlanAgent*, along with their attached flows and capabilities.
- **Sidebar Application Navigation**: A persistent left-hand navigation menu for quick access to Knowledge, Agents, Conversations, and overarching Workspace Settings.
- **Workspace Navigation & Selection**: A dropdown menu in the header to switch between different workspaces (e.g., `local/education`, `local/plants`).
- **Workspace-level Actions**: Actions in the top-bar such as "Export" context and a "Thing" button.

## 2. Detailed Mock of the Layout
The page follows a standard SaaS Dashboard layout with a fixed sidebar and a scrollable main content area.

```text
+---------------------------------------------------------------------------------+
| [Elephant Logo] [local/education v] [+]                      [Thing] [Export]   |
+---------------------------------------------------------------------------------+
| Sidebar (Left)         | Main Content (Right)                                   |
|                        |                                                        |
| - KNOWLEDGE (4)        | Manage knowledge and agents                            |
|   - Classroom Mgmt     |                                                        |
|   - Curriculum Stds    | [Folder Icon] Knowledge         [+ Create Knowledge]   |
|   - Subject Topics     +--------------------------------------------------------+
|   - Teacher Profile    | +-------------------+ +-------------------+            |
| - Create Knowledge     | | Classroom Mgmt    | | Curriculum Stds   |            |
|                        | | [Description...]  | | [Description...]  |            |
| - AGENTS (2)           | +-------------------+ +-------------------+            |
|   - AssessmentAgent    | +-------------------+ +-------------------+            |
|   - LessonPlanAgent    | | Subject Topics    | | Teacher Profile   |            |
| - Create Agent         | | [Description...]  | | [Description...]  |            |
|                        | +-------------------+ +-------------------+            |
| - CONVERSATIONS (2)    |                                                        |
|   (Select agent...)    | [Robot Icon] Agents                 [+ Create Agent]   |
|                        +--------------------------------------------------------+
|                        | +-------------------+ +-------------------+            |
| [Settings]             | | AssessmentAgent   | | LessonPlanAgent   |            |
| [Collapse]             | | [/Gen Assessment] | | [/Gen Lesson]     |            |
|                        | | [3 Areas, 1 Flow] | | [4 Areas, 1 Flow] |            |
|                        | +-------------------+ +-------------------+            |
+------------------------+-------------------+ +-------------------+------------+
```

## 3. Description for Each Action
- **Select Workspace Dropdown (Top Left)**: Click to open a menu to switch the current workspace context to another available workspace.
- **"+" Button (Next to Workspace Dropdown)**: Click to initialize a new local workspace environment.
- **"Export" Button (Top Right)**: Initiates a download or data transfer of the current workspace's complete configuration and state.
- **Knowledge Area Cards (Main Content)**: Clicking any of these cards navigates the user to a dedicated detailed configuration/editing view for that specific domain's prompt fragments.
- **Agent Cards (Main Content)**: Clicking any of these cards navigates the user to the Agent configuration page, where rules, flows, and runtime parameters are set.
- **"+ Create Knowledge" Button (Main Content)**: Triggers a modal or workflow to add a new Knowledge domain to grounding data sources.
- **"+ Create Agent" Button (Main Content)**: Triggers a modal or workflow to create a completely new AI Agent within the workspace.
- **Sidebar Navigation Links**: Quickly jump to list views or specific single entities without scrolling the main dashboard.
- **"Settings" Link (Sidebar Bottom)**: Opens workspace-wide configuration settings.
- **"Collapse" Toggle (Sidebar Bottom)**: Shrinks the sidebar to just icons, maximizing the screen real estate for the main content dashboard.

## 4. Style of the Page
- **Visual Theme**: Minimalist, Enterprise SaaS design system, utilizing high contrast and generous whitespace to group information clusters effectively.
- **Color Palette**:
    - **Foundation**: Flat white backgrounds with Slate/Gray text (`text-slate-700`) and borders (`border-slate-200`).
    - **Accents**: **Emerald Green** used strictly for Knowledge-related interactive elements or highlights. **Violet Purple** used strictly for Agent-related interactive elements or highlights.
- **Typography**: Clean, geometric sans-serif font (e.g., Inter/Roboto). It relies on clear typographic hierarchy, employing slightly bolded headers for sections and semi-bold for entity titles within cards.
- **Component Styling**:
    - **Cards**: Feature highly rounded corners (large border-radius like `rounded-xl`) with transparent backgrounds moving to pure white, plus subtle hover interactions via drop shadows (`hover:shadow-md`) to indicate interactability.
    - **Iconography**: Clean SVG stroke icons (Folders for Knowledge, Robots for Agents) add visual signifiers without adding noise.

## 5. Additional Interactive Elements & Modals

### Header Actions
- **'Thing' Button (Top Right)**: Clicking this toggles a sliding **Right Sidebar Panel**, transitioning the button text to "Hide Thing".
  - **Panel Content**: Contains a chat-like interface featuring a "Workspace actions" section with a "New chat" button, a "History" list, and a command execution area where users can type `help`, `status`, or paste JSON action envelopes.
- **'Export' Button**: Clicking initiates a workspace export. The text transforms to "Exporting..." while the data bundle prepares.

### Workspace Management
- **Workspace Selector Dropdown (Top Left)**: Clicking the active workspace name reveals a Radix-powered dropdown.
  - **Content**: Includes a "Search workspaces..." input, a list of available local workspaces with active checkmarks, an "Add Local Workspace" button, and an "Import from GitHub" section.
- **'+' Button (Top Left)**: Opens the **"Create Local Workspace" Modal** containing a simple form with a "Workspace name" input.

### Sidebar Navigation Interactions
- **'Settings' Button (Bottom Left)**: Opens the comprehensive **"Workspace Settings" Modal**, divided into:
  - **package.json**: Metadata editor with an "Advanced JSON editor" accordion and a searchable dependency manager.
  - **Env Files**: Interface to decrypt, load, and normalize encrypted `.env` variables.
  - **Providers**: Interface to manage AI API keys and map `LM_MODEL` aliases.
- **'Collapse' Button (Bottom Left)**: Transforms the sidebar into an icon-only minimal view, changing its tooltip to "Expand sidebar".
- **Section Headers (Knowledge, Agents...)**: Serve as semantic headers; clicking them highlights the section but does not collapse the lists.

### Main Area Interactions
- **Knowledge/Agent Card Hover States**: Hovering over a Knowledge card turns its border Emerald green with a subtle shadow. Hovering over an Agent card transitions its border to Violet purple with a deepened shadow.
- **Creation Modals**: Clicking "+ Create Knowledge" or "+ Create Agent" spawns modals requesting a "Name" and an optional "Description" (with the Agent modal styled with violet ascents and a robot icon).
