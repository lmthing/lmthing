export interface SerializationLimits {
  maxStringLength: number
  maxArrayElements: number
  maxObjectKeys: number
  maxDepth: number
}

const DEFAULT_LIMITS: SerializationLimits = {
  maxStringLength: 2_000,
  maxArrayElements: 50,
  maxObjectKeys: 20,
  maxDepth: 5,
}

/**
 * Serialize a value to a human-readable string for injection into the LLM context.
 * Handles truncation, circular references, and depth limiting.
 */
export function serialize(value: unknown, limits: Partial<SerializationLimits> = {}): string {
  const opts = { ...DEFAULT_LIMITS, ...limits }
  const seen = new WeakSet<object>()
  return serializeValue(value, opts, seen, 0)
}

function serializeValue(
  value: unknown,
  limits: SerializationLimits,
  seen: WeakSet<object>,
  depth: number,
): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'

  const type = typeof value

  if (type === 'string') {
    const str = value as string
    if (str.length > limits.maxStringLength) {
      const half = Math.floor(limits.maxStringLength / 2)
      return JSON.stringify(str.slice(0, half) + `... (truncated, ${str.length} chars total)`)
    }
    return JSON.stringify(str)
  }

  if (type === 'number' || type === 'boolean') {
    return JSON.stringify(value)
  }

  if (type === 'function') {
    const fn = value as Function
    return `[Function: ${fn.name || 'anonymous'}]`
  }

  if (type === 'symbol') {
    return `[Symbol: ${(value as symbol).description ?? ''}]`
  }

  if (type === 'bigint') {
    return `${value}n`
  }

  if (value instanceof Error) {
    return `[Error: ${value.message}]`
  }

  if (value instanceof Promise) {
    return '[Promise]'
  }

  if (value instanceof Date) {
    return `"${value.toISOString()}"`
  }

  if (value instanceof RegExp) {
    return value.toString()
  }

  // Objects & arrays — check circular and depth
  if (type === 'object') {
    const obj = value as object
    if (seen.has(obj)) return '[Circular]'
    seen.add(obj)

    if (depth >= limits.maxDepth) {
      if (Array.isArray(obj)) return `[Array(${obj.length})]`
      return `[Object]`
    }

    if (Array.isArray(obj)) {
      return serializeArray(obj, limits, seen, depth)
    }

    // Map
    if (obj instanceof Map) {
      const entries: string[] = []
      let count = 0
      for (const [k, v] of obj) {
        if (count >= limits.maxObjectKeys) {
          entries.push(`... +${obj.size - count} more`)
          break
        }
        entries.push(`${serializeValue(k, limits, seen, depth + 1)}: ${serializeValue(v, limits, seen, depth + 1)}`)
        count++
      }
      return `Map { ${entries.join(', ')} }`
    }

    // Set
    if (obj instanceof Set) {
      const items: string[] = []
      let count = 0
      for (const v of obj) {
        if (count >= limits.maxArrayElements) {
          items.push(`... +${obj.size - count} more`)
          break
        }
        items.push(serializeValue(v, limits, seen, depth + 1))
        count++
      }
      return `Set { ${items.join(', ')} }`
    }

    return serializeObject(obj, limits, seen, depth)
  }

  return String(value)
}

function serializeArray(
  arr: unknown[],
  limits: SerializationLimits,
  seen: WeakSet<object>,
  depth: number,
): string {
  if (arr.length === 0) return '[]'

  const items: string[] = []
  const max = Math.min(arr.length, limits.maxArrayElements)
  for (let i = 0; i < max; i++) {
    items.push(serializeValue(arr[i], limits, seen, depth + 1))
  }
  if (arr.length > limits.maxArrayElements) {
    items.push(`... +${arr.length - limits.maxArrayElements} more`)
  }
  return `[${items.join(', ')}]`
}

function serializeObject(
  obj: object,
  limits: SerializationLimits,
  seen: WeakSet<object>,
  depth: number,
): string {
  const keys = Object.keys(obj)
  if (keys.length === 0) return '{}'

  const entries: string[] = []
  const max = Math.min(keys.length, limits.maxObjectKeys)
  for (let i = 0; i < max; i++) {
    const key = keys[i]
    const val = (obj as Record<string, unknown>)[key]
    entries.push(`${JSON.stringify(key)}: ${serializeValue(val, limits, seen, depth + 1)}`)
  }
  if (keys.length > limits.maxObjectKeys) {
    entries.push(`... +${keys.length - limits.maxObjectKeys} more`)
  }
  return `{ ${entries.join(', ')} }`
}
