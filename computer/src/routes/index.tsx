import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useComputer } from '@/lib/runtime/ComputerContext'
import { useIdeStore } from '@/lib/store'
import { IdeLayout } from '@lmthing/ui/components/computer/ide-layout'
import type { TerminalTab } from '@lmthing/ui/components/computer/ide-layout'
import type { TerminalSession } from '@/lib/runtime/types'

export const Route = createFileRoute('/')({
  component: IdeRoute,
})

function IdeRoute() {
  const { status, createTerminalSession } = useComputer()
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

  return (
    <IdeLayout
      status={status}
      isBooting={store.isBooting}
      isInstalling={store.isInstalling}
      fileTree={store.fileTree}
      activeFile={store.activeFile}
      onFileSelect={() => {}}
      onCreateFile={() => {}}
      onCreateDirectory={() => {}}
      onDelete={() => {}}
      openFiles={store.openFiles}
      fileContents={store.fileContents}
      onEditorFileSelect={(path) => store.setActiveFile(path)}
      onFileClose={(path) => store.closeFile(path)}
      onContentChange={(path, content) => store.updateFileContent(path, content)}
      terminalTabs={tabs}
      activeTerminalTabId={activeTabId}
      onTerminalTabSelect={setActiveTabId}
      onTerminalTabClose={handleCloseTab}
      onAddTerminalTab={handleAddTab}
      previewUrl={store.previewUrl}
    />
  )
}
