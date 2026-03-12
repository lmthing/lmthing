// src/lib/fs/FSEventBus.ts

import type { FSEvent, DirEvent, BatchEvent, FSEventType, DirEventType } from './events'
import { globToRegex as _globToRegex, expandBraces } from './glob'

type EventCallback = (event: FSEvent) => void
type BatchCallback = (event: BatchEvent) => void
type FileCallback = (event: FSEvent) => void
type ContentCallback = (content: string) => void
type VoidCallback = () => void
type RenameCallback = (newPath: string) => void
type DirCallback = (event: DirEvent) => void
type DirAddCallback = (entry: string, content: string) => void
type DirRemoveCallback = (entry: string) => void
type DirRenameCallback = (oldEntry: string, newEntry: string) => void

interface TrieNode {
  children: Map<string, TrieNode>
  callbacks: Set<EventCallback>
}

interface GlobMatcher {
  pattern: string
  regex: RegExp
  callbacks: Set<EventCallback>
}

export class FSEventBus {
  private anyListeners = new Set<EventCallback>()
  private fileListeners = new Map<string, Set<FileCallback>>()
  private fileCreateListeners = new Map<string, Set<ContentCallback>>()
  private fileUpdateListeners = new Map<string, Set<ContentCallback>>()
  private fileDeleteListeners = new Map<string, Set<VoidCallback>>()
  private fileRenameListeners = new Map<string, Set<RenameCallback>>()
  private dirListeners = new Map<string, Set<DirCallback>>()
  private dirAddListeners = new Map<string, Set<DirAddCallback>>()
  private dirRemoveListeners = new Map<string, Set<DirRemoveCallback>>()
  private dirRenameListeners = new Map<string, Set<DirRenameCallback>>()
  private prefixTrie: TrieNode = { children: new Map(), callbacks: new Set() }
  private globMatchers: GlobMatcher[] = []
  private batchListeners = new Set<BatchCallback>()
  private currentBatch: FSEvent[] = []
  private batchDepth = 0

  // ── Emit ──────────────────────────────────────────────────────────
  emit(event: FSEvent): void {
    // If we're in a batch, collect the event
    if (this.batchDepth > 0) {
      this.currentBatch.push(event)
      return
    }

    this.dispatchEvent(event)
  }

  emitBatch(events: FSEvent[]): void {
    // Fire individual events
    for (const event of events) {
      this.dispatchEvent(event)
    }

    // Fire batch listeners
    if (this.batchListeners.size > 0) {
      const batchEvent: BatchEvent = { events }
      for (const cb of this.batchListeners) {
        cb(batchEvent)
      }
    }
  }

  private dispatchEvent(event: FSEvent): void {
    // 1. onAny listeners
    for (const cb of this.anyListeners) {
      cb(event)
    }

    const { type, path, oldPath, content } = event

    // 2. onFile listeners (exact path match)
    const fileCbs = this.fileListeners.get(path)
    if (fileCbs) {
      for (const cb of fileCbs) {
        cb(event)
      }
    }

    // 3. File-type specific listeners
    if (type === 'create' && content !== undefined) {
      const createCbs = this.fileCreateListeners.get(path)
      if (createCbs) {
        for (const cb of createCbs) {
          cb(content)
        }
      }
    }

    if (type === 'update' && content !== undefined) {
      const updateCbs = this.fileUpdateListeners.get(path)
      if (updateCbs) {
        for (const cb of updateCbs) {
          cb(content)
        }
      }
    }

    if (type === 'delete') {
      const deleteCbs = this.fileDeleteListeners.get(path)
      if (deleteCbs) {
        for (const cb of deleteCbs) {
          cb()
        }
      }
    }

    if (type === 'rename' && oldPath) {
      // Old path listeners
      const renameCbs = this.fileRenameListeners.get(oldPath)
      if (renameCbs) {
        for (const cb of renameCbs) {
          cb(path)
        }
      }
    }

    // 4. Prefix listeners (trie-based)
    this.dispatchPrefix(path, event)

    // 5. Directory listeners (immediate children only)
    const dir = this.dirname(path)
    const entry = this.basename(path)
    this.dispatchDir(dir, entry, type, path, content, oldPath)

    // 6. Glob listeners
    for (const { regex, callbacks } of this.globMatchers) {
      if (regex.test(path)) {
        for (const cb of callbacks) {
          cb(event)
        }
      }
    }
  }

