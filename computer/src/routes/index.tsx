import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, useCallback } from 'react'
import { useComputer } from '@/lib/runtime/ComputerContext'
import { useIdeStore } from '@/lib/store'
import { readFile, writeFile, createFile, createDirectory, deleteFile } from '@/lib/runtime/file-operations'
import { IdeLayout } from '@lmthing/ui/components/computer/ide-layout'
import type { TerminalSession } from '@/lib/runtime/types'

export const Route = createFileRoute('/')({
  component: IdeRoute,
})

function IdeRoute() {
  const { container, status, createTerminalSession, initIDE } = useComputer()
  const store = useIdeStore()
  const [session, setSession] = useState<TerminalSession | null>(null)

  // Boot IDE once container is ready
  useEffect(() => {
    if (status === 'running' && container) {
      initIDE()
    }
  }, [status, container, initIDE])

  // Create terminal session
  useEffect(() => {
    if (status !== 'running') return

    let disposed = false
    let currentSession: TerminalSession | null = null

    createTerminalSession().then((s) => {
      if (disposed) { s.dispose(); return }
      currentSession = s
      setSession(s)
    })

    return () => {
      disposed = true
      if (currentSession) { currentSession.dispose(); setSession(null) }
    }
  }, [status, createTerminalSession])

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
      terminalSession={session}
      previewUrl={store.previewUrl}
    />
  )
}
