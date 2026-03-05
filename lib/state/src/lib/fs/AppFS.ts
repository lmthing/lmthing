// src/lib/fs/AppFS.ts

import { FSEventBus } from './FSEventBus'
import type { FSInterface } from './FSInterface'
import { globToRegex } from './glob'
import type { FileTree, DirEntry, FileOp, Unsubscribe } from '@/types/studio'
import type { FSEvent, DirEvent, BatchEvent } from './events'

export class AppFS implements FSInterface {
  private store: Map<string, string>
  private bus: FSEventBus

  constructor(initialData?: FileTree) {
    this.store = new Map(Object.entries(initialData || {}))
    this.bus = new FSEventBus()
  }

  // ── useSyncExternalStore (coarse-grained, legacy compat) ──────────
  subscribe(cb: () => void): Unsubscribe {
    return this.bus.onAny(() => cb())
  }

  getSnapshot(): Readonly<FileTree> {
    return Object.fromEntries(this.store)
  }

  // ── Read ──────────────────────────────────────────────────────────
  readFile(path: string): string | null {
    return this.store.get(path) ?? null
  }

  readDir(path: string): DirEntry[] {
    const prefix = path ? `${path}/` : ''
    const entries = new Map<string, DirEntry>()

    for (const fullPath of this.store.keys()) {
      if (fullPath === prefix.slice(0, -1)) continue // Don't include the dir itself
      if (!fullPath.startsWith(prefix)) continue

      const relative = fullPath.slice(prefix.length)
      const slashIdx = relative.indexOf('/')
      const isFile = slashIdx === -1

      if (isFile) {
        entries.set(relative, { name: relative, path: fullPath, type: 'file' })
      } else {
        const dirName = relative.slice(0, slashIdx)
        if (!entries.has(dirName)) {
          entries.set(dirName, { name: dirName, path: `${prefix}${dirName}`, type: 'dir' })
        }
      }
    }

    return Array.from(entries.values()).sort((a, b) => a.name.localeCompare(b.name))
  }

  glob(pattern: string): string[] {
    const regex = globToRegex(pattern)
    return Array.from(this.store.keys()).filter(path => regex.test(path))
  }

  globRead(pattern: string): FileTree {
    const regex = globToRegex(pattern)
    const result: FileTree = {}
    for (const [path, content] of this.store) {
      if (regex.test(path)) {
        result[path] = content
      }
    }
    return result
  }

  // ── Write (sync) ──────────────────────────────────────────────────
  writeFile(path: string, content: string): void {
    const exists = this.store.has(path)
    const type: FSEvent['type'] = exists ? 'update' : 'create'
    this.store.set(path, content)
    this.bus.emit({ type, path, content, timestamp: Date.now() })
  }

  appendFile(path: string, content: string): void {
    const existing = this.store.get(path) ?? ''
    const newContent = existing + content
    const exists = this.store.has(path)
    const type: FSEvent['type'] = exists ? 'update' : 'create'
    this.store.set(path, newContent)
    this.bus.emit({ type, path, content: newContent, timestamp: Date.now() })
  }

  deleteFile(path: string): void {
    if (!this.store.has(path)) return
    this.store.delete(path)
    this.bus.emit({ type: 'delete', path, timestamp: Date.now() })
  }

  deletePath(prefix: string): void {
    const toDelete: string[] = []
    for (const path of this.store.keys()) {
      if (path.startsWith(prefix + '/') || path === prefix) {
        toDelete.push(path)
      }
    }
    for (const path of toDelete) {
      this.store.delete(path)
      this.bus.emit({ type: 'delete', path, timestamp: Date.now() })
    }
  }

  renamePath(oldPrefix: string, newPrefix: string): void {
    const toRename: Array<{ oldPath: string; newPath: string; content: string }> = []

    // Collect all paths to rename
    for (const [oldPath, content] of this.store) {
      if (oldPath.startsWith(oldPrefix + '/') || oldPath === oldPrefix) {
        const newPath = oldPath === oldPrefix
          ? newPrefix
          : newPrefix + oldPath.slice(oldPrefix.length)
        toRename.push({ oldPath, newPath, content })
      }
    }

    // Perform rename
    for (const { oldPath, newPath, content } of toRename) {
      this.store.delete(oldPath)
      this.store.set(newPath, content)
      this.bus.emit({
        type: 'rename',
        path: newPath,
        oldPath,
        content,
        timestamp: Date.now()
      })
    }
  }

