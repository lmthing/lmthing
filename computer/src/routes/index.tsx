import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useComputer } from '@/lib/runtime/ComputerContext'
import { useIdeStore } from '@/lib/store'
import { useGlobRead, useSpaceFS } from '@lmthing/state'
import { IdeLayout } from '@lmthing/ui/components/computer/ide-layout'
import type { TerminalTab } from '@lmthing/ui/components/computer/ide-layout'
import type { TerminalSession } from '@/lib/runtime/types'
import type { FileTreeNode } from '@/lib/runtime/file-watcher'

export const Route = createFileRoute('/')({
  component: IdeRoute,
})

function buildTree(paths: string[]): FileTreeNode[] {
  const root: FileTreeNode[] = []

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

  const sort = (nodes: FileTreeNode[]): FileTreeNode[] => {
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

function IdeRoute() {
  const { status, createTerminalSession } = useComputer()
  const store = useIdeStore()
  const fs = useSpaceFS()
  const snapshot = useGlobRead('**/*')

  // Build the tree dynamically using buildTree
  const paths = useMemo(() => Object.keys(snapshot).sort(), [snapshot])
  const fileTree = useMemo(() => buildTree(paths), [paths])

  const [tabs, setTabs] = useState<TerminalTab[]>([
    { id: 'bash', label: 'bash', session: null },
  ])
  const [activeTabId, setActiveTabId] = useState<string>('bash')

  // Full runtime sessions (with dispose) tracked separately from UI tabs
  const sessionsRef = useRef<Map<string, TerminalSession>>(new Map())

  // Create the initial bash terminal session
  useEffect(() => {
    if (status !== 'running') return

    let disposed = false

    createTerminalSession().then((session) => {
      if (disposed) { session.dispose(); return }
      sessionsRef.current.set('bash', session)
      setTabs((prev) => prev.map((t) => t.id === 'bash' ? { ...t, session } : t))
    })

    return () => {
      disposed = true
      sessionsRef.current.get('bash')?.dispose()
      sessionsRef.current.delete('bash')
      setTabs((prev) => prev.map((t) => t.id === 'bash' ? { ...t, session: null } : t))
    }
  }, [status, createTerminalSession])

  const handleAddTab = useCallback(async () => {
    const id = `bash-${Date.now()}`
    setTabs((prev) => [...prev, { id, label: 'bash', session: null }])
    setActiveTabId(id)
    const session = await createTerminalSession()
    sessionsRef.current.set(id, session)
    setTabs((prev) => prev.map((t) => t.id === id ? { ...t, session } : t))
  }, [createTerminalSession])

  const handleCloseTab = useCallback((id: string) => {
    sessionsRef.current.get(id)?.dispose()
    sessionsRef.current.delete(id)
    setTabs((prev) => prev.filter((t) => t.id !== id))
    setActiveTabId((prev) => {
      if (prev !== id) return prev
      const remaining = tabs.filter((t) => t.id !== id)
      return remaining[remaining.length - 1]?.id ?? 'bash'
    })
  }, [tabs])

  const handleFileSelect = useCallback((path: string) => {
    const content = snapshot[path] ?? ''
    store.openFile(path, content)
  }, [snapshot, store])

  const handleCreateFile = useCallback((parentPath: string, name: string) => {
    if (!fs) return
    const path = parentPath === '.' ? name : `${parentPath}/${name}`
    fs.writeFile(path, '')
    store.openFile(path, '')
  }, [fs, store])

  const handleCreateDirectory = useCallback((parentPath: string, name: string) => {
    if (!fs) return
    const path = parentPath === '.' ? `${name}/.gitkeep` : `${parentPath}/${name}/.gitkeep`
    fs.writeFile(path, '')
  }, [fs])

  const handleDelete = useCallback((path: string) => {
    if (!fs) return
    fs.deleteFile(path)
    fs.deletePath(path)
    store.closeFile(path)
  }, [fs, store])

  const handleContentChange = useCallback((path: string, content: string) => {
    if (fs) {
      fs.writeFile(path, content)
    }
    store.updateFileContent(path, content)
  }, [fs, store])

  return (
    <IdeLayout
      status={status}
      isBooting={store.isBooting}
      isInstalling={store.isInstalling}
      fileTree={fileTree}
      activeFile={store.activeFile}
      onFileSelect={handleFileSelect}
      onCreateFile={handleCreateFile}
      onCreateDirectory={handleCreateDirectory}
      onDelete={handleDelete}
      openFiles={store.openFiles}
      fileContents={snapshot}
      onEditorFileSelect={(path) => store.setActiveFile(path)}
      onFileClose={(path) => store.closeFile(path)}
      onContentChange={handleContentChange}
      terminalTabs={tabs}
      activeTerminalTabId={activeTabId}
      onTerminalTabSelect={setActiveTabId}
      onTerminalTabClose={handleCloseTab}
      onAddTerminalTab={handleAddTab}
      previewUrl={store.previewUrl}
    />
  )
}
