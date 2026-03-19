import type { AgentRegistry } from '../sandbox/agent-registry'
import { renderTaskLine } from './message-builder'

/**
 * Generate the {{AGENTS}} block showing the state of all tracked agent promises.
 * Returns null if no entries are visible.
 */
export function generateAgentsBlock(
  registry: AgentRegistry,
  resolvedInThisStop: Set<string>,
): string | null {
  if (!registry.hasVisibleEntries()) return null

  const currentTurn = registry.getCurrentTurn()
  const lines: string[] = ['{{AGENTS}}']

  for (const entry of registry.getAll()) {
    const turnsSinceRegistered = currentTurn - entry.registeredTurn
    const completedTurnDistance = entry.completedAt != null
      ? currentTurn - entry.registeredTurn
      : 0

    // Decay: 6+ turns after completion → removed
    if (
      (entry.status === 'resolved' || entry.status === 'failed') &&
      completedTurnDistance >= 6
    ) {
      continue
    }

    const width = Math.max(1, 60 - entry.varName.length - entry.label.length - 5)
    lines.push(`┌ ${entry.varName} — ${entry.label} ${'─'.repeat(width)}┐`)

    // Compact mode: 3-5 turns after completion
    const isCompact =
      (entry.status === 'resolved' || entry.status === 'failed') &&
      completedTurnDistance >= 3

    if (entry.status === 'running') {
      lines.push(`│ ◉ running${' '.repeat(52)}│`)

      // Show nested tasklist if child has one
      const snapshot = registry.getSnapshot(entry.varName)
      if (snapshot?.tasklistsState && snapshot.tasklistsState.tasklists.size > 0) {
        for (const [tlId, tlState] of snapshot.tasklistsState.tasklists) {
          const tlWidth = Math.max(1, 56 - tlId.length - 3)
          lines.push(`│ ┌ tasks ${'─'.repeat(tlWidth)}┐  │`)
          for (const task of tlState.plan.tasks) {
            const { symbol, detail } = renderTaskLine(task, tlState)
            lines.push(`│ │ ${symbol} ${task.id.padEnd(16)} ${detail.padEnd(36)}│  │`)
          }
          lines.push(`│ └${'─'.repeat(Math.max(1, 57))}┘  │`)
        }
      } else {
        lines.push(`│ (no tasklist)${' '.repeat(48)}│`)
      }
    } else if (entry.status === 'waiting') {
      lines.push(`│ ? waiting — needs input from parent${' '.repeat(26)}│`)
      if (entry.pendingQuestion && !isCompact) {
        lines.push(`│ ┌ question ────────────────────────────────────────────┐   │`)
        const msg = entry.pendingQuestion.message.slice(0, 50)
        lines.push(`│ │ "${msg}"${' '.repeat(Math.max(1, 51 - msg.length))}│   │`)
        const schemaEntries = Object.entries(entry.pendingQuestion.schema)
        if (schemaEntries.length > 0) {
          lines.push(`│ │ schema: {${' '.repeat(43)}│   │`)
          for (const [key, val] of schemaEntries.slice(0, 5)) {
            const typeStr = formatSchemaValue(val)
            lines.push(`│ │   ${key}: ${typeStr}`.padEnd(56) + '│   │')
          }
          if (schemaEntries.length > 5) {
            lines.push(`│ │   ... +${schemaEntries.length - 5} more`.padEnd(56) + '│   │')
          }
          lines.push(`│ │ }`.padEnd(56) + '│   │')
        }
        lines.push(`│ └────────────────────────────────────────────────────────┘   │`)
      }
    } else if (entry.status === 'resolved') {
      if (isCompact) {
        lines.push(`│ ✓ resolved${' '.repeat(51)}│`)
      } else if (resolvedInThisStop.has(entry.varName)) {
        lines.push(`│ ✓ (value included in this stop payload)${' '.repeat(22)}│`)
      } else {
        lines.push(`│ ✓ resolved${' '.repeat(51)}│`)
      }
    } else if (entry.status === 'failed') {
      if (isCompact) {
        lines.push(`│ ✗ failed${' '.repeat(53)}│`)
      } else {
        const errMsg = (entry.error ?? 'unknown error').slice(0, 50)
        lines.push(`│ ✗ ${errMsg.padEnd(59)}│`)
      }
    }

    lines.push(`└${'─'.repeat(63)}┘`)
  }

  // If only the header was added (all entries were decayed), return null
  if (lines.length === 1) return null

  return lines.join('\n')
}

/**
 * Format a JSON schema value for display in the {{AGENTS}} block.
 * e.g. { type: "string", enum: ["rare", "medium"] } → "rare" | "medium"
 *      { type: "number" } → number
 */
function formatSchemaValue(val: unknown): string {
  if (!val || typeof val !== 'object') return String(val)
  const obj = val as Record<string, unknown>
  if (Array.isArray(obj.enum)) {
    return obj.enum.slice(0, 4).map(e => `"${e}"`).join(' | ') +
      (obj.enum.length > 4 ? ` | ...` : '')
  }
  if (typeof obj.type === 'string') return obj.type
  return JSON.stringify(val).slice(0, 30)
}