  duplicatePath(source: string, dest: string): void {
    const toDuplicate: Array<{ sourcePath: string; destPath: string; content: string }> = []

    for (const [sourcePath, content] of this.store) {
      if (sourcePath.startsWith(source + '/') || sourcePath === source) {
        const destPath = sourcePath === source
          ? dest
          : dest + sourcePath.slice(source.length)
        toDuplicate.push({ sourcePath, destPath, content })
      }
    }

    for (const { destPath, content } of toDuplicate) {
      this.store.set(destPath, content)
      this.bus.emit({
        type: 'create',
        path: destPath,
        content,
        timestamp: Date.now()
      })
    }
  }

  batch(ops: FileOp[]): void {
    this.bus.beginBatch()
    try {
      for (const op of ops) {
        switch (op.type) {
          case 'write':
            this.writeFile(op.path, op.content)
            break
          case 'append':
            this.appendFile(op.path, op.content)
            break
          case 'delete':
            this.deleteFile(op.path)
            break
          case 'rename':
            this.renamePath(op.oldPath, op.newPath)
            break
          case 'duplicate':
            this.duplicatePath(op.source, op.dest)
            break
        }
      }
    } finally {
      this.bus.endBatch()
    }
  }

  // ── Write (streaming) ─────────────────────────────────────────────
  async streamWriteFile(path: string, stream: AsyncIterable<string>): Promise<void> {
    let content = ''
    for await (const chunk of stream) {
      content += chunk
    }
    this.writeFile(path, content)
  }

  async streamAppendFile(path: string, stream: AsyncIterable<string>): Promise<void> {
    let content = ''
    for await (const chunk of stream) {
      content += chunk
    }
    this.appendFile(path, content)
  }

  // ── Events: any ───────────────────────────────────────────────────
  onAny(cb: (event: FSEvent) => void): Unsubscribe {
    return this.bus.onAny(cb)
  }

  // ── Events: file-level ────────────────────────────────────────────
  onFile(path: string, cb: (event: FSEvent) => void): Unsubscribe {
    return this.bus.onFile(path, cb)
  }

  onFileCreate(path: string, cb: (content: string) => void): Unsubscribe {
    return this.bus.onFileCreate(path, cb)
  }

  onFileUpdate(path: string, cb: (content: string) => void): Unsubscribe {
    return this.bus.onFileUpdate(path, cb)
  }

  onFileDelete(path: string, cb: () => void): Unsubscribe {
    return this.bus.onFileDelete(path, cb)
  }

  onFileRename(path: string, cb: (newPath: string) => void): Unsubscribe {
    return this.bus.onFileRename(path, cb)
  }

  // ── Events: directory-level ───────────────────────────────────────
  onDir(dir: string, cb: (event: DirEvent) => void): Unsubscribe {
    return this.bus.onDir(dir, cb)
  }

  onDirAdd(dir: string, cb: (entry: string, content: string) => void): Unsubscribe {
    return this.bus.onDirAdd(dir, cb)
  }

  onDirRemove(dir: string, cb: (entry: string) => void): Unsubscribe {
    return this.bus.onDirRemove(dir, cb)
  }

  onDirRename(dir: string, cb: (oldEntry: string, newEntry: string) => void): Unsubscribe {
    return this.bus.onDirRename(dir, cb)
  }

  // ── Events: prefix-level ──────────────────────────────────────────
  onPrefix(prefix: string, cb: (event: FSEvent) => void): Unsubscribe {
    return this.bus.onPrefix(prefix, cb)
  }

  // ── Events: glob-level ────────────────────────────────────────────
  onGlob(pattern: string, cb: (event: FSEvent) => void): Unsubscribe {
    return this.bus.onGlob(pattern, cb)
  }

  // ── Events: batch ─────────────────────────────────────────────────
  onBatch(cb: (event: BatchEvent) => void): Unsubscribe {
    return this.bus.onBatch(cb)
  }

  // ── Direct access to bus for advanced use cases ─────────────────────
  getEventBus(): FSEventBus {
    return this.bus
  }

  // ── Data export/import ─────────────────────────────────────────────
  export(): FileTree {
    return Object.fromEntries(this.store)
  }

  import(data: FileTree): void {
    this.store.clear()
    for (const [path, content] of Object.entries(data)) {
      this.store.set(path, content)
    }
    // Notify after import
    for (const [path, content] of Object.entries(data)) {
      this.bus.emit({ type: 'create', path, content, timestamp: Date.now() })
    }
  }
}
