# Layout Reference Guide

This document defines the common layout patterns and UI components used across the application.

## Common Layout Patterns

### L1: Single-Column Centered Layout
**Used in:** Home Page (`/`)

- Vertical single-column layout centered on screen
- Soft, glowing rounded border frame
- Maximum content width with horizontal margins
- Structured in distinct sections (Header → Hero → CTA → Grid)

### L2: Three-Column Dashboard Layout
**Used in:** Studio Dashboard, Agent Details, Knowledge Area Details

```
+------------------------------------------------------------------+
| Global Header (Navigation, Actions)                             |
+------------------+---------------------------+-------------------+
| Sidebar (Left)   | Main Content (Center)     | Action/Context   |
| - Fixed width    | - Flexible width          | (Right, optional)|
| - Navigation     | - Primary workspace       | - Contextual     |
| - Entity lists   | - Editor/viewer           |   actions        |
| - Create actions | - Cards/grids             | - Metadata       |
+------------------+---------------------------+-------------------+
```

### L3: Two-Column Split Layout
**Used in:** Knowledge Area File Explorer

```
+------------------------------------------------------------------+
| Global Header                                                    |
+------------------+-------------------------------------------------+
| Sidebar (Left)   | Tree Explorer (Left Half) | Editor (Right Half)|
| - Fixed width    | - File browser            | - Content viewer   |
| - Navigation     | - Hierarchical tree       | - Markdown editor  |
+------------------+-----------------------+--------------------------+
```

## Component Library

### C1: Application Header
- **Left:** Logo + Workspace selector dropdown + Quick actions
- **Center:** Page title and description (contextual)
- **Right:** Utility actions ("Thing" button, "Export", "Login")

### C2: Sidebar Navigation
- **Structure:** Fixed-width left panel
- **Sections:**
  - Workspace selector (top)
  - KNOWLEDGE (with count badge)
    - List of knowledge areas
    - + Create Knowledge
  - AGENTS (with count badge)
    - List of agents
    - + Create Agent
  - CONVERSATIONS (with count badge)
    - Context-dependent list
  - Settings (bottom)
  - Collapse toggle (bottom)
- **Active State:** Highlighted item with accent color (Emerald for Knowledge, Violet for Agents)

### C3: Card Grid
- Responsive grid layout (typically 2-3 columns)
- Card structure:
  - Icon/Avatar (top-left)
  - Title and subtitle
  - Description text
  - Metadata badges
  - Action button (bottom or overlay)
- Hover states with shadow and border color transitions

### C4: Empty State
- Centered layout
- Large icon (document, folder, or relevant symbol)
- Bold heading
- Descriptive subtitle with guidance
- Optional CTA button

### C5: Pill/Tag Selection Bar
- Horizontal scrollable row of interactive pills
- States: Active (colored), Inactive (gray)
- Toggle on/off behavior
- Optional dropdown per pill for sub-options
- Clear all button

### C6: Markdown Editor
- Large textarea with monospace font
- Syntax highlighting (optional)
- Labeled with section heading
- Border with rounded corners

### C7: Tree Explorer
- Header with search and action buttons
- Expand/Collapse all controls
- Hierarchical folder structure
- Expandable items with chevron indicators
- Context menu on hover (three-dot menu)
- File type icons

### C8: Modal Dialog
- Centered overlay with backdrop
- Header with title and close button
- Content area (forms, lists, settings tabs)
- Footer with action buttons
- Variations:
  - Simple form modal (name + description)
  - Complex tabbed modal (Settings)
  - Selection modal (Workspace picker)

### C9: Floating Action Button
- Fixed position (typically bottom-right)
- Large, prominent button
- Accent color (Violet for Chat)
- Icon + label
- Opens overlay or sidebar panel

### C10: Sliding Side Panel
- Slides in from right
- Full height
- Close button or toggle to hide
- Chat interface or additional context
- Backdrop overlay (optional)

## Color System

### Semantic Colors
- **Knowledge:** Emerald Green (#10b981, emerald-500)
- **Agents:** Violet Purple (#7c3aed, violet-600)
- **Active States:** Respective semantic color
- **Neutral:** Slate grays (50, 100, 200, 700)
- **Backgrounds:** White (#ffffff), Light gray (slate-50)
- **Text:** Dark slate (slate-700, slate-900)
- **Borders:** Slate-200

### Status Colors
- **Active/Success:** Emerald green
- **Information:** Blue
- **Warning:** Amber
- **Danger/Delete:** Red

## Typography Scale

- **Display:** Large, bold headings for hero sections (3xl-6xl)
- **H1:** Page titles (2xl-3xl, bold)
- **H2:** Section headings (xl-2xl, semibold)
- **H3:** Card titles (lg-xl, semibold)
- **Body:** Default text (base, regular)
- **Small:** Captions, metadata (sm-xs, regular)
- **Monospace:** Code, instructions, JSON

## Spacing System

- **Section gaps:** Large (8-16 units)
- **Card padding:** Medium (4-6 units)
- **Component margins:** Small-medium (2-4 units)
- **Element padding:** Minimal-small (1-2 units)

## Interactive States

### Hover
- Card: Shadow deepens, border color intensifies
- Button: Background darkens, scale increases slightly
- Link: Color transition, underline appears

### Active/Selected
- Background tint with semantic color
- Border highlight
- Icon color change
- Text color change

### Focus
- Outline with semantic color
- Enhanced contrast

## Border Radius Scale

- **Small:** 4px (buttons, tags)
- **Medium:** 8px (cards, inputs)
- **Large:** 12px (major sections)
- **XLarge:** 16px+ (hero cards, feature blocks)

## Shadow Scale

- **None:** Flat elements
- **Subtle:** Cards at rest (sm)
- **Medium:** Hover states (md)
- **Strong:** Modals, elevated panels (lg-xl)
