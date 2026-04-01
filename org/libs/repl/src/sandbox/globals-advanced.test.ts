import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createGlobals } from './globals'
import { AsyncManager } from './async-manager'
import type { StreamPauseController, RenderSurface } from '../session/types'

// ── Shared factory ──────────────────────────────────────────────────────────

function createMockConfig() {
  let paused = false
  const pauseController: StreamPauseController = {
    pause: vi.fn(() => { paused = true }),
    resume: vi.fn(() => { paused = false }),
    isPaused: () => paused,
  }
  const renderSurface: RenderSurface = {
    append: vi.fn(),
    renderForm: vi.fn().mockResolvedValue({ ok: true }),
    cancelForm: vi.fn(),
    appendTasklistProgress: vi.fn(),
    updateTasklistProgress: vi.fn(),
    updateTaskProgress: vi.fn(),
  }
  const asyncManager = new AsyncManager()
  return { pauseController, renderSurface, asyncManager }
}

// ── loadKnowledge ────────────────────────────────────────────────────────────

describe('loadKnowledge', () => {
  it('calls onLoadKnowledge with selector and returns tagged content', () => {
    const config = createMockConfig()
    const selector = { math: { formulas: { quadratic: true } } }
    const mockContent = { math: { formulas: { quadratic: '# Quadratic formula' } } }
    const onLoadKnowledge = vi.fn().mockReturnValue(mockContent)

    const globals = createGlobals({ ...config, onLoadKnowledge })
    const result = globals.loadKnowledge(selector)

    expect(onLoadKnowledge).toHaveBeenCalledWith(selector)
    // Result is tagged — still contains the content
    expect(JSON.stringify(result)).toContain('quadratic')
  })

  it('throws when no onLoadKnowledge configured', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)
    expect(() => globals.loadKnowledge({ x: {} })).toThrow('loadKnowledge() is not available')
  })

  it('throws when selector is not an object', () => {
    const config = createMockConfig()
    const globals = createGlobals({ ...config, onLoadKnowledge: vi.fn() })
    expect(() => globals.loadKnowledge(null as any)).toThrow('loadKnowledge() requires a selector object')
  })
})

// ── loadClass ────────────────────────────────────────────────────────────────

describe('loadClass', () => {
  it('calls getClassInfo and onLoadClass', () => {
    const config = createMockConfig()
    const getClassInfo = vi.fn().mockReturnValue({ methods: [{ name: 'read', description: '', signature: '() => string' }] })
    const onLoadClass = vi.fn()

    const globals = createGlobals({ ...config, getClassInfo, onLoadClass })
    globals.loadClass('Filesystem')

    expect(getClassInfo).toHaveBeenCalledWith('Filesystem')
    expect(onLoadClass).toHaveBeenCalledWith('Filesystem')
  })

  it('is a no-op if class already loaded', () => {
    const config = createMockConfig()
    const getClassInfo = vi.fn().mockReturnValue({ methods: [] })
    const onLoadClass = vi.fn()

    const globals = createGlobals({ ...config, getClassInfo, onLoadClass })
    globals.loadClass('Fs')
    globals.loadClass('Fs') // second call — no-op

    expect(onLoadClass).toHaveBeenCalledTimes(1)
  })

  it('throws for unknown class', () => {
    const config = createMockConfig()
    const getClassInfo = vi.fn().mockReturnValue(null)
    const globals = createGlobals({ ...config, getClassInfo })
    expect(() => globals.loadClass('Unknown')).toThrow('Unknown class: "Unknown"')
  })

  it('throws when no getClassInfo configured', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)
    expect(() => globals.loadClass('Foo')).toThrow('loadClass() is not available')
  })

  it('throws for non-string className', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)
    expect(() => globals.loadClass('' as any)).toThrow('loadClass() requires a class name string')
  })
})

// ── askParent ────────────────────────────────────────────────────────────────

