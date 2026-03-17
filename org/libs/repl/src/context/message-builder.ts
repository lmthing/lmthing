import type { StopPayload, ErrorPayload } from '../session/types'

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
 * Build a user message for an incomplete checkpoint reminder.
 * Format: ⚠ [system] Tasklist "tasklistId" incomplete. Remaining: id1, id2. Continue from where you left off.
 */
export function buildCheckpointReminderMessage(tasklistId: string, remainingIds: string[]): string {
  return `⚠ [system] Tasklist "${tasklistId}" incomplete. Remaining: ${remainingIds.join(', ')}. Continue from where you left off.`
}

/**
 * Build a user message for a loadClass() injection.
 * Format: ← loadClass { class: "Name", methods: ["m1", "m2"] }
 */
export function buildLoadClassMessage(className: string, methods: string[]): string {
  return `← loadClass { class: "${className}", methods: [${methods.map(m => `"${m}"`).join(', ')}] }`
}
