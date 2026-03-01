# Prompt Library Specification

## Overview
The Prompt Library is a filesystem-based workspace where experts author, organize, and manage prompt fragments as a hierarchical taxonomy of markdown files. Users navigate a split-pane interface with an expandable file tree on the left and a markdown editor on the right for creating and editing prompt content.

## User Flows
- **Browse library** — Navigate the hierarchical file tree to explore prompt fragments by domain or category
- **Search files** — Use the search box in the file tree header to filter files and folders by name
- **View fragment** — Click a file in the tree to load its content in the editor pane for reading
- **Create fragment** — Click "New", provide a filename and location, then open in editor
- **Edit fragment** — Make changes to content in the editor, toggle between edit and preview mode, save (Ctrl+S / Cmd+S)
- **Create folder** — Add new directories to the taxonomy for organization
- **Rename/move** — Rename files or folders, or move them to different locations in the tree
- **Delete** — Remove files or folders from the library (with confirmation)
- **Duplicate** — Create a copy of a file or folder with "-copy" suffix

## UI Requirements
- **Split pane layout** — File tree sidebar on left (expandable/collapsible), editor pane on right
- **File tree** — Hierarchical, nested folder structure with expand/collapse, folder icon (📁/📂) in blue, document icon (📄) in gray for files
- **File tree search** — Search box in file tree header for filtering files and folders by name, real-time filtering as user types
- **Editor** — Markdown editing with toolbar for formatting (bold, italic, headings H1-H6, lists, code blocks with syntax highlighting, inline code, links, blockquotes, horizontal rules)
- **Preview toggle** — Toggle button to switch between edit mode and rendered markdown preview
- **Metadata panel** — Dedicated panel for editing YAML frontmatter (separate from editor)
- **New file modal** — Form requiring filename input and parent folder selection, validates for empty names, invalid characters, and duplicates
- **New folder modal** — Form requiring folder name and parent location, same validation as new file
- **Context menus** — Right-click on files/folders for rename, move, delete, duplicate actions
- **Empty state (no selection)** — "Select a file from the tree to view or edit its content."
- **Empty state (empty library)** — "No prompt fragments yet. Click 'New' to create your first fragment."
- **Unsaved indicator** — Dot (•) next to filename in file tree when changes are pending
- **Unsaved changes prompt** — Modal with "You have unsaved changes. Save, Discard, or Cancel?" when switching away from or closing a file with changes
- **Folder expansion** — "Expand All" and "Collapse All" actions in file tree header, selecting a file auto-expands its parent folders, expansion state is NOT persisted across sessions
- **Save** — Explicit save only (Ctrl+S / Cmd+S, or Save button), unsaved changes persist in memory when switching files
- **Delete file** — Confirmation modal shows filename, deletion is not undoable
- **Delete directory** — Confirmation modal warns that all contents will be deleted recursively, unsaved changes in deleted files are lost with a warning
- **Move/rename with duplicate name** — Error message: "A file with that name already exists."
- **Rename with unsaved changes** — Allowed, rename applies to file path only
- **Duplicate file** — Creates "filename-copy.md" (or "filename-copy-2.md" if copy exists), no confirmation required
- **Duplicate folder** — Recursively copies all contents with "-copy" suffix on folders, no confirmation required
- **Filename validation** — .md extension auto-added if not provided, allowed characters: letters, numbers, hyphens, underscores, spaces, max 255 characters, no duplicates in same directory
- **Folder name normalization** — Folder names are automatically converted to lowercase with hyphens replacing spaces
- **Error display** — Toast notifications for non-blocking errors (auto-dismiss after 5 seconds), modal for blocking errors, inline text for form validation

## Configuration
- shell: true