describe('askParent', () => {
  it('returns { _noParent: true } in fire-and-forget mode', async () => {
    const config = createMockConfig()
    const globals = createGlobals({ ...config, isFireAndForget: true })
    const result = await globals.askParent('What is the user id?')
    expect(result).toEqual({ _noParent: true })
  })

  it('returns { _noParent: true } when no onAskParent configured', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)
    const result = await globals.askParent('hello')
    expect(result).toEqual({ _noParent: true })
  })

  it('calls onAskParent and returns response', async () => {
    const config = createMockConfig()
    const onAskParent = vi.fn().mockResolvedValue({ userId: 'u_123' }) as unknown as (q: { message: string; schema: Record<string, unknown> }) => Promise<Record<string, unknown>>
    const globals = createGlobals({ ...config, onAskParent })

    const result = await globals.askParent('What is the user id?', { userId: { type: 'string' } })

    expect(onAskParent).toHaveBeenCalledWith({
      message: 'What is the user id?',
      schema: { userId: { type: 'string' } },
    })
    expect(result).toEqual({ userId: 'u_123' })
  })

  it('pauses and resumes stream', async () => {
    const config = createMockConfig()
    const onAskParent = vi.fn().mockResolvedValue({ ok: true }) as unknown as (q: { message: string; schema: Record<string, unknown> }) => Promise<Record<string, unknown>>
    const globals = createGlobals({ ...config, onAskParent })

    await globals.askParent('test')
    expect(config.pauseController.pause).toHaveBeenCalled()
    expect(config.pauseController.resume).toHaveBeenCalled()
  })

  it('times out and returns { _timeout: true }', async () => {
    const config = createMockConfig()
    const onAskParent = vi.fn(() => new Promise(() => {})) as unknown as (q: { message: string; schema: Record<string, unknown> }) => Promise<Record<string, unknown>>
    const globals = createGlobals({ ...config, onAskParent, askTimeout: 50 })

    const result = await globals.askParent('slow question')
    expect(result).toEqual({ _timeout: true })
  })

  it('throws for invalid message', async () => {
    const config = createMockConfig()
    const onAskParent = vi.fn().mockResolvedValue({})
    const globals = createGlobals({ ...config, onAskParent })
    await expect(globals.askParent('')).rejects.toThrow('requires a message string')
  })
})

// ── respond ──────────────────────────────────────────────────────────────────

describe('respond', () => {
  it('calls onRespond with promise and data', () => {
    const config = createMockConfig()
    const onRespond = vi.fn()
    const globals = createGlobals({ ...config, onRespond })

    const fakePromise = Promise.resolve()
    globals.respond(fakePromise, { answer: 42 })
    expect(onRespond).toHaveBeenCalledWith(fakePromise, { answer: 42 })
  })

  it('throws when onRespond not configured', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)
    expect(() => globals.respond({}, {})).toThrow('respond() is not available')
  })

  it('throws for invalid data', () => {
    const config = createMockConfig()
    const onRespond = vi.fn()
    const globals = createGlobals({ ...config, onRespond })
    expect(() => globals.respond({}, null as any)).toThrow('requires a data object')
  })
})

// ── trace ────────────────────────────────────────────────────────────────────

describe('trace', () => {
  it('returns default snapshot when no onTrace configured', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)
    const snapshot = globals.trace()
    expect(snapshot.turns).toBe(0)
    expect(snapshot.llmCalls).toBe(0)
    expect(snapshot.estimatedCost).toBe('$0.00')
  })

  it('calls onTrace when configured', () => {
    const config = createMockConfig()
    const mockSnapshot = {
      turns: 5, llmCalls: 10, llmTokens: { input: 1000, output: 500, total: 1500 },
      estimatedCost: '$0.05', asyncTasks: { completed: 2, failed: 0, running: 1 },
      scopeSize: 8, pinnedCount: 2, memoCount: 3, sessionDurationMs: 12000,
    }
    const onTrace = vi.fn().mockReturnValue(mockSnapshot)
    const globals = createGlobals({ ...config, onTrace })

    const result = globals.trace()
    expect(onTrace).toHaveBeenCalled()
    expect(result.turns).toBe(5)
    expect(result.estimatedCost).toBe('$0.05')
  })
})

// ── watch / checkWatchers ────────────────────────────────────────────────────

describe('watch', () => {
  it('fires callback when variable value changes', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)
    const callback = vi.fn()
    globals.watch('counter', callback)

    let counter = 0
    // First check: fires because lastValue starts as undefined → 0
    globals.checkWatchers((name) => (name === 'counter' ? counter : undefined))
    expect(callback).toHaveBeenCalledWith(0, undefined)
    callback.mockClear()

    // Second check: no change
    globals.checkWatchers((name) => (name === 'counter' ? counter : undefined))
    expect(callback).not.toHaveBeenCalled()

    // Third check: value changed
    counter = 1
    globals.checkWatchers((name) => (name === 'counter' ? counter : undefined))
    expect(callback).toHaveBeenCalledWith(1, 0)
  })

  it('returns an unwatch function', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)
    const callback = vi.fn()
    const unwatch = globals.watch('x', callback) as () => void

    let x = 1
    globals.checkWatchers((name) => (name === 'x' ? x : undefined))
    x = 2
    globals.checkWatchers((name) => (name === 'x' ? x : undefined))
    const callsBefore = callback.mock.calls.length

    unwatch()
    x = 3
    globals.checkWatchers((name) => (name === 'x' ? x : undefined))
    expect(callback.mock.calls.length).toBe(callsBefore) // no new calls after unwatch
  })

  it('handles JSON-serialization error gracefully', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)
    const callback = vi.fn()
    globals.watch('circ', callback)

    const circular: any = {}
    circular.self = circular

    // Should not throw
    expect(() =>
      globals.checkWatchers((name) => (name === 'circ' ? circular : undefined))
    ).not.toThrow()
    expect(callback).not.toHaveBeenCalled()
  })
})

