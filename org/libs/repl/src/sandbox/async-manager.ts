export interface AsyncTask {
  id: string
  label: string
  abortController: AbortController
  promise: Promise<void>
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  startTime: number
  result?: unknown
  error?: string
}

/**
 * Manages background async tasks spawned by async() calls.
 */
export class AsyncManager {
  private tasks = new Map<string, AsyncTask>()
  private results = new Map<string, unknown>()
  private counter = 0
  private maxTasks: number

  constructor(maxTasks = 10) {
    this.maxTasks = maxTasks
  }

  /**
   * Register a new background task.
   */
  register(
    fn: (signal: AbortSignal) => Promise<void>,
    label?: string,
  ): string {
    if (this.getRunningCount() >= this.maxTasks) {
      throw new Error(`Maximum async tasks reached (${this.maxTasks})`)
    }

    const id = `async_${this.counter++}`
    const abortController = new AbortController()
    const startTime = Date.now()

    const promise = fn(abortController.signal)
      .then(() => {
        const task = this.tasks.get(id)
        if (task && task.status === 'running') {
          task.status = 'completed'
        }
      })
      .catch((err) => {
        const task = this.tasks.get(id)
        if (task) {
          if (task.status === 'running') {
            task.status = 'failed'
            task.error = err instanceof Error ? err.message : String(err)
          }
        }
      })

    this.tasks.set(id, {
      id,
      label: label ?? id,
      abortController,
      promise,
      status: 'running',
      startTime,
    })

    return id
  }

  /**
   * Cancel a task by ID.
   */
  cancel(taskId: string, message = 'cancelled by user'): boolean {
    const task = this.tasks.get(taskId)
    if (!task || task.status !== 'running') return false

    task.abortController.abort(message)
    task.status = 'cancelled'
    this.results.set(taskId, { cancelled: true, message })
    return true
  }

  /**
   * Store a result from a task's scoped stop() call.
   */
  setResult(taskId: string, value: unknown): void {
    this.results.set(taskId, value)
  }

  /**
   * Drain all accumulated results and clear the results map.
   */
  drainResults(): Map<string, unknown> {
    const drained = new Map(this.results)
    this.results.clear()
    return drained
  }

  /**
   * Get a task by ID.
   */
  getTask(taskId: string): AsyncTask | undefined {
    return this.tasks.get(taskId)
  }

  /**
   * Get all tasks.
   */
  getAllTasks(): AsyncTask[] {
    return [...this.tasks.values()]
  }

  /**
   * Get count of currently running tasks.
   */
  getRunningCount(): number {
    return [...this.tasks.values()].filter(t => t.status === 'running').length
  }

  /**
   * Build the async portion of a stop payload.
   * Running tasks show "pending", completed ones show their results.
   */
  buildStopPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {}
    const drained = this.drainResults()

    for (const [taskId, task] of this.tasks) {
      if (drained.has(taskId)) {
        payload[task.label] = drained.get(taskId)
      } else if (task.status === 'running') {
        payload[task.label] = 'pending'
      }
      // completed tasks without results, and failed/cancelled tasks
      // already have their results in drained
    }

    return payload
  }

  /**
   * Wait for all running tasks to complete, with timeout.
   */
  async drain(timeoutMs = 5000): Promise<void> {
    const running = [...this.tasks.values()].filter(t => t.status === 'running')
    if (running.length === 0) return

    await Promise.race([
      Promise.allSettled(running.map(t => t.promise)),
      new Promise(resolve => setTimeout(resolve, timeoutMs)),
    ])
  }

  /**
   * Cancel all running tasks.
   */
  cancelAll(): void {
    for (const task of this.tasks.values()) {
      if (task.status === 'running') {
        task.abortController.abort('session cleanup')
        task.status = 'cancelled'
      }
    }
  }
}
