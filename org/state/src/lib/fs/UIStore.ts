// src/lib/fs/UIStore.ts

import type { Unsubscribe } from '../../types/studio'

type Subscriber = () => void

/**
 * Ephemeral in-memory store for UI state (expanded sections, open modals, etc.)
 * Not persisted to FS or localStorage — purely transient view state.
 * Uses useSyncExternalStore-compatible subscribe/getSnapshot pattern.
 */
export class UIStore {
  private state = new Map<string, unknown>()
  private listeners = new Set<Subscriber>()
  private snapshotCache: Record<string, unknown> | null = null

  get<T>(key: string): T | undefined {
    return this.state.get(key) as T | undefined
  }

  set<T>(key: string, value: T): void {
    const current = this.state.get(key)
    if (Object.is(current, value)) return
    this.state.set(key, value)
    this.snapshotCache = null
    this.notify()
  }

  delete(key: string): void {
    if (this.state.has(key)) {
      this.state.delete(key)
      this.snapshotCache = null
      this.notify()
    }
  }

  has(key: string): boolean {
    return this.state.has(key)
  }

  clear(): void {
    if (this.state.size === 0) return
    this.state.clear()
    this.snapshotCache = null
    this.notify()
  }

  // ── useSyncExternalStore compatibility ─────────────────────────────
  subscribe(cb: Subscriber): Unsubscribe {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  getSnapshot(): Record<string, unknown> {
    if (!this.snapshotCache) {
      this.snapshotCache = Object.fromEntries(this.state)
    }
    return this.snapshotCache
  }

  private notify(): void {
    for (const cb of this.listeners) {
      cb()
    }
  }
}
