'use client'

import { useState, useRef, useCallback, useMemo, useEffect, type MouseEvent } from 'react'
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  MoreVertical,
  X,
  FileText,
  AlertCircle,
  Loader2,
  Search,
  FolderPlus,
  FilePlus,
  Copy,
  Trash2,
  Edit3,
  PanelLeft,
  PanelRight,
  Type,
  Bold,
  Italic,
  List,
  ListOrdered,
  Code,
  Link2,
  Quote,
  Minus,
} from 'lucide-react'
import type {
  PromptLibraryProps,
  FileSystemNode,
  PromptFragment,
  Directory,
  DirectoryConfig,
  NewFileForm,
  NewFolderForm,
  UnsavedChangesAction,
  PromptFrontmatter,
} from '@/../product/sections/prompt-library/types'

// ============================================================================
// SUB-COMPONENT: Context Menu
// ============================================================================

interface ContextMenuProps {
  node: FileSystemNode
  onClose: () => void
  onRename: () => void
  onMove: () => void
  onEditConfig: () => void
  onDelete: () => void
  onDuplicate: () => void
  position: { x: number; y: number }
}

function ContextMenu({ node, onClose, onRename, onMove, onEditConfig, onDelete, onDuplicate, position }: ContextMenuProps) {
  const isDirectory = node.type === 'directory'

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 min-w-[180px] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
        style={{ left: position.x, top: position.y }}
      >
        <button
          onClick={() => { onRename(); onClose() }}
          className="w-full px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-950/30 flex items-center gap-3 transition-colors"
        >
          <Edit3 className="w-4 h-4 text-slate-400" />
          Rename
        </button>
        {isDirectory && (
          <button
            onClick={() => { onMove(); onClose() }}
            className="w-full px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-950/30 flex items-center gap-3 transition-colors"
          >
            <Folder className="w-4 h-4 text-slate-400" />
            Move to...
          </button>
        )}
        {isDirectory && (
          <button
            onClick={() => { onEditConfig(); onClose() }}
            className="w-full px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-950/30 flex items-center gap-3 transition-colors"
          >
            <Edit3 className="w-4 h-4 text-slate-400" />
            Edit config
          </button>
        )}
        {!isDirectory && (
          <button
            onClick={() => { onDuplicate(); onClose() }}
            className="w-full px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-950/30 flex items-center gap-3 transition-colors"
          >
            <Copy className="w-4 h-4 text-slate-400" />
            Duplicate
          </button>
        )}
        <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
        <button
          onClick={() => { onDelete(); onClose() }}
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
// SUB-COMPONENT: File Tree Node
// ============================================================================

interface TreeNodeProps {
  node: FileSystemNode
  level: number
  isExpanded: (path: string) => boolean
  isSelected: (id: string) => boolean
  hasUnsaved: (id: string) => boolean
  onToggle: (path: string) => void
  onSelect: (file: PromptFragment) => void
  onSelectDirectory: (directory: Directory) => void
  onContextMenu: (node: FileSystemNode, position: { x: number; y: number }) => void
}

function TreeNode({
  node,
  level,
  isExpanded,
  isSelected,
  hasUnsaved,
  onToggle,
  onSelect,
  onSelectDirectory,
  onContextMenu,
}: TreeNodeProps) {
  const isDir = node.type === 'directory'
  const selected = isSelected(node.id)
  const unsaved = !isDir && hasUnsaved(node.id)
  const hasChildren = isDir && node.children && node.children.length > 0

  const handleClick = () => {
    if (isDir) {
      onToggle(node.path)
      onSelectDirectory(node as Directory)
    } else {
      onSelect(node as PromptFragment)
    }
  }

  const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    onContextMenu(node, { x: e.clientX, y: e.clientY })
  }

  const getNodeColor = () => {
    if (isDir && (node as Directory).config?.color) {
      return (node as Directory).config?.color
    }
    return undefined
  }

  const nodeColor = getNodeColor()

  return (
    <div>
      <div
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className={`
          group flex items-center gap-2 py-2 px-2.5 mx-1.5 rounded-lg cursor-pointer
          transition-all duration-150 relative
          ${selected
            ? 'bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-md shadow-violet-500/25'
            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
          }
        `}
        style={{ paddingLeft: `${level * 16 + 10}px` }}
      >
        {isDir ? (
          <>
            {isExpanded(node.path) ? (
              <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 ${selected ? 'text-white' : 'text-slate-400 group-hover:text-slate-500'}`} />
            ) : (
              <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${selected ? 'text-white' : 'text-slate-400 group-hover:text-slate-500'}`} />
            )}
            {isExpanded(node.path) ? (
              <FolderOpen className="w-4 h-4 flex-shrink-0" style={{ color: selected ? '#fff' : nodeColor || '#8b5cf6' }} />
            ) : (
              <Folder className="w-4 h-4 flex-shrink-0" style={{ color: selected ? '#fff' : nodeColor || '#8b5cf6' }} />
            )}
          </>
        ) : (
          <>
            <span className="w-6 flex-shrink-0" />
            <FileText className={`w-4 h-4 flex-shrink-0 ${selected ? 'text-white' : 'text-slate-400 group-hover:text-slate-500'}`} />
          </>
        )}
        <span className={`text-sm font-medium truncate flex-1 ${selected ? 'text-white' : ''}`}>
          {node.name}
        </span>

        {/* Unsaved indicator */}
        {unsaved && (
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${selected ? 'bg-amber-200' : 'bg-amber-500'}`} title="Unsaved changes" />
        )}

        {/* More options button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            const rect = (e.target as HTMLElement).getBoundingClientRect()
            onContextMenu(node, { x: rect.left, y: rect.bottom + 4 })
          }}
          className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all flex-shrink-0 ${selected ? 'hover:bg-white/20' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}
        >
          <MoreVertical className={`w-3.5 h-3.5 ${selected ? 'text-white' : 'text-slate-400'}`} />
        </button>
      </div>

      {isDir && isExpanded(node.path) && hasChildren && (
        <div className="relative">
          {/* Tree guide line */}
          <div className="absolute left-[18px] top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700" style={{ transform: `translateX(${level * 16}px)` }} />
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              isExpanded={isExpanded}
              isSelected={isSelected}
              hasUnsaved={hasUnsaved}
              onToggle={onToggle}
              onSelect={onSelect}
              onSelectDirectory={onSelectDirectory}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// SUB-COMPONENT: Unsaved Changes Modal
// ============================================================================

interface UnsavedChangesModalProps {
  isOpen: boolean
  fileName: string
  onClose: () => void
  onAction: (action: UnsavedChangesAction) => void
}

function UnsavedChangesModal({ isOpen, fileName, onClose, onAction }: UnsavedChangesModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Warning gradient header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Unsaved Changes</h3>
              <p className="text-amber-100 text-sm mt-0.5">Your changes will be lost</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <p className="text-slate-700 dark:text-slate-300 mb-1">
            You have unsaved changes in <span className="font-semibold text-slate-900 dark:text-slate-100">"{fileName}"</span>.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Would you like to save them before continuing?
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => onAction('discard')}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Discard
            </button>
            <button
              onClick={() => onAction('cancel')}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onAction('save')}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-violet-500 rounded-lg hover:bg-violet-600 transition-colors shadow-lg shadow-violet-500/25"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SUB-COMPONENT: Delete Confirmation Modal
// ============================================================================

interface DeleteModalProps {
  isOpen: boolean
  nodeName: string
  isDirectory: boolean
  onClose: () => void
  onConfirm: () => void
}

function DeleteModal({ isOpen, nodeName, isDirectory, onClose, onConfirm }: DeleteModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Danger gradient header */}
        <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <Trash2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Delete {isDirectory ? 'Folder' : 'File'}</h3>
              <p className="text-red-100 text-sm mt-0.5">This action cannot be undone</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <p className="text-slate-700 dark:text-slate-300 mb-1">
            Are you sure you want to delete <span className="font-semibold text-slate-900 dark:text-slate-100">"{nodeName}"</span>?
          </p>
          {isDirectory && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              All contents will be deleted recursively
            </p>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { onConfirm(); onClose() }}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors shadow-lg shadow-red-500/25"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SUB-COMPONENT: New File Modal
// ============================================================================

interface NewFileModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (form: NewFileForm) => void
  directories: Directory[]
  parentPath: string
  validationErrors?: { field: string; message: string }[]
}

function NewFileModal({ isOpen, onClose, onSubmit, directories, parentPath, validationErrors = [] }: NewFileModalProps) {
  const [filename, setFilename] = useState('')
  const [selectedParent, setSelectedParent] = useState(parentPath)

  useEffect(() => {
    if (isOpen) {
      setFilename('')
      const initialParent = parentPath === '/' ? (directories[0]?.path || '/') : parentPath
      setSelectedParent(initialParent)
    }
  }, [isOpen, parentPath, directories])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (filename.trim()) {
      const parent = selectedParent || directories[0]?.path || '/'
      onSubmit({
        filename: filename.trim().endsWith('.md') ? filename.trim() : `${filename.trim()}.md`,
        parentPath: parent,
      })
    }
  }

  const flattenDirectories = (dir: Directory, prefix = ''): Array<{ path: string; label: string }> => {
    const items = [{ path: dir.path, label: prefix + (dir.config?.label || dir.name) }]
    if (dir.children) {
      dir.children.forEach((child) => {
        if (child.type === 'directory') {
          items.push(...flattenDirectories(child, prefix + child.name + ' / '))
        }
      })
    }
    return items
  }

  const dirOptions = flattenDirectories(directories[0])

  const getError = (field: string) => validationErrors.find(e => e.field === field)?.message

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="bg-gradient-to-r from-violet-500 to-violet-600 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <FilePlus className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">New Prompt Fragment</h3>
              <p className="text-violet-100 text-sm mt-0.5">Create a new markdown file</p>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Filename
            </label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="my-prompt-fragment"
              className={`
                w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border rounded-lg
                focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:text-white transition-all
                ${getError('filename') ? 'border-red-300 dark:border-red-600' : 'border-slate-300 dark:border-slate-600'}
              `}
              autoFocus
            />
            {getError('filename') && (
              <p className="text-xs text-red-500 mt-1.5">{getError('filename')}</p>
            )}
            <p className="text-xs text-slate-500 mt-1.5">.md extension will be added automatically</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Location
            </label>
            <select
              value={selectedParent}
              onChange={(e) => setSelectedParent(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:text-white transition-all"
            >
              {dirOptions.map((dir) => (
                <option key={dir.path} value={dir.path}>
                  {dir.label || '/ (root)'}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-violet-500 rounded-lg hover:bg-violet-600 transition-colors shadow-lg shadow-violet-500/25"
            >
              Create File
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================================
// SUB-COMPONENT: New Folder Modal
// ============================================================================

interface NewFolderModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (form: NewFolderForm) => void
  directories: Directory[]
  parentPath: string
  validationErrors?: { field: string; message: string }[]
}

function NewFolderModal({ isOpen, onClose, onSubmit, directories, parentPath, validationErrors = [] }: NewFolderModalProps) {
  const [folderName, setFolderName] = useState('')
  const [selectedParent, setSelectedParent] = useState(parentPath)

  useEffect(() => {
    if (isOpen) {
      setFolderName('')
      const initialParent = parentPath === '/' ? (directories[0]?.path || '/') : parentPath
      setSelectedParent(initialParent)
    }
  }, [isOpen, parentPath, directories])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (folderName.trim()) {
      const parent = selectedParent || directories[0]?.path || '/'
      onSubmit({
        folderName: folderName.trim().toLowerCase().replace(/\s+/g, '-'),
        parentPath: parent,
      })
    }
  }

  const flattenDirectories = (dir: Directory, prefix = ''): Array<{ path: string; label: string }> => {
    const items = [{ path: dir.path, label: prefix + (dir.config?.label || dir.name) }]
    if (dir.children) {
      dir.children.forEach((child) => {
        if (child.type === 'directory') {
          items.push(...flattenDirectories(child, prefix + child.name + ' / '))
        }
      })
    }
    return items
  }

  const dirOptions = flattenDirectories(directories[0])
  const getError = (field: string) => validationErrors.find(e => e.field === field)?.message

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <FolderPlus className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">New Folder</h3>
              <p className="text-amber-100 text-sm mt-0.5">Create a new directory</p>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Folder Name
            </label>
            <input
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="my-folder"
              className={`
                w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border rounded-lg
                focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:text-white transition-all
                ${getError('folderName') ? 'border-red-300 dark:border-red-600' : 'border-slate-300 dark:border-slate-600'}
              `}
              autoFocus
            />
            {getError('folderName') && (
              <p className="text-xs text-red-500 mt-1.5">{getError('folderName')}</p>
            )}
            <p className="text-xs text-slate-500 mt-1.5">Use lowercase with hyphens</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Parent Location
            </label>
            <select
              value={selectedParent}
              onChange={(e) => setSelectedParent(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:text-white transition-all"
            >
              {dirOptions.map((dir) => (
                <option key={dir.path} value={dir.path}>
                  {dir.label || '/ (root)'}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/25"
            >
              Create Folder
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================================
// SUB-COMPONENT: Rename Modal
// ============================================================================

interface RenameModalProps {
  isOpen: boolean
  nodeName: string
  onClose: () => void
  onSubmit: (newName: string) => void
  validationErrors?: { field: string; message: string }[]
}

function RenameModal({ isOpen, nodeName, onClose, onSubmit, validationErrors = [] }: RenameModalProps) {
  const [newName, setNewName] = useState(nodeName)

  useEffect(() => {
    if (isOpen) {
      setNewName(nodeName)
    }
  }, [isOpen, nodeName])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newName.trim() && newName.trim() !== nodeName) {
      onSubmit(newName.trim())
      onClose()
    }
  }

  const getError = (field: string) => validationErrors.find(e => e.field === field)?.message

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <Edit3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Rename</h3>
              <p className="text-slate-300 text-sm mt-0.5">Enter a new name</p>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              New Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={`
                w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border rounded-lg
                focus:ring-2 focus:ring-slate-500 focus:border-slate-500 dark:text-white transition-all
                ${getError('name') ? 'border-red-300 dark:border-red-600' : 'border-slate-300 dark:border-slate-600'}
              `}
              autoFocus
            />
            {getError('name') && (
              <p className="text-xs text-red-500 mt-1.5">{getError('name')}</p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Rename
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================================
// SUB-COMPONENT: Metadata Panel
// ============================================================================

interface MetadataPanelProps {
  frontmatter: PromptFrontmatter | undefined
  onChange: (frontmatter: PromptFrontmatter) => void
  fileName: string
  filePath: string
}

function MetadataPanel({ frontmatter, onChange, fileName, filePath }: MetadataPanelProps) {
  const [localFrontmatter, setLocalFrontmatter] = useState<PromptFrontmatter>(frontmatter || {})

  useEffect(() => {
    setLocalFrontmatter(frontmatter || {})
  }, [frontmatter])

  const handleChange = (key: keyof PromptFrontmatter, value: string | string[]) => {
    const updated = { ...localFrontmatter, [key]: value }
    setLocalFrontmatter(updated)
    onChange(updated)
  }

  const handleTagsChange = (value: string) => {
    const tags = value.split(',').map(t => t.trim()).filter(Boolean)
    handleChange('tags', tags)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Metadata</h4>
        <span className="text-xs text-slate-500 dark:text-slate-400">YAML Frontmatter</span>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Title</label>
          <input
            type="text"
            value={localFrontmatter.title || ''}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="Enter title..."
            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:text-white transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Category</label>
          <input
            type="text"
            value={localFrontmatter.category || ''}
            onChange={(e) => handleChange('category', e.target.value)}
            placeholder="e.g., basics, networking, security"
            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:text-white transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Tags</label>
          <input
            type="text"
            value={(localFrontmatter.tags || []).join(', ')}
            onChange={(e) => handleTagsChange(e.target.value)}
            placeholder="Comma-separated tags..."
            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:text-white transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Author</label>
          <input
            type="text"
            value={localFrontmatter.author || ''}
            onChange={(e) => handleChange('author', e.target.value)}
            placeholder="Author name..."
            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:text-white transition-all"
          />
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">File Info</p>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-mono truncate">{fileName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-500 truncate">{filePath}</p>
        </div>
      </div>
    </div>
  )
}

interface DirectoryMetadataPanelProps {
  config: DirectoryConfig | undefined
  onChange: (config: DirectoryConfig) => void
  directoryName: string
  directoryPath: string
}

function DirectoryMetadataPanel({ config, onChange, directoryName, directoryPath }: DirectoryMetadataPanelProps) {
  const [localConfig, setLocalConfig] = useState<DirectoryConfig>(config || {})

  useEffect(() => {
    setLocalConfig(config || {})
  }, [config])

  const handleChange = (key: keyof DirectoryConfig, value: unknown) => {
    const updated = { ...localConfig, [key]: value }
    setLocalConfig(updated)
    onChange(updated)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Directory Metadata</h4>
        <span className="text-xs text-slate-500 dark:text-slate-400">config.json</span>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Label</label>
          <input
            type="text"
            value={(localConfig.label as string) || ''}
            onChange={(e) => handleChange('label', e.target.value)}
            placeholder="Human-readable folder label"
            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:text-white transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Description</label>
          <textarea
            value={(localConfig.description as string) || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Describe this directory's purpose"
            rows={3}
            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:text-white transition-all"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Icon</label>
            <input
              type="text"
              value={(localConfig.icon as string) || ''}
              onChange={(e) => handleChange('icon', e.target.value)}
              placeholder="📁 or icon id"
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:text-white transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Color</label>
            <input
              type="text"
              value={(localConfig.color as string) || ''}
              onChange={(e) => handleChange('color', e.target.value)}
              placeholder="e.g. #6366f1"
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:text-white transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Render As</label>
            <select
              value={(localConfig.renderAs as string) || ''}
              onChange={(e) => handleChange('renderAs', e.target.value || undefined)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:text-white transition-all"
            >
              <option value="">Default</option>
              <option value="section">section</option>
              <option value="field">field</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Field Type</label>
            <select
              value={(localConfig.fieldType as string) || ''}
              onChange={(e) => handleChange('fieldType', e.target.value || undefined)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:text-white transition-all"
            >
              <option value="">Default</option>
              <option value="text">text</option>
              <option value="textarea">textarea</option>
              <option value="select">select</option>
              <option value="multiselect">multiselect</option>
              <option value="toggle">toggle</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Variable Name</label>
          <input
            type="text"
            value={(localConfig.variableName as string) || ''}
            onChange={(e) => handleChange('variableName', e.target.value)}
            placeholder="Variable key used in templates"
            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:text-white transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Placeholder</label>
          <input
            type="text"
            value={(localConfig.placeholder as string) || ''}
            onChange={(e) => handleChange('placeholder', e.target.value)}
            placeholder="Input placeholder"
            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:text-white transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Hint</label>
          <textarea
            value={(localConfig.hint as string) || ''}
            onChange={(e) => handleChange('hint', e.target.value)}
            placeholder="Hint shown below the field"
            rows={2}
            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:text-white transition-all"
          />
        </div>

        <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
          <input
            type="checkbox"
            checked={Boolean(localConfig.required)}
            onChange={(e) => handleChange('required', e.target.checked)}
            className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
          />
          Required
        </label>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">Directory Info</p>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-mono truncate">{directoryName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-500 truncate">{directoryPath}</p>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SUB-COMPONENT: WYSIWYG Editor
// ============================================================================

interface WysiwygEditorProps {
  content: string
  onChange: (content: string) => void
  onSave: () => void
  unsavedChanges: boolean
  isLoading?: boolean
}

function WysiwygEditor({ content, onChange, onSave, unsavedChanges: _unsavedChanges, isLoading: _isLoading = false }: WysiwygEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showPreview, setShowPreview] = useState(false)

  const insertFormat = (before: string, after: string = '', placeholder: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end) || placeholder
    const newText = content.substring(0, start) + before + selectedText + after + content.substring(end)

    onChange(newText)

    // Restore cursor position
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length)
    }, 0)
  }

  const formatButtons = [
    { icon: Bold, label: 'Bold', action: () => insertFormat('**', '**', 'bold text') },
    { icon: Italic, label: 'Italic', action: () => insertFormat('*', '*', 'italic text') },
    { icon: Type, label: 'Heading', action: () => insertFormat('## ', '', 'Heading') },
    { icon: List, label: 'Bullet List', action: () => insertFormat('- ', '', 'list item') },
    { icon: ListOrdered, label: 'Numbered List', action: () => insertFormat('1. ', '', 'list item') },
    { icon: Code, label: 'Code Block', action: () => insertFormat('\n```\n', '\n```\n', 'code') },
    { icon: Code, label: 'Inline Code', action: () => insertFormat('`', '`', 'code'), inlineOnly: true },
    { icon: Link2, label: 'Link', action: () => insertFormat('[', '](url)', 'link text') },
    { icon: Quote, label: 'Blockquote', action: () => insertFormat('> ', '', 'quote') },
    { icon: Minus, label: 'Horizontal Rule', action: () => insertFormat('\n---\n', '', '') },
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1">
          {formatButtons.map((btn) => (
            <button
              key={btn.label}
              onClick={btn.action}
              className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
              title={btn.label}
            >
              <btn.icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`
              p-2 rounded-lg transition-colors text-sm font-medium flex items-center gap-1.5
              ${showPreview
                ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'
              }
            `}
          >
            {showPreview ? <Edit3 className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
            <span className="hidden sm:inline">{showPreview ? 'Edit' : 'Preview'}</span>
          </button>
        </div>
      </div>

      {/* Editor/Preview Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Text Editor */}
        <div className={`flex-1 overflow-hidden min-h-0 ${showPreview ? 'hidden' : ''}`}>
          <style>{`
            .editor-scroll::-webkit-scrollbar {
              width: 10px;
            }
            .editor-scroll::-webkit-scrollbar-track {
              background: rgb(248 250 252);
            }
            .editor-scroll::-webkit-scrollbar-thumb {
              background: rgb(203 213 225);
              border-radius: 5px;
              border: 2px solid rgb(248 250 252);
            }
            .editor-scroll::-webkit-scrollbar-thumb:hover {
              background: rgb(148 163 184);
            }
            .dark .editor-scroll::-webkit-scrollbar-track {
              background: rgb(15 23 42);
            }
            .dark .editor-scroll::-webkit-scrollbar-thumb {
              background: rgb(51 65 85);
              border: 2px solid rgb(15 23 42);
            }
            .dark .editor-scroll::-webkit-scrollbar-thumb:hover {
              background: rgb(71 85 105);
            }
          `}</style>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              // Handle Ctrl/Cmd + S for save
              if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault()
                onSave()
              }
              // Handle Tab for indentation
              if (e.key === 'Tab') {
                e.preventDefault()
                const start = textareaRef.current?.selectionStart || 0
                const end = textareaRef.current?.selectionEnd || 0
                const newValue = content.substring(0, start) + '  ' + content.substring(end)
                onChange(newValue)
                setTimeout(() => {
                  textareaRef.current?.setSelectionRange(start + 2, start + 2)
                }, 0)
              }
            }}
            className="editor-scroll w-full h-full resize-none outline-none font-mono text-sm leading-relaxed bg-transparent dark:text-slate-200 placeholder-slate-300 dark:placeholder-slate-600 p-6 overflow-y-auto overflow-x-hidden"
            placeholder="Start writing your prompt fragment..."
            spellCheck={false}
          />
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
            <style>{`
              .preview-scroll::-webkit-scrollbar {
                width: 8px;
              }
              .preview-scroll::-webkit-scrollbar-track {
                background: transparent;
              }
              .preview-scroll::-webkit-scrollbar-thumb {
                background: rgb(203 213 225);
                border-radius: 4px;
              }
              .preview-scroll::-webkit-scrollbar-thumb:hover {
                background: rgb(148 163 184);
              }
              .dark .preview-scroll::-webkit-scrollbar-thumb {
                background: rgb(51 65 85);
              }
              .dark .preview-scroll::-webkit-scrollbar-thumb:hover {
                background: rgb(71 85 105);
              }
            `}</style>
            <div
              className="prose prose-slate dark:prose-invert max-w-none prose-sm"
              dangerouslySetInnerHTML={{
                __html: content
                  .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                  .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                  .replace(/^# (.*$)/gm, '<h1>$1</h1>')
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  .replace(/\*(.*?)\*/g, '<em>$1</em>')
                  .replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-violet-600 dark:text-violet-400">$1</code>')
                  .replace(/^- (.*$)/gm, '<li>$1</li>')
                  .replace(/^(\d+)\. (.*$)/gm, '<li>$2</li>')
                  .replace(/^> (.*$)/gm, '<blockquote class="border-l-4 border-violet-500 pl-4 italic">$1</blockquote>')
                  .replace(/\n/g, '<br>')
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PromptLibrary({
  fileSystem,
  selectedFile,
  expandedFolders,
  unsavedChanges,
  isLoading = false,
  error = null,
  validationErrors = [],
  emptyState: _emptyState,
  onSelectFile,
  onToggleFolder,
  onExpandAll,
  onCollapseAll,
  onEditContent,
  onEditFrontmatter,
  onEditDirectoryConfig,
  onSave,
  onUnsavedChangesAction,
  onCreateFile,
  onCreateFolder,
  onRename,
  onMove,
  onDelete,
  onDuplicate,
  onDismissError,
}: PromptLibraryProps) {
  // State
  const [contextMenu, setContextMenu] = useState<{
    node: FileSystemNode | null
    position: { x: number; y: number }
  }>({ node: null, position: { x: 0, y: 0 } })
  const [showNewFileModal, setShowNewFileModal] = useState(false)
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showUnsavedModal, setShowUnsavedModal] = useState(false)
  const [pendingFileId, setPendingFileId] = useState<string | null>(null)
  const [editorContent, setEditorContent] = useState(selectedFile?.content || '')
  const [searchQuery, setSearchQuery] = useState('')
  const [newFileParentPath, setNewFileParentPath] = useState(fileSystem.path || '/')
  const [showMetadata, setShowMetadata] = useState(false)
  const [localFrontmatter, setLocalFrontmatter] = useState<PromptFrontmatter | undefined>(selectedFile?.frontmatter)
  const [selectedDirectory, setSelectedDirectory] = useState<Directory | null>(null)
  const [localDirectoryConfig, setLocalDirectoryConfig] = useState<DirectoryConfig | undefined>(undefined)

  // Track unsaved files
  const isFileUnsaved = (fileId: string) => {
    return selectedFile?.id === fileId && unsavedChanges
  }

  // Update editor content when selection changes
  const handleSelectFile = useCallback((file: PromptFragment) => {
    if (unsavedChanges && selectedFile) {
      setPendingFileId(file.id)
      setShowUnsavedModal(true)
      return
    }

    setEditorContent(file.content)
    setNewFileParentPath(file.path.substring(0, file.path.lastIndexOf('/')) || '/')
    setLocalFrontmatter(file.frontmatter)
    setSelectedDirectory(null)
    onSelectFile(file)
  }, [unsavedChanges, selectedFile, onSelectFile])

  const handleSelectDirectory = useCallback((directory: Directory) => {
    setSelectedDirectory(directory)
    setLocalDirectoryConfig(directory.config)
    setNewFileParentPath(directory.path)
  }, [])

  const handleEditDirectoryConfigFromMenu = useCallback(() => {
    const node = contextMenu.node
    if (!node || node.type !== 'directory') {
      return
    }

    setSelectedDirectory(node)
    setLocalDirectoryConfig(node.config)
    setNewFileParentPath(node.path)
    setShowMetadata(true)
  }, [contextMenu.node])

  const handleUnsavedAction = useCallback((action: UnsavedChangesAction) => {
    setShowUnsavedModal(false)

    switch (action) {
      case 'save':
        onSave()
        if (pendingFileId && onUnsavedChangesAction) {
          onUnsavedChangesAction(action)
        }
        break
      case 'discard':
        if (onUnsavedChangesAction) {
          onUnsavedChangesAction(action)
        }
        break
      case 'cancel':
        // Do nothing, stay on current file
        break
    }

    setPendingFileId(null)
  }, [onSave, onUnsavedChangesAction, pendingFileId])

  const handleEditContent = useCallback((content: string) => {
    setEditorContent(content)

    onEditContent(content)
  }, [onEditContent])

  const handleSave = useCallback(() => {
    onSave()
  }, [onSave])

  const handleContextMenu = useCallback((node: FileSystemNode, position: { x: number; y: number }) => {
    setContextMenu({ node, position })
  }, [])

  const closeContextMenu = useCallback(() => {
    setContextMenu({ node: null, position: { x: 0, y: 0 } })
  }, [])

  const handleRename = useCallback(() => {
    closeContextMenu()
    setShowRenameModal(true)
  }, [closeContextMenu])

  const handleRenameSubmit = useCallback((newName: string) => {
    if (contextMenu.node) {
      onRename(contextMenu.node.id, newName)
    }
  }, [contextMenu.node, onRename])

  const handleMove = useCallback(() => {
    closeContextMenu()
    if (contextMenu.node) {
      onMove(contextMenu.node.id, '')
    }
  }, [closeContextMenu, contextMenu.node, onMove])

  const handleDelete = useCallback(() => {
    closeContextMenu()
    setShowDeleteModal(true)
  }, [closeContextMenu])

  const handleDeleteConfirm = useCallback(() => {
    if (contextMenu.node) {
      onDelete(contextMenu.node.id)
    }
  }, [contextMenu.node, onDelete])

  const handleDuplicate = useCallback(() => {
    closeContextMenu()
    if (contextMenu.node) {
      onDuplicate?.(contextMenu.node.id)
    }
  }, [closeContextMenu, contextMenu.node, onDuplicate])

  const handleCreateFile = useCallback((form: NewFileForm) => {
    setShowNewFileModal(false)
    const parentPath =
      form.parentPath === '/' && fileSystem.path && fileSystem.path !== '/'
        ? fileSystem.path
        : form.parentPath

    onCreateFile({
      ...form,
      parentPath,
    })
  }, [onCreateFile, fileSystem.path])

  const handleCreateFolder = useCallback((form: NewFolderForm) => {
    setShowNewFolderModal(false)
    const parentPath =
      form.parentPath === '/' && fileSystem.path && fileSystem.path !== '/'
        ? fileSystem.path
        : form.parentPath

    onCreateFolder({
      ...form,
      parentPath,
    })
  }, [onCreateFolder, fileSystem.path])

  const handleFrontmatterChange = useCallback((frontmatter: PromptFrontmatter) => {
    setLocalFrontmatter(frontmatter)
    onEditFrontmatter?.(frontmatter)
  }, [onEditFrontmatter])

  const handleDirectoryConfigChange = useCallback((config: DirectoryConfig) => {
    setLocalDirectoryConfig(config)
    if (selectedDirectory?.path) {
      onEditDirectoryConfig?.(selectedDirectory.path, config)
    }
  }, [onEditDirectoryConfig, selectedDirectory])

  // Update frontmatter when selection changes
  useEffect(() => {
    if (selectedFile) {
      setLocalFrontmatter(selectedFile.frontmatter)
    } else {
      setLocalFrontmatter(undefined)
    }
  }, [selectedFile])

  useEffect(() => {
    if (newFileParentPath === '/' && fileSystem.path && fileSystem.path !== '/') {
      setNewFileParentPath(fileSystem.path)
    }
  }, [fileSystem.path, newFileParentPath])

  useEffect(() => {
    if (!selectedDirectory) {
      setLocalDirectoryConfig(undefined)
      return
    }

    const findDirectoryByPath = (node: FileSystemNode, targetPath: string): Directory | null => {
      if (node.type === 'directory') {
        if (node.path === targetPath) {
          return node
        }
        for (const child of node.children || []) {
          const found = findDirectoryByPath(child, targetPath)
          if (found) return found
        }
      }
      return null
    }

    const refreshed = findDirectoryByPath(fileSystem, selectedDirectory.path)
    if (refreshed) {
      setSelectedDirectory(refreshed)
      setLocalDirectoryConfig(refreshed.config)
    }
  }, [fileSystem, selectedDirectory])

  // Filter tree nodes based on search
  const filterNodes = (nodes: FileSystemNode[], query: string): FileSystemNode[] => {
    if (!query) return nodes

    const filtered: FileSystemNode[] = []
    const lowerQuery = query.toLowerCase()

    nodes.forEach((node) => {
      const matchesSearch = node.name.toLowerCase().includes(lowerQuery)

      if (node.type === 'directory') {
        const filteredChildren = filterNodes(node.children || [], query)
        if (matchesSearch || filteredChildren.length > 0) {
          filtered.push({ ...node, children: filteredChildren })
        }
      } else if (matchesSearch) {
        filtered.push(node)
      }
    })

    return filtered
  }

  const filteredTree = {
    ...fileSystem,
    children: filterNodes(fileSystem.children || [], searchQuery),
  }

  const totalItems = useMemo(() => {
    const count = (node: FileSystemNode): number => {
      if (node.type === 'file') return 1
      return 1 + (node.children?.reduce((sum, child) => sum + count(child), 0) || 0)
    }

    const total = fileSystem.children?.reduce((sum, child) => sum + count(child), 0) || 0

    // If there is a single top-level directory wrapper, exclude it from the count.
    const hasSingleWrapperDirectory =
      fileSystem.path === '/' &&
      (fileSystem.children?.length || 0) === 1 &&
      fileSystem.children?.[0]?.type === 'directory'

    return hasSingleWrapperDirectory ? total - 1 : total
  }, [fileSystem])

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* ========== FILE TREE SIDEBAR ========== */}
      <aside className="w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden flex-shrink-0">
        {/* Sidebar Header */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-violet-500" />
                Knowledge Base
              </h2>
              <p className="text-xs text-slate-500 mt-1">Add the documents, rules, and context your agent needs to understand your specific knowledge.</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowNewFileModal(true)}
                className="p-1.5 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-950/30 text-slate-600 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                title="New File"
              >
                <FilePlus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowNewFolderModal(true)}
                className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/30 text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                title="New Folder"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-2.5">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 border-0 rounded-lg focus:ring-2 focus:ring-violet-500 dark:text-slate-200 placeholder-slate-400"
            />
          </div>

          {/* Expand/Collapse All */}
          <div className="flex gap-1.5">
            <button
              onClick={onExpandAll}
              className="flex-1 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1"
            >
              <ChevronDown className="w-3 h-3" />
              Expand
            </button>
            <button
              onClick={onCollapseAll}
              className="flex-1 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1"
            >
              <ChevronRight className="w-3 h-3" />
              Collapse
            </button>
          </div>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 scroll-smooth min-h-0">
          <style>{`
            .tree-scroll::-webkit-scrollbar {
              width: 6px;
            }
            .tree-scroll::-webkit-scrollbar-track {
              background: transparent;
            }
            .tree-scroll::-webkit-scrollbar-thumb {
              background: rgb(203 213 225);
              border-radius: 3px;
            }
            .tree-scroll::-webkit-scrollbar-thumb:hover {
              background: rgb(148 163 184);
            }
            .dark .tree-scroll::-webkit-scrollbar-thumb {
              background: rgb(51 65 85);
            }
            .dark .tree-scroll::-webkit-scrollbar-thumb:hover {
              background: rgb(71 85 105);
            }
          `}</style>
          {filteredTree.children && filteredTree.children.length > 0 ? (
            filteredTree.children.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                level={0}
                isExpanded={(path) => expandedFolders.includes(path)}
                isSelected={(id) => selectedDirectory?.id === id || selectedFile?.id === id}
                hasUnsaved={isFileUnsaved}
                onToggle={onToggleFolder}
                onSelect={handleSelectFile}
                onSelectDirectory={handleSelectDirectory}
                onContextMenu={handleContextMenu}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <File className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">No files found</p>
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span>{totalItems} items</span>
            {unsavedChanges && (
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Unsaved
              </span>
            )}
          </div>
        </div>
      </aside>

      {/* ========== EDITOR PANEL ========== */}
      <main className="flex-1 flex flex-col bg-white dark:bg-slate-900 min-h-0 overflow-hidden">
        {/* Editor Header */}
        <div className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 bg-slate-50/50 dark:bg-slate-800/50 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {selectedDirectory ? (
              <>
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600">
                  <Folder className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate text-sm">
                    {localDirectoryConfig?.label || selectedDirectory.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {selectedDirectory.path}
                  </p>
                </div>
              </>
            ) : selectedFile ? (
              <>
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600">
                  <FileText className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate text-sm">
                    {selectedFile.frontmatter?.title || selectedFile.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {selectedFile.path}
                  </p>
                </div>
                {unsavedChanges && (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Unsaved
                  </span>
                )}
              </>
            ) : (
              <div className="text-slate-400 text-sm">No item selected</div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Toggle Metadata Panel */}
            {(selectedFile || selectedDirectory) && (
              <button
                onClick={() => setShowMetadata(!showMetadata)}
                className={`
                  p-1.5 rounded-lg transition-all flex items-center gap-1.5
                  ${showMetadata
                    ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                    : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }
                `}
                title="Toggle metadata panel"
              >
                <PanelLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-xs font-medium">Metadata</span>
              </button>
            )}

            {selectedFile && isLoading && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </div>
            )}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-4 mt-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl flex items-start gap-3 flex-shrink-0">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">Error</p>
              <p className="text-sm text-red-600 dark:text-red-400">{error.message || error}</p>
            </div>
            <button
              onClick={onDismissError}
              className="text-red-400 hover:text-red-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Metadata Panel */}
          {showMetadata && (selectedFile || selectedDirectory) && (
            <aside className="w-72 border-r border-slate-200 dark:border-slate-800 p-4 overflow-y-auto bg-slate-50/30 dark:bg-slate-800/30 min-h-0">
              <style>{`
                .metadata-scroll::-webkit-scrollbar {
                  width: 6px;
                }
                .metadata-scroll::-webkit-scrollbar-track {
                  background: transparent;
                }
                .metadata-scroll::-webkit-scrollbar-thumb {
                  background: rgb(203 213 225);
                  border-radius: 3px;
                }
                .metadata-scroll::-webkit-scrollbar-thumb:hover {
                  background: rgb(148 163 184);
                }
                .dark .metadata-scroll::-webkit-scrollbar-thumb {
                  background: rgb(51 65 85);
                }
                .dark .metadata-scroll::-webkit-scrollbar-thumb:hover {
                  background: rgb(71 85 105);
                }
              `}</style>
              {selectedDirectory ? (
                <DirectoryMetadataPanel
                  config={localDirectoryConfig}
                  onChange={handleDirectoryConfigChange}
                  directoryName={selectedDirectory.name}
                  directoryPath={selectedDirectory.path}
                />
              ) : selectedFile ? (
                <MetadataPanel
                  frontmatter={localFrontmatter}
                  onChange={handleFrontmatterChange}
                  fileName={selectedFile.name}
                  filePath={selectedFile.path}
                />
              ) : null}
            </aside>
          )}

          {/* Editor Area */}
          <div className="flex-1 flex flex-col min-h-0">
            {selectedDirectory ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 px-8">
                <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 mb-4">
                  <Folder className="w-12 h-12 opacity-50" />
                </div>
                <h3 className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">Directory selected</h3>
                <p className="text-sm max-w-md text-center">
                  Use the metadata panel to edit this directory&apos;s config values.
                </p>
              </div>
            ) : selectedFile ? (
              <WysiwygEditor
                content={editorContent}
                onChange={handleEditContent}
                onSave={handleSave}
                unsavedChanges={unsavedChanges}
                isLoading={isLoading}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 mb-4">
                  <FileText className="w-12 h-12 opacity-50" />
                </div>
                <h3 className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">No file selected</h3>
                <p className="text-sm max-w-md text-center">
                  Select a file from the tree to view and edit its content, or create a new prompt fragment.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ========== CONTEXT MENU ========== */}
      {contextMenu.node && (
        <ContextMenu
          node={contextMenu.node}
          position={contextMenu.position}
          onClose={closeContextMenu}
          onRename={handleRename}
          onMove={handleMove}
          onEditConfig={handleEditDirectoryConfigFromMenu}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
        />
      )}

      {/* ========== MODALS ========== */}
      <NewFileModal
        isOpen={showNewFileModal}
        onClose={() => setShowNewFileModal(false)}
        onSubmit={handleCreateFile}
        directories={[fileSystem]}
        parentPath={newFileParentPath}
        validationErrors={validationErrors}
      />

      <NewFolderModal
        isOpen={showNewFolderModal}
        onClose={() => setShowNewFolderModal(false)}
        onSubmit={handleCreateFolder}
        directories={[fileSystem]}
        parentPath={newFileParentPath}
        validationErrors={validationErrors}
      />

      <RenameModal
        isOpen={showRenameModal}
        nodeName={contextMenu.node?.name || ''}
        onClose={() => setShowRenameModal(false)}
        onSubmit={handleRenameSubmit}
        validationErrors={validationErrors}
      />

      <DeleteModal
        isOpen={showDeleteModal}
        nodeName={contextMenu.node?.name || ''}
        isDirectory={contextMenu.node?.type === 'directory'}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
      />

      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        fileName={selectedFile?.name || ''}
        onClose={() => setShowUnsavedModal(false)}
        onAction={handleUnsavedAction}
      />
    </div>
  )
}