// ── pipeline ─────────────────────────────────────────────────────────────────

describe('pipeline', () => {
  it('chains transforms sequentially', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    const result = await globals.pipeline(
      5,
      { name: 'double', fn: (x: any) => x * 2 },
      { name: 'addOne', fn: (x: any) => x + 1 },
    )

    expect(result.result).toBe(11)
    expect(result.steps).toHaveLength(2)
    expect(result.steps[0]).toMatchObject({ name: 'double', ok: true })
    expect(result.steps[1]).toMatchObject({ name: 'addOne', ok: true })
  })

  it('supports async transforms', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    const result = await globals.pipeline(
      'hello',
      { name: 'upper', fn: async (x: any) => x.toUpperCase() },
    )

    expect(result.result).toBe('HELLO')
    expect(result.steps[0].ok).toBe(true)
  })

  it('short-circuits on error and records it', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    const result = await globals.pipeline(
      1,
      { name: 'fail', fn: () => { throw new Error('transform failed') } },
      { name: 'never', fn: (x: any) => x + 1 },
    )

    expect(result.steps).toHaveLength(1)
    expect(result.steps[0].ok).toBe(false)
    expect(result.steps[0].error).toBe('transform failed')
    // second transform was not called
    expect(result.result).toBe(1) // unchanged from before error
  })

  it('records durationMs for each step', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    const result = await globals.pipeline(
      0,
      { name: 'step', fn: (x: any) => x },
    )
    expect(result.steps[0].durationMs).toBeGreaterThanOrEqual(0)
  })
})

// ── cachedFetch ──────────────────────────────────────────────────────────────

describe('cachedFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function makeFetchResponse(body: unknown, contentType = 'application/json', status = 200) {
    return Promise.resolve({
      ok: true,
      status,
      headers: { get: () => contentType },
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(String(body)),
    })
  }

  it('fetches JSON and returns data', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)
    ;(globalThis as any).fetch = vi.fn().mockReturnValue(makeFetchResponse({ answer: 42 }))

    const result = await globals.cachedFetch('https://api.example.com/data')
    expect(result.data).toEqual({ answer: 42 })
    expect(result.cached).toBe(false)
    expect(result.status).toBe(200)
  })

  it('returns cached result on second call', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)
    const mockFetch = vi.fn().mockReturnValue(makeFetchResponse({ value: 1 }))
    ;(globalThis as any).fetch = mockFetch

    await globals.cachedFetch('https://api.example.com/cached', { cacheTtlMs: 5000 })
    const second = await globals.cachedFetch('https://api.example.com/cached', { cacheTtlMs: 5000 })

    expect(mockFetch).toHaveBeenCalledTimes(1) // only one real request
    expect(second.cached).toBe(true)
  })

  it('retries on failure and throws after exhausting retries', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)
    const mockFetch = vi.fn().mockRejectedValue(new Error('network error'))
    ;(globalThis as any).fetch = mockFetch

    await expect(
      globals.cachedFetch('https://api.example.com/fail', { maxRetries: 1 })
    ).rejects.toThrow('network error')

    expect(mockFetch).toHaveBeenCalledTimes(2) // initial + 1 retry
  })

  it('forces text parse when parseAs is "text"', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)
    ;(globalThis as any).fetch = vi.fn().mockReturnValue(makeFetchResponse('plain text', 'text/plain'))

    const result = await globals.cachedFetch('https://api.example.com/text', { parseAs: 'text' })
    expect(result.data).toBe('plain text')
  })

  it('caps timeout at 60s', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)
    ;(globalThis as any).fetch = vi.fn().mockReturnValue(makeFetchResponse({}))

    // Should not throw even with an absurd timeout value
    await globals.cachedFetch('https://api.example.com/', { timeout: 999_999 })
  })
})

// ── schema ───────────────────────────────────────────────────────────────────

describe('schema', () => {
  it('infers primitive types', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    expect(globals.schema('hello')).toMatchObject({ type: 'string' })
    expect(globals.schema(42)).toMatchObject({ type: 'number' })
    expect(globals.schema(true)).toMatchObject({ type: 'boolean' })
    expect(globals.schema(null)).toMatchObject({ type: 'null' })
  })

  it('infers array type with item schema', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    const result = globals.schema([1, 2, 3])
    expect(result.type).toBe('array')
    expect((result.items as any).type).toBe('number')
  })

  it('infers object type with properties', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    const result = globals.schema({ name: 'Alice', age: 30 })
    expect(result.type).toBe('object')
    const props = result.properties as Record<string, { type: string }>
    expect(props.name.type).toBe('string')
    expect(props.age.type).toBe('number')
  })

  it('handles empty arrays', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    const result = globals.schema([])
    expect(result.type).toBe('array')
    expect((result.items as any).type).toBe('unknown')
  })
})

