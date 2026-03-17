import type { Hook } from '../session/types'

export class HookRegistry {
  private hooks = new Map<string, Hook>()
  private failureCounts = new Map<string, number>()
  private disabledHooks = new Set<string>()
  private maxConsecutiveFailures: number

  constructor(maxConsecutiveFailures = 3) {
    this.maxConsecutiveFailures = maxConsecutiveFailures
  }

  register(hook: Hook): void {
    this.hooks.set(hook.id, hook)
    this.failureCounts.set(hook.id, 0)
  }

  unregister(id: string): boolean {
    this.failureCounts.delete(id)
    this.disabledHooks.delete(id)
    return this.hooks.delete(id)
  }

  get(id: string): Hook | undefined {
    return this.hooks.get(id)
  }

  /**
   * List hooks by phase, excluding disabled hooks.
   */
  listByPhase(phase: 'before' | 'after'): Hook[] {
    return [...this.hooks.values()].filter(
      h => h.phase === phase && !this.disabledHooks.has(h.id),
    )
  }

  /**
   * Record a failure for a hook. After maxConsecutiveFailures, disable it.
   */
  recordFailure(id: string): void {
    const count = (this.failureCounts.get(id) ?? 0) + 1
    this.failureCounts.set(id, count)
    if (count >= this.maxConsecutiveFailures) {
      this.disabledHooks.add(id)
    }
  }

  /**
   * Record a success for a hook (resets failure count).
   */
  recordSuccess(id: string): void {
    this.failureCounts.set(id, 0)
  }

  isDisabled(id: string): boolean {
    return this.disabledHooks.has(id)
  }

  getAll(): Hook[] {
    return [...this.hooks.values()]
  }

  clear(): void {
    this.hooks.clear()
    this.failureCounts.clear()
    this.disabledHooks.clear()
  }
}