  private dispatchPrefix(path: string, event: FSEvent): void {
    const segments = path.split('/')
    let node = this.prefixTrie

    for (const segment of segments) {
      const child = node.children.get(segment)
      if (!child) break
      node = child
      for (const cb of node.callbacks) {
        cb(event)
      }
    }
  }

  private dispatchDir(
    dir: string,
    entry: string,
    type: FSEventType,
    path: string,
    content: string | undefined,
    oldPath: string | undefined
  ): void {
    const dirCbs = this.dirListeners.get(dir)
    if (!dirCbs && !this.dirAddListeners.has(dir) && !this.dirRemoveListeners.has(dir) && !this.dirRenameListeners.has(dir)) {
      return
    }

    let dirEvent: DirEvent | undefined
    let eventType: DirEventType | undefined

    if (type === 'create') {
      eventType = 'add'
      dirEvent = { type: 'add', dir, entry, content }
    } else if (type === 'delete') {
      eventType = 'remove'
      dirEvent = { type: 'remove', dir, entry }
    } else if (type === 'rename' && oldPath) {
      eventType = 'rename'
      const oldEntry = this.basename(oldPath)
      dirEvent = { type: 'rename', dir, entry, oldEntry }
    }

    if (!dirEvent) return

    if (dirCbs) {
      for (const cb of dirCbs) {
        cb(dirEvent)
      }
    }

    if (eventType === 'add') {
      const addCbs = this.dirAddListeners.get(dir)
      if (addCbs && content !== undefined) {
        for (const cb of addCbs) {
          cb(entry, content)
        }
      }
    }

    if (eventType === 'remove') {
      const removeCbs = this.dirRemoveListeners.get(dir)
      if (removeCbs) {
        for (const cb of removeCbs) {
          cb(entry)
        }
      }
    }

    if (eventType === 'rename' && oldPath) {
      const renameCbs = this.dirRenameListeners.get(dir)
      if (renameCbs) {
        const oldEntry = this.basename(oldPath)
        for (const cb of renameCbs) {
          cb(oldEntry, entry)
        }
      }
    }
  }

  private dirname(path: string): string {
    const idx = path.lastIndexOf('/')
    return idx === -1 ? '' : path.slice(0, idx)
  }

  private basename(path: string): string {
    const idx = path.lastIndexOf('/')
    return idx === -1 ? path : path.slice(idx + 1)
  }

  // ── Subscribe: any ────────────────────────────────────────────────
  onAny(cb: EventCallback): () => void {
    this.anyListeners.add(cb)
    return () => this.anyListeners.delete(cb)
  }

  // ── Subscribe: file-level ─────────────────────────────────────────
  onFile(path: string, cb: FileCallback): () => void {
    if (!this.fileListeners.has(path)) {
      this.fileListeners.set(path, new Set())
    }
    this.fileListeners.get(path)!.add(cb)
    return () => this.fileListeners.get(path)?.delete(cb)
  }

  onFileCreate(path: string, cb: ContentCallback): () => void {
    if (!this.fileCreateListeners.has(path)) {
      this.fileCreateListeners.set(path, new Set())
    }
    this.fileCreateListeners.get(path)!.add(cb)
    return () => this.fileCreateListeners.get(path)?.delete(cb)
  }

  onFileUpdate(path: string, cb: ContentCallback): () => void {
    if (!this.fileUpdateListeners.has(path)) {
      this.fileUpdateListeners.set(path, new Set())
    }
    this.fileUpdateListeners.get(path)!.add(cb)
    return () => this.fileUpdateListeners.get(path)?.delete(cb)
  }

  onFileDelete(path: string, cb: VoidCallback): () => void {
    if (!this.fileDeleteListeners.has(path)) {
      this.fileDeleteListeners.set(path, new Set())
    }
    this.fileDeleteListeners.get(path)!.add(cb)
    return () => this.fileDeleteListeners.get(path)?.delete(cb)
  }