// ── validate ─────────────────────────────────────────────────────────────────

describe('validate', () => {
  it('returns { valid: true } for matching value', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    const result = globals.validate('hello', { type: 'string' })
    expect(result.valid).toBe(true)
  })

  it('returns errors for type mismatch', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    const result = globals.validate(42, { type: 'string' })
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors!.length).toBeGreaterThan(0)
  })

  it('validates nested object properties', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    const schema = {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
    }

    expect(globals.validate({ name: 'Alice', age: 30 }, schema).valid).toBe(true)
    expect(globals.validate({ age: 30 }, schema).valid).toBe(false) // missing name
  })

  it('validates array items', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    const schema = {
      type: 'array',
      items: { type: 'number' },
    }

    expect(globals.validate([1, 2, 3], schema).valid).toBe(true)
    expect(globals.validate([1, 'two', 3], schema).valid).toBe(false)
  })
})

// ── delegate ─────────────────────────────────────────────────────────────────

describe('delegate', () => {
  it('executes function directly', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    const result = await globals.delegate(() => 42)
    expect(result.strategy).toBe('direct')
    expect(result.result).toBe(42)
  })

  it('uses fork for string task when onFork configured', async () => {
    const config = createMockConfig()
    const onFork = vi.fn().mockResolvedValue({ output: { answer: 'yes' }, turns: 1, success: true })
    const globals = createGlobals({ ...config, onFork })

    const result = await globals.delegate('Summarize the following text...')
    expect(result.strategy).toBe('fork')
    expect(result.result).toEqual({ answer: 'yes' })
    expect(onFork).toHaveBeenCalled()
  })

  it('throws for string task without fork handler', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    await expect(globals.delegate('some string task')).rejects.toThrow('fork not available')
  })

  it('throws for direct strategy with string task', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    await expect(globals.delegate('task', { strategy: 'direct' })).rejects.toThrow('"direct" strategy with string tasks')
  })

  it('times out function and throws', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    await expect(
      globals.delegate(() => new Promise(() => {}), { timeout: 50 })
    ).rejects.toThrow('timeout')
  })
})

// ── broadcast / listen ───────────────────────────────────────────────────────

describe('broadcast / listen', () => {
  it('delivers event to registered listener', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)
    const listener = vi.fn()

    globals.listen('events', listener)
    globals.broadcast('events', { type: 'click' })

    expect(listener).toHaveBeenCalledWith({ type: 'click' })
  })

  it('buffers events when no listener registered', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    globals.broadcast('data', 'item1')
    globals.broadcast('data', 'item2')

    const buffered = globals.listen('data') as unknown[]
    expect(buffered).toEqual(['item1', 'item2'])
  })

  it('clears buffer on drain', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    globals.broadcast('ch', 'val')
    globals.listen('ch') // drains

    const second = globals.listen('ch') as unknown[]
    expect(second).toEqual([])
  })

  it('unsubscribe stops future events', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)
    const listener = vi.fn()

    const unsub = globals.listen('ch', listener) as () => void
    globals.broadcast('ch', 'before')
    unsub()
    globals.broadcast('ch', 'after')

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('before')
  })

  it('buffers at most 10 events per channel', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    for (let i = 0; i < 15; i++) globals.broadcast('flood', i)

    const buffered = globals.listen('flood') as unknown[]
    expect(buffered).toHaveLength(10)
    expect(buffered[0]).toBe(5) // oldest evicted
  })

  it('swallows errors thrown by listeners', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    globals.listen('err', () => { throw new Error('listener error') })
    expect(() => globals.broadcast('err', 'data')).not.toThrow()
  })
})

// ── learn ────────────────────────────────────────────────────────────────────

describe('learn', () => {
  it('calls onLearn with topic, insight, and tags', async () => {
    const config = createMockConfig()
    const onLearn = vi.fn().mockResolvedValue(undefined)
    const globals = createGlobals({ ...config, onLearn })

    await globals.learn('user preferences', 'prefers dark mode', ['ui', 'settings'])
    expect(onLearn).toHaveBeenCalledWith('user preferences', 'prefers dark mode', ['ui', 'settings'])
  })

  it('throws when onLearn not configured', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    await expect(globals.learn('topic', 'insight')).rejects.toThrow('knowledge persistence not available')
  })
})

// ── critique (LLM-backed, mocked) ────────────────────────────────────────────

