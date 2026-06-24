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

const CLI_LOG_COMMAND = 'tail -n 100 -f /tmp/lmthing-server.log 2>/dev/null || sleep 9999'

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
  const { transport } = useApp()

  const [filePaths, setFilePaths] = useState<string[]>([])
  const [fileContents, setFileContents] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const debounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const saveFile = useCallback(
    (path: string, content: string) => {
      if (!transport) return
      const timer = debounceTimersRef.current.get(path)
      if (timer) clearTimeout(timer)

      const newTimer = setTimeout(async () => {
        debounceTimersRef.current.delete(path)
        try {
          await transport.writeFile(path, content)
        } catch (err) {
          console.error(`Failed to save ${path}:`, err)
        }
      }, 1500)

      debounceTimersRef.current.set(path, newTimer)
    },
    [transport],
  )

  // Load file tree on mount
  useEffect(() => {
    if (!transport) return
    let cancelled = false

    async function loadTree() {
      setIsLoading(true)
      setError(null)
      try {
        const files = await transport!.listFiles()
        if (!cancelled) setFilePaths(files)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadTree()
    return () => { cancelled = true }
  }, [transport])

  const fileTree = useMemo(() => buildTree(filePaths), [filePaths])

  const [tabs, setTabs] = useState<TerminalTab[]>([
    { id: 'cli', label: 'process', session: null, readonly: true },
    { id: 'bash', label: 'bash', session: null },
  ])
  const [activeTabId, setActiveTabId] = useState<string>('bash')

  const sessionsRef = useRef<Map<string, TerminalSession>>(new Map())

  // Create both terminal sessions when pod is running
  useEffect(() => {
    if (status !== 'running') return

    let disposed = false

    async function initTerminals() {
      const [cliSession, bashSession] = await Promise.all([
        createTerminalSession(CLI_LOG_COMMAND),
        createTerminalSession(),
      ])
      if (disposed) {
        cliSession.dispose()
        bashSession.dispose()
        return
      }
      sessionsRef.current.set('cli', cliSession)
      sessionsRef.current.set('bash', bashSession)
      setTabs((prev) => prev.map((t) => {
        if (t.id === 'cli') return { ...t, session: cliSession }
        if (t.id === 'bash') return { ...t, session: bashSession }
        return t
      }))
    }

    void initTerminals()

    return () => {
      disposed = true
      sessionsRef.current.get('cli')?.dispose()
      sessionsRef.current.get('bash')?.dispose()
      sessionsRef.current.delete('cli')
      sessionsRef.current.delete('bash')
      setTabs((prev) => prev.map((t) =>
        (t.id === 'cli' || t.id === 'bash') ? { ...t, session: null } : t
      ))
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

  const handleFileSelect = useCallback(async (path: string) => {
    if (fileContents[path] !== undefined) {
      store.openFile(path, fileContents[path])
      return
    }
    if (!transport) return
    try {
      const content = await transport.readFile(path)
      setFileContents((prev) => ({ ...prev, [path]: content }))
      store.openFile(path, content)
    } catch (err) {
      console.error(`Failed to read ${path}:`, err)
      store.openFile(path, '')
    }
  }, [fileContents, transport, store])

  const handleCreateFile = useCallback(async (parentPath: string, name: string) => {
    const path = parentPath === '.' ? name : `${parentPath}/${name}`
    if (!transport) return
    try {
      await transport.writeFile(path, '')
      setFilePaths((prev) => prev.includes(path) ? prev : [...prev, path])
      setFileContents((prev) => ({ ...prev, [path]: '' }))
      store.openFile(path, '')
    } catch (err) {
      console.error(`Failed to create ${path}:`, err)
    }
  }, [transport, store])

  const handleCreateDirectory = useCallback(async (parentPath: string, name: string) => {
    const path = parentPath === '.' ? name : `${parentPath}/${name}`
    const dummyPath = `${path}/.gitkeep`
    if (!transport) return
    try {
      await transport.writeFile(dummyPath, '')
      setFilePaths((prev) => prev.includes(dummyPath) ? prev : [...prev, dummyPath])
    } catch (err) {
      console.error(`Failed to create directory ${path}:`, err)
    }
  }, [transport])

  const handleDelete = useCallback((path: string) => {
    // Optimistically remove from local state; no delete API yet
    setFilePaths((prev) => prev.filter((p) => p !== path && !p.startsWith(`${path}/`)))
    setFileContents((prev) => {
      const next = { ...prev }
      delete next[path]
      for (const k of Object.keys(next)) {
        if (k.startsWith(`${path}/`)) delete next[k]
      }
      return next
    })
    store.closeFile(path)
  }, [store])

  const handleContentChange = useCallback((path: string, content: string) => {
    setFileContents((prev) => ({ ...prev, [path]: content }))
    store.updateFileContent(path, content)
    saveFile(path, content)
  }, [saveFile, store])

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
      fileContents={fileContents}
      onEditorFileSelect={(path) => store.setActiveFile(path)}
      onFileClose={(path) => store.closeFile(path)}
      onContentChange={handleContentChange}
      terminalTabs={tabs}
      activeTerminalTabId={activeTabId}
      onTerminalTabSelect={setActiveTabId}
      onTerminalTabClose={handleCloseTab}
      onAddTerminalTab={handleAddTab}
    />
  )
}
