// src/lib/fs/DraftStore.ts

import type { Unsubscribe } from '@/types/studio'

export interface DraftChangeEvent {
  path: string
  hasDraft: boolean
}

type ChangeCallback = (event: DraftChangeEvent) => void
type Subscriber = () => void

export class DraftStore {
  private drafts = new Map<string, string>()
  private changeListeners = new Set<ChangeCallback>()
  private subscribeListeners = new Set<Subscriber>()

  // ── Draft operations ───────────────────────────────────────────────
  set(path: string, content: string): void {
    this.drafts.set(path, content)
    this.notifyChange({ path, hasDraft: true })
    this.notify()
  }

  get(path: string): string | undefined {
    return this.drafts.get(path)
  }

  has(path: string): boolean {
    return this.drafts.has(path)
  }

  delete(path: string): void {
    if (this.drafts.has(path)) {
      this.drafts.delete(path)
      this.notifyChange({ path, hasDraft: false })
      this.notify()
    }
  }

  clear(): void {
    if (this.drafts.size === 0) return

    const paths = Array.from(this.drafts.keys())
    this.drafts.clear()

    for (const path of paths) {
      this.notifyChange({ path, hasDraft: false })
    }
    this.notify()
  }

  // ── Bulk operations ────────────────────────────────────────────────
  getAll(): Map<string, string> {
    return new Map(this.drafts)
  }

  getPaths(): string[] {
    return Array.from(this.drafts.keys())
  }

  isEmpty(): boolean {
    return this.drafts.size === 0
  }

  getCount(): number {
    return this.drafts.size
  }

  // ── Change tracking ────────────────────────────────────────────────
  onChange(path: string, cb: (hasDraft: boolean) => void): Unsubscribe {
    const listener = (event: DraftChangeEvent) => {
      if (event.path === path) {
        cb(event.hasDraft)
      }
    }
    this.changeListeners.add(listener)
    return () => this.changeListeners.delete(listener)
  }

  // ── useSyncExternalStore compatibility ─────────────────────────────
  subscribe(cb: Subscriber): Unsubscribe {
    this.subscribeListeners.add(cb)
    return () => this.subscribeListeners.delete(cb)
  }

  getSnapshot(): Record<string, string> {
    return Object.fromEntries(this.drafts)
  }

  // ── Internal notification ───────────────────────────────────────────
  private notifyChange(event: DraftChangeEvent): void {
    for (const cb of this.changeListeners) {
      cb(event)
    }
  }

  private notify(): void {
    for (const cb of this.subscribeListeners) {
      cb()
    }
  }
}
