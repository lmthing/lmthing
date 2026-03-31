import { useEffect, useRef } from 'react'
import { useComputer } from './ComputerContext'
import type { WebContainer } from '@webcontainer/api'

// PostMessage protocol (parent ↔ computer iframe):
//
// Parent → Computer:
//   lmthing:fs-list-all     — request full file tree
//   lmthing:fs-write        — { path, content } write single file
//   lmthing:fs-write-batch  — { files: Record<string, string> } write multiple files
//   lmthing:fs-delete       — { path } delete file or directory
//
// Computer → Parent:
//   lmthing:fs-ready        — WebContainer FS is available
//   lmthing:fs-sync         — { files: Record<string, string> } full snapshot
//   lmthing:fs-change       — { path, content: string | null } file changed (null = deleted)
//   lmthing:fs-write-batch-done — batch write acknowledged

const WATCH_INTERVAL_MS = 3000

async function readAllFiles(container: WebContainer, path = '.'): Promise<Record<string, string>> {
  const files: Record<string, string> = {}
  try {
    const entries = await container.fs.readdir(path, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === 'node_modules') continue
      const fullPath = path === '.' ? entry.name : `${path}/${entry.name}`
      if (entry.isDirectory()) {
        Object.assign(files, await readAllFiles(container, fullPath))
      } else {
        try {
          files[fullPath] = await container.fs.readFile(fullPath, 'utf-8')
        } catch {
          // skip binary or unreadable files
        }
      }
    }
  } catch { /* ignore readdir errors */ }
  return files
}

async function ensureDir(container: WebContainer, filePath: string): Promise<void> {
  const lastSlash = filePath.lastIndexOf('/')
  if (lastSlash <= 0) return
  await container.fs.mkdir(filePath.slice(0, lastSlash), { recursive: true }).catch(() => {})
}

export function FsRelay() {
  const { container } = useComputer()
  const isEmbedded = window !== window.top

  // Paths recently written by the parent — suppressed from the outbound watcher
  const parentWrittenRef = useRef(new Set<string>())
  // Last known FS snapshot, used for change detection in the watcher
  const prevFilesRef = useRef<Record<string, string> | null>(null)

  useEffect(() => {
    if (!isEmbedded || !container) return

    window.parent.postMessage({ type: 'lmthing:fs-ready' }, '*')

    // ── Parent → Computer message handler ──
    const onMessage = async (e: MessageEvent) => {
      switch (e.data?.type) {
        case 'lmthing:fs-list-all': {
          const files = await readAllFiles(container)
          prevFilesRef.current = files
          window.parent.postMessage({ type: 'lmthing:fs-sync', files }, '*')
          break
        }

        case 'lmthing:fs-write': {
          const { path, content } = e.data as { path: string; content: string }
          parentWrittenRef.current.add(path)
          await ensureDir(container, path)
          await container.fs.writeFile(path, content).catch(() => {})
          // Keep prevFiles in sync so the watcher doesn't echo this back
          if (prevFilesRef.current) prevFilesRef.current[path] = content
          break
        }

        case 'lmthing:fs-write-batch': {
          const { files } = e.data as { files: Record<string, string> }
          for (const [path, content] of Object.entries(files)) {
            parentWrittenRef.current.add(path)
            await ensureDir(container, path)
            await container.fs.writeFile(path, content).catch(() => {})
          }
          // Merge into prevFiles snapshot
          if (prevFilesRef.current) Object.assign(prevFilesRef.current, files)
          else prevFilesRef.current = { ...files }
          window.parent.postMessage({ type: 'lmthing:fs-write-batch-done' }, '*')
          break
        }

        case 'lmthing:fs-delete': {
          const { path } = e.data as { path: string }
          parentWrittenRef.current.add(path)
          await container.fs.rm(path, { recursive: true }).catch(() => {})
          if (prevFilesRef.current) delete prevFilesRef.current[path]
          break
        }
      }
    }
    window.addEventListener('message', onMessage)

    // ── Computer → Parent file watcher ──
    // Polls the WebContainer FS and forwards any computer-originated changes to the parent.
    let active = true
    const watch = async () => {
      // Seed the initial snapshot
      prevFilesRef.current = await readAllFiles(container)

      while (active) {
        await new Promise(r => setTimeout(r, WATCH_INTERVAL_MS))
        if (!active) break

        const current = await readAllFiles(container)
        const prev = prevFilesRef.current ?? {}
        const changes: Array<{ path: string; content: string | null }> = []

        // Added or modified
        for (const [path, content] of Object.entries(current)) {
          if (prev[path] !== content && !parentWrittenRef.current.has(path)) {
            changes.push({ path, content })
          }
        }
        // Deleted
        for (const path of Object.keys(prev)) {
          if (!(path in current) && !parentWrittenRef.current.has(path)) {
            changes.push({ path, content: null })
          }
        }

        // Parent-written paths have been accounted for — clear for next cycle
        parentWrittenRef.current.clear()
        prevFilesRef.current = current

        for (const change of changes) {
          window.parent.postMessage({ type: 'lmthing:fs-change', ...change }, '*')
        }
      }
    }
    watch()

    return () => {
      active = false
      window.removeEventListener('message', onMessage)
    }
  }, [isEmbedded, container])

  return null
}
