// src/lib/fs/ScopedFS.ts

import { AppFS } from './AppFS'
import type { FSInterface } from './FSInterface'
import type { FileTree, DirEntry, FileOp, Unsubscribe } from '../../types/studio'
import type { FSEvent, DirEvent, BatchEvent } from './events'

function normalizePrefix(prefix: string): string {
  return prefix.replace(/^\/+|\/+$/g, '')
}

function joinPath(prefix: string, path: string): string {
  const normalizedPrefix = normalizePrefix(prefix)
  const normalizedPath = path.replace(/^\/+/, '')
  if (!normalizedPrefix) return normalizedPath
  if (!normalizedPath) return normalizedPrefix
  return `${normalizedPrefix}/${normalizedPath}`
}

function stripPrefix(prefix: string, fullPath: string): string {
  const normalizedPrefix = normalizePrefix(prefix)
  if (!normalizedPrefix) return fullPath
  if (fullPath === normalizedPrefix) return ''
  if (fullPath.startsWith(normalizedPrefix + '/')) {
    return fullPath.slice(normalizedPrefix.length + 1)
  }
  return fullPath
}

export class ScopedFS implements FSInterface {
  constructor(protected root: AppFS, protected prefix: string) {
    this.prefix = normalizePrefix(prefix)
  }

  // ── useSyncExternalStore (coarse-grained, legacy compat) ──────────
  subscribe(cb: () => void): Unsubscribe {
    // Subscribe to all events under our prefix
    return this.root.onAny((event) => {
      const localPath = stripPrefix(this.prefix, event.path)
      if (localPath !== event.path) {
        // Event is within our scope
        cb()
      }
    })
  }

  getSnapshot(): Readonly<FileTree> {
    const fullTree = this.root.getSnapshot()
    const scopedTree: FileTree = {}
    const prefix = this.prefix ? `${this.prefix}/` : ''

    for (const [path, content] of Object.entries(fullTree)) {
      if (path.startsWith(prefix) || (!this.prefix && path)) {
        const localPath = stripPrefix(this.prefix, path)
        if (localPath) {
          scopedTree[localPath] = content
        }
      }
    }

    return scopedTree
  }

  // ── Read ──────────────────────────────────────────────────────────
  readFile(path: string): string | null {
    return this.root.readFile(joinPath(this.prefix, path))
  }

  readDir(path: string): DirEntry[] {
    const fullPath = joinPath(this.prefix, path)
    const entries = this.root.readDir(fullPath)
    return entries.map(entry => ({
      ...entry,
      path: stripPrefix(this.prefix, entry.path)
    }))
  }

  glob(pattern: string): string[] {
    const results = this.root.glob(pattern)
    return results
      .map(p => stripPrefix(this.prefix, p))
      .filter(p => p !== pattern) // Only return paths within our scope
  }

  globRead(pattern: string): FileTree {
    const fullResults = this.root.globRead(pattern)
    const scopedResults: FileTree = {}

    for (const [fullPath, content] of Object.entries(fullResults)) {
      const localPath = stripPrefix(this.prefix, fullPath)
      if (localPath !== fullPath) {
        scopedResults[localPath] = content
      }
    }

    return scopedResults
  }

  // ── Write (sync) ──────────────────────────────────────────────────
  writeFile(path: string, content: string): void {
    this.root.writeFile(joinPath(this.prefix, path), content)
  }

  appendFile(path: string, content: string): void {
    this.root.appendFile(joinPath(this.prefix, path), content)
  }

  deleteFile(path: string): void {
    this.root.deleteFile(joinPath(this.prefix, path))
  }

  deletePath(prefix: string): void {
    this.root.deletePath(joinPath(this.prefix, prefix))
  }

  renamePath(oldPrefix: string, newPrefix: string): void {
    this.root.renamePath(
      joinPath(this.prefix, oldPrefix),
      joinPath(this.prefix, newPrefix)
    )
  }

  duplicatePath(source: string, dest: string): void {
    this.root.duplicatePath(
      joinPath(this.prefix, source),
      joinPath(this.prefix, dest)
    )
  }

  batch(ops: FileOp[]): void {
    const scopedOps = ops.map(op => {
      switch (op.type) {
        case 'rename':
          return {
            ...op,
            oldPath: joinPath(this.prefix, op.oldPath),
            newPath: joinPath(this.prefix, op.newPath)
          }
        case 'duplicate':
          return {
            ...op,
            source: joinPath(this.prefix, op.source),
            dest: joinPath(this.prefix, op.dest)
          }
        default:
          return {
            ...op,
            path: joinPath(this.prefix, op.path)
          }
      }
    })
    this.root.batch(scopedOps)
  }

  // ── Write (streaming) ─────────────────────────────────────────────
  async streamWriteFile(path: string, stream: AsyncIterable<string>): Promise<void> {
    return this.root.streamWriteFile(joinPath(this.prefix, path), stream)
  }

  async streamAppendFile(path: string, stream: AsyncIterable<string>): Promise<void> {
    return this.root.streamAppendFile(joinPath(this.prefix, path), stream)
  }

  // ── Events: any ───────────────────────────────────────────────────
  onAny(cb: (event: FSEvent) => void): Unsubscribe {
    return this.root.onAny((event) => {
      const localPath = stripPrefix(this.prefix, event.path)
      if (localPath !== event.path) {
        cb({
          ...event,
          path: localPath,
          oldPath: event.oldPath ? stripPrefix(this.prefix, event.oldPath) : undefined
        })
      }
    })
  }

