import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useComputer } from '@/lib/runtime/ComputerContext'
import { useIdeStore } from '@/lib/store'
import { useApp } from '@lmthing/state'
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

function parsePath(path: string): { projectId: string; spaceId: string; relPath: string } | null {
  const parts = path.split('/')
  if (parts.length < 3 || parts[1] !== 'spaces') return null
  return {
    projectId: parts[0],
    spaceId: parts[2],
    relPath: parts.slice(3).join('/'),
  }
}

function IdeRoute() {
  const { status, createTerminalSession } = useComputer()
  const store = useIdeStore()
  const { transport } = useApp()

  const [snapshot, setSnapshot] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const debounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const snapshotRef = useRef(snapshot)

  useEffect(() => {
    snapshotRef.current = snapshot
  }, [snapshot])

  const saveSpace = useCallback(
    (projectId: string, spaceId: string, currentSnapshot: Record<string, string>) => {
      if (!transport) return
      const key = `${projectId}/${spaceId}`
      const timer = debounceTimersRef.current.get(key)
      if (timer) clearTimeout(timer)

      const newTimer = setTimeout(async () => {
        debounceTimersRef.current.delete(key)
        const spaceFiles: Record<string, string> = {}
        const prefix = `${projectId}/spaces/${spaceId}/`
        for (const [p, content] of Object.entries(currentSnapshot)) {
          if (p.startsWith(prefix)) {
            const relPath = p.slice(prefix.length)
            if (relPath) {
              spaceFiles[relPath] = content
            }
          }
        }
        try {
          await transport.saveSpaceFiles(projectId, spaceId, spaceFiles)
          console.log(`Saved space ${key} to pod`)
        } catch (err) {
          console.error(`Failed to save space ${key}:`, err)
        }
      }, 1500)

      debounceTimersRef.current.set(key, newTimer)
    },
    [transport],
  )

  // Load all projects and spaces on mount
  useEffect(() => {
    if (!transport) return
    let cancelled = false

    async function loadAll() {
      setIsLoading(true)
      setError(null)
      try {
        const projects = await transport!.listProjects()
        const allFiles: Record<string, string> = {}

        for (const project of projects) {
          const spaces = await transport!.listSpaces(project.id)
          for (const space of spaces) {
            const files = await transport!.loadSpaceFiles(project.id, space.id)
            const prefix = `${project.id}/spaces/${space.id}`
            for (const [relPath, content] of Object.entries(files)) {
              allFiles[`${prefix}/${relPath}`] = content
            }
          }
        }

        if (!cancelled) {
          setSnapshot(allFiles)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadAll()

    return () => {
      cancelled = true
      // Flush all pending saves immediately on unmount
      for (const [key, timer] of debounceTimersRef.current.entries()) {
        clearTimeout(timer)
        const [projectId, spaceId] = key.split('/')
        const spaceFiles: Record<string, string> = {}
        const prefix = `${projectId}/spaces/${spaceId}/`
        for (const [p, content] of Object.entries(snapshotRef.current)) {
          if (p.startsWith(prefix)) {
            const relPath = p.slice(prefix.length)
            if (relPath) {
              spaceFiles[relPath] = content
            }
          }
        }
        void transport!.saveSpaceFiles(projectId, spaceId, spaceFiles).catch(() => {})
      }
    }
  }, [transport])

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
    const path = parentPath === '.' ? name : `${parentPath}/${name}`
    const parsed = parsePath(path)
    if (!parsed || !parsed.relPath) {
      console.warn('Cannot create files outside of a space')
      return
    }
    setSnapshot((prev) => {
      const next = { ...prev, [path]: '' }
      saveSpace(parsed.projectId, parsed.spaceId, next)
      return next
    })
    store.openFile(path, '')
  }, [saveSpace, store])

  const handleCreateDirectory = useCallback((parentPath: string, name: string) => {
    const path = parentPath === '.' ? name : `${parentPath}/${name}`
    const dummyPath = `${path}/.gitkeep`
    const parsed = parsePath(dummyPath)
    if (!parsed) return

    setSnapshot((prev) => {
      const next = { ...prev, [dummyPath]: '' }
      saveSpace(parsed.projectId, parsed.spaceId, next)
      return next
    })
  }, [saveSpace])

  const handleDelete = useCallback((path: string) => {
    const parsed = parsePath(path)
    if (!parsed) return

    setSnapshot((prev) => {
      const next = { ...prev }
      delete next[path]
      const prefix = `${path}/`
      for (const k of Object.keys(next)) {
        if (k.startsWith(prefix)) {
          delete next[k]
        }
      }
      saveSpace(parsed.projectId, parsed.spaceId, next)
      return next
    })
    store.closeFile(path)
  }, [saveSpace, store])

  const handleContentChange = useCallback((path: string, content: string) => {
    const parsed = parsePath(path)
    if (!parsed) return

    setSnapshot((prev) => {
      const next = { ...prev, [path]: content }
      saveSpace(parsed.projectId, parsed.spaceId, next)
      return next
    })
    store.updateFileContent(path, content)
  }, [saveSpace, store])

  return (
    <IdeLayout
      status={status}
      isBooting={isLoading || store.isBooting}
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
