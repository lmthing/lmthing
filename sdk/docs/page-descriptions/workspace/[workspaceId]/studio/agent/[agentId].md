# Agent Configuration (`/workspace/[workspaceId]/studio/agent/[agentId]`)

**Layout:** [L2: Three-Column Dashboard Layout](../../../../LAYOUT.md#l2-three-column-dashboard-layout) (full three-column)

## User Stories

### US-201: View Agent Identity and Navigate Back
**As a** workspace user  
**I want to** see the agent name and be able to navigate back to the studio dashboard  
**So that** I can understand which agent I'm configuring and easily return to the overview

**Acceptance Criteria:**
- Header displays back button (`<`) on the left
- Agent name (e.g., "AssessmentAgent") displayed prominently in header
- Agent description displayed as subtitle
- Clicking back button navigates to `/workspace/{workspaceId}/studio`
- Header includes utility actions: "Thing" and "Export" buttons on the right
- Uses [C1: Application Header](../../../../LAYOUT.md#c1-application-header)

**Components:** [C1: Application Header](../../../../LAYOUT.md#c1-application-header) with back navigation

---

### US-202: Select Knowledge Context for Agent
**As a** workspace user  
**I want to** attach or detach knowledge areas to my agent  
**So that** the agent has access to the right context for its tasks

**Acceptance Criteria:**
- Horizontal knowledge selection bar below header displays available knowledge areas
- Each knowledge area shows as a pill button with icon and name
- Pills have two states:
  - **Inactive (gray):** Knowledge area not attached
  - **Active (violet):** Knowledge area attached, includes checkmark
- Clicking a pill toggles its state (attach/detach)
- "Clear all" button on right side detaches all knowledge areas
- Shows count of selected knowledge (e.g., "Knowledge (3 selected)")
- Uses [C5: Pill/Tag Selection Bar](../../../../LAYOUT.md#c5-pilltag-selection-bar)
- Uses [Semantic Colors - Agents](../../../../LAYOUT.md#semantic-colors) (Violet for active state)

**Components:** [C5: Pill/Tag Selection Bar](../../../../LAYOUT.md#c5-pilltag-selection-bar)

---

### US-203: Define Agent Main Instructions
**As a** workspace user  
**I want to** write and edit the agent's core system prompt  
**So that** I can shape its behavior, personality, and operational guidelines

**Acceptance Criteria:**
- Large markdown textarea labeled "Main Instructions (optional)" in center pane
- Textarea uses monospace font for code-like display
- Supports markdown formatting in input
- Placeholder text guides user on what to include
- Changes are saved (auto-save or explicit save)
- Uses [C6: Markdown Editor](../../../../LAYOUT.md#c6-markdown-editor)

**Components:** [C6: Markdown Editor](../../../../LAYOUT.md#c6-markdown-editor)

---

### US-204: View Area Knowledge Details
**As a** workspace user  
**I want to** see which specific knowledge is feeding into the agent  
**So that** I can understand what context the agent has access to

**Acceptance Criteria:**
- "AREA KNOWLEDGE" section displays below Main Instructions
- Lists all attached knowledge areas as expandable accordion cards
- Each card shows:
  - Knowledge area icon
  - Knowledge area name
  - Expand/collapse chevron (v)
- Cards are styled with [Semantic Colors - Knowledge](../../../../LAYOUT.md#semantic-colors) (Emerald accents)
- Clicking card or chevron expands to show detailed knowledge structure
- Uses accordion pattern

**Components:** Expandable accordion cards

---

### US-205: View Available Actions and Tools
**As a** workspace user  
**I want to** see what actions and tools are available to the agent  
**So that** I can understand and manage the agent's capabilities

**Acceptance Criteria:**
- Right panel displays tabbed interface with "Actions" and "Tools" tabs
- Shows count badges: "Actions (1)" and "Tools (0)"
- Clicking tabs switches between views
- Active tab highlighted with [Semantic Colors - Agents](../../../../LAYOUT.md#semantic-colors) (Violet)
- Uses tab component pattern

**Components:** Tabbed interface panel

---

### US-206: Attach Workflow to Agent
**As a** workspace user  
**I want to** attach a pre-configured workflow to my agent  
**So that** the agent can execute multi-step processes via slash commands

**Acceptance Criteria:**
- "Attach Flow" button visible in Actions tab of right panel
- Clicking opens "Attach Workflow" modal
- Modal displays:
  - Searchable list of available workflows
  - Each workflow shows name, description, and step count
  - Select/Cancel buttons
- After attaching, workflow appears as action card in the list
- Uses [C8: Modal Dialog](../../../../LAYOUT.md#c8-modal-dialog) (Selection modal variant)

**Components:** Attach button, [C8: Modal Dialog](../../../../LAYOUT.md#c8-modal-dialog)

---

### US-207: View and Manage Attached Actions
**As a** workspace user  
**I want to** see attached workflows and their status  
**So that** I can manage which capabilities the agent has

**Acceptance Criteria:**
- Actions tab displays cards for each attached workflow
- Each card shows:
  - Workflow icon (e.g., bolt icon)
  - Slash command (e.g., "/generate")
  - Workflow name (e.g., "Generate Assessment")
  - Step count (e.g., "6 steps")
  - Status badge ("Active" in emerald green)
- Hovering reveals action menu (edit, disable, detach)
- Card styled with rounded corners and border
- Uses [C3: Card Grid](../../../../LAYOUT.md#c3-card-grid) styling
- Status uses [Status Colors](../../../../LAYOUT.md#status-colors)

**Components:** Action card list

---

### US-208: Test Agent in Runtime Sandbox
**As a** workspace user  
**I want to** chat with the agent to test its configuration  
**So that** I can verify it behaves as expected before deployment

**Acceptance Criteria:**
- "Chat" button fixed at bottom-right of screen
- Button uses [Semantic Colors - Agents](../../../../LAYOUT.md#semantic-colors) (Violet background)
- Clicking opens "Runtime Conversation Preview" modal/overlay
- Chat interface includes:
  - Message history area
  - Input field for new messages
  - Send button
  - Close button to return to configuration
- Agent uses current configuration (instructions, knowledge, actions)
- Uses [C9: Floating Action Button](../../../../LAYOUT.md#c9-floating-action-button)
- Modal uses chat interface pattern

**Components:** [C9: Floating Action Button](../../../../LAYOUT.md#c9-floating-action-button), chat modal overlay

---

### US-209: Toggle Action Status
**As a** workspace user  
**I want to** enable or disable an attached action without removing it  
**So that** I can temporarily turn off capabilities for testing

**Acceptance Criteria:**
- Status badge on action card is clickable
- Clicking toggles between "Active" (green) and "Inactive" (gray)
- Inactive actions are not available during runtime
- Visual state change is immediate
- Uses [Status Colors](../../../../LAYOUT.md#status-colors)

**Components:** Interactive status badge

---

### US-210: Detach Action from Agent
**As a** workspace user  
**I want to** remove an attached workflow from the agent  
**So that** I can clean up unused capabilities

**Acceptance Criteria:**
- Hovering over action card reveals action menu icon (three dots or trash icon)
- Clicking reveals dropdown with "Detach" option
- Clicking "Detach" removes the action immediately or after confirmation
- Action card disappears from list
- Action count updates

**Components:** Context menu with detach action

---

### US-211: Navigate to Agent from Sidebar
**As a** workspace user  
**I want to** switch between agents using the sidebar  
**So that** I can configure multiple agents efficiently

**Acceptance Criteria:**
- [C2: Sidebar Navigation](../../../../LAYOUT.md#c2-sidebar-navigation) shows list of agents
- Currently active agent highlighted with [Semantic Colors - Agents](../../../../LAYOUT.md#semantic-colors) (Violet accent)
- Clicking another agent navigates to that agent's configuration page
- Uses [Active States](../../../../LAYOUT.md#activeselected)

**Components:** [C2: Sidebar Navigation](../../../../LAYOUT.md#c2-sidebar-navigation)

---

### US-212: Access Agent-Specific Export
**As a** workspace user  
**I want to** export this specific agent's configuration  
**So that** I can share or back up just this agent

**Acceptance Criteria:**
- "Export" button in header initiates agent export
- Exports agent configuration including instructions, knowledge mappings, and attached actions
- Button shows loading state during export
- Downloads JSON file or opens export dialog

**Components:** Export button in [C1: Application Header](../../../../LAYOUT.md#c1-application-header)

---

### US-213: Use Thing Agent for Agent Configuration
**As a** workspace user  
**I want to** access the Thing assistant while configuring an agent  
**So that** I can get help or automate configuration tasks

**Acceptance Criteria:**
- "Thing" button in header toggles right panel
- Panel slides in from right, button text changes to "Hide Thing"
- Thing chat interface includes agent-specific commands
- Uses [C10: Sliding Side Panel](../../../../LAYOUT.md#c10-sliding-side-panel)
- Panel can coexist with or replace the Actions/Tools panel

**Components:** Thing button, [C10: Sliding Side Panel](../../../../LAYOUT.md#c10-sliding-side-panel)

---

### US-214: View Sidebar Conversations for Agent
**As a** workspace user  
**I want to** see past conversations with this agent  
**So that** I can review previous interactions

**Acceptance Criteria:**
- Sidebar CONVERSATIONS section shows conversations for current agent
- Each conversation shows:
  - Conversation title or preview
  - Timestamp or status
- Clicking conversation loads its history
- Empty state shows instruction text when no conversations exist

**Components:** Conversation list in [C2: Sidebar Navigation](../../../../LAYOUT.md#c2-sidebar-navigation)

---

## Visual Design Reference

**Layout Structure:**
- Uses [L2: Three-Column Dashboard Layout](../../../../LAYOUT.md#l2-three-column-dashboard-layout) (full three-column)
- Sidebar (left) + Main content (center) + Action panel (right)

**Color Scheme:**
- Primary accent: Violet purple (#7c3aed) for all agent-related elements
- Knowledge accent: Emerald green for knowledge area cards
- Status: Emerald for active, Gray for inactive
- See [Color System](../../../../LAYOUT.md#color-system)

**Typography:**
- Monospace font for Main Instructions textarea
- Small caps with letter-spacing for section labels (AREA KNOWLEDGE)
- See [Typography Scale](../../../../LAYOUT.md#typography-scale)

**Component Styling:**
- Generous border-radius for pills, cards, and buttons (rounded corners)
- 1px solid slate borders for column divisions
- Flat, high-contrast design without heavy shadows
- See [Border Radius Scale](../../../../LAYOUT.md#border-radius-scale)

**Key Interactive Elements:**
- Knowledge pills toggle on click (gray ↔ violet)
- Action cards reveal menu on hover
- Chat button is primary CTA (violet, bottom-right)
- See [Interactive States](../../../../LAYOUT.md#interactive-states)
