# KnowledgeTree Component

A powerful file tree component for the knowledge section built with [react-arborist](https://github.com/brimdata/react-arborist).

## Features

- **Drag and Drop**: Reorder files and folders by dragging
- **Inline Rename**: Edit file/folder names directly in the tree
- **Context Menu**: Right-click for quick actions
- **Keyboard Navigation**: Full keyboard support
- **Multi-select**: Select multiple items (Ctrl/Cmd + Click)
- **Smooth Animations**: Beautiful transitions and effects
- **Dark Mode**: Fully styled for both light and dark themes

## Usage

```tsx
import { KnowledgeTree } from '@/shell/components/KnowledgeTree'
import type { KnowledgeNode } from '@/types/workspace-data'

function MyComponent() {
  const [nodes, setNodes] = useState<KnowledgeNode[]>([])
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  return (
    <KnowledgeTree
      nodes={nodes}
      selectedFilePath={selectedPath}
      onFileSelect={(path) => {
        setSelectedPath(path)
        // Load and display file content
      }}
      onDirectorySelect={(path) => {
        // Toggle directory expansion
      }}
      onRenameNode={(oldPath, newPath) => {
        // Handle rename
      }}
      onDeleteNode={(path) => {
        // Handle delete
      }}
      onDuplicateNode={(path) => {
        // Handle duplicate
      }}
      onCreateFile={(parentPath) => {
        // Handle file creation
      }}
      onCreateFolder={(parentPath) => {
        // Handle folder creation
      }}
      onMove={(dragPath, targetPath, index) => {
        // Handle drag and drop
      }}
    />
  )
}
```

## Props

### `nodes: KnowledgeNode[]`
Array of knowledge nodes to display in the tree.

### `selectedFilePath: string | null`
Currently selected file path to highlight in the tree.

### `onFileSelect: (path: string) => void`
Callback when a file is selected.

### `onDirectorySelect: (path: string) => void`
Callback when a directory is selected.

### `onRenameNode: (oldPath: string, newPath: string) => void`
Callback when a node is renamed.

### `onDeleteNode: (path: string) => void`
Callback when a node is deleted.

### `onDuplicateNode: (path: string) => void`
Callback when a file is duplicated.

### `onCreateFile: (parentPath: string | null) => void`
Callback when a new file should be created.

### `onCreateFolder: (parentPath: string | null) => void`
Callback when a new folder should be created.

### `onMove: (dragPath: string, targetPath: string, index: number) => void`
Callback when a node is moved via drag and drop.

## UI Actions

### Context Menu
Right-click on any file or folder to access:
- **Rename**: Edit the name inline
- **Duplicate** (files only): Create a copy
- **Delete**: Remove the item
- **New File** (directories only): Create a new file in the folder
- **New Folder** (directories only): Create a new folder

### Keyboard Shortcuts
- **Arrow Keys**: Navigate through the tree
- **Enter**: Rename selected item
- **Delete**: Delete selected item
- **Ctrl/Cmd + C**: Copy (with multi-select support)
- **Ctrl/Cmd + V**: Paste
- **Ctrl/Cmd + Click**: Multi-select

### Drag and Drop
- **Drag**: Click and hold to start dragging
- **Drop**: Drop on a folder to move inside, or between items to reorder
- **Visual Feedback**: Highlighted drop target during drag

## Styling

The component uses Tailwind CSS classes and custom CSS for react-arborist. The styles are defined in `KnowledgeTree.css`.

### Customization
You can customize the appearance by:
1. Modifying the CSS classes in the component
2. Updating the colors in `KnowledgeTree.css`
3. Adjusting the `nodeColor` logic for directory colors

## Integration with PromptLibrary

The KnowledgeTree can be used as a replacement for the built-in file tree in PromptLibrary. It provides a better UX with drag-and-drop, context menus, and keyboard navigation.

To integrate:
1. Replace the tree rendering section in PromptLibrary
2. Map KnowledgeNode data to the tree format
3. Wire up the callbacks to workspace data operations

## Dependencies

- `react-arborist`: ^3.4.3
- `lucide-react`: For icons
- `tailwindcss`: For styling