  // ── Events: file-level ────────────────────────────────────────────
  onFile(path: string, cb: (event: FSEvent) => void): Unsubscribe {
    return this.root.onFile(joinPath(this.prefix, path), (event) => {
      cb({
        ...event,
        path: stripPrefix(this.prefix, event.path),
        oldPath: event.oldPath ? stripPrefix(this.prefix, event.oldPath) : undefined
      })
    })
  }

  onFileCreate(path: string, cb: (content: string) => void): Unsubscribe {
    return this.root.onFileCreate(joinPath(this.prefix, path), cb)
  }

  onFileUpdate(path: string, cb: (content: string) => void): Unsubscribe {
    return this.root.onFileUpdate(joinPath(this.prefix, path), cb)
  }

  onFileDelete(path: string, cb: () => void): Unsubscribe {
    return this.root.onFileDelete(joinPath(this.prefix, path), cb)
  }

  onFileRename(path: string, cb: (newPath: string) => void): Unsubscribe {
    return this.root.onFileRename(joinPath(this.prefix, path), (newPath) => {
      cb(stripPrefix(this.prefix, newPath))
    })
  }

  // ── Events: directory-level ───────────────────────────────────────
  onDir(dir: string, cb: (event: DirEvent) => void): Unsubscribe {
    return this.root.onDir(joinPath(this.prefix, dir), (event) => {
      const localDir = stripPrefix(this.prefix, event.dir)
      if (localDir !== event.dir) {
        cb({
          ...event,
          dir: localDir
        })
      }
    })
  }

  onDirAdd(dir: string, cb: (entry: string, content: string) => void): Unsubscribe {
    return this.root.onDirAdd(joinPath(this.prefix, dir), cb)
  }

  onDirRemove(dir: string, cb: (entry: string) => void): Unsubscribe {
    return this.root.onDirRemove(joinPath(this.prefix, dir), cb)
  }

  onDirRename(dir: string, cb: (oldEntry: string, newEntry: string) => void): Unsubscribe {
    return this.root.onDirRename(joinPath(this.prefix, dir), cb)
  }

  // ── Events: prefix-level ──────────────────────────────────────────
  onPrefix(prefix: string, cb: (event: FSEvent) => void): Unsubscribe {
    const fullPrefix = joinPath(this.prefix, prefix)
    return this.root.onPrefix(fullPrefix, (event) => {
      const localPath = stripPrefix(this.prefix, event.path)
      const localPrefix = stripPrefix(this.prefix, fullPrefix)
      cb({
        ...event,
        path: localPath,
        oldPath: event.oldPath ? stripPrefix(this.prefix, event.oldPath) : undefined
      })
    })
  }

  // ── Events: glob-level ────────────────────────────────────────────
  onGlob(pattern: string, cb: (event: FSEvent) => void): Unsubscribe {
    // For glob, we need to transform the pattern to include our prefix
    // and then strip it from events
    const fullPattern = this.prefix
      ? (pattern.startsWith('*') ? `${this.prefix}/${pattern}` : joinPath(this.prefix, pattern))
      : pattern

    return this.root.onGlob(fullPattern, (event) => {
      const localPath = stripPrefix(this.prefix, event.path)
      if (localPath !== event.path) {
        cb({
          ...event,
          path: localPath,
          oldPath: event.oldPath ? stripPrefix(this.prefix, event.oldPath) : undefined
        })
      }
    })
  }

  // ── Events: batch ─────────────────────────────────────────────────
  onBatch(cb: (event: BatchEvent) => void): Unsubscribe {
    return this.root.onBatch((batchEvent) => {
      const transformedEvents = batchEvent.events.map(event => ({
        ...event,
        path: stripPrefix(this.prefix, event.path),
        oldPath: event.oldPath ? stripPrefix(this.prefix, event.oldPath) : undefined
      }))

      // Only notify if at least one event is within our scope
      const hasScopedEvents = transformedEvents.some(
        e => e.path !== batchEvent.events[0]?.path
      )

      if (hasScopedEvents) {
        cb({ events: transformedEvents })
      }
    })
  }

  // ── Access to root ─────────────────────────────────────────────────
  getRoot(): AppFS {
    return this.root
  }

  getPrefix(): string {
    return this.prefix
  }
}

// ── Concrete FS classes ───────────────────────────────────────────────

export class UserFS extends ScopedFS {
  constructor(root: AppFS, username: string) {
    super(root, username)
  }
}

export class StudioFS extends ScopedFS {
  constructor(root: AppFS, username: string, studioId: string) {
    super(root, `${username}/${studioId}`)
  }
}

export class SpaceFS extends ScopedFS {
  constructor(root: AppFS, username: string, studioId: string, spaceId: string) {
    super(root, `${username}/${studioId}/${spaceId}`)
  }

  // Convenience constructor from StudioFS
  static fromStudioFS(studioFS: StudioFS, spaceId: string): SpaceFS {
    const root = studioFS.getRoot()
    const prefix = studioFS.getPrefix()
    const username = prefix.split('/')[0]
    const studioId = prefix.split('/')[1]
    return new SpaceFS(root, username, studioId, spaceId)
  }
}
