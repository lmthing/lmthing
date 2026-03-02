# URL Analysis: /workspace/[workspaceId]/studio/domain/[domainId] (Knowledge Area Details)

## 1. Available Features
- **Sidebar Navigation:**
    - **Workspace Management:** View current workspace (e.g., `local/education`) and create new ones.
    - **Knowledge Browser:** List of all knowledge areas (Classroom Management, Curriculum Standards, Subject Topics, Teacher Profile) with category counts, acting as a quick-switch mechanism. Currently active item is highlighted.
    - **Agent Browser:** List of configured agents (AssessmentAgent, LessonPlanAgent).
    - **Conversation History Section:** Placeholder instructing user to "Select an agent to view its conversations".
    - **Global Actions:** Bottom links for "Settings" and "Collapse" sidebar.
- **Knowledge Base Explorer (Left Pane):**
    - **File Management:** Action icons to cleanly create a "New File" or "New Folder".
    - **Search:** Real-time search/filter input for files within the domain.
    - **Tree Operations:** Global "Expand" and "Collapse" buttons for the category tree view.
    - **Category Management:** A hierarchical list of predefined categories (folders) such as `Class Size`, `Grade Level`, `Learning Model`, `Available Resources`, and `Student Support Needs`. Items can be expanded or collapsed to view internal files.
- **Content Viewer/Editor (Right Pane):**
    - **Main Workspace Area:** Designed to view and edit the contents of selected markdown files.
    - **Empty State Display:** A prominent initial placeholder message with a document icon stating "No file selected. Select a file from the tree to view and edit its content, or create a new prompt fragment."
- **Header Actions:**
    - **Navigation:** Back button (`<`) to return to the Studio overview.
    - **Contextual Information:** Title ("Classroom Management") and descriptive subtitle ("Classroom characteristics, student demographics, and learning environment configuration").
    - **Tooling:** Workspace actions via a generic "Thing" button and an "Export" button for knowledge extraction.

## 2. Detailed Mock of the Layout
The page utilizes a three-pane (or split-pane with sidebar) interface designed for heavily nested content management:

```text
+---------------------------------------------------------------------------------+
| Sidebar (Left)       | Header                                 [Thing] [Export]  |
| [Logo] [workspace v] | < Classroom Mgmt  (Description subtitle)                 |
|                      +----------------------------------------------------------+
| - KNOWLEDGE (4)      | [Purple Dot] Knowledge Base             |                |
|   [Active] Classroom | Add documents, rules...       [+F] [+D] |                |
|   - Curriculum Stds  | [ Q Search files...                   ] | No item sel..  |
|   - Subject Topics   | [ v Expand ] [ > Collapse ]             |                |
|   - Teacher Profile  |-----------------------------------------|                |
|                      | > [Folder] Class Size                   |                |
| + Create Knowledge   | > [Folder] Grade Level                  |      [Icon]    |
|                      | > [Folder] Learning Model               |                |
| - AGENTS (2)         | > [Folder] Available Resources          |No file selected|
|   - AssessmentAgent  | > [Folder] Student Support Needs        | (subtitle ...  |
|   - LessonPlanAgent  |                                         |  message)      |
|                      |                                         |                |
| + Create Agent       |                                         |                |
|                      |                                         |                |
| - CONVERSATIONS (2)  |                                         |                |
|   (instruction text) |                                         |                |
|                      |                                         |                |
|                      |                                         |                |
| [Settings]           |                                         |                |
| [< Collapse]         |                                         |                |
+----------------------+-----------------------------------------+----------------+
```

## 3. Description for Each Action
- **Back Button (`<`) in Header:** Navigates the user back one level to the main Studio landing dashboard.
- **Workspace Selector Dropdown:** Opens a menu to switch between different local workspaces.
- **Active state links (Sidebar):** Clicking other Knowledge items seamlessly pivots the active domain in the Explorer.
- **New File Icon (`+D` document shape):** Opens a prompt state to create a new textual prompt fragment/file within the currently focused folder or root domain.
- **New Folder Icon (`+F` folder shape):** Prompts the creation of a new category folder within the knowledge hierarchy.
- **Search Files Input:** Dynamically filters the file resource tree view below it based on matched text.
- **Expand/Collapse (Buttons):** Expands or collapses all category folders in the file tree simultaneously for easier scanning or deep-dives.
- **Tree Items (Folders with `>` arrows):** Clicking the arrow or folder toggles its expanded/collapsed state to reveal nested items.
- **Thing Button:** Triggers a specific app function (potentially sending selected context to an LLM or summarizing).
- **Export Button:** Initiates the download or JSON extraction process for the data within this specific knowledge area.
- **Sidebar Settings / Collapse:** Standard UI actions to manage application-level preferences or optimize screen width.

## 4. Style of the Page
- **Color Scheme & Theme:**
    - Clean, productivity-focused light mode design.
    - **Backgrounds:** Pure white (`#ffffff`) for main content spaces and a contrasting very light slate gray (`bg-slate-50`) for the fixed sidebar.
    - **Active States:** The currently selected "Classroom Management" sidebar link utilizes an Emerald Green tint (`text-emerald-700` and `bg-emerald-50`), visually anchoring the user.
    - **File Explorer Accents:** Employs Violet/Purple exclusively for the little `[Purple Dot]` next to "Knowledge Base" and for the Category Folder icons. UI action icons are subtle slate-gray.
- **Typography:**
    - Professional, readable sans-serif (likely Inter).
    - Clear hierarchical scale: bold, large weight for the main title, with muted, smaller text for descriptions.
    - Sidebar categories rely on small, uppercase, letter-spaced labels (`KNOWLEDGE`, `AGENTS`) for clear groupings.
- **Component Styling & Geometry:**
    - Interfaces rely heavily on `rounded-lg` (8px radius) or similar to soften the corners of buttons, inputs, active states, and empty state icons.
    - **Borders:** Crisp, 1px solid defined borders (`border-slate-200`) establish the columns (Sidebar | Explorer | Editor) and underline the top header, ensuring a rigid but invisible grid that organizes the complex nested lists.
    - **Empty State:** Employs a centered, light-gray document icon with centered instructional text to elegantly handle the absence of content without looking broken.

## 5. Additional Interactive Elements & Modals
- **File Explorer Creation Modals**: 
  - Clicking the **"Add File" Icon** opens the **"New Prompt Fragment" Modal**, providing inputs to specify a filename and determine its target directory.
  - Clicking the **"Add Folder" Icon** opens a dedicated **"New Folder" Modal**.
- **Dynamic File Tree Filtering**: The search bar residing at the top of the file explorer allows real-time, interactive filtering of the current knowledge base files without page reloads.
- **Tree Expansion Interaction**: Folders within the explorer tree can be clicked to dynamically expand or collapse their sub-contents.
- **Editor State Transition**: Selecting a specific file from the explorer tree seamlessly transitions the right-pane's empty state into an active, functional markdown-capable text area.
