// src/lib/fs/FSInterface.ts

import type { FileTree, DirEntry, FileOp, Unsubscribe } from '../../types/studio'
import type { FSEvent, DirEvent, BatchEvent } from './events'

/**
 * FSInterface - The complete file system interface contract
 *
 * Both AppFS and all scoped FS classes (UserFS, StudioFS, SpaceFS) implement this.
 * Scoped classes transparently strip their prefix before delivering events/paths.
 */
export interface FSInterface {
  // ── useSyncExternalStore (coarse-grained, legacy compat) ──────────
  subscribe(cb: () => void): Unsubscribe
  getSnapshot(): Readonly<FileTree>

  // ── Read ──────────────────────────────────────────────────────────
  readFile(path: string): string | null
  readDir(path: string): DirEntry[]
  glob(pattern: string): string[]
  globRead(pattern: string): FileTree

  // ── Write (sync) ──────────────────────────────────────────────────
  writeFile(path: string, content: string): void
  appendFile(path: string, content: string): void
  deleteFile(path: string): void
  deletePath(prefix: string): void
  renamePath(oldPrefix: string, newPrefix: string): void
  duplicatePath(source: string, dest: string): void
  batch(ops: FileOp[]): void

  // ── Write (streaming) ─────────────────────────────────────────────
  streamWriteFile(path: string, stream: AsyncIterable<string>): Promise<void>
  streamAppendFile(path: string, stream: AsyncIterable<string>): Promise<void>

  // ── Events: any ───────────────────────────────────────────────────
  onAny(cb: (event: FSEvent) => void): Unsubscribe

  // ── Events: file-level ────────────────────────────────────────────
  onFile(path: string, cb: (event: FSEvent) => void): Unsubscribe
  onFileCreate(path: string, cb: (content: string) => void): Unsubscribe
  onFileUpdate(path: string, cb: (content: string) => void): Unsubscribe
  onFileDelete(path: string, cb: () => void): Unsubscribe
  onFileRename(path: string, cb: (newPath: string) => void): Unsubscribe

  // ── Events: directory-level ───────────────────────────────────────
  onDir(dir: string, cb: (event: DirEvent) => void): Unsubscribe
  onDirAdd(dir: string, cb: (entry: string, content: string) => void): Unsubscribe
  onDirRemove(dir: string, cb: (entry: string) => void): Unsubscribe
  onDirRename(dir: string, cb: (oldEntry: string, newEntry: string) => void): Unsubscribe

  // ── Events: prefix-level ──────────────────────────────────────────
  onPrefix(prefix: string, cb: (event: FSEvent) => void): Unsubscribe

  // ── Events: glob-level ────────────────────────────────────────────
  onGlob(pattern: string, cb: (event: FSEvent) => void): Unsubscribe

  // ── Events: batch ─────────────────────────────────────────────────
  onBatch(cb: (event: BatchEvent) => void): Unsubscribe
}
