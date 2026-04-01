/**
 * LLM Instruction Quality Tests
 *
 * These tests verify that each global function's description is clear enough
 * for language models of varying sizes to understand and use correctly.
 *
 * Each global is tested against 5 model sizes: pico, micro, nano, medium, large.
 * A real LLM call is made for each (model × global) pair. The generated code is
 * executed in a real sandbox and the output is asserted.
 *
 * Required environment variables:
 *   LMTHING_API_KEY  — API key for the LiteLLM-compatible endpoint
 *   LMTHING_BASE_URL — Base URL (default: https://cloud.lmthing.com/v1)
 *
 * Optional per-size model overrides (see MODEL_SIZES below for defaults):
 *   LMTHING_MODEL_PICO   LMTHING_MODEL_MICRO   LMTHING_MODEL_NANO
 *   LMTHING_MODEL_MEDIUM LMTHING_MODEL_LARGE
 *
 * Run only this suite:
 *   LMTHING_API_KEY=<key> pnpm vitest run src/sandbox/globals-llm.test.ts
 */

import { describe, it, expect, vi } from 'vitest'
import { Sandbox } from './sandbox'
import { createGlobals } from './globals'
import { AsyncManager } from './async-manager'
import type { StreamPauseController, RenderSurface } from '../session/types'

// ── Model size definitions ───────────────────────────────────────────────────
// Each size maps to a model name. Override via environment variables.
// These are sent to the OpenAI-compatible LiteLLM endpoint at LMTHING_BASE_URL.

const MODEL_SIZES = {
  pico:   process.env.LMTHING_MODEL_PICO   ?? 'gpt-3.5-turbo',
  micro:  process.env.LMTHING_MODEL_MICRO  ?? 'gpt-4o-mini',
  nano:   process.env.LMTHING_MODEL_NANO   ?? 'gpt-4o-mini',
  medium: process.env.LMTHING_MODEL_MEDIUM ?? 'gpt-4o',
  large:  process.env.LMTHING_MODEL_LARGE  ?? 'gpt-4-turbo',
} as const

type ModelSize = keyof typeof MODEL_SIZES

const ALL_SIZES = Object.keys(MODEL_SIZES) as ModelSize[]

// ── Skip guard ────────────────────────────────────────────────────────────────

const API_KEY = process.env.LMTHING_API_KEY ?? process.env.OPENAI_API_KEY
const BASE_URL = (process.env.LMTHING_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '')

const hasApiKey = !!API_KEY

// ── LLM helper ────────────────────────────────────────────────────────────────

/**
 * Ask the LLM (of a given size) to write a TypeScript snippet that uses a specific
 * global. The system prompt explains the global concisely; the user prompt gives a
 * concrete task. Returns raw text (we extract the first code block).
 *
 * Uses the OpenAI-compatible /v1/chat/completions endpoint directly via fetch.
 */
async function askLlm(
  size: ModelSize,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  if (!API_KEY) throw new Error('No API key — set LMTHING_API_KEY or OPENAI_API_KEY')

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL_SIZES[size],
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 200,
      temperature: 0,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`LLM API error ${response.status}: ${body.slice(0, 200)}`)
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>
  }
  return data.choices[0]?.message?.content ?? ''
}

