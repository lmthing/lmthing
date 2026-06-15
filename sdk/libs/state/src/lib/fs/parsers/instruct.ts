// src/lib/fs/parsers/instruct.ts
//
// Parser/serializer for agents/<slug>/instruct.md — NEW SPEC.
// Frontmatter fields: title, knowledge[], functions[], components[],
// actions[]{id,label,description,tasklist}, defaultAction?, dependencies[].
// Body is the system-prompt markdown.
//
// NOTE: We use a custom block-YAML parser rather than the shared frontmatter
// helper because the new instruct.md uses multi-line block lists and block
// mappings (the shape scaffoldSpace.ts writes) that the simple inline parser
// in frontmatter.ts does not handle.

export interface AgentAction {
  id: string
  label: string
  description: string
  tasklist: string
}

export interface AgentInstruct {
  title: string
  knowledge: string[]
  functions: string[]
  components: string[]
  actions: AgentAction[]
  defaultAction?: string
  dependencies: string[]
  /** System-prompt body (everything after the frontmatter block) */
  body: string
}

// ---------------------------------------------------------------------------
// Block YAML parser (single-document, handles block lists and block mappings)
// ---------------------------------------------------------------------------

const FM_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/

function parseBlockYaml(yaml: string): Record<string, unknown> {
  const lines = yaml.split('\n')
  const result: Record<string, unknown> = {}
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) { i++; continue }

    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) { i++; continue }

    const key = trimmed.slice(0, colonIdx).trim()
    const rest = trimmed.slice(colonIdx + 1).trim()

    if (rest === '' || rest === '[]' || rest === '{}') {
      if (rest === '[]') { result[key] = []; i++; continue }
      if (rest === '{}') { result[key] = {}; i++; continue }
      // blank after colon → could be block list or block mapping
      const items: unknown[] = []
      i++
      while (i < lines.length) {
        const nextLine = lines[i]
        if (!nextLine.trim()) { break }
        const indent = nextLine.match(/^(\s+)/)?.[1].length ?? 0
        if (indent < 2) break // back to top level
        const nextTrimmed = nextLine.trim()

        if (nextTrimmed.startsWith('- ')) {
          // block sequence item
          const itemContent = nextTrimmed.slice(2).trim()
          if (itemContent.includes(':') && !itemContent.startsWith('"') && !itemContent.startsWith("'")) {
            // inline mapping: "- id: foo"
            const obj: Record<string, unknown> = {}
            parseInlineKv(itemContent, obj)
            i++
            // read continuation lines (deeper indent)
            while (i < lines.length) {
              const cl = lines[i]
              if (!cl.trim()) break
              const clIndent = cl.match(/^(\s+)/)?.[1].length ?? 0
              if (clIndent < 4) break
              parseInlineKv(cl.trim(), obj)
              i++
            }
            items.push(obj)
          } else {
            items.push(parseScalar(itemContent))
            i++
          }
        } else {
          break
        }
      }
      result[key] = items
    } else if (rest.startsWith('[') && rest.endsWith(']')) {
      // inline array
      const inner = rest.slice(1, -1).trim()
      result[key] = inner ? inner.split(',').map(v => parseScalar(v.trim())) : []
      i++
    } else {
      result[key] = parseScalar(rest)
      i++
    }
  }

  return result
}

function parseInlineKv(text: string, target: Record<string, unknown>): void {
  const colonIdx = text.indexOf(':')
  if (colonIdx === -1) return
  const k = text.slice(0, colonIdx).trim()
  const v = text.slice(colonIdx + 1).trim()
  if (k) target[k] = parseScalar(v)
}

function parseScalar(value: string): unknown {
  if (!value) return ''
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null' || value === '~') return null
  if ((value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'")))
    return value.slice(1, -1)
  const num = Number(value)
  if (!isNaN(num) && value !== '') return num
  return value
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  if (typeof value === 'string' && value.trim() !== '') return [value]
  return []
}

function parseActions(value: unknown): AgentAction[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null)
    .map((v) => ({
      id: typeof v.id === 'string' ? v.id : '',
      label: typeof v.label === 'string' ? v.label : '',
      description: typeof v.description === 'string' ? v.description : '',
      tasklist: typeof v.tasklist === 'string' ? v.tasklist : '',
    }))
}

/**
 * Parse the raw content of agents/<slug>/instruct.md into an AgentInstruct.
 */
export function parseAgentInstruct(content: string): AgentInstruct {
  const match = content.match(FM_REGEX)
  if (!match) {
    return {
      title: '',
      knowledge: [],
      functions: [],
      components: [],
      actions: [],
      dependencies: [],
      body: content.trim(),
    }
  }

  const raw = parseBlockYaml(match[1])
  const body = match[2].trim()

  return {
    title: typeof raw.title === 'string' ? raw.title : '',
    knowledge: toStringArray(raw.knowledge),
    functions: toStringArray(raw.functions),
    components: toStringArray(raw.components),
    actions: parseActions(raw.actions),
    defaultAction: typeof raw.defaultAction === 'string' ? raw.defaultAction : undefined,
    dependencies: toStringArray(raw.dependencies),
    body,
  }
}

// ---------------------------------------------------------------------------
// Serialize
// ---------------------------------------------------------------------------

/**
 * Serialize an AgentInstruct back to the on-disk format that scaffoldSpace.ts
 * produces and the framework loader expects.
 *
 * Arrays are serialized as YAML block lists; actions as block sequences of
 * mappings — so the output is human-readable and round-trips cleanly.
 */
export function serializeAgentInstruct(instruct: AgentInstruct): string {
  const lines: string[] = ['---', `title: ${instruct.title}`]

  // knowledge
  if ((instruct.knowledge ?? []).length > 0) {
    lines.push('knowledge:')
    for (const k of instruct.knowledge) lines.push(`  - ${k}`)
  } else {
    lines.push('knowledge: []')
  }

  // functions
  if ((instruct.functions ?? []).length > 0) {
    lines.push('functions:')
    for (const f of instruct.functions) lines.push(`  - ${f}`)
  } else {
    lines.push('functions: []')
  }

  // components
  if ((instruct.components ?? []).length > 0) {
    lines.push('components:')
    for (const c of instruct.components) lines.push(`  - ${c}`)
  } else {
    lines.push('components: []')
  }

  // defaultAction (optional)
  if (instruct.defaultAction) {
    lines.push(`defaultAction: ${instruct.defaultAction}`)
  }

  // actions
  if ((instruct.actions ?? []).length > 0) {
    lines.push('actions:')
    for (const a of instruct.actions) {
      lines.push(`  - id: ${a.id}`)
      lines.push(`    label: "${(a.label ?? '').replace(/"/g, '\\"')}"`)
      lines.push(`    description: "${(a.description ?? '').replace(/"/g, '\\"')}"`)
      lines.push(`    tasklist: ${a.tasklist}`)
    }
  } else {
    lines.push('actions: []')
  }

  // dependencies
  if ((instruct.dependencies ?? []).length > 0) {
    lines.push('dependencies:')
    for (const d of instruct.dependencies) lines.push(`  - ${d}`)
  } else {
    lines.push('dependencies: []')
  }

  lines.push('---')
  lines.push('')
  lines.push((instruct.body ?? '').trim())

  return lines.join('\n')
}
