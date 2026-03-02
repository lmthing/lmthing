import { useRef, useCallback, useMemo, useState, type CSSProperties } from 'react'
import { Tree, type NodeApi, type TreeApi } from 'react-arborist'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  MoreVertical,
  Edit3,
  Copy,
  Trash2,
  Plus,
  FolderPlus
} from 'lucide-react'
import type { KnowledgeNode } from '@/types/workspace-data'
import './KnowledgeTree.css'

// ============================================================================
// Types
// ============================================================================

export interface KnowledgeTreeProps {
  nodes: KnowledgeNode[]
  selectedFilePath: string | null
  onFileSelect: (path: string) => void
  onDirectorySelect: (path: string) => void
  onRenameNode: (oldPath: string, newPath: string) => void
  onDeleteNode: (path: string) => void
  onDuplicateNode: (path: string) => void
  onCreateFile: (parentPath: string | null) => void
  onCreateFolder: (parentPath: string | null) => void
  onMove: (dragPath: string, targetPath: string, index: number) => void
}

interface TreeNode {
  id: string
  name: string
  path: string
  type: 'directory' | 'file'
  children?: TreeNode[]
  config?: KnowledgeNode['config']
  frontmatter?: KnowledgeNode['frontmatter']
}

interface ContextMenuState {
  node: NodeApi<TreeNode> | null
  position: { x: number; y: number } | null
}

// ============================================================================
// Helper Functions
// ============================================================================

function convertToTreeData(nodes: KnowledgeNode[]): TreeNode[] {
  return nodes.map(node => ({
    id: node.path,
    name: node.path.split('/').pop() || node.path,
    path: node.path,
    type: node.type,
    config: node.config,
    frontmatter: node.frontmatter,
    children: node.children ? convertToTreeData(node.children) : undefined,
  }))
}

// ============================================================================
// Context Menu Component
// ============================================================================

interface ContextMenuProps {
  node: NodeApi<TreeNode>
  position: { x: number; y: number }
  onClose: () => void
  onRename: () => void
  onDelete: () => void
  onDuplicate: () => void
  onCreateFile: () => void
  onCreateFolder: () => void
}

function ContextMenu({
  node,
  position,
  onClose,
  onRename,
  onDelete,
  onDuplicate,
  onCreateFile,
  onCreateFolder,
}: ContextMenuProps) {
  const isDirectory = node.data.type === 'directory'

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 min-w-[180px] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
        style={{ left: position.x, top: position.y }}
      >
        {isDirectory && (
          <>
            <button
              onClick={() => {
                onCreateFile()
                onClose()
              }}
              className="w-full px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-950/30 flex items-center gap-3 transition-colors"
            >
              <Plus className="w-4 h-4 text-slate-400" />
              New File
            </button>
            <button
              onClick={() => {
                onCreateFolder()
                onClose()
              }}
              className="w-full px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-950/30 flex items-center gap-3 transition-colors"
            >
              <FolderPlus className="w-4 h-4 text-slate-400" />
              New Folder
            </button>
            <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
          </>
        )}
        <button
          onClick={() => {
            onRename()
            onClose()
          }}
          className="w-full px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-950/30 flex items-center gap-3 transition-colors"
        >
          <Edit3 className="w-4 h-4 text-slate-400" />
          Rename
        </button>
        {!isDirectory && (
          <button
            onClick={() => {
              onDuplicate()
              onClose()
            }}
            className="w-full px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-950/30 flex items-center gap-3 transition-colors"
          >
            <Copy className="w-4 h-4 text-slate-400" />
            Duplicate
          </button>
        )}
        <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
        <button
          onClick={() => {
            onDelete()
            onClose()
          }}
          className="w-full px-4 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-3 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      </div>
    </>
  )
}

// ============================================================================
// Tree Node Component
// ============================================================================

interface NodeRendererProps {
  node: NodeApi<TreeNode>
  style: CSSProperties
  dragHandle?: (el: HTMLDivElement | null) => void
  onContextMenu: (node: NodeApi<TreeNode>, position: { x: number; y: number }) => void
  selectedPath: string | null
}

