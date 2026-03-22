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
 * Build a user message after a task completion when there are remaining tasks.
 * Guides the agent to the next ready task with its instructions.
 */
export function buildTaskContinueMessage(
  tasklistId: string,
  completedTaskId: string,
  readyTasks: Array<{ id: string; instructions: string; outputSchema: Record<string, { type: string }> }>,
  tasklistsState: TasklistsState,
): string {
  let msg = `← completeTask ✓ ${tasklistId}/${completedTaskId}`
  if (readyTasks.length > 0) {
    msg += `\n\nNext task:`
    const next = readyTasks[0]
    msg += `\n  Task: ${next.id}`
    msg += `\n  Instructions: ${next.instructions}`
    const schemaStr = Object.entries(next.outputSchema).map(([k, v]) => `${k}: ${v.type}`).join(', ')
    msg += `\n  Expected output: { ${schemaStr} }`
    if (readyTasks.length > 1) {
      msg += `\n\nAlso ready: ${readyTasks.slice(1).map(t => t.id).join(', ')}`
    }
  }
  const tasksBlock = generateTasksBlock(tasklistsState)
  if (tasksBlock) msg += `\n\n${tasksBlock}`
  return msg
}

/**
 * Build a user message for a task order violation.
 * Stops the stream and guides the agent to the correct next task.
 */
export function buildTaskOrderViolationMessage(
  tasklistId: string,
  attemptedTaskId: string,
  readyTasks: Array<{ id: string; instructions: string; outputSchema: Record<string, { type: string }> }>,
  tasklistsState: TasklistsState,
): string {
  let msg = `⚠ [system] Task order violation in tasklist "${tasklistId}": tried to complete "${attemptedTaskId}" but it is not ready.`
  if (readyTasks.length > 0) {
    msg += `\n\nNext task to complete:`
    const next = readyTasks[0]
    msg += `\n  Task: ${next.id}`
    msg += `\n  Instructions: ${next.instructions}`
    const schemaStr = Object.entries(next.outputSchema).map(([k, v]) => `${k}: ${v.type}`).join(', ')
    msg += `\n  Expected output: { ${schemaStr} }`
    if (readyTasks.length > 1) {
      msg += `\n\nAlso ready: ${readyTasks.slice(1).map(t => t.id).join(', ')}`
    }
  }
  msg += '\n\nWork on the ready task above, then call completeTask() when done.'
  const tasksBlock = generateTasksBlock(tasklistsState)
  if (tasksBlock) msg += `\n\n${tasksBlock}`
  return msg
}

/**
 * Generate a {{CURRENT_TASK}} block showing instructions for the next ready task(s).
 * Appended to stop messages alongside {{TASKS}} when tasklists are active.
 */
export function generateCurrentTaskBlock(tasklistsState: TasklistsState): string | null {
  if (tasklistsState.tasklists.size === 0) return null

  const lines: string[] = []
  for (const [tasklistId, state] of tasklistsState.tasklists) {
    // Find ready tasks
    const readyIds = [...state.readyTasks]
    if (readyIds.length === 0) continue

    const next = state.plan.tasks.find(t => t.id === readyIds[0])
    if (!next) continue

    lines.push(`{{CURRENT_TASK}}`)
    lines.push(`Tasklist: ${tasklistId}`)
    lines.push(`Task: ${next.id}`)
    lines.push(`Instructions: ${next.instructions}`)
    const schemaStr = Object.entries(next.outputSchema).map(([k, v]) => `${k}: ${v.type}`).join(', ')
    lines.push(`Expected output: { ${schemaStr} }`)
  }

  return lines.length > 0 ? lines.join('\n') : null
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