describe('critique', () => {
  it('calls onCritique with output, criteria, and context', async () => {
    const config = createMockConfig()
    const mockResult = {
      pass: true,
      overallScore: 0.9,
      scores: { clarity: 0.9, accuracy: 0.9 },
      issues: [],
      suggestions: ['Add examples'],
    }
    const onCritique = vi.fn().mockResolvedValue(mockResult)
    const globals = createGlobals({ ...config, onCritique })

    const result = await globals.critique(
      'The sky is blue.',
      ['clarity', 'accuracy'],
      'astronomy context',
    )

    expect(onCritique).toHaveBeenCalledWith(
      'The sky is blue.',
      ['clarity', 'accuracy'],
      'astronomy context',
    )
    expect(result.pass).toBe(true)
    expect(result.overallScore).toBe(0.9)
  })

  it('throws when onCritique not configured', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    await expect(globals.critique('output', ['clarity'])).rejects.toThrow('LLM critique not available')
  })

  it('forwards failing critique result', async () => {
    const config = createMockConfig()
    const failResult = {
      pass: false,
      overallScore: 0.3,
      scores: { clarity: 0.3 },
      issues: ['Too vague', 'Missing citations'],
      suggestions: ['Add specific data'],
    }
    const onCritique = vi.fn().mockResolvedValue(failResult)
    const globals = createGlobals({ ...config, onCritique })

    const result = await globals.critique('vague statement', ['clarity'])
    expect(result.pass).toBe(false)
    expect(result.issues).toHaveLength(2)
  })
})

// ── plan (LLM-backed, mocked) ─────────────────────────────────────────────────

describe('plan', () => {
  it('calls onPlan and returns task decomposition', async () => {
    const config = createMockConfig()
    const mockPlan = [
      { id: 'gather', instructions: 'Gather requirements' },
      { id: 'design', instructions: 'Design solution', dependsOn: ['gather'] },
    ]
    const onPlan = vi.fn().mockResolvedValue(mockPlan)
    const globals = createGlobals({ ...config, onPlan })

    const result = await globals.plan('Build a todo app', ['no database'])
    expect(onPlan).toHaveBeenCalledWith('Build a todo app', ['no database'])
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('gather')
  })

  it('throws when onPlan not configured', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    await expect(globals.plan('some goal')).rejects.toThrow('LLM planning not available')
  })
})

// ── parallel ──────────────────────────────────────────────────────────────────

describe('parallel', () => {
  it('runs tasks concurrently and returns results', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    const order: string[] = []
    const result = await globals.parallel([
      { label: 'fast', fn: async () => { order.push('fast'); return 'a' } },
      { label: 'slow', fn: async () => { await new Promise(r => setTimeout(r, 20)); order.push('slow'); return 'b' } },
    ])

    expect(result).toHaveLength(2)
    expect(result.find(r => r.label === 'fast')?.result).toBe('a')
    expect(result.find(r => r.label === 'slow')?.result).toBe('b')
    expect(result.every(r => r.ok)).toBe(true)
  })

  it('returns empty array for empty tasks', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    expect(await globals.parallel([])).toEqual([])
  })

  it('throws for more than 10 tasks', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    const tasks = Array.from({ length: 11 }, (_, i) => ({ label: `t${i}`, fn: () => i }))
    await expect(globals.parallel(tasks)).rejects.toThrow('max 10 concurrent tasks')
  })

  it('captures task errors without failing others', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    const result = await globals.parallel([
      { label: 'ok', fn: () => 'success' },
      { label: 'fail', fn: () => { throw new Error('task error') } },
    ])

    expect(result.find(r => r.label === 'ok')?.ok).toBe(true)
    expect(result.find(r => r.label === 'fail')?.ok).toBe(false)
    expect(result.find(r => r.label === 'fail')?.error).toBe('task error')
  })

  it('supports failFast: aborts remaining tasks on first async failure', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    // The fail task must fail asynchronously (after a microtask yield) so the
    // 'aborted' task has a chance to register its AbortSignal listener before
    // controller.abort() fires.
    const result = await globals.parallel([
      { label: 'fail', fn: async () => { await Promise.resolve(); throw new Error('first fail') } },
      // Never resolves — relies entirely on the abort signal to finish
      { label: 'aborted', fn: () => new Promise(() => {}) },
    ], { failFast: true, timeout: 5000 })

    expect(result.find(r => r.label === 'fail')?.ok).toBe(false)
    expect(result.find(r => r.label === 'aborted')?.ok).toBe(false)
    expect(result.find(r => r.label === 'aborted')?.error).toMatch(/abort/i)
  })

  it('times out individual tasks', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    const result = await globals.parallel([
      { label: 'slow', fn: () => new Promise(() => {}) },
    ], { timeout: 50 })

    expect(result[0].ok).toBe(false)
    expect(result[0].error).toBe('timeout')
  })
})