/** Extract TypeScript code from a markdown code block or raw code. */
function extractCode(text: string): string {
  const fenced = text.match(/```(?:typescript|ts|javascript|js)?\s*\n?([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  // No fences — assume the whole response is code
  return text.trim()
}

// ── Sandbox factory ───────────────────────────────────────────────────────────

function createTestSandbox() {
  let paused = false
  const pauseController: StreamPauseController = {
    pause: vi.fn(() => { paused = true }),
    resume: vi.fn(() => { paused = false }),
    isPaused: () => paused,
  }
  const renders: Array<{ id: string; element: unknown }> = []
  const renderSurface: RenderSurface = {
    append: vi.fn((id, el) => renders.push({ id, el })),
    renderForm: vi.fn().mockResolvedValue({ name: 'Alice' }),
    cancelForm: vi.fn(),
    appendTasklistProgress: vi.fn(),
    updateTasklistProgress: vi.fn(),
    updateTaskProgress: vi.fn(),
  }
  const asyncManager = new AsyncManager()
  const sandbox = new Sandbox()

  const globals = createGlobals({ pauseController, renderSurface, asyncManager })

  // Inject all globals into the sandbox
  for (const [name, fn] of Object.entries({
    stop: globals.stop,
    display: globals.display,
    ask: globals.ask,
    async: globals.async,
    tasklist: globals.tasklist,
    completeTask: globals.completeTask,
    completeTaskAsync: globals.completeTaskAsync,
    taskProgress: globals.taskProgress,
    failTask: globals.failTask,
    retryTask: globals.retryTask,
    sleep: globals.sleep,
    loadKnowledge: globals.loadKnowledge,
    pipeline: globals.pipeline,
    parallel: globals.parallel,
    schema: globals.schema,
    validate: globals.validate,
    guard: globals.guard,
    broadcast: globals.broadcast,
    listen: globals.listen,
    pin: globals.pin,
    unpin: globals.unpin,
    memo: globals.memo,
    trace: globals.trace,
    checkpoint: globals.checkpoint,
    rollback: globals.rollback,
    speculate: globals.speculate,
    delegate: globals.delegate,
    cachedFetch: globals.cachedFetch,
    compress: globals.compress,
    focus: globals.focus,
    watch: globals.watch,
    learn: globals.learn,
    critique: globals.critique,
    reflect: globals.reflect,
    fork: globals.fork,
    plan: globals.plan,
    contextBudget: globals.contextBudget,
  })) {
    sandbox.inject(name, fn as any)
  }

  return { sandbox, globals, pauseController, renderSurface, renders }
}

// ── Test helper: run for all sizes ───────────────────────────────────────────

/**
 * Run a test across all 5 model sizes. Skips if no API key.
 */
function forEachSize(
  name: string,
  fn: (size: ModelSize) => Promise<void>,
) {
  for (const size of ALL_SIZES) {
    it.skipIf(!hasApiKey)(`[${size}] ${name}`, { timeout: 30_000 }, async () => {
      await fn(size)
    })
  }
}

// ── System prompt fragments ───────────────────────────────────────────────────

const PREAMBLE = `You are a TypeScript REPL agent. Write only TypeScript code — no prose, no markdown.
The sandbox has no imports. The following globals are available.`

function makeSystemPrompt(globalDocs: string): string {
  return `${PREAMBLE}\n\n${globalDocs}`
}

// ── stop ─────────────────────────────────────────────────────────────────────

describe('LLM instruction quality: stop', () => {
  forEachSize('can call stop() to pause execution with a value', async (size) => {
    const systemPrompt = makeSystemPrompt(`
stop(...values) — Pause execution and surface values to the user.
Example: await stop(result)
The agent always uses \`await stop(value)\` to hand control back.
`)

    const code = extractCode(await askLlm(size, systemPrompt,
      'Write two lines: (1) declare a variable answer = 42; (2) call await stop(answer).'))

    const stopFn = vi.fn().mockResolvedValue(undefined)
    const sb = new Sandbox()
    sb.inject('stop', stopFn)
    await sb.execute(code)

    expect(stopFn).toHaveBeenCalled()
    const args = stopFn.mock.calls[0] as unknown[]
    expect(args[0]).toBe(42)
  })
})

// ── display ───────────────────────────────────────────────────────────────────

describe('LLM instruction quality: display', () => {
  forEachSize('can call display() to render output', async (size) => {
    const { sandbox, renders } = createTestSandbox()

    const systemPrompt = makeSystemPrompt(`
display(element) — Render a React element to the output surface. Non-blocking.
Example: display(<div>Hello</div>)
Or plain objects: display({ type: 'div', props: { children: 'Hello' } })
`)

    const code = extractCode(await askLlm(size, systemPrompt,
      'Write a single line that calls display() with a plain object representing a div with text "Hello World".'))

    const displayFn = vi.fn()
    const sb = new Sandbox()
    sb.inject('display', displayFn)
    await sb.execute(code)

    expect(displayFn).toHaveBeenCalled()
  })
})

// ── sleep ─────────────────────────────────────────────────────────────────────

describe('LLM instruction quality: sleep', () => {
  forEachSize('can call sleep() to pause briefly', async (size) => {
    const systemPrompt = makeSystemPrompt(`
sleep(seconds) — Pause execution for the given number of seconds. Maximum 30 seconds.
Example: await sleep(1)
`)

    const code = extractCode(await askLlm(size, systemPrompt,
      'Write a single line that sleeps for 0.01 seconds.'))

    const sb = new Sandbox()
    const sleepFn = vi.fn().mockResolvedValue(undefined)
    sb.inject('sleep', sleepFn)
    await sb.execute(code)

    expect(sleepFn).toHaveBeenCalledWith(expect.any(Number))
    const seconds = (sleepFn.mock.calls[0] as [number])[0]
    expect(seconds).toBeGreaterThanOrEqual(0)
    expect(seconds).toBeLessThanOrEqual(1)
  })
})

