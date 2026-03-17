import type { CatalogModule } from './types'

function queryPath(data: unknown, path: string): unknown {
  const parts = path.replace(/^\$\.?/, '').split('.').filter(Boolean)
  let current: unknown = data
  for (const part of parts) {
    if (current == null) return undefined
    const arrayMatch = part.match(/^(\w+)\[(\*|\d+)\]$/)
    if (arrayMatch) {
      const [, key, index] = arrayMatch
      current = (current as Record<string, unknown>)[key]
      if (!Array.isArray(current)) return undefined
      if (index === '*') return current
      current = current[parseInt(index, 10)]
    } else {
      current = (current as Record<string, unknown>)[part]
    }
  }
  return current
}

function deepMerge(...objects: unknown[]): unknown {
  const result: Record<string, unknown> = {}
  for (const obj of objects) {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value) &&
            typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
          result[key] = deepMerge(result[key], value)
        } else {
          result[key] = value
        }
      }
    }
  }
  return result
}

interface DiffEntry {
  path: string
  type: 'added' | 'removed' | 'changed'
  oldValue?: unknown
  newValue?: unknown
}

function diff(a: unknown, b: unknown, path = '$'): DiffEntry[] {
  const diffs: DiffEntry[] = []
  if (a === b) return diffs
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') {
    diffs.push({ path, type: 'changed', oldValue: a, newValue: b })
    return diffs
  }
  const aObj = a as Record<string, unknown>
  const bObj = b as Record<string, unknown>
  const allKeys = new Set([...Object.keys(aObj), ...Object.keys(bObj)])
  for (const key of allKeys) {
    if (!(key in aObj)) {
      diffs.push({ path: `${path}.${key}`, type: 'added', newValue: bObj[key] })
    } else if (!(key in bObj)) {
      diffs.push({ path: `${path}.${key}`, type: 'removed', oldValue: aObj[key] })
    } else {
      diffs.push(...diff(aObj[key], bObj[key], `${path}.${key}`))
    }
  }
  return diffs
}

const jsonModule: CatalogModule = {
  id: 'json',
  description: 'JSON manipulation utilities',
  functions: [
    {
      name: 'jsonParse',
      description: 'Parse JSON with better error messages',
      signature: '(text: string) => any',
      fn: (text: unknown) => {
        try {
          return JSON.parse(text as string)
        } catch (e) {
          const err = e as SyntaxError
          throw new Error(`JSON parse error: ${err.message}`)
        }
      },
    },
    {
      name: 'jsonQuery',
      description: 'JSONPath query',
      signature: '(data: any, path: string) => any',
      fn: (data: unknown, path: unknown) => queryPath(data, path as string),
    },
    {
      name: 'jsonTransform',
      description: 'Map over arrays/objects',
      signature: '(data: any, fn: (item: any) => any) => any',
      fn: (data: unknown, fn: unknown) => {
        const mapper = fn as (item: unknown) => unknown
        if (Array.isArray(data)) return data.map(mapper)
        if (typeof data === 'object' && data !== null) {
          const result: Record<string, unknown> = {}
          for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
            result[k] = mapper(v)
          }
          return result
        }
        return mapper(data)
      },
    },
    {
      name: 'jsonMerge',
      description: 'Deep merge objects',
      signature: '(...objects: any[]) => any',
      fn: (...objects: unknown[]) => deepMerge(...objects),
    },
    {
      name: 'jsonDiff',
      description: 'Structural diff between two objects',
      signature: '(a: any, b: any) => Diff[]',
      fn: (a: unknown, b: unknown) => diff(a, b),
    },
  ],
}

export default jsonModule