// ── checkpoint / rollback ────────────────────────────────────────────────────

describe('checkpoint / rollback', () => {
  it('saves and restores scope snapshot', () => {
    const config = createMockConfig()
    const scope = new Map([['x', 42]])
    const declaredNames = new Set(['x'])

    const onCheckpoint = vi.fn().mockReturnValue({ values: scope, declaredNames })
    const onRollback = vi.fn()

    const globals = createGlobals({ ...config, onCheckpoint, onRollback })
    const id = globals.checkpoint('cp1')

    expect(id).toBe('cp1')
    expect(onCheckpoint).toHaveBeenCalled()

    globals.rollback('cp1')
    expect(onRollback).toHaveBeenCalledWith({ values: scope, declaredNames })
  })

  it('throws rollback for unknown checkpoint id', () => {
    const config = createMockConfig()
    const onCheckpoint = vi.fn().mockReturnValue({ values: new Map(), declaredNames: new Set() })
    const onRollback = vi.fn()
    const globals = createGlobals({ ...config, onCheckpoint, onRollback })

    expect(() => globals.rollback('missing')).toThrow('no checkpoint named "missing"')
  })

  it('throws checkpoint when onCheckpoint not configured', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)
    expect(() => globals.checkpoint('cp1')).toThrow('sandbox snapshotting not available')
  })

  it('evicts oldest checkpoint when limit of 5 exceeded', () => {
    const config = createMockConfig()
    const onCheckpoint = vi.fn().mockReturnValue({ values: new Map(), declaredNames: new Set() })
    const onRollback = vi.fn()
    const globals = createGlobals({ ...config, onCheckpoint, onRollback })

    for (let i = 1; i <= 6; i++) globals.checkpoint(`cp${i}`)

    // cp1 should have been evicted
    expect(() => globals.rollback('cp1')).toThrow('no checkpoint named "cp1"')
    // cp6 should still be there
    globals.rollback('cp6')
    expect(onRollback).toHaveBeenCalled()
  })
})

// ── guard ─────────────────────────────────────────────────────────────────────

describe('guard', () => {
  it('does not throw for truthy condition', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)
    expect(() => globals.guard(true, 'should not throw')).not.toThrow()
    expect(() => globals.guard(1, 'should not throw')).not.toThrow()
    expect(() => globals.guard('truthy', 'should not throw')).not.toThrow()
  })

  it('throws GuardError for falsy condition', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    expect(() => globals.guard(false, 'value must be truthy')).toThrow('value must be truthy')
    expect(() => globals.guard(null, 'null not allowed')).toThrow('null not allowed')
    expect(() => globals.guard(0, 'zero not allowed')).toThrow('zero not allowed')
  })

  it('throws with name GuardError', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    try {
      globals.guard(false, 'assertion failed')
    } catch (err: any) {
      expect(err.name).toBe('GuardError')
    }
  })
})

// ── focus ─────────────────────────────────────────────────────────────────────

describe('focus', () => {
  it('sets focus sections', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    globals.focus('functions', 'knowledge')
    const sections = globals.getFocusSections()
    expect(sections?.has('functions')).toBe(true)
    expect(sections?.has('knowledge')).toBe(true)
    expect(sections?.has('components')).toBe(false)
  })

  it('resets to null on focus("all")', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    globals.focus('functions')
    globals.focus('all')
    expect(globals.getFocusSections()).toBeNull()
  })

  it('resets to null with no arguments', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    globals.focus('knowledge')
    globals.focus()
    expect(globals.getFocusSections()).toBeNull()
  })

  it('throws for unknown section', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    expect(() => globals.focus('invalid')).toThrow('unknown section: "invalid"')
  })
})

// ── fork (LLM-backed, mocked) ─────────────────────────────────────────────────

describe('fork', () => {
  it('calls onFork and returns result', async () => {
    const config = createMockConfig()
    const mockResult = { output: { summary: 'done' }, turns: 2, success: true }
    const onFork = vi.fn().mockResolvedValue(mockResult)
    const globals = createGlobals({ ...config, onFork })

    const result = await globals.fork({ task: 'Summarize this text', maxTurns: 3 })

    expect(onFork).toHaveBeenCalledWith({ task: 'Summarize this text', maxTurns: 3 })
    expect(result.success).toBe(true)
    expect(result.output).toEqual({ summary: 'done' })
  })

  it('throws when onFork not configured', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    await expect(globals.fork({ task: 'do something' })).rejects.toThrow('fork() is not available')
  })

  it('throws for invalid request (missing task)', async () => {
    const config = createMockConfig()
    const onFork = vi.fn()
    const globals = createGlobals({ ...config, onFork })

    await expect(globals.fork({} as any)).rejects.toThrow('fork() requires')
  })
})