// ── pipeline ──────────────────────────────────────────────────────────────────

describe('LLM instruction quality: pipeline', () => {
  forEachSize('can build a data pipeline with transforms', async (size) => {
    const systemPrompt = makeSystemPrompt(`
pipeline(data, ...transforms) — Chain data transformations.
Each transform is { name: string, fn: (input) => output }.
Returns { result, steps: [{ name, ok, durationMs }] }.
Example:
  const out = await pipeline(
    [1, 2, 3],
    { name: 'sum', fn: (arr) => arr.reduce((a, b) => a + b, 0) },
    { name: 'stringify', fn: (n) => String(n) },
  )
`)

    const code = extractCode(await askLlm(size, systemPrompt,
      'Write code that pipes the number 10 through a "double" transform (multiplies by 2) and stores the result in variable "out".'))

    const pipelineFn = vi.fn().mockResolvedValue({ result: 20, steps: [{ name: 'double', ok: true, durationMs: 0 }] })
    const sb = new Sandbox()
    sb.inject('pipeline', pipelineFn)
    await sb.execute(code)

    expect(pipelineFn).toHaveBeenCalled()
    const [data, ...transforms] = pipelineFn.mock.calls[0] as [unknown, ...Array<{ name: string; fn: unknown }>]
    expect(data).toBe(10)
    expect(transforms).toHaveLength(1)
    expect(transforms[0].name).toMatch(/double/i)
    expect(typeof transforms[0].fn).toBe('function')
  })
})

// ── parallel ──────────────────────────────────────────────────────────────────

describe('LLM instruction quality: parallel', () => {
  forEachSize('can run tasks in parallel', async (size) => {
    const systemPrompt = makeSystemPrompt(`
parallel(tasks, options?) — Run multiple async functions concurrently. Max 10.
Each task: { label: string, fn: () => unknown }
Returns: Array<{ label, ok, result?, error?, durationMs }>
Example:
  const results = await parallel([
    { label: 'fetch-a', fn: async () => fetchA() },
    { label: 'fetch-b', fn: async () => fetchB() },
  ])
`)

    const code = extractCode(await askLlm(size, systemPrompt,
      'Write code that runs two parallel tasks: "task-a" returns 1, "task-b" returns 2. Store in "results".'))

    const parallelFn = vi.fn().mockResolvedValue([
      { label: 'task-a', ok: true, result: 1, durationMs: 0 },
      { label: 'task-b', ok: true, result: 2, durationMs: 0 },
    ])
    const sb = new Sandbox()
    sb.inject('parallel', parallelFn)
    await sb.execute(code)

    expect(parallelFn).toHaveBeenCalled()
    const [tasks] = parallelFn.mock.calls[0] as [Array<{ label: string; fn: unknown }>]
    expect(Array.isArray(tasks)).toBe(true)
    expect(tasks.length).toBe(2)
    const labels = tasks.map(t => t.label)
    expect(labels).toContain('task-a')
    expect(labels).toContain('task-b')
  })
})

// ── tasklist + completeTask ───────────────────────────────────────────────────

