import '@lmthing/css/components/computer/ide-file-tree.css'
import { useState } from 'react'
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  FilePlus,
  FolderPlus,
  Trash2,
} from 'lucide-react'
import * as ContextMenu from '@radix-ui/react-context-menu'
import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '../../lib/utils'

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

export interface IdeFileTreeProps {
  fileTree: FileTreeNode[]
  activeFile: string | null
  onFileSelect: (path: string) => void
  onCreateFile: (parentPath: string, name: string) => void
  onCreateDirectory: (parentPath: string, name: string) => void
  onDelete: (path: string) => void
}

interface ItemProps {
  node: FileTreeNode
  level: number
  activeFile: string | null
  onFileSelect: (path: string) => void
  onCreateFile: (parentPath: string, name: string) => void
  onCreateDirectory: (parentPath: string, name: string) => void
  onDelete: (path: string) => void
}

function IdeFileTreeItem({ node, level, activeFile, onFileSelect, onCreateFile, onCreateDirectory, onDelete }: ItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [dialogType, setDialogType] = useState<'file' | 'folder' | null>(null)
  const [newName, setNewName] = useState('')
  const isActive = activeFile === node.path

  function handleClick() {
    if (node.type === 'directory') {
      setExpanded(!expanded)
    } else {
      onFileSelect(node.path)
    }
  }

  function handleCreate() {
    if (!newName.trim() || !dialogType) return
    const parent = node.type === 'directory' ? node.path : node.path.split('/').slice(0, -1).join('/') || '.'
    if (dialogType === 'file') onCreateFile(parent, newName.trim())
    else onCreateDirectory(parent, newName.trim())
    setDialogType(null)
    setNewName('')
  }

  return (
    <div>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div
            className={cn('ide-file-tree__item', isActive && 'ide-file-tree__item--active')}
            style={{ paddingLeft: `${level * 12 + 8}px` }}
            onClick={handleClick}
          >
            {node.type === 'directory' ? (
              <>
                {expanded
                  ? <ChevronDown size={16} className="ide-file-tree__icon" />
                  : <ChevronRight size={16} className="ide-file-tree__icon" />}
                {expanded
                  ? <FolderOpen size={16} className="ide-file-tree__icon ide-file-tree__icon--folder" />
                  : <Folder size={16} className="ide-file-tree__icon ide-file-tree__icon--folder" />}
              </>
            ) : (
              <>
                <span style={{ width: 16 }} />
                <File size={16} className="ide-file-tree__icon" />
              </>
            )}
            <span className="ide-file-tree__name">{node.name}</span>
          </div>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content className="ide-file-tree__context-menu">
            <ContextMenu.Item className="ide-file-tree__context-item" onClick={() => setDialogType('file')}>
              <FilePlus size={16} /> New File
            </ContextMenu.Item>
            <ContextMenu.Item className="ide-file-tree__context-item" onClick={() => setDialogType('folder')}>
              <FolderPlus size={16} /> New Folder
            </ContextMenu.Item>
            <ContextMenu.Separator style={{ height: 1, margin: '4px 0', background: 'var(--color-border)' }} />
            <ContextMenu.Item className="ide-file-tree__context-item ide-file-tree__context-item--danger" onClick={() => onDelete(node.path)}>
              <Trash2 size={16} /> Delete
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      <Dialog.Root open={dialogType !== null} onOpenChange={(open) => { if (!open) setDialogType(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="ide-file-tree__dialog-overlay" />
          <Dialog.Content className="ide-file-tree__dialog-content">
            <Dialog.Title className="ide-file-tree__dialog-title">
              New {dialogType === 'folder' ? 'Folder' : 'File'}
            </Dialog.Title>
            <input
              className="ide-file-tree__dialog-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder={dialogType === 'folder' ? 'folder-name' : 'filename.txt'}
              autoFocus
            />
            <div className="ide-file-tree__dialog-actions">
              <button className="btn btn--ghost btn--sm" onClick={() => setDialogType(null)}>Cancel</button>
              <button className="btn btn--primary btn--sm" onClick={handleCreate}>Create</button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {node.type === 'directory' && expanded && node.children?.map((child) => (
        <IdeFileTreeItem
          key={child.path}
          node={child}
          level={level + 1}
          activeFile={activeFile}
          onFileSelect={onFileSelect}
          onCreateFile={onCreateFile}
          onCreateDirectory={onCreateDirectory}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

function IdeFileTree({ fileTree, activeFile, onFileSelect, onCreateFile, onCreateDirectory, onDelete }: IdeFileTreeProps) {
  const [dialogType, setDialogType] = useState<'file' | 'folder' | null>(null)
  const [newName, setNewName] = useState('')

  function handleCreate() {
    if (!newName.trim() || !dialogType) return
    if (dialogType === 'file') onCreateFile('.', newName.trim())
    else onCreateDirectory('.', newName.trim())
    setDialogType(null)
    setNewName('')
  }

  return (
    <div className="ide-file-tree">
      <div className="ide-file-tree__header">
        <span className="ide-file-tree__header-title">Files</span>
        <div className="ide-file-tree__header-actions">
          <button className="ide-file-tree__action-btn" title="New File" onClick={() => setDialogType('file')}>
            <FilePlus size={16} />
          </button>
          <button className="ide-file-tree__action-btn" title="New Folder" onClick={() => setDialogType('folder')}>
            <FolderPlus size={16} />
          </button>
        </div>
      </div>
      <div>
        {fileTree.map((node) => (
          <IdeFileTreeItem
            key={node.path}
            node={node}
            level={0}
            activeFile={activeFile}
            onFileSelect={onFileSelect}
            onCreateFile={onCreateFile}
            onCreateDirectory={onCreateDirectory}
            onDelete={onDelete}
          />
        ))}
      </div>

      <Dialog.Root open={dialogType !== null} onOpenChange={(open) => { if (!open) setDialogType(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="ide-file-tree__dialog-overlay" />
          <Dialog.Content className="ide-file-tree__dialog-content">
            <Dialog.Title className="ide-file-tree__dialog-title">
              New {dialogType === 'folder' ? 'Folder' : 'File'}
            </Dialog.Title>
            <input
              className="ide-file-tree__dialog-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder={dialogType === 'folder' ? 'folder-name' : 'filename.txt'}
              autoFocus
            />
            <div className="ide-file-tree__dialog-actions">
              <button className="btn btn--ghost btn--sm" onClick={() => setDialogType(null)}>Cancel</button>
              <button className="btn btn--primary btn--sm" onClick={handleCreate}>Create</button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

export { IdeFileTree }
