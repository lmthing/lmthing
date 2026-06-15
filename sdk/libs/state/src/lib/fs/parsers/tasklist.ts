// src/lib/fs/parsers/tasklist.ts
//
// Parser/serializer for tasklists/<name>/NN-<id>.md — NEW SPEC.
// Each file frontmatter: id, output{field:type}, dependsOn[]?, optional?, goal?, condition?.
// Body is the instruction text.

import { parseFrontmatter } from './frontmatter'

export type TaskOutput = Record<string, string>

export interface TasklistTask {
  /** 1-based numeric order (from the NN- prefix) */
  order: number
  /** Task id (the part after NN-) */
  id: string
  /** Instruction body */
  instruction: string
  output: TaskOutput
  dependsOn?: string[]
  optional?: boolean
  /** Exactly one task per tasklist should have goal: true */
  goal?: boolean
  condition?: string
}

// ---------------------------------------------------------------------------
// Parse a single NN-<id>.md file
// ---------------------------------------------------------------------------

/**
 * Parse the raw content of a tasklist task file.
 * `filename` is the bare filename like "01-boil_water.md".
 */
export function parseTasklistTask(filename: string, content: string): TasklistTask {
  const { frontmatter: raw, content: body } = parseFrontmatter<Record<string, unknown>>(content)

  // Extract order and id from filename: NN-id.md
  const nameWithoutExt = filename.replace(/\.md$/i, '')
  const match = nameWithoutExt.match(/^(\d+)[_-](.+)$/)
  const order = match ? parseInt(match[1], 10) : 0
  const id = match ? match[2] : (typeof raw.id === 'string' ? raw.id : nameWithoutExt)

  const output = parseOutput(raw.output)
  const dependsOn = parseStringArray(raw.dependsOn)
  const optional = raw.optional === true || raw.optional === 'true'
  const goal = raw.goal === true || raw.goal === 'true'
  const condition = typeof raw.condition === 'string' ? raw.condition : undefined

  return {
    order,
    id,
    instruction: body.trim(),
    output,
    ...(dependsOn.length > 0 ? { dependsOn } : {}),
    ...(optional ? { optional } : {}),
    ...(goal ? { goal } : {}),
    ...(condition !== undefined ? { condition } : {}),
  }
}

function parseOutput(value: unknown): TaskOutput {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const out: TaskOutput = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = typeof v === 'string' ? v : String(v)
    }
    return out
  }
  return { result: 'string' }
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  if (typeof value === 'string' && value.trim() !== '' && value !== '[]') return [value]
  return []
}

// ---------------------------------------------------------------------------
// Serialize a task back to NN-<id>.md content
// ---------------------------------------------------------------------------

/**
 * Serialize a TasklistTask to the on-disk format.
 * `order` is used to build the zero-padded prefix; `id` is the task id.
 */
export function serializeTasklistTask(task: TasklistTask): string {
  const lines: string[] = ['---', `id: ${task.id}`, 'output:']

  for (const [k, v] of Object.entries(task.output)) {
    lines.push(`  ${k}: ${v}`)
  }

  const dependsOn = task.dependsOn ?? []
  if (dependsOn.length > 0) {
    lines.push('dependsOn:')
    for (const d of dependsOn) lines.push(`  - ${d}`)
  } else {
    lines.push('dependsOn: []')
  }

  lines.push(`optional: ${task.optional ?? false}`)
  lines.push(`goal: ${task.goal ?? false}`)

  if (task.condition !== undefined) {
    lines.push(`condition: "${task.condition.replace(/"/g, '\\"')}"`)
  }

  lines.push('---')
  lines.push('')
  lines.push(task.instruction.trim())

  return lines.join('\n')
}

/**
 * Build the zero-padded filename for a task: "01-boil_water.md"
 */
export function tasklistTaskFilename(order: number, id: string): string {
  return `${String(order).padStart(2, '0')}-${id}.md`
}