  onFileRename(path: string, cb: RenameCallback): () => void {
    if (!this.fileRenameListeners.has(path)) {
      this.fileRenameListeners.set(path, new Set())
    }
    this.fileRenameListeners.get(path)!.add(cb)
    return () => this.fileRenameListeners.get(path)?.delete(cb)
  }

  // ── Subscribe: directory-level (immediate children only) ──────────
  onDir(dir: string, cb: DirCallback): () => void {
    if (!this.dirListeners.has(dir)) {
      this.dirListeners.set(dir, new Set())
    }
    this.dirListeners.get(dir)!.add(cb)
    return () => this.dirListeners.get(dir)?.delete(cb)
  }

  onDirAdd(dir: string, cb: DirAddCallback): () => void {
    if (!this.dirAddListeners.has(dir)) {
      this.dirAddListeners.set(dir, new Set())
    }
    this.dirAddListeners.get(dir)!.add(cb)
    return () => this.dirAddListeners.get(dir)?.delete(cb)
  }

  onDirRemove(dir: string, cb: DirRemoveCallback): () => void {
    if (!this.dirRemoveListeners.has(dir)) {
      this.dirRemoveListeners.set(dir, new Set())
    }
    this.dirRemoveListeners.get(dir)!.add(cb)
    return () => this.dirRemoveListeners.get(dir)?.delete(cb)
  }

  onDirRename(dir: string, cb: DirRenameCallback): () => void {
    if (!this.dirRenameListeners.has(dir)) {
      this.dirRenameListeners.set(dir, new Set())
    }
    this.dirRenameListeners.get(dir)!.add(cb)
    return () => this.dirRenameListeners.get(dir)?.delete(cb)
  }

  // ── Subscribe: prefix-level (all descendants) ─────────────────────
  onPrefix(prefix: string, cb: EventCallback): () => void {
    const segments = prefix.split('/').filter(Boolean)
    let node = this.prefixTrie

    for (const segment of segments) {
      let child = node.children.get(segment)
      if (!child) {
        child = { children: new Map(), callbacks: new Set() }
        node.children.set(segment, child)
      }
      node = child
    }

    node.callbacks.add(cb)

    return () => {
      node.callbacks.delete(cb)
      // Note: we don't clean up empty trie nodes for simplicity
    }
  }

  // ── Subscribe: glob-level ─────────────────────────────────────────
  onGlob(pattern: string, cb: FileCallback): () => void {
    let matcher = this.globMatchers.find(m => m.pattern === pattern)

    if (!matcher) {
      // Convert glob pattern to regex
      const regex = this.globToRegex(pattern)
      matcher = { pattern, regex, callbacks: new Set() }
      this.globMatchers.push(matcher)
    }

    matcher.callbacks.add(cb)

    return () => {
      matcher.callbacks.delete(cb)
      // Clean up if no more callbacks
      if (matcher.callbacks.size === 0) {
        const idx = this.globMatchers.indexOf(matcher)
        if (idx !== -1) {
          this.globMatchers.splice(idx, 1)
        }
      }
    }
  }

  private globToRegex(pattern: string): RegExp {
    const expanded = expandBraces(pattern)
    if (expanded.length === 1) return _globToRegex(expanded[0])
    const parts = expanded.map(p => _globToRegex(p).source)
    return new RegExp(parts.join('|'))
  }

  // ── Subscribe: batch ──────────────────────────────────────────────
  onBatch(cb: BatchCallback): () => void {
    this.batchListeners.add(cb)
    return () => this.batchListeners.delete(cb)
  }

  // ── Batch control ─────────────────────────────────────────────────
  beginBatch(): void {
    this.batchDepth++
  }

  endBatch(): void {
    this.batchDepth--
    if (this.batchDepth === 0 && this.currentBatch.length > 0) {
      const events = [...this.currentBatch]
      this.currentBatch = []
      this.emitBatch(events)
    }
  }

  async batch<T>(fn: () => T): Promise<T> {
    this.beginBatch()
    try {
      const result = await fn()
      this.endBatch()
      return result
    } catch (e) {
      this.endBatch()
      throw e
    }
  }
}
