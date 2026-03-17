import type { ScopeEntry } from '../session/types'

export interface ScopeGeneratorOptions {
  maxVariables?: number
  maxValueWidth?: number
}

/**
 * Generate a SCOPE table string from scope entries.
 */
export function generateScopeTable(entries: ScopeEntry[], options: ScopeGeneratorOptions = {}): string {
  const { maxVariables = 50, maxValueWidth = 50 } = options
  const visible = entries.slice(0, maxVariables)

  if (visible.length === 0) {
    return '(no variables declared)'
  }

  const nameCol = Math.max(4, ...visible.map(e => e.name.length))
  const typeCol = Math.max(4, ...visible.map(e => e.type.length))

  const header = `${'Name'.padEnd(nameCol)}  ${'Type'.padEnd(typeCol)}  Value`
  const separator = `${'-'.repeat(nameCol)}  ${'-'.repeat(typeCol)}  ${'-'.repeat(maxValueWidth)}`

  const rows = visible.map(e => {
    const truncatedValue = e.value.length > maxValueWidth
      ? e.value.slice(0, maxValueWidth - 3) + '...'
      : e.value
    return `${e.name.padEnd(nameCol)}  ${e.type.padEnd(typeCol)}  ${truncatedValue}`
  })

  const lines = [header, separator, ...rows]

  if (entries.length > maxVariables) {
    lines.push(`... +${entries.length - maxVariables} more variables`)
  }

  return lines.join('\n')
}

/**
 * Describe the type of a value for the scope table.
 */
export function describeType(val: unknown): string {
  if (val === null) return 'null'
  if (val === undefined) return 'undefined'
  if (Array.isArray(val)) {
    if (val.length === 0) return 'Array'
    return `Array<${describeType(val[0])}>`
  }
  const t = typeof val
  if (t === 'object') {
    const name = (val as object).constructor?.name
    return name && name !== 'Object' ? name : 'Object'
  }
  return t
}

/**
 * Truncate a value for display in the scope table.
 */
export function truncateValue(val: unknown, maxLen = 50): string {
  if (val === null) return 'null'
  if (val === undefined) return 'undefined'
  if (typeof val === 'function') return `[Function: ${val.name || 'anonymous'}]`
  if (typeof val === 'symbol') return val.toString()

  try {
    let str: string
    if (typeof val === 'string') {
      str = JSON.stringify(val)
    } else if (Array.isArray(val)) {
      const preview = val.slice(0, 3).map(v => truncateValue(v, 20)).join(', ')
      str = val.length > 3 ? `[${preview}, ... +${val.length - 3}]` : `[${preview}]`
    } else if (typeof val === 'object') {
      const keys = Object.keys(val as object)
      const preview = keys.slice(0, 5).join(', ')
      str = keys.length > 5 ? `{${preview}, ... +${keys.length - 5}}` : `{${preview}}`
    } else {
      str = String(val)
    }

    if (str.length > maxLen) {
      return str.slice(0, maxLen - 3) + '...'
    }
    return str
  } catch {
    return '[value]'
  }
}
