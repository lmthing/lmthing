# Knowledge Area Details (`/workspace/[workspaceId]/studio/domain/[domainId]`)

**Layout:** [L3: Two-Column Split Layout](../../../../LAYOUT.md#l3-two-column-split-layout)

## User Stories

### US-301: View Knowledge Area Context and Navigate Back
**As a** workspace user  
**I want to** see the knowledge area name and be able to navigate back  
**So that** I can understand which knowledge area I'm editing and easily return to the studio

**Acceptance Criteria:**
- Header displays back button (`<`) on the left
- Knowledge area name (e.g., "Classroom Management") displayed prominently
- Descriptive subtitle (e.g., "Classroom characteristics, student demographics, and learning environment configuration")
- Clicking back button navigates to `/workspace/{workspaceId}/studio`
- Header includes utility actions: "Thing" and "Export" buttons on the right
- Uses [C1: Application Header](../../../../LAYOUT.md#c1-application-header)

**Components:** [C1: Application Header](../../../../LAYOUT.md#c1-application-header) with back navigation

---

### US-302: Browse Knowledge Files in Tree Structure
**As a** workspace user  
**I want to** view all files and folders in a hierarchical tree  
**So that** I can navigate and organize knowledge content

**Acceptance Criteria:**
- Left pane displays file tree explorer with [C7: Tree Explorer](../../../../LAYOUT.md#c7-tree-explorer)
- Tree section header labeled "Knowledge Base" with purple dot indicator
- Shows hierarchical folder structure (e.g., Class Size, Grade Level, Learning Model)
- Folders display with folder icon and chevron indicator (`>`)
- Clicking folder or chevron toggles expanded/collapsed state
- Files display with document icon
- Active/selected item highlighted with [Semantic Colors - Knowledge](../../../../LAYOUT.md#semantic-colors) (Emerald)
- Uses [C7: Tree Explorer](../../../../LAYOUT.md#c7-tree-explorer)

**Components:** [C7: Tree Explorer](../../../../LAYOUT.md#c7-tree-explorer)

---

### US-303: Search for Files
**As a** workspace user  
**I want to** search for specific files by name  
**So that** I can quickly find content in large knowledge bases

**Acceptance Criteria:**
- Search input field at top of tree explorer
- Placeholder text: "Search files..."
- Typing filters tree view in real-time
- Matches highlight in the tree
- Clearing search restores full tree view
- Search icon visible in input field

**Components:** Search input in [C7: Tree Explorer](../../../../LAYOUT.md#c7-tree-explorer)

---

### US-304: Expand and Collapse All Folders
**As a** workspace user  
**I want to** expand or collapse all folders at once  
**So that** I can quickly scan the full structure or focus on specific areas

**Acceptance Criteria:**
- "Expand" button visible in tree header
- "Collapse" button visible in tree header
- Clicking "Expand" opens all nested folders
- Clicking "Collapse" closes all folders to top level
- Buttons styled as small secondary actions

**Components:** Expand/Collapse controls in [C7: Tree Explorer](../../../../LAYOUT.md#c7-tree-explorer)

---

### US-305: Create New File
**As a** workspace user  
**I want to** add a new markdown file to the knowledge area  
**So that** I can add new prompt fragments or documentation

**Acceptance Criteria:**
- "New File" button (+D document icon) visible in tree header
- Clicking opens "New Prompt Fragment" modal
- Modal includes:
  - "Filename" input field (auto-appends `.md`)
  - "Location" selector dropdown (shows folder hierarchy)
  - Create/Cancel buttons
- After creation, file appears in tree and opens in editor
- Uses [C8: Modal Dialog](../../../../LAYOUT.md#c8-modal-dialog) (Simple form modal variant)
- Modal styled with [Semantic Colors - Knowledge](../../../../LAYOUT.md#semantic-colors) (Emerald accents)

**Components:** New File button, [C8: Modal Dialog](../../../../LAYOUT.md#c8-modal-dialog)

---

### US-306: Create New Folder
**As a** workspace user  
**I want to** create a new folder in the knowledge hierarchy  
**So that** I can better organize my knowledge content

**Acceptance Criteria:**
- "New Folder" button (+F folder icon) visible in tree header
- Clicking opens "New Folder" modal
- Modal includes:
  - "Folder Name" input field
  - "Parent Location" selector dropdown
  - Create/Cancel buttons
- After creation, folder appears in tree structure
- Uses [C8: Modal Dialog](../../../../LAYOUT.md#c8-modal-dialog) (Simple form modal variant)
- Modal styled with [Semantic Colors - Knowledge](../../../../LAYOUT.md#semantic-colors) (Emerald accents)

**Components:** New Folder button, [C8: Modal Dialog](../../../../LAYOUT.md#c8-modal-dialog)

---

### US-307: Select and View File Content
**As a** workspace user  
**I want to** click on a file in the tree  
**So that** I can view and edit its content

**Acceptance Criteria:**
- Clicking a file in the tree selects it (highlighted state)
- Selected file's content loads in the right pane editor
- File opens in markdown editor with syntax support
- Editor uses [C6: Markdown Editor](../../../../LAYOUT.md#c6-markdown-editor)
- Previous file closes when new file is selected

**Components:** Interactive tree item, [C6: Markdown Editor](../../../../LAYOUT.md#c6-markdown-editor)

---

### US-308: Edit File Content
**As a** workspace user  
**I want to** edit the markdown content of a selected file  
**So that** I can update knowledge fragments and documentation

**Acceptance Criteria:**
- Right pane displays markdown editor when file is selected
- Editor allows full markdown editing
- Changes save automatically or via explicit save action
- Editor uses monospace font for better markdown visibility
- Supports markdown syntax highlighting
- Uses [C6: Markdown Editor](../../../../LAYOUT.md#c6-markdown-editor)

**Components:** [C6: Markdown Editor](../../../../LAYOUT.md#c6-markdown-editor)

---

### US-309: View Empty State When No File Selected
**As a** workspace user  
**I want to** see helpful guidance when no file is selected  
**So that** I understand what to do next

**Acceptance Criteria:**
- When no file is selected, right pane displays [C4: Empty State](../../../../LAYOUT.md#c4-empty-state)
- Shows document icon (large, centered)
- Heading: "No file selected"
- Subtitle: "Select a file from the tree to view and edit its content, or create a new prompt fragment."
- Uses [C4: Empty State](../../../../LAYOUT.md#c4-empty-state) component
- Styled with muted colors (slate gray)

**Components:** [C4: Empty State](../../../../LAYOUT.md#c4-empty-state)

---

### US-310: Access File Context Menu
**As a** workspace user  
**I want to** access additional file operations via context menu  
**So that** I can rename, duplicate, or delete files

**Acceptance Criteria:**
- Hovering over file or folder in tree reveals three-dot menu icon (`...`)
- Clicking three-dot icon opens context menu dropdown
- Menu includes options:
  - **Rename:** Opens inline edit or modal to change name
  - **Duplicate:** Creates a copy of the file/folder
  - **Delete:** Removes item (with confirmation, red text hover)
- Menu positioning follows cursor/item position
- Click outside or ESC key closes menu

**Components:** Context menu dropdown

---

### US-311: Rename File or Folder
**As a** workspace user  
**I want to** rename a file or folder  
**So that** I can improve organization and clarity

**Acceptance Criteria:**
- Selecting "Rename" from context menu activates inline edit mode or opens modal
- Input field pre-populated with current name
- Pressing Enter or clicking confirm saves new name
- ESC or clicking cancel reverts to original name
- File automatically updates in tree with new name

**Components:** Inline edit or rename modal

---

### US-312: Duplicate File or Folder
**As a** workspace user  
**I want to** duplicate existing files or folders  
**So that** I can create variations or templates quickly

**Acceptance Criteria:**
- Selecting "Duplicate" from context menu creates a copy
- Copy appears in same location with suffix (e.g., "file-copy.md")
- Duplicate includes all content/children
- New item appears in tree immediately

**Components:** Context menu action

---

### US-313: Delete File or Folder
**As a** workspace user  
**I want to** delete files or folders I no longer need  
**So that** I can keep my knowledge base clean

**Acceptance Criteria:**
- Selecting "Delete" from context menu shows confirmation (optional)
- Delete option has red text on hover to indicate danger
- Confirming removes item from tree immediately
- Deleting folder removes all contents
- If deleted file is currently open, editor returns to empty state
- Uses [Status Colors](../../../../LAYOUT.md#status-colors) (red for danger)

**Components:** Context menu action with confirmation

---

### US-314: Navigate to Knowledge Area from Sidebar
**As a** workspace user  
**I want to** switch between knowledge areas using the sidebar  
**So that** I can edit multiple knowledge areas efficiently

**Acceptance Criteria:**
- [C2: Sidebar Navigation](../../../../LAYOUT.md#c2-sidebar-navigation) shows list of knowledge areas
- Currently active area highlighted with [Semantic Colors - Knowledge](../../../../LAYOUT.md#semantic-colors) (Emerald accent)
- Clicking another knowledge area navigates to that area's detail page
- Uses [Active States](../../../../LAYOUT.md#activeselected)

**Components:** [C2: Sidebar Navigation](../../../../LAYOUT.md#c2-sidebar-navigation)

---

### US-315: Export Knowledge Area
**As a** workspace user  
**I want to** export this specific knowledge area  
**So that** I can share or back up just this domain

**Acceptance Criteria:**
- "Export" button in header initiates knowledge area export
- Exports all files and folder structure
- Button shows "Exporting..." state during process
- Downloads as ZIP or JSON bundle
- Uses [C1: Application Header](../../../../LAYOUT.md#c1-application-header)

**Components:** Export button in header

---

### US-316: Use Thing Agent for Knowledge Management
**As a** workspace user  
**I want to** access the Thing assistant while managing knowledge  
**So that** I can get help or automate knowledge organization tasks

**Acceptance Criteria:**
- "Thing" button in header toggles right panel
- Panel slides in from right, button text changes to "Hide Thing"
- Thing chat interface can help with:
  - Generating file content
  - Organizing structure
  - Summarizing knowledge
- Uses [C10: Sliding Side Panel](../../../../LAYOUT.md#c10-sliding-side-panel)
- Panel replaces or overlays the editor pane

**Components:** Thing button, [C10: Sliding Side Panel](../../../../LAYOUT.md#c10-sliding-side-panel)

---

## Visual Design Reference

**Layout Structure:**
- Uses [L3: Two-Column Split Layout](../../../../LAYOUT.md#l3-two-column-split-layout)
- Sidebar (left) + Tree Explorer (left-center) + Editor (right)

**Color Scheme:**
- Primary accent: Emerald green (#10b981) for all knowledge-related elements
- Active states: Emerald background tint
- Purple dot for Knowledge Base label (visual differentiation)
- See [Color System](../../../../LAYOUT.md#color-system)

**Typography:**
- Clean sans-serif for tree items and labels
- Monospace font for editor content
- Small uppercase labels with letter-spacing (KNOWLEDGE)
- See [Typography Scale](../../../../LAYOUT.md#typography-scale)

**Component Styling:**
- Rounded corners (lg border-radius, 8px) for inputs and buttons
- Crisp 1px solid borders (slate-200) for pane divisions
- Document icon in empty state with light gray styling
- See [Border Radius Scale](../../../../LAYOUT.md#border-radius-scale)

**Key Interactive Elements:**
- Tree items expand/collapse on click
- Hover reveals context menu icon
- Search filters in real-time
- Empty state guides user action
- See [Interactive States](../../../../LAYOUT.md#interactive-states)
