// src/lib/fs/parsers/instruct.ts
//
// Parser/serializer for agents/<slug>/instruct.md — NEW SPEC.
// Frontmatter fields: title, knowledge[], functions[], components[],
// actions[]{id,label,description,tasklist}, defaultAction?, canDelegateTo[].
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
  /** space-ref/agent-slug, #action, bare slug, or npm: delegation targets */
  canDelegateTo: string[]
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
      // blank after colon → could be a block list, a block mapping, or empty.
      // Peek at the first non-blank child line to decide.
      let peek = i + 1
      while (peek < lines.length && !lines[peek].trim()) peek++
      const childTrimmed = peek < lines.length ? lines[peek].trim() : ''
      const childIndent = peek < lines.length ? (lines[peek].match(/^(\s+)/)?.[1].length ?? 0) : 0

      if (childIndent >= 2 && !childTrimmed.startsWith('- ') && childTrimmed.includes(':')) {
        // block mapping: key whose value is an indented mapping of sub-keys.
        // Each sub-key may itself be a scalar, a block list, or an inline array.
        const map: Record<string, unknown> = {}
        i = peek
        const baseIndent = childIndent
        while (i < lines.length) {
          const ml = lines[i]
          if (!ml.trim()) { i++; continue }
          const mIndent = ml.match(/^(\s+)/)?.[1].length ?? 0
          if (mIndent < baseIndent) break
          if (mIndent > baseIndent) { i++; continue }
          const mTrimmed = ml.trim()
          const mColon = mTrimmed.indexOf(':')
          if (mColon === -1) { i++; continue }
          const subKey = mTrimmed.slice(0, mColon).trim()
          const subRest = mTrimmed.slice(mColon + 1).trim()
          if (subRest === '' || subRest === '[]') {
            if (subRest === '[]') { map[subKey] = []; i++; continue }
            // Peek: a sub-block can be a list of scalars (`- foo`) or a nested
            // mapping of scalars (`key: value`).
            let sp = i + 1
            while (sp < lines.length && !lines[sp].trim()) sp++
            const spTrimmed = sp < lines.length ? lines[sp].trim() : ''
            const spIndent = sp < lines.length ? (lines[sp].match(/^(\s+)/)?.[1].length ?? 0) : 0
            if (spIndent > baseIndent && !spTrimmed.startsWith('- ') && spTrimmed.includes(':')) {
              // nested mapping of scalars
              const inner: Record<string, unknown> = {}
              i = sp
              const innerIndent = spIndent
              while (i < lines.length) {
                const il = lines[i]
                if (!il.trim()) { i++; continue }
                const iIndent = il.match(/^(\s+)/)?.[1].length ?? 0
                if (iIndent < innerIndent) break
                const iTrimmed = il.trim()
                if (iTrimmed.startsWith('- ')) break
                parseInlineKv(iTrimmed, inner)
                i++
              }
              map[subKey] = inner
            } else {
              // sub-block list of scalars
              const subItems: unknown[] = []
              i++
              while (i < lines.length) {
                const sl = lines[i]
                if (!sl.trim()) break
                const sIndent = sl.match(/^(\s+)/)?.[1].length ?? 0
                if (sIndent <= baseIndent) break
                const sTrimmed = sl.trim()
                if (sTrimmed.startsWith('- ')) {
                  subItems.push(parseScalar(sTrimmed.slice(2).trim()))
                  i++
                } else {
                  break
                }
              }
              map[subKey] = subItems
            }
          } else if (subRest.startsWith('[') && subRest.endsWith(']')) {
            const inner = subRest.slice(1, -1).trim()
            map[subKey] = inner ? inner.split(',').map(v => parseScalar(v.trim())) : []
            i++
          } else {
            map[subKey] = parseScalar(subRest)
            i++
          }
        }
        result[key] = map
        continue
      }

      // block list (sequence of scalars or inline mappings)
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
      canDelegateTo: [],
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
    // accept legacy `dependencies` key as a fallback for old instruct.md files
    canDelegateTo: toStringArray(raw.canDelegateTo ?? raw.dependencies),
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

  // canDelegateTo
  if ((instruct.canDelegateTo ?? []).length > 0) {
    lines.push('canDelegateTo:')
    for (const d of instruct.canDelegateTo) lines.push(`  - ${d}`)
  } else {
    lines.push('canDelegateTo: []')
  }

  lines.push('---')
  lines.push('')
  lines.push((instruct.body ?? '').trim())

  return lines.join('\n')
}
