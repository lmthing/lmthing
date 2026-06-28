// src/lib/fs/parsers/tasklist.ts
//
// Parser/serializer for tasklists/<name>/NN-<id>.md — NEW SPEC.
// Each file frontmatter: id, input{field:type}?, output{field:type}, dependsOn[]?, optional?, goal?, condition?.
// Body is the instruction text.
// Also handles tasklists/<name>/index.md: frontmatter input{field:type}?, body is description.

export type TaskOutput = Record<string, string>

// ---------------------------------------------------------------------------
// Block-YAML frontmatter parsing
//
// The shared `parseFrontmatter` flattens nested block mappings (it strips
// indentation, so `input:` + `  field: type` becomes a top-level `field` key),
// which loses the `input`/`output` maps. Task frontmatter needs block mappings
// and block lists, so we parse it here with an indentation-aware reader.
// ---------------------------------------------------------------------------

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n?---\s*(?:\n([\s\S]*))?$/

interface ParsedFm {
  fm: Record<string, unknown>
  body: string
}

/** Split a markdown file into its frontmatter map (block-aware) + body. */
function parseTaskFrontmatter(content: string): ParsedFm {
  const match = content.match(FRONTMATTER_RE)
  if (!match) return { fm: {}, body: content }
  const fm = parseBlockYaml(match[1] ?? '')
  return { fm, body: match[2] ?? '' }
}

/** Minimal block-YAML reader: scalars, `key: []`, block lists, nested maps. */
function parseBlockYaml(yaml: string): Record<string, unknown> {
  const lines = yaml.split('\n')
  const result: Record<string, unknown> = {}
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '' || line.trimStart().startsWith('#')) { i++; continue }
    // Only consider top-level (unindented) keys here.
    if (/^\s/.test(line)) { i++; continue }
    const colon = line.indexOf(':')
    if (colon === -1) { i++; continue }
    const key = line.slice(0, colon).trim()
    const rest = line.slice(colon + 1).trim()
    i++
    if (rest === '' ) {
      // Block list, block mapping, or empty — peek the next indented lines.
      const block: string[] = []
      while (i < lines.length && (/^\s+\S/.test(lines[i]) || lines[i].trim() === '')) {
        if (lines[i].trim() === '') { i++; continue }
        block.push(lines[i]); i++
      }
      if (block.length === 0) { result[key] = ''; continue }
      if (block[0].trimStart().startsWith('- ')) {
        result[key] = block.map((l) => parseScalar(l.trimStart().slice(2).trim()))
      } else {
        const map: Record<string, unknown> = {}
        for (const l of block) {
          const c = l.indexOf(':')
          if (c === -1) continue
          map[l.slice(0, c).trim()] = parseScalar(l.slice(c + 1).trim())
        }
        result[key] = map
      }
    } else if (rest === '[]') {
      result[key] = []
    } else if (rest.startsWith('[') && rest.endsWith(']')) {
      const inner = rest.slice(1, -1).trim()
      result[key] = inner ? inner.split(',').map((v) => parseScalar(v.trim())) : []
    } else {
      result[key] = parseScalar(rest)
    }
  }
  return result
}

function parseScalar(value: string): unknown {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }
  if (value === 'true') return true
  if (value === 'false') return false
  return value
}

export interface TasklistTask {
  /** 1-based numeric order (from the NN- prefix) */
  order: number
  /** Task id (the part after NN-) */
  id: string
  /** Instruction body */
  instruction: string
  input?: TaskOutput
  output: TaskOutput
  dependsOn?: string[]
  optional?: boolean
  /** Exactly one task per tasklist should have goal: true */
  goal?: boolean
  condition?: string
}

export interface TasklistIndex {
  input?: Record<string, string>
  description: string
}

// ---------------------------------------------------------------------------
// Parse a single NN-<id>.md file
// ---------------------------------------------------------------------------

/**
 * Parse the raw content of a tasklist task file.
 * `filename` is the bare filename like "01-boil_water.md".
 */
export function parseTasklistTask(filename: string, content: string): TasklistTask {
  const { fm: raw, body } = parseTaskFrontmatter(content)

  // Extract order and id from filename: NN-id.md
  const nameWithoutExt = filename.replace(/\.md$/i, '')
  const match = nameWithoutExt.match(/^(\d+)[_-](.+)$/)
  const order = match ? parseInt(match[1], 10) : 0
  const id = match ? match[2] : (typeof raw.id === 'string' ? raw.id : nameWithoutExt)

  const inputRaw = parseOutputOptional(raw.input)
  const output = parseOutput(raw.output)
  const dependsOn = parseStringArray(raw.dependsOn)
  const optional = raw.optional === true || raw.optional === 'true'
  const goal = raw.goal === true || raw.goal === 'true'
  const condition = typeof raw.condition === 'string' ? raw.condition : undefined

  return {
    order,
    id,
    instruction: body.trim(),
    ...(inputRaw !== undefined ? { input: inputRaw } : {}),
    output,
    ...(dependsOn.length > 0 ? { dependsOn } : {}),
    ...(optional ? { optional } : {}),
    ...(goal ? { goal } : {}),
    ...(condition !== undefined ? { condition } : {}),
  }
}

/**
 * Parse the raw content of a tasklist index file (tasklists/<name>/index.md).
 */
export function parseTasklistIndex(content: string): TasklistIndex {
  const { fm: raw, body } = parseTaskFrontmatter(content)
  const input = parseOutputOptional(raw.input)
  return {
    ...(input !== undefined ? { input } : {}),
    description: body.trim(),
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
  return {}
}

function parseOutputOptional(value: unknown): TaskOutput | undefined {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const out: TaskOutput = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = typeof v === 'string' ? v : String(v)
    }
    return Object.keys(out).length > 0 ? out : undefined
  }
  return undefined
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
  const lines: string[] = ['---', `id: ${task.id}`]

  if (task.input && Object.keys(task.input).length > 0) {
    lines.push('input:')
    for (const [k, v] of Object.entries(task.input)) {
      lines.push(`  ${k}: ${v}`)
    }
  }

  lines.push('output:')
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
 * Serialize a TasklistIndex to the on-disk format for index.md.
 */
export function serializeTasklistIndex(index: TasklistIndex, description: string): string {
  const lines: string[] = ['---']

  if (index.input && Object.keys(index.input).length > 0) {
    lines.push('input:')
    for (const [k, v] of Object.entries(index.input)) {
      lines.push(`  ${k}: ${v}`)
    }
  }

  lines.push('---')
  lines.push('')
  lines.push(description.trim())

  return lines.join('\n')
}

/**
 * Build the zero-padded filename for a task: "01-boil_water.md"
 */
export function tasklistTaskFilename(order: number, id: string): string {
  return `${String(order).padStart(2, '0')}-${id}.md`
}