describe('LLM instruction quality: tasklist + completeTask', () => {
  forEachSize('can declare a tasklist and complete tasks in order', async (size) => {
    const systemPrompt = makeSystemPrompt(`
tasklist(tasklistId, description, tasks) — Declare a task plan.
  tasks: Array<{ id, instructions, outputSchema: Record<string, {type}> }>
  By default tasks run sequentially. Call once per session.

completeTask(tasklistId, taskId, output) — Mark task complete with its output.
  output must match the task's outputSchema.

Example:
  tasklist('plan', 'Build a feature', [
    { id: 'research', instructions: 'Look up APIs', outputSchema: { summary: { type: 'string' } } },
    { id: 'implement', instructions: 'Write the code', outputSchema: { path: { type: 'string' } } },
  ])
  completeTask('plan', 'research', { summary: 'Found 3 APIs' })
  completeTask('plan', 'implement', { path: 'src/feature.ts' })
`)

    const code = extractCode(await askLlm(size, systemPrompt,
      'Write code that: (1) declares a tasklist "wf" with description "Process data" and two tasks: "fetch" (outputSchema: {data: {type:"string"}}) and "save" (outputSchema: {id: {type:"number"}}); (2) completes "fetch" with {data:"hello"}; (3) completes "save" with {id:1}.'))

    const tasklistFn = vi.fn()
    const completeTaskFn = vi.fn()
    const sb = new Sandbox()
    sb.inject('tasklist', tasklistFn)
    sb.inject('completeTask', completeTaskFn)
    await sb.execute(code)

    expect(tasklistFn).toHaveBeenCalled()
    expect(completeTaskFn).toHaveBeenCalledTimes(2)

    const [tlId, , tasks] = tasklistFn.mock.calls[0] as [string, string, any[]]
    expect(tlId).toBe('wf')
    expect(tasks).toHaveLength(2)

    const completions = completeTaskFn.mock.calls
    const taskIds = completions.map((c: any[]) => c[1] as string)
    expect(taskIds).toContain('fetch')
    expect(taskIds).toContain('save')
  })
})

// ── schema ────────────────────────────────────────────────────────────────────

describe('LLM instruction quality: schema', () => {
  forEachSize('can infer a schema from a value', async (size) => {
    const systemPrompt = makeSystemPrompt(`
schema(value) — Infer a JSON schema from a runtime value.
Returns a schema object like { type: 'object', properties: {...} }.
Example:
  const s = schema({ name: 'Alice', age: 30 })
  // s.type === 'object'
`)

    const code = extractCode(await askLlm(size, systemPrompt,
      'Write a single line that infers the schema of the object { count: 5 } and stores it in variable "s".'))

    const schemaFn = vi.fn().mockReturnValue({ type: 'object', properties: { count: { type: 'number' } } })
    const sb = new Sandbox()
    sb.inject('schema', schemaFn)
    await sb.execute(code)

    expect(schemaFn).toHaveBeenCalled()
    const arg = schemaFn.mock.calls[0][0]
    expect(arg).toMatchObject({ count: 5 })
  })
})

// ── validate ──────────────────────────────────────────────────────────────────

describe('LLM instruction quality: validate', () => {
  forEachSize('can validate a value against a schema', async (size) => {
    const systemPrompt = makeSystemPrompt(`
validate(value, schema) — Validate a value against a JSON-like schema.
Returns { valid: true } or { valid: false, errors: string[] }.
Example:
  const r = validate('hello', { type: 'string' })  // r.valid === true
  const r2 = validate(42, { type: 'string' })       // r2.valid === false
`)

    const code = extractCode(await askLlm(size, systemPrompt,
      'Write a single line that validates the number 99 against { type: "number" } and stores the result in "result".'))

    const validateFn = vi.fn().mockReturnValue({ valid: true })
    const sb = new Sandbox()
    sb.inject('validate', validateFn)
    await sb.execute(code)

    expect(validateFn).toHaveBeenCalled()
    const [val, sch] = validateFn.mock.calls[0] as [unknown, Record<string, unknown>]
    expect(val).toBe(99)
    expect(sch).toMatchObject({ type: 'number' })
  })
})

// ── guard ─────────────────────────────────────────────────────────────────────

describe('LLM instruction quality: guard', () => {
  forEachSize('can use guard() as a runtime assertion', async (size) => {
    const systemPrompt = makeSystemPrompt(`
guard(condition, message) — Runtime assertion. Throws GuardError if condition is falsy.
Example:
  const x = 5
  guard(x > 0, 'x must be positive')  // passes
  guard(x > 10, 'x must be > 10')     // throws GuardError: x must be > 10
`)

    const code = extractCode(await askLlm(size, systemPrompt,
      'Write code that: (1) declares const items = [1, 2, 3]; (2) uses guard to assert items.length > 0 with message "items must not be empty".'))

    const guardFn = vi.fn()
    const sb = new Sandbox()
    sb.inject('guard', guardFn)
    await sb.execute(code)

    expect(guardFn).toHaveBeenCalled()
    const [condition, message] = guardFn.mock.calls[0] as [unknown, string]
    expect(condition).toBeTruthy()
    expect(typeof message).toBe('string')
    expect(message.toLowerCase()).toContain('empty')
  })
})