// ── compress (LLM-backed, mocked) ─────────────────────────────────────────────

describe('compress', () => {
  it('returns data unchanged if shorter than 100 chars', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    const short = 'hi there'
    const result = await globals.compress(short)
    expect(result).toBe(short)
  })

  it('truncates without onCompress when data exceeds limit', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    const long = 'x'.repeat(2000)
    const result = await globals.compress(long, { maxTokens: 10 })
    expect(result).toContain('...(truncated)')
  })

  it('calls onCompress (mock LLM) for large data', async () => {
    const config = createMockConfig()
    const onCompress = vi.fn().mockResolvedValue('compressed summary here')
    const globals = createGlobals({ ...config, onCompress })

    const large = 'a'.repeat(500)
    const result = await globals.compress(large, { format: 'prose' })

    expect(onCompress).toHaveBeenCalledWith(large, { format: 'prose' })
    expect(result).toBe('compressed summary here')
  })

  it('serializes non-string data to JSON before compressing', async () => {
    const config = createMockConfig()
    const onCompress = vi.fn().mockResolvedValue('summary')
    const globals = createGlobals({ ...config, onCompress })

    const obj = { data: 'x'.repeat(200) }
    await globals.compress(obj)
    const calledWith = onCompress.mock.calls[0][0]
    expect(typeof calledWith).toBe('string')
    expect(calledWith).toContain('"data"')
  })
})

// ── speculate ─────────────────────────────────────────────────────────────────

describe('speculate', () => {
  it('runs all branches and returns results', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    const result = await globals.speculate([
      { label: 'approach-a', fn: () => 'result-a' },
      { label: 'approach-b', fn: () => 'result-b' },
    ])

    expect(result.results).toHaveLength(2)
    const a = result.results.find(r => r.label === 'approach-a')!
    expect(a.ok).toBe(true)
    expect(a.result).toBe('result-a')
  })

  it('captures branch errors as failed results', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    const result = await globals.speculate([
      { label: 'good', fn: () => 42 },
      { label: 'bad', fn: () => { throw new Error('branch failed') } },
    ])

    const bad = result.results.find(r => r.label === 'bad')!
    expect(bad.ok).toBe(false)
    expect(bad.error).toBe('branch failed')
  })

  it('throws for empty branches array', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    await expect(globals.speculate([])).rejects.toThrow('non-empty array')
  })

  it('throws for more than 5 branches', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    const branches = Array.from({ length: 6 }, (_, i) => ({ label: `b${i}`, fn: () => i }))
    await expect(globals.speculate(branches)).rejects.toThrow('max 5 branches')
  })

  it('uses onSpeculate handler when configured (mock LLM)', async () => {
    const config = createMockConfig()
    const mockResults = {
      results: [
        { label: 'a', ok: true, result: 'llm-a', durationMs: 10 },
      ],
    }
    const onSpeculate = vi.fn().mockResolvedValue(mockResults)
    const globals = createGlobals({ ...config, onSpeculate })

    const result = await globals.speculate([{ label: 'a', fn: () => 'local-a' }])
    expect(onSpeculate).toHaveBeenCalled()
    expect(result.results[0].result).toBe('llm-a')
  })

  it('times out slow branches', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    const result = await globals.speculate(
      [{ label: 'slow', fn: () => new Promise(() => {}) }],
      { timeout: 50 },
    )

    expect(result.results[0].ok).toBe(false)
    expect(result.results[0].error).toBe('Branch timed out')
  })
})

// ── reflect (LLM-backed, mocked) ─────────────────────────────────────────────

describe('reflect', () => {
  it('calls onReflect and returns assessment', async () => {
    const config = createMockConfig()
    const mockResult = {
      assessment: 'The plan is solid but needs refinement',
      scores: { completeness: 0.8, feasibility: 0.9 },
      suggestions: ['Add error handling'],
      shouldPivot: false,
    }
    const onReflect = vi.fn().mockResolvedValue(mockResult)
    const globals = createGlobals({ ...config, onReflect })

    const result = await globals.reflect({
      question: 'Is this plan complete?',
      criteria: ['completeness', 'feasibility'],
    })

    expect(onReflect).toHaveBeenCalledWith({
      question: 'Is this plan complete?',
      criteria: ['completeness', 'feasibility'],
    })
    expect(result.shouldPivot).toBe(false)
    expect(result.scores.completeness).toBe(0.8)
  })

  it('throws when onReflect not configured', async () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    await expect(globals.reflect({ question: 'Is this good?' })).rejects.toThrow('no reflection model configured')
  })

  it('throws for missing question', async () => {
    const config = createMockConfig()
    const onReflect = vi.fn()
    const globals = createGlobals({ ...config, onReflect })

    await expect(globals.reflect({} as any)).rejects.toThrow('requires { question:')
  })

  it('forwards shouldPivot: true to signal strategy change', async () => {
    const config = createMockConfig()
    const onReflect = vi.fn().mockResolvedValue({
      assessment: 'Current approach is inefficient',
      scores: { quality: 0.2 },
      suggestions: ['Try a different model'],
      shouldPivot: true,
    })
    const globals = createGlobals({ ...config, onReflect })

    const result = await globals.reflect({ question: 'Should I pivot?' })
    expect(result.shouldPivot).toBe(true)
  })
})

