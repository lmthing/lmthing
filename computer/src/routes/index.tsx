import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useComputer } from '@/lib/runtime/ComputerContext'
import { useIdeStore } from '@/lib/store'
import { readFile, writeFile, createFile, createDirectory, deleteFile } from '@/lib/runtime/file-operations'
import { IdeLayout } from '@lmthing/ui/components/computer/ide-layout'
import type { TerminalTab } from '@lmthing/ui/components/computer/ide-layout'
import type { TerminalSession } from '@/lib/runtime/types'

export const Route = createFileRoute('/')({
  component: IdeRoute,
})

function IdeRoute() {
  const { container, status, tier, createTerminalSession } = useComputer()
  const store = useIdeStore()

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

  // File tree callbacks
  const handleFileSelect = useCallback(async (path: string) => {
    if (!container) return
    try {
      const content = await readFile(container, path)
      store.openFile(path, content)
    } catch (err) {
      console.error('Failed to read file:', err)
    }
  }, [container, store])

  const handleCreateFile = useCallback(async (parentPath: string, name: string) => {
    if (!container) return
    const fullPath = parentPath === '.' ? name : `${parentPath}/${name}`
    await createFile(container, fullPath)
  }, [container])

  const handleCreateDirectory = useCallback(async (parentPath: string, name: string) => {
    if (!container) return
    const fullPath = parentPath === '.' ? name : `${parentPath}/${name}`
    await createDirectory(container, fullPath)
  }, [container])

  const handleDelete = useCallback(async (path: string) => {
    if (!container) return
    await deleteFile(container, path)
    store.closeFile(path)
  }, [container, store])

  const handleContentChange = useCallback(async (path: string, content: string) => {
    store.updateFileContent(path, content)
    if (container) {
      try { await writeFile(container, path, content) } catch { /* ignore */ }
    }
  }, [container, store])

  return (
    <IdeLayout
      status={status}
      isBooting={store.isBooting}
      isInstalling={store.isInstalling}
      fileTree={store.fileTree}
      activeFile={store.activeFile}
      onFileSelect={handleFileSelect}
      onCreateFile={handleCreateFile}
      onCreateDirectory={handleCreateDirectory}
      onDelete={handleDelete}
      openFiles={store.openFiles}
      fileContents={store.fileContents}
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