// ── broadcast + listen ───────────────────────────────────────────────────────

describe('LLM instruction quality: broadcast + listen', () => {
  forEachSize('can emit and receive events via broadcast/listen', async (size) => {
    const systemPrompt = makeSystemPrompt(`
broadcast(channel, data) — Emit an event on a named channel.
listen(channel, callback?) — Subscribe or drain buffered events.
  With callback: listen('ch', (data) => ...) — returns unsubscribe function.
  Without callback: listen('ch') — returns buffered events array and clears buffer.
Example:
  broadcast('status', { code: 200 })
  const events = listen('status')  // [{ code: 200 }]
`)

    const code = extractCode(await askLlm(size, systemPrompt,
      'Write code that: (1) broadcasts a "done" event on channel "results" with value { ok: true }; (2) retrieves buffered events from "results" into variable "events".'))

    const broadcastFn = vi.fn()
    const listenFn = vi.fn().mockReturnValue([{ ok: true }])
    const sb = new Sandbox()
    sb.inject('broadcast', broadcastFn)
    sb.inject('listen', listenFn)
    await sb.execute(code)

    expect(broadcastFn).toHaveBeenCalledWith('results', expect.anything())
    expect(listenFn).toHaveBeenCalledWith('results')
  })
})

// ── pin + unpin ───────────────────────────────────────────────────────────────

describe('LLM instruction quality: pin + unpin', () => {
  forEachSize('can pin and unpin values', async (size) => {
    const systemPrompt = makeSystemPrompt(`
pin(key, value) — Pin a value to persistent memory that survives across turns.
  Pinned values appear in the {{PINNED}} block of the system prompt.
  Max 10 pins.
unpin(key) — Remove a pinned value.
Example:
  pin('userId', 'u_123')
  pin('theme', 'dark')
  unpin('theme')
`)

    const code = extractCode(await askLlm(size, systemPrompt,
      'Write code that: (1) pins the key "sessionId" with value "s_42"; (2) then unpins "sessionId".'))

    const pinFn = vi.fn()
    const unpinFn = vi.fn()
    const sb = new Sandbox()
    sb.inject('pin', pinFn)
    sb.inject('unpin', unpinFn)
    await sb.execute(code)

    expect(pinFn).toHaveBeenCalledWith('sessionId', 's_42')
    expect(unpinFn).toHaveBeenCalledWith('sessionId')
  })
})

// ── memo ──────────────────────────────────────────────────────────────────────

describe('LLM instruction quality: memo', () => {
  forEachSize('can write and read memos', async (size) => {
    const systemPrompt = makeSystemPrompt(`
memo(key) — Read a memo.
memo(key, text) — Write a memo (max 500 chars, max 20 memos).
memo(key, null) — Delete a memo.
Memos appear in {{MEMO}} in the system prompt.
Example:
  memo('plan', 'Step 1: gather data')
  const note = memo('plan')  // 'Step 1: gather data'
  memo('plan', null)          // delete
`)

    const code = extractCode(await askLlm(size, systemPrompt,
      'Write code that: (1) writes a memo with key "progress" and value "halfway done"; (2) reads it back into variable "note".'))

    const memoFn = vi.fn()
      .mockImplementationOnce(() => undefined) // write call returns undefined
      .mockImplementationOnce(() => 'halfway done') // read call
    const sb = new Sandbox()
    sb.inject('memo', memoFn)
    await sb.execute(code)

    expect(memoFn).toHaveBeenCalledTimes(2)
    expect(memoFn.mock.calls[0]).toEqual(['progress', 'halfway done'])
    expect(memoFn.mock.calls[1]).toEqual(['progress'])
  })
})

// ── speculate ─────────────────────────────────────────────────────────────────