// ── pin / unpin ───────────────────────────────────────────────────────────────

describe('pin / unpin', () => {
  it('stores a value and returns it via getPinnedMemory', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    globals.pin('userId', 'u_42')

    const pinned = globals.getPinnedMemory()
    expect(pinned.has('userId')).toBe(true)
    expect(pinned.get('userId')?.value).toBe('u_42')
  })

  it('updates existing pin without consuming a slot', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    globals.pin('x', 1)
    globals.pin('x', 2)

    expect(globals.getPinnedMemory().get('x')?.value).toBe(2)
    expect(globals.getPinnedMemory().size).toBe(1)
  })

  it('throws at 10 pins when adding a new key', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    for (let i = 0; i < 10; i++) globals.pin(`key${i}`, i)

    expect(() => globals.pin('overflow', 'value')).toThrow('pin() limit reached')
  })

  it('unpins a key', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    globals.pin('a', 1)
    globals.unpin('a')

    expect(globals.getPinnedMemory().has('a')).toBe(false)
  })

  it('throws for invalid pin key', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    expect(() => globals.pin('', 'val')).toThrow('requires a non-empty string key')
  })

  it('throws for invalid unpin key', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    expect(() => globals.unpin('')).toThrow('requires a non-empty string key')
  })
})

// ── memo ──────────────────────────────────────────────────────────────────────

describe('memo', () => {
  it('writes and reads a memo', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    globals.memo('summary', 'User prefers concise answers')
    expect(globals.memo('summary')).toBe('User prefers concise answers')
  })

  it('deletes a memo when value is null', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    globals.memo('key', 'value')
    globals.memo('key', null)

    expect(globals.memo('key')).toBeUndefined()
  })

  it('returns undefined for unknown key', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    expect(globals.memo('unknown')).toBeUndefined()
  })

  it('throws when value exceeds 500 chars', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    expect(() => globals.memo('k', 'x'.repeat(501))).toThrow('500 char limit')
  })

  it('throws at 20 memos when adding a new key', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    for (let i = 0; i < 20; i++) globals.memo(`key${i}`, `value${i}`)

    expect(() => globals.memo('overflow', 'new value')).toThrow('memo() limit reached')
  })

  it('allows updating an existing memo beyond the 20 slot limit', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    for (let i = 0; i < 20; i++) globals.memo(`key${i}`, `value${i}`)

    // Updating existing key should not throw
    expect(() => globals.memo('key0', 'updated')).not.toThrow()
    expect(globals.memo('key0')).toBe('updated')
  })

  it('throws for non-string value', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    expect(() => globals.memo('k', 42 as any)).toThrow('value must be a string or null')
  })

  it('throws for invalid key', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    expect(() => globals.memo('')).toThrow('requires a non-empty string key')
  })

  it('stores memos accessible via getMemoMemory', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    globals.memo('note', 'remember this')

    expect(globals.getMemoMemory().has('note')).toBe(true)
  })
})

// ── contextBudget ─────────────────────────────────────────────────────────────

describe('contextBudget', () => {
  it('returns default snapshot when not configured', () => {
    const config = createMockConfig()
    const globals = createGlobals(config)

    const budget = globals.contextBudget()
    expect(budget.totalTokens).toBe(100_000)
    expect(budget.recommendation).toBe('nominal')
  })

  it('calls onContextBudget when configured', () => {
    const config = createMockConfig()
    const mockBudget = {
      totalTokens: 128_000,
      usedTokens: 80_000,
      remainingTokens: 48_000,
      systemPromptTokens: 10_000,
      messageHistoryTokens: 70_000,
      turnNumber: 12,
      decayLevel: { stops: 'compact', knowledge: 'minimal' },
      recommendation: 'conserve' as const,
    }
    const onContextBudget = vi.fn().mockReturnValue(mockBudget)
    const globals = createGlobals({ ...config, onContextBudget })

    const result = globals.contextBudget()
    expect(onContextBudget).toHaveBeenCalled()
    expect(result.recommendation).toBe('conserve')
    expect(result.usedTokens).toBe(80_000)
  })
})
