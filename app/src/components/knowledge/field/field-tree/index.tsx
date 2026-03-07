/**
 * FieldTree - React-arborist file tree for knowledge management.
 * Phase 6: CRUD, drag-and-drop, context menu, rename. No Tailwind.
 */
import { useRef, useCallback, useMemo, useState, useImperativeHandle, forwardRef, type CSSProperties } from 'react'
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
  FolderPlus,
} from 'lucide-react'
import type { KnowledgeNode } from '@/types/space-data'
import { Button } from '@/elements/forms/button'
import { Input } from '@/elements/forms/input'
import { Separator } from '@/elements/content/separator'
import { cn } from '@/lib/utils'
import './FieldTree.css'

export interface FieldTreeHandle {
  expandAll: () => void
  collapseAll: () => void
}

export interface FieldTreeProps {
  nodes: KnowledgeNode[]
  selectedFilePath: string | null
  searchQuery?: string
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

function filterTreeNodes(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query) return nodes
  const lower = query.toLowerCase()
  return nodes.reduce<TreeNode[]>((acc, node) => {
    const nameMatches = node.name.toLowerCase().includes(lower)
    const filteredChildren = node.children ? filterTreeNodes(node.children, query) : undefined
    if (nameMatches || (filteredChildren && filteredChildren.length > 0)) {
      acc.push({
        ...node,
        children: filteredChildren,
      })
    }
    return acc
  }, [])
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
}: {
  node: NodeApi<TreeNode>
  position: { x: number; y: number }
  onClose: () => void
  onRename: () => void
  onDelete: () => void
  onDuplicate: () => void
  onCreateFile: () => void
  onCreateFolder: () => void
}) {
  const isDirectory = node.data.type === 'directory'

  return (
    <>
      <div className="field-tree-context-menu__backdrop" onClick={onClose} />
      <div
        className="field-tree-context-menu"
        style={{ left: position.x, top: position.y }}
      >
        {isDirectory && (
          <>
            <button
              onClick={() => { onCreateFile(); onClose() }}
              className="field-tree-context-menu__item"
            >
              <Plus className="field-tree-context-menu__item-icon" />
              New File
            </button>
            <button
              onClick={() => { onCreateFolder(); onClose() }}
              className="field-tree-context-menu__item"
            >
              <FolderPlus className="field-tree-context-menu__item-icon" />
              New Folder
            </button>
            <Separator />
          </>
        )}
        <button
          onClick={() => { onRename(); onClose() }}
          className="field-tree-context-menu__item"
        >
          <Edit3 className="field-tree-context-menu__item-icon" />
          Rename
        </button>
        {!isDirectory && (
          <button
            onClick={() => { onDuplicate(); onClose() }}
            className="field-tree-context-menu__item"
          >
            <Copy className="field-tree-context-menu__item-icon" />
            Duplicate
          </button>
        )}
        <Separator />
        <button
          onClick={() => { onDelete(); onClose() }}
          className="field-tree-context-menu__item field-tree-context-menu__item--destructive"
        >
          <Trash2 className="field-tree-context-menu__item-icon" />
          Delete
        </button>
      </div>
    </>
  )
}