describe('LLM instruction quality: speculate', () => {
  forEachSize('can run speculative branches', async (size) => {
    const systemPrompt = makeSystemPrompt(`
speculate(branches, options?) — Run multiple approaches concurrently.
  branches: Array<{ label: string, fn: () => unknown }>
  Max 5 branches. Returns { results: SpeculateBranchResult[] }.
  Each result: { label, ok, result?, error?, durationMs }
Example:
  const { results } = await speculate([
    { label: 'approach-a', fn: () => computeA() },
    { label: 'approach-b', fn: () => computeB() },
  ])
  const winner = results.find(r => r.ok)
`)

    const code = extractCode(await askLlm(size, systemPrompt,
      'Write code that speculatively tries two approaches: "parse-json" returns JSON.parse(\'{"x":1}\'), "fallback" returns {x:0}. Store in "out".'))

    const speculateFn = vi.fn().mockResolvedValue({
      results: [
        { label: 'parse-json', ok: true, result: { x: 1 }, durationMs: 0 },
        { label: 'fallback', ok: true, result: { x: 0 }, durationMs: 0 },
      ],
    })
    const sb = new Sandbox()
    sb.inject('speculate', speculateFn)
    await sb.execute(code)

    expect(speculateFn).toHaveBeenCalled()
    const [branches] = speculateFn.mock.calls[0] as [Array<{ label: string; fn: unknown }>]
    expect(Array.isArray(branches)).toBe(true)
    expect(branches.length).toBe(2)
    const labels = branches.map(b => b.label)
    expect(labels).toContain('parse-json')
    expect(labels).toContain('fallback')
  })
})

// ── contextBudget ─────────────────────────────────────────────────────────────

describe('LLM instruction quality: contextBudget', () => {
  forEachSize('can read context budget and act on recommendation', async (size) => {
    const systemPrompt = makeSystemPrompt(`
contextBudget() — Returns a snapshot of the context window budget.
Returns: { totalTokens, usedTokens, remainingTokens, recommendation: 'nominal'|'conserve'|'critical' }
Example:
  const budget = contextBudget()
  if (budget.recommendation === 'critical') {
    // trim context...
  }
`)

    const code = extractCode(await askLlm(size, systemPrompt,
      'Write code that: (1) reads the context budget into "budget"; (2) if recommendation is "conserve" or "critical", sets variable "shouldTrim" to true, otherwise false.'))

    const budgetFn = vi.fn().mockReturnValue({
      totalTokens: 100_000,
      usedTokens: 80_000,
      remainingTokens: 20_000,
      recommendation: 'conserve',
    })
    const sb = new Sandbox()
    sb.inject('contextBudget', budgetFn)
    await sb.execute(code)

    expect(budgetFn).toHaveBeenCalled()
    const shouldTrim = sb.getValue('shouldTrim')
    expect(shouldTrim).toBe(true)
  })
})

// ── focus ─────────────────────────────────────────────────────────────────────

describe('LLM instruction quality: focus', () => {
  forEachSize('can narrow system prompt to specific sections', async (size) => {
    const systemPrompt = makeSystemPrompt(`
focus(...sections) — Collapse system prompt sections you don't need.
  Valid sections: 'functions', 'knowledge', 'components', 'classes', 'agents'
  focus('all') or focus() — reset to show everything.
Example:
  focus('functions', 'knowledge')  // only show these two sections
  focus('all')                     // reset — show all sections
`)

    const code = extractCode(await askLlm(size, systemPrompt,
      'Write a line that focuses only on the "knowledge" and "functions" sections of the system prompt.'))

    const focusFn = vi.fn()
    const sb = new Sandbox()
    sb.inject('focus', focusFn)
    await sb.execute(code)

    expect(focusFn).toHaveBeenCalled()
    const sections = focusFn.mock.calls[0] as string[]
    expect(sections).toContain('knowledge')
    expect(sections).toContain('functions')
  })
})

// ── async ─────────────────────────────────────────────────────────────────────

describe('LLM instruction quality: async', () => {
  forEachSize('can run a background task with async()', async (size) => {
    const systemPrompt = makeSystemPrompt(`
async(fn, label?) — Fire-and-forget background task. Does not block execution.
  fn: async () => void — the background work
  label: optional description shown in UI
Results are delivered at the next stop() call.
Example:
  async(async () => { await someWork() }, 'doing work')
`)

    const code = extractCode(await askLlm(size, systemPrompt,
      'Write a single line that starts a background task labeled "send-report" that calls an async function sendReport() (assume it exists).'))

    const asyncFn = vi.fn()
    const sendReport = vi.fn().mockResolvedValue(undefined)
    const sb = new Sandbox()
    sb.inject('async', asyncFn)
    sb.inject('sendReport', sendReport)
    await sb.execute(code)

    expect(asyncFn).toHaveBeenCalled()
    const [fn, label] = asyncFn.mock.calls[0] as [() => Promise<void>, string | undefined]
    expect(typeof fn).toBe('function')
    if (label !== undefined) {
      expect(typeof label).toBe('string')
    }
  })
})
