export interface RegistryOptions {
  timeout?: number
  rateLimit?: { maxCalls: number; windowMs: number }
  onCall?: (name: string, args: unknown[], duration: number) => void
}

interface RateLimitState {
  calls: number[]
}

/**
 * Wrap a function with timeout, logging, and rate limiting.
 */
export function wrapFunction<T extends (...args: any[]) => any>(
  name: string,
  fn: T,
  options: RegistryOptions = {},
): T {
  const timeout = options.timeout ?? 30_000
  const rateState: RateLimitState | null = options.rateLimit
    ? { calls: [] }
    : null

  const wrapped = async function (...args: unknown[]) {
    // Rate limiting
    if (rateState && options.rateLimit) {
      const now = Date.now()
      const { maxCalls, windowMs } = options.rateLimit
      rateState.calls = rateState.calls.filter(t => now - t < windowMs)
      if (rateState.calls.length >= maxCalls) {
        throw new Error(`Rate limit exceeded for ${name}: max ${maxCalls} calls per ${windowMs}ms`)
      }
      rateState.calls.push(now)
    }

    const start = Date.now()

    // Timeout wrapper
    const result = await Promise.race([
      Promise.resolve(fn(...args)),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout: ${name} exceeded ${timeout}ms`)), timeout),
      ),
    ])

    const duration = Date.now() - start
    options.onCall?.(name, args, duration)

    return result
  }

  // Preserve function name
  Object.defineProperty(wrapped, 'name', { value: name })

  return wrapped as unknown as T
}

/**
 * Create a function registry that wraps all registered functions.
 */
export class FunctionRegistry {
  private functions = new Map<string, Function>()
  private options: RegistryOptions

  constructor(options: RegistryOptions = {}) {
    this.options = options
  }

  register(name: string, fn: (...args: any[]) => any): void {
    this.functions.set(name, wrapFunction(name, fn, this.options))
  }

  get(name: string): Function | undefined {
    return this.functions.get(name)
  }

  getAll(): Record<string, Function> {
    const result: Record<string, Function> = {}
    for (const [name, fn] of this.functions) {
      result[name] = fn
    }
    return result
  }

  has(name: string): boolean {
    return this.functions.has(name)
  }

  names(): string[] {
    return [...this.functions.keys()]
  }
}
