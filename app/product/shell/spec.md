# Application Shell Specification

## Overview
LMThing uses a chat-focused sidebar layout that provides quick access to agents, conversations, and settings. The shell is persistent across all views and adapts based on context — showing the Agents Dashboard when browsing, and the Chat Interface when in a conversation.

## Data Sources

### Agents Data
**Location:** `/product/sections/agent-builder/data.json`

The shell reads from `savedAgentConfigs` array:

```typescript
interface SavedAgentConfig {
  id: string
  name: string
  description: string
  mainInstruction: string
  selectedDomains: string[]
  formValues: Record<string, any>
  enabledTools: Array<{ toolId: string, source: string }>
  emptyFieldsForRuntime: string[]
  attachedFlows: Array<{ flowId: string, flowName: string, slashAction: { ... } }>
  createdAt: string
  updatedAt: string
}
```

### Conversations Data
**Location:** `/product/sections/agent-runtime/data.json`

The shell reads from `conversations` array for recent history:

```typescript
interface Conversation {
  id: string
  agentId: string
  agentName: string
  messages: Array<{ id: string, role: 'user' | 'assistant', content: string, timestamp: string }>
  createdAt: string
  updatedAt: string
}
```

## Navigation Structure

### Sidebar Components (Top to Bottom):
1. **New Chat Button** — Primary action to create a new agent or start a new conversation
2. **Agents Section** — Collapsible section showing all available agents
   - Displays agent count
   - Shows recent conversations grouped by agent
3. **Settings** — Link to settings at the bottom
4. **Collapse Toggle** — Button to collapse/expand the sidebar

### Main Content Area:
- **Agents Dashboard** — Grid view of all agents with search and + New Agent button
- **Chat Interface** — Conversation view with agent name header and message input

## Layout Pattern
**Sidebar Navigation** — Collapsible sidebar (280px expanded, 72px collapsed) on the left. Main content area takes remaining width.

### Sidebar States:
- **Expanded** (280px): Shows all nav items, agents list, and history with full labels
- **Collapsed** (72px): Shows only icons with tooltips on hover
- **Mobile**: Hidden by default, slides in from left when hamburger is clicked

## Component Architecture

### Shell Components:
- `AppShell` — Main shell wrapper supporting `viewMode: 'dashboard' | 'chat'`
- `ChatSidebar` — Sidebar with New chat button, Agents list, settings, collapse
- `ChatHeader` — Header showing agent name with Edit link + user menu
- `AgentsDashboard` — Grid/list view of agents with search and + New Agent button
- `RecentHistory` — List of recent conversations

### Section Components (outside shell):
- **Agent Builder** (`/src/sections/agent-builder/`) — New Agent Modal, agent configuration
- **Agent Runtime** (`/src/sections/agent-runtime/`) — Chat Interface with messages

## Responsive Behavior
- **Desktop (1024px+):** Sidebar always visible, collapsible. Content takes remaining width.
- **Tablet (768px-1023px):** Same as desktop, sidebar starts collapsed
- **Mobile (<768px):** Sidebar hidden, hamburger menu in header opens overlay

## Design Notes
- **Colors:**
  - Primary action (+ New Agent, Submit): Red (#ef4444)
  - Active state: Violet accents
  - Hover states: Slate-100 (light) / Slate-800 (dark)
  - Backgrounds: White (light) / Slate-900 (dark)
  - Borders: Slate-200 (light) / Slate-800 (dark)
- **Typography:**
  - Space Grotesk for headings and navigation labels
  - Inter for body text and UI elements
  - JetBrains Mono for code/system prompts
- **Icons:** Lucide React icon set
- **Animations:** Smooth transitions (200ms) for sidebar collapse, hover states
- **Scroll:** Sidebar content scrolls independently when items exceed viewport
- **Shadows:** Subtle shadows on dropdowns and modals for depth
