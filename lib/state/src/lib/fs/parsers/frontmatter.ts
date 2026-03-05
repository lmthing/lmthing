// src/lib/fs/parsers/frontmatter.ts

export interface FrontmatterResult<T = Record<string, unknown>> {
  frontmatter: T
  content: string
  raw: string
}

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/

export function parseFrontmatter<T = Record<string, unknown>>(
  content: string
): FrontmatterResult<T> {
  const match = content.match(FRONTMATTER_REGEX)

  if (!match) {
    return { frontmatter: {} as T, content, raw: content }
  }

  const rawFrontmatter = match[1]
  const body = match[2]
  const frontmatter = parseYAML<T>(rawFrontmatter)

  return {
    frontmatter,
    content: body,
    raw: content
  }
}

export function serializeFrontmatter<T = Record<string, unknown>>(
  frontmatter: T,
  content: string
): string {
  const yaml = serializeYAML(frontmatter as Record<string, unknown>)
  return `---\n${yaml}\n---\n${content}`
}

function parseYAML<T = Record<string, unknown>>(yaml: string): T {
  const lines = yaml.split('\n')
  const result: Record<string, unknown> = {}

  for (const line of lines) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue

    const key = line.slice(0, colonIdx).trim()
    const valueStr = line.slice(colonIdx + 1).trim()
    const value = parseYAMLValue(valueStr)

    result[key] = value
  }

  return result as T
}

function parseYAMLValue(value: string): unknown {
  // Handle quoted strings
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }

  // Handle arrays (simple comma-separated values)
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1)
    if (!inner.trim()) return []
    return inner.split(',').map(v => parseYAMLValue(v.trim()))
  }

  // Handle booleans
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null' || value === '~') return null

  // Handle numbers
  const num = Number(value)
  if (!isNaN(num)) return num

  // Default to string
  return value
}

function serializeYAML(obj: Record<string, unknown>): string {
  const lines: string[] = []

  for (const [key, value] of Object.entries(obj)) {
    lines.push(`${key}: ${serializeYAMLValue(value)}`)
  }

  return lines.join('\n')
}

function serializeYAMLValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') {
    // Quote strings if they contain special characters
    if (/[:{}\[\],\n]/.test(value)) {
      return `"${value.replace(/"/g, '\\"')}"`
    }
    return value
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    return `[${value.map(serializeYAMLValue).join(', ')}]`
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const pairs = Object.entries(obj).map(
      ([k, v]) => `${k}: ${serializeYAMLValue(v)}`
    )
    if (pairs.length === 0) return '{}'
    return `{${pairs.join(', ')}}`
  }
  return String(value)
}
