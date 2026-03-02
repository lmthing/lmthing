# Studio Dashboard (`/workspace/[workspaceId]/studio`)

**Layout:** [L2: Three-Column Dashboard Layout](../../LAYOUT.md#l2-three-column-dashboard-layout) (without right panel)

## User Stories

### US-101: View Workspace Context
**As a** workspace user  
**I want to** see which workspace I'm currently working in  
**So that** I can confirm I'm in the correct context

**Acceptance Criteria:**
- Current workspace name (e.g., `local/education`) is displayed in header with dropdown indicator
- Workspace selector uses [C1: Application Header](../../LAYOUT.md#c1-application-header)
- Logo visible in top-left corner
- Header includes utility actions: "Thing" button and "Export" button on the right

**Components:** [C1: Application Header](../../LAYOUT.md#c1-application-header) with workspace selector

---

### US-102: Switch Between Workspaces
**As a** user with multiple workspaces  
**I want to** switch to a different workspace  
**So that** I can work on different projects without losing my place

**Acceptance Criteria:**
- Clicking workspace name in header opens dropdown modal
- Modal includes:
  - "Search workspaces..." input field
  - List of available local workspaces with active workspace checkmark
  - "Add Local Workspace" button
  - "Import from GitHub" section
- Selecting a workspace navigates to that workspace's studio dashboard
- Uses [C8: Modal Dialog](../../LAYOUT.md#c8-modal-dialog) (Selection modal variant)
- Modal follows [Shadow Scale](../../LAYOUT.md#shadow-scale) (strong shadow)

**Components:** Workspace selector dropdown, [C8: Modal Dialog](../../LAYOUT.md#c8-modal-dialog)

---

### US-103: Create a New Local Workspace
**As a** user  
**I want to** create a new workspace  
**So that** I can organize different AI agent projects separately

**Acceptance Criteria:**
- "+" button next to workspace selector in header
- Clicking opens "Create Local Workspace" modal
- Modal includes:
  - "Workspace name" input field
  - Create/Cancel buttons
- After creation, navigates to new workspace's studio dashboard
- Uses [C8: Modal Dialog](../../LAYOUT.md#c8-modal-dialog) (Simple form modal variant)

**Components:** Add button, [C8: Modal Dialog](../../LAYOUT.md#c8-modal-dialog)

---

### US-104: Navigate Within Workspace
**As a** workspace user  
**I want to** quickly navigate between different sections (Knowledge, Agents, Conversations)  
**So that** I can efficiently manage different aspects of my workspace

**Acceptance Criteria:**
- [C2: Sidebar Navigation](../../LAYOUT.md#c2-sidebar-navigation) is visible on the left
- Sidebar sections include:
  - KNOWLEDGE (with count badge showing 4)
    - List of knowledge areas (Classroom Management, Curriculum Standards, Subject Topics, Teacher Profile)
    - "+ Create Knowledge" action
  - AGENTS (with count badge showing 2)
    - List of agents (AssessmentAgent, LessonPlanAgent)
    - "+ Create Agent" action
  - CONVERSATIONS (with count badge showing 2)
    - Instruction: "Select an agent to view its conversations"
- Settings link at bottom
- Collapse toggle at bottom
- Current section/page highlights the active item with Emerald (Knowledge) or Violet (Agent) accent color
- Uses [Active States](../../LAYOUT.md#activeselected) from interactive states

**Components:** [C2: Sidebar Navigation](../../LAYOUT.md#c2-sidebar-navigation)

---

### US-105: View Knowledge Areas Overview
**As a** workspace user  
**I want to** see all knowledge areas in my workspace  
**So that** I can manage the data sources for my AI agents

**Acceptance Criteria:**
- Main content area displays "Knowledge" section with folder icon
- Section header includes "+ Create Knowledge" button
- Knowledge areas displayed as cards in responsive grid (2 columns)
- Each card shows:
  - Knowledge area name
  - Description text
  - Hover state with Emerald green border and shadow
- Cards use [C3: Card Grid](../../LAYOUT.md#c3-card-grid) layout
- Hover follows [Interactive States - Hover](../../LAYOUT.md#hover)
- Uses [Semantic Colors - Knowledge](../../LAYOUT.md#semantic-colors) (Emerald green)

**Components:** Section header, [C3: Card Grid](../../LAYOUT.md#c3-card-grid)

---

### US-106: View Agents Overview
**As a** workspace user  
**I want to** see all agents in my workspace  
**So that** I can manage and configure my AI agents

**Acceptance Criteria:**
- Main content area displays "Agents" section with robot icon
- Section header includes "+ Create Agent" button
- Agents displayed as cards in responsive grid (2 columns)
- Each card shows:
  - Agent name
  - Associated flow (e.g., "/Gen Assessment")
  - Metadata: number of knowledge areas attached and flow count (e.g., "3 Areas, 1 Flow")
  - Hover state with Violet purple border and shadow
- Cards use [C3: Card Grid](../../LAYOUT.md#c3-card-grid) layout
- Hover follows [Interactive States - Hover](../../LAYOUT.md#hover)
- Uses [Semantic Colors - Agents](../../LAYOUT.md#semantic-colors) (Violet purple)

**Components:** Section header, [C3: Card Grid](../../LAYOUT.md#c3-card-grid)

---

### US-107: Create New Knowledge Area
**As a** workspace user  
**I want to** create a new knowledge area  
**So that** I can add new data sources for my agents to use

**Acceptance Criteria:**
- "+ Create Knowledge" button visible in Knowledge section header
- Clicking opens modal with:
  - "Name" input field
  - "Description" input field (optional)
  - Create/Cancel buttons
- Modal styled with Emerald green accents
- After creation, new knowledge area appears in the grid and sidebar
- Uses [C8: Modal Dialog](../../LAYOUT.md#c8-modal-dialog) (Simple form modal variant)
- Uses [Semantic Colors - Knowledge](../../LAYOUT.md#semantic-colors)

**Components:** Create button, [C8: Modal Dialog](../../LAYOUT.md#c8-modal-dialog)

---

### US-108: Create New Agent
**As a** workspace user  
**I want to** create a new agent  
**So that** I can configure a new AI assistant for specific tasks

**Acceptance Criteria:**
- "+ Create Agent" button visible in Agents section header
- Clicking opens modal with:
  - Robot icon
  - "Name" input field
  - "Description" input field (optional)
  - Create/Cancel buttons
- Modal styled with Violet purple accents
- After creation, new agent appears in the grid and sidebar
- Navigates to agent configuration page
- Uses [C8: Modal Dialog](../../LAYOUT.md#c8-modal-dialog) (Simple form modal variant)
- Uses [Semantic Colors - Agents](../../LAYOUT.md#semantic-colors)

**Components:** Create button, [C8: Modal Dialog](../../LAYOUT.md#c8-modal-dialog)

---

### US-109: Navigate to Knowledge Area Details
**As a** workspace user  
**I want to** click on a knowledge area card  
**So that** I can view and edit its content

**Acceptance Criteria:**
- Clicking anywhere on a knowledge area card navigates to: `/workspace/{workspaceId}/studio/domain/{domainId}`
- Card hover state provides visual feedback
- Transition is immediate (no loading state for navigation)
- Uses [Interactive States - Hover](../../LAYOUT.md#hover)

**Components:** Interactive card

---

### US-110: Navigate to Agent Configuration
**As a** workspace user  
**I want to** click on an agent card  
**So that** I can configure its instructions, knowledge, and actions

**Acceptance Criteria:**
- Clicking anywhere on an agent card navigates to: `/workspace/{workspaceId}/studio/agent/{agentId}`
- Card hover state provides visual feedback
- Transition is immediate
- Uses [Interactive States - Hover](../../LAYOUT.md#hover)

**Components:** Interactive card

---

### US-111: Export Workspace Configuration
**As a** workspace user  
**I want to** export my workspace  
**So that** I can back it up or share it with others

**Acceptance Criteria:**
- "Export" button visible in header top-right
- Clicking initiates export process
- Button text changes to "Exporting..." during export
- Downloads complete workspace configuration bundle
- Uses [C1: Application Header](../../LAYOUT.md#c1-application-header) component

**Components:** Export button in header

---

### US-112: Access Thing Agent Assistant
**As a** workspace user  
**I want to** use the Thing agent for workspace automation  
**So that** I can execute commands and get help with workspace actions

**Acceptance Criteria:**
- "Thing" button visible in header top-right
- Clicking toggles sliding panel from right side
- Button text changes to "Hide Thing" when panel is open
- Panel uses [C10: Sliding Side Panel](../../LAYOUT.md#c10-sliding-side-panel)
- Panel contains:
  - "Workspace actions" section
  - "New chat" button
  - "History" list
  - Command input area (supports `help`, `status`, JSON actions)
- Clicking again or backdrop dismisses panel
- Uses [C1: Application Header](../../LAYOUT.md#c1-application-header) for button

**Components:** Thing button, [C10: Sliding Side Panel](../../LAYOUT.md#c10-sliding-side-panel)

---

### US-113: Manage Workspace Settings
**As a** workspace user  
**I want to** configure workspace-level settings  
**So that** I can manage dependencies, environment variables, and AI providers

**Acceptance Criteria:**
- "Settings" link visible at bottom of sidebar
- Clicking opens comprehensive "Workspace Settings" modal
- Modal includes three tabs:
  - **package.json:** Metadata editor with "Advanced JSON editor" accordion and searchable dependency manager
  - **Env Files:** Interface to decrypt, load, and normalize encrypted `.env` variables
  - **Providers:** Interface to manage AI API keys and map `LM_MODEL` aliases
- Uses [C8: Modal Dialog](../../LAYOUT.md#c8-modal-dialog) (Complex tabbed modal variant)
- Modal uses [Shadow Scale](../../LAYOUT.md#shadow-scale) (strong shadow)

**Components:** Settings link, [C8: Modal Dialog](../../LAYOUT.md#c8-modal-dialog)

---

### US-114: Collapse Sidebar for More Space
**As a** workspace user  
**I want to** collapse the sidebar  
**So that** I can maximize screen space for the main content

**Acceptance Criteria:**
- "Collapse" button visible at bottom of sidebar with left arrow icon (`<`)
- Clicking collapses sidebar to icon-only view
- Button tooltip changes to "Expand sidebar"
- Icon updates to right arrow (`>`)
- Clicking again restores full sidebar
- Uses [C2: Sidebar Navigation](../../LAYOUT.md#c2-sidebar-navigation) component

**Components:** Collapse toggle button

---

## Visual Design Reference

**Layout Structure:**
- Uses [L2: Three-Column Dashboard Layout](../../LAYOUT.md#l2-three-column-dashboard-layout) (sidebar + main content, no right panel)
- Fixed sidebar (left), flexible main content (center)

**Color Scheme:**
- Foundation: White backgrounds, slate/gray text and borders
- Knowledge accent: Emerald green (#10b981)
- Agent accent: Violet purple (#7c3aed)
- See [Color System](../../LAYOUT.md#color-system)

**Typography:**
- Clean sans-serif font (Inter/Roboto)
- Bold section headers, semi-bold entity titles
- See [Typography Scale](../../LAYOUT.md#typography-scale)

**Component Styling:**
- Highly rounded corners (xl border-radius)
- Transparent to white card backgrounds
- Hover shadows (md) for interactivity
- Clean SVG stroke icons
- See [Border Radius Scale](../../LAYOUT.md#border-radius-scale) and [Shadow Scale](../../LAYOUT.md#shadow-scale)
