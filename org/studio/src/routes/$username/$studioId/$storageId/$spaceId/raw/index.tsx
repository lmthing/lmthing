import { useState, useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useGlobRead } from '../../../../../../../../org/state/src'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
} from 'lucide-react'

interface TreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: TreeNode[]
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = []

  for (const path of paths) {
    const parts = path.split('/')
    let current = root
    let currentPath = ''

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      currentPath = currentPath ? `${currentPath}/${part}` : part
      const isFile = i === parts.length - 1

      let existing = current.find((n) => n.name === part)
      if (!existing) {
        existing = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'directory',
          children: isFile ? undefined : [],
        }
        current.push(existing)
      }
      if (!isFile) {
        current = existing.children!
      }
    }
  }

  const sort = (nodes: TreeNode[]): TreeNode[] => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    for (const n of nodes) {
      if (n.children) sort(n.children)
    }
    return nodes
  }

  return sort(root)
}

function TreeItem({
  node,
  depth,
  selectedPath,
  onSelect,
  expanded,
  onToggle,
}: {
  node: TreeNode
  depth: number
  selectedPath: string | null
  onSelect: (path: string) => void
  expanded: Set<string>
  onToggle: (path: string) => void
}) {
  const isDir = node.type === 'directory'
  const isOpen = expanded.has(node.path)
  const isSelected = node.path === selectedPath

  return (
    <>
      <div
        onClick={() => {
          if (isDir) onToggle(node.path)
          else onSelect(node.path)
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.25rem 0.5rem',
          paddingLeft: `${depth + 0.5}rem`,
          cursor: 'pointer',
          fontSize: '0.8125rem',
          borderRadius: '0.25rem',
          background: isSelected ? 'var(--color-primary, #6d28d9)' : 'transparent',
          color: isSelected ? 'var(--color-primary-foreground, #fff)' : 'inherit',
        }}
        onMouseEnter={(e) => {
          if (!isSelected) (e.currentTarget.style.background = 'var(--color-muted, #222)')
        }}
        onMouseLeave={(e) => {
          if (!isSelected) (e.currentTarget.style.background = 'transparent')
        }}
      >
        {isDir ? (
          <>
            {isOpen
              ? <ChevronDown style={{ width: 14, height: 14, flexShrink: 0, opacity: 0.5 }} />
              : <ChevronRight style={{ width: 14, height: 14, flexShrink: 0, opacity: 0.5 }} />}
            {isOpen
              ? <FolderOpen style={{ width: 15, height: 15, flexShrink: 0, color: isSelected ? 'inherit' : 'var(--color-primary, #8b5cf6)' }} />
              : <Folder style={{ width: 15, height: 15, flexShrink: 0, color: isSelected ? 'inherit' : 'var(--color-primary, #8b5cf6)' }} />}
          </>
        ) : (
          <>
            <span style={{ width: 14, flexShrink: 0 }} />
            <FileText style={{ width: 15, height: 15, flexShrink: 0, opacity: 0.5 }} />
          </>
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </span>
      </div>
      {isDir && isOpen && node.children?.map((child) => (
        <TreeItem
          key={child.path}
          node={child}
          depth={depth + 1}
          selectedPath={selectedPath}
          onSelect={onSelect}
          expanded={expanded}
          onToggle={onToggle}
        />
      ))}
    </>
  )
}

function RawView() {
  const snapshot = useGlobRead('**/*')
  const paths = useMemo(() => Object.keys(snapshot).sort(), [snapshot])
  const tree = useMemo(() => buildTree(paths), [paths])

  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const handleToggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const selectedContent = selectedPath ? snapshot[selectedPath] ?? null : null

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* File tree sidebar */}
      <div
        style={{
          width: 260,
          minWidth: 200,
          borderRight: '1px solid var(--color-border, #333)',
          overflowY: 'auto',
          padding: '0.5rem 0',
          flexShrink: 0,
        }}
      >
        <div style={{ padding: '0.5rem 0.75rem 0.75rem', fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5 }}>
          Files ({paths.length})
        </div>
        {tree.map((node) => (
          <TreeItem
            key={node.path}
            node={node}
            depth={0}
            selectedPath={selectedPath}
            onSelect={setSelectedPath}
            expanded={expanded}
            onToggle={handleToggle}
          />
        ))}
      </div>

      {/* File content */}
      <div style={{ flex: 1, overflow: 'auto', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
        {selectedPath && selectedContent !== null ? (
          <>
            <div
              style={{
                padding: '0.5rem 1rem',
                borderBottom: '1px solid var(--color-border, #333)',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--color-accent, #8b5cf6)',
                position: 'sticky',
                top: 0,
                background: 'var(--color-background, #111)',
                zIndex: 1,
              }}
            >
              {selectedPath}
            </div>
            <pre
              style={{
                margin: 0,
                padding: '1rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.6,
              }}
            >
              {selectedContent}
            </pre>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.4, fontSize: '0.875rem' }}>
            {paths.length === 0 ? 'No files in this space.' : 'Select a file to view its content.'}
          </div>
        )}
      </div>
    </div>
  )
}

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId/raw/',
)({
  component: RawView,
})