function NodeRenderer({ node, style, dragHandle, onContextMenu, selectedPath }: NodeRendererProps) {
  const isDirectory = node.data.type === 'directory'
  const isSelected = node.data.path === selectedPath

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (node.isInternal) {
      node.toggle()
    }
    node.select()
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onContextMenu(node, { x: e.clientX, y: e.clientY })
  }

  const getNodeColor = () => {
    if (isDirectory && node.data.config?.color) {
      return node.data.config.color
    }
    return undefined
  }

  const nodeColor = getNodeColor()

  return (
    <div
      ref={dragHandle}
      style={style}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      className={`
        group flex items-center gap-2 py-2 px-2.5 mx-1.5 rounded-lg cursor-pointer
        transition-all duration-150 relative
        ${
          isSelected
            ? 'bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-md shadow-violet-500/25'
            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
        }
        ${node.state.isDragging ? 'opacity-50' : ''}
        ${node.state.willReceiveDrop ? 'ring-2 ring-violet-500' : ''}
      `}
    >
      {isDirectory ? (
        <>
          {node.isOpen ? (
            <ChevronDown
              className={`w-3.5 h-3.5 flex-shrink-0 ${
                isSelected ? 'text-white' : 'text-slate-400 group-hover:text-slate-500'
              }`}
            />
          ) : (
            <ChevronRight
              className={`w-3.5 h-3.5 flex-shrink-0 ${
                isSelected ? 'text-white' : 'text-slate-400 group-hover:text-slate-500'
              }`}
            />
          )}
          {node.isOpen ? (
            <FolderOpen
              className="w-4 h-4 flex-shrink-0"
              style={{ color: isSelected ? '#fff' : nodeColor || '#8b5cf6' }}
            />
          ) : (
            <Folder
              className="w-4 h-4 flex-shrink-0"
              style={{ color: isSelected ? '#fff' : nodeColor || '#8b5cf6' }}
            />
          )}
        </>
      ) : (
        <>
          <span className="w-6 flex-shrink-0" />
          <FileText
            className={`w-4 h-4 flex-shrink-0 ${
              isSelected ? 'text-white' : 'text-slate-400 group-hover:text-slate-500'
            }`}
          />
        </>
      )}
      
      {node.isEditing ? (
        <input
          type="text"
          defaultValue={node.data.name}
          autoFocus
          onBlur={() => node.reset()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              node.reset()
            } else if (e.key === 'Enter') {
              node.submit(e.currentTarget.value)
            }
          }}
          className="flex-1 px-2 py-0.5 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 border border-violet-500 rounded outline-none"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <>
          <span className={`text-sm font-medium truncate flex-1 ${isSelected ? 'text-white' : ''}`}>
            {node.data.name}
          </span>

          {/* More options button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              const rect = (e.target as HTMLElement).getBoundingClientRect()
              onContextMenu(node, { x: rect.left, y: rect.bottom + 4 })
            }}
            className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all flex-shrink-0 ${
              isSelected ? 'hover:bg-white/20' : 'hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <MoreVertical className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
          </button>
        </>
      )}
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function KnowledgeTree({
  nodes,
  selectedFilePath,
  onFileSelect,
  onDirectorySelect,
  onRenameNode,
  onDeleteNode,
  onDuplicateNode,
  onCreateFile,
  onCreateFolder,
  onMove,
}: KnowledgeTreeProps) {
  const treeRef = useRef<TreeApi<TreeNode>>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ node: null, position: null })

  const treeData = useMemo(() => convertToTreeData(nodes), [nodes])

  const handleContextMenu = useCallback((node: NodeApi<TreeNode>, position: { x: number; y: number }) => {
    setContextMenu({ node, position })
  }, [])

  const handleRename = useCallback(() => {
    if (contextMenu.node) {
      contextMenu.node.edit()
    }
  }, [contextMenu.node])

  const handleRenameSubmit = useCallback(
    (args: { id: string; name: string }) => {
      const node = treeRef.current?.get(args.id)
      if (!node) return

      const oldPath = node.data.path
      const pathParts = oldPath.split('/')
      pathParts[pathParts.length - 1] = args.name
      const newPath = pathParts.join('/')

      onRenameNode(oldPath, newPath)
    },
    [onRenameNode]
  )

  const handleDelete = useCallback(() => {
    if (contextMenu.node) {
      onDeleteNode(contextMenu.node.data.path)
    }
  }, [contextMenu.node, onDeleteNode])

  const handleDuplicate = useCallback(() => {
    if (contextMenu.node) {
      onDuplicateNode(contextMenu.node.data.path)
    }
  }, [contextMenu.node, onDuplicateNode])

  const handleCreateFile = useCallback(() => {
    if (contextMenu.node) {
      onCreateFile(contextMenu.node.data.path)
    }
  }, [contextMenu.node, onCreateFile])

  const handleCreateFolder = useCallback(() => {
    if (contextMenu.node) {
      onCreateFolder(contextMenu.node.data.path)
    }
  }, [contextMenu.node, onCreateFolder])

  const handleMove = useCallback(
    (args: { dragIds: string[]; parentId: string | null; index: number }) => {
      if (args.dragIds.length === 0) return

      const dragPath = args.dragIds[0]
      const targetPath = args.parentId || ''

      onMove(dragPath, targetPath, args.index)
    },
    [onMove]
  )

  const handleSelect = useCallback(
    (nodes: NodeApi<TreeNode>[]) => {
      if (nodes.length > 0) {
        const node = nodes[0]
        if (node.data.type === 'directory') {
          onDirectorySelect(node.data.path)
        } else {
          onFileSelect(node.data.path)
        }
      }
    },
    [onFileSelect, onDirectorySelect]
  )

  return (
    <div className="relative h-full w-full">
      <Tree
        ref={treeRef}
        data={treeData}
        openByDefault={false}
        indent={24}
        rowHeight={36}
        overscanCount={8}
        paddingTop={8}
        paddingBottom={8}
        onRename={handleRenameSubmit}
        onMove={handleMove}
        onSelect={handleSelect}
        disableMultiSelection={false}
        disableDrag={false}
        disableDrop={false}
      >
        {(props) => (
          <NodeRenderer
            {...props}
            onContextMenu={handleContextMenu}
            selectedPath={selectedFilePath}
          />
        )}
      </Tree>

      {contextMenu.node && contextMenu.position && (
        <ContextMenu
          node={contextMenu.node}
          position={contextMenu.position}
          onClose={() => setContextMenu({ node: null, position: null })}
          onRename={handleRename}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onCreateFile={handleCreateFile}
          onCreateFolder={handleCreateFolder}
        />
      )}
    </div>
  )
}