function NodeRenderer({
  node,
  style,
  dragHandle,
  onContextMenu,
  selectedPath,
}: {
  node: NodeApi<TreeNode>
  style: CSSProperties
  dragHandle?: (el: HTMLDivElement | null) => void
  onContextMenu: (node: NodeApi<TreeNode>, position: { x: number; y: number }) => void
  selectedPath: string | null
}) {
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

  const nodeColor = isDirectory && node.data.config?.color
    ? node.data.config.color
    : undefined

  return (
    <div
      ref={dragHandle}
      style={style}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      className={cn(
        'field-tree-node',
        isSelected && 'field-tree-node--selected',
        node.state.isDragging && 'field-tree-node--dragging',
        node.state.willReceiveDrop && 'field-tree-node--drop-target',
      )}
    >
      {isDirectory ? (
        <>
          {node.isOpen ? (
            <ChevronDown className="field-tree-node__icon--chevron" />
          ) : (
            <ChevronRight className="field-tree-node__icon--chevron" />
          )}
          {node.isOpen ? (
            <FolderOpen
              className="field-tree-node__icon field-tree-node__icon--folder"
              style={nodeColor && !isSelected ? { color: nodeColor } : undefined}
            />
          ) : (
            <Folder
              className="field-tree-node__icon field-tree-node__icon--folder"
              style={nodeColor && !isSelected ? { color: nodeColor } : undefined}
            />
          )}
        </>
      ) : (
        <>
          <span className="field-tree-node__spacer" />
          <FileText className="field-tree-node__icon field-tree-node__icon--file" />
        </>
      )}

      {node.isEditing ? (
        <Input
          type="text"
          defaultValue={node.data.name}
          autoFocus
          onBlur={() => node.reset()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') node.reset()
            else if (e.key === 'Enter') node.submit(e.currentTarget.value)
          }}
          onClick={(e) => e.stopPropagation()}
          style={{ flex: 1 }}
        />
      ) : (
        <>
          <span className="field-tree-node__label">{node.data.name}</span>
          <div className="field-tree-node__actions">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                const rect = (e.target as HTMLElement).getBoundingClientRect()
                onContextMenu(node, { x: rect.left, y: rect.bottom + 4 })
              }}
            >
              <MoreVertical className="field-tree-node__icon" />
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

export const FieldTree = forwardRef<FieldTreeHandle, FieldTreeProps>(function FieldTree({
  nodes,
  selectedFilePath,
  searchQuery,
  onFileSelect,
  onDirectorySelect,
  onRenameNode,
  onDeleteNode,
  onDuplicateNode,
  onCreateFile,
  onCreateFolder,
  onMove,
}, ref) {
  const treeRef = useRef<TreeApi<TreeNode>>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ node: null, position: null })

  useImperativeHandle(ref, () => ({
    expandAll: () => treeRef.current?.openAll(),
    collapseAll: () => treeRef.current?.closeAll(),
  }), [])

  const treeData = useMemo(() => {
    const converted = convertToTreeData(nodes)
    return searchQuery ? filterTreeNodes(converted, searchQuery) : converted
  }, [nodes, searchQuery])

  const handleContextMenu = useCallback((node: NodeApi<TreeNode>, position: { x: number; y: number }) => {
    setContextMenu({ node, position })
  }, [])

  const handleRename = useCallback(() => {
    if (contextMenu.node) contextMenu.node.edit()
  }, [contextMenu.node])

  const handleRenameSubmit = useCallback(
    (args: { id: string; name: string }) => {
      const node = treeRef.current?.get(args.id)
      if (!node) return
      const oldPath = node.data.path
      const pathParts = oldPath.split('/')
      pathParts[pathParts.length - 1] = args.name
      onRenameNode(oldPath, pathParts.join('/'))
    },
    [onRenameNode]
  )

  const handleDelete = useCallback(() => {
    if (contextMenu.node) onDeleteNode(contextMenu.node.data.path)
  }, [contextMenu.node, onDeleteNode])

  const handleDuplicate = useCallback(() => {
    if (contextMenu.node) onDuplicateNode(contextMenu.node.data.path)
  }, [contextMenu.node, onDuplicateNode])

  const handleCreateFile = useCallback(() => {
    if (contextMenu.node) onCreateFile(contextMenu.node.data.path)
  }, [contextMenu.node, onCreateFile])

  const handleCreateFolder = useCallback(() => {
    if (contextMenu.node) onCreateFolder(contextMenu.node.data.path)
  }, [contextMenu.node, onCreateFolder])

  const handleMove = useCallback(
    (args: { dragIds: string[]; parentId: string | null; index: number }) => {
      if (args.dragIds.length === 0) return
      onMove(args.dragIds[0], args.parentId || '', args.index)
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
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
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
})
