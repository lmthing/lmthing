import type { StopPayload, ErrorPayload, TasklistsState, TaskDefinition, TasklistState } from '../session/types'

/**
 * Build a user message for a stop() injection.
 * Format: ← stop { key: value, ... }
 */
export function buildStopMessage(payload: StopPayload): string {
  const entries = Object.entries(payload)
    .map(([key, sv]) => `${key}: ${sv.display}`)
    .join(', ')
  return `← stop { ${entries} }`
}

/**
 * Build a user message for an error injection.
 * Format: ← error [Type] message (line N)
 */
export function buildErrorMessage(error: ErrorPayload): string {
  return `← error [${error.type}] ${error.message} (line ${error.line})`
}

/**
 * Build a user message for a human intervention.
 * No prefix — raw text.
 */
export function buildInterventionMessage(text: string): string {
  return text
}

/**
 * Build a user message for a hook interrupt.
 * Format: ⚠ [hook:id] message
 */
export function buildHookInterruptMessage(hookId: string, message: string): string {
  return `⚠ [hook:${hookId}] ${message}`
}

/**
 * Build a user message for an incomplete tasklist reminder.
 * Format: ⚠ [system] Tasklist "tasklistId" incomplete. Remaining: id1, id2. Continue from where you left off.
 */
export function buildTasklistReminderMessage(
  tasklistId: string,
  ready: string[],
  blocked: string[],
  failed: string[],
): string {
  let msg = `⚠ [system] Tasklist "${tasklistId}" incomplete.`
  if (ready.length > 0) msg += ` Ready: ${ready.join(', ')}.`
  if (blocked.length > 0) msg += ` Blocked: ${blocked.join(', ')}.`
  if (failed.length > 0) msg += ` Failed: ${failed.join(', ')}.`
  msg += ' Continue with a ready task.'
  return msg
}

/**
 * Build a user message for a loadClass() injection.
 * Format: ← loadClass { class: "Name", methods: ["m1", "m2"] }
 */
export function buildLoadClassMessage(className: string, methods: string[]): string {
  return `← loadClass { class: "${className}", methods: [${methods.map(m => `"${m}"`).join(', ')}] }`
}

/**
 * Compute the symbol and detail string for a single task, given the tasklist state.
 * Reused by generateTasksBlock and agents-block.ts.
 */
export function renderTaskLine(
  task: TaskDefinition,
  state: TasklistState,
): { symbol: string; detail: string } {
  const completion = state.completed.get(task.id)

  if (completion?.status === 'completed') {
    const outputStr = JSON.stringify(completion.output)
    const truncated = outputStr.length > 40 ? outputStr.slice(0, 37) + '...' : outputStr
    return { symbol: '✓', detail: `→ ${truncated}` }
  }
  if (completion?.status === 'failed') {
    return { symbol: '✗', detail: `— ${completion.error ?? 'unknown error'}` }
  }
  if (completion?.status === 'skipped') {
    return { symbol: '⊘', detail: '(skipped — condition was falsy)' }
  }
  if (state.runningTasks.has(task.id)) {
    const progress = state.progressMessages?.get(task.id)
    const detail = progress
      ? `(running — ${progress.percent != null ? progress.percent + '% ' : ''}${progress.message})`
      : '(running)'
    return { symbol: '◉', detail }
  }
  if (state.readyTasks.has(task.id)) {
    return { symbol: '◎', detail: '(ready — deps satisfied)' }
  }
  const deps = task.dependsOn?.join(', ') ?? ''
  return { symbol: '○', detail: deps ? `(blocked — waiting on: ${deps})` : '(pending)' }
}

/**
 * Generate the {{TASKS}} block showing current state of all active tasklists.
 * Appended to stop messages when tasklists are active.
 */
export function generateTasksBlock(tasklistsState: TasklistsState): string | null {
  if (tasklistsState.tasklists.size === 0) return null

  const lines: string[] = ['{{TASKS}}']

  for (const [tasklistId, state] of tasklistsState.tasklists) {
    const width = Math.max(1, 60 - tasklistId.length - 3)
    lines.push(`┌ ${tasklistId} ${'─'.repeat(width)}┐`)

    for (const task of state.plan.tasks) {
      const { symbol, detail } = renderTaskLine(task, state)
      lines.push(`│ ${symbol} ${task.id.padEnd(18)} ${detail.padEnd(40)}│`)
    }

    lines.push(`└${'─'.repeat(63)}┘`)
  }

  return lines.join('\n')
}
