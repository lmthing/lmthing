/**
 * Shared REPL runner — uses Vercel AI SDK streamText with the core provider resolver.
 *
 * The model string follows the "provider:modelId" format from lmthing core:
 *   "openai:gpt-4o-mini", "anthropic:claude-sonnet-4-20250514", "zai:glm-4.5", etc.
 *
 * Custom providers are configured via environment variables:
 *   ZAI_API_KEY, ZAI_API_BASE, ZAI_API_TYPE=openai
 *
 * Run:
 *   npx tsx examples/01-math.ts zai:glm-4.5
 */

import { config } from 'dotenv'
import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'

// Load .env from the repl package root
config({ path: resolve(import.meta.dirname, '../.env') })

import { streamText } from 'ai'
import { resolveModel } from '../../core/src/providers/resolver'
import { Session } from '../src/session/session'
import type { SessionEvent, StopPayload, ErrorPayload } from '../src/session/types'
import { generateScopeTable } from '../src/context/scope-generator'
import { serialize } from '../src/stream/serializer'

// ── System Prompt ──

function buildSystemPrompt(fnSigs: string, scope: string, instruct?: string): string {
  let prompt = `You are a code-execution agent. You respond EXCLUSIVELY with valid TypeScript code. No markdown. No prose. No explanations outside of code comments. Every character you emit is fed line-by-line into a live TypeScript REPL that executes as you stream.

## Execution Model

Your output is NOT a script that runs after you finish. Each line is parsed and executed as it arrives. Think of yourself as typing into a live terminal.

The REPL supports top-level await. Every async function call must be awaited.

CRITICAL: Do NOT wrap code in markdown fences (\`\`\`). Output raw TypeScript only. Do NOT use <think> tags or any XML tags.

## Available Globals

### await stop(...values) — Pause and read
Suspends your execution. The runtime evaluates each argument, serializes the results, and injects them as a user message prefixed with "← stop". You resume with knowledge of those values.

Use stop when you need to inspect a runtime value before deciding what to write next.
Example: await stop(x, y) → you will see: ← stop { x: <value>, y: <value> }

IMPORTANT: After calling await stop(), STOP writing code. The runtime will pause your stream, read the values, and resume you in a new turn. Do NOT predict or simulate the stop response yourself.

### display(element) — Show output to user
Non-blocking. Appends a rendered component to the user's view.

### checkpoints(plan) — Declare a task plan with milestones
Before starting any implementation work, you MUST declare a plan using checkpoints(). This registers milestones with the host. Each checkpoint has an id, instructions, and outputSchema describing the result shape.

Call checkpoints() exactly ONCE, before writing any implementation code. It does not block execution.

Example:
checkpoints({
  description: "Analyze employee data",
  tasks: [
    { id: "load", instructions: "Load the dataset", outputSchema: { count: { type: "number" } } },
    { id: "analyze", instructions: "Compute statistics", outputSchema: { done: { type: "boolean" } } },
    { id: "report", instructions: "Present results", outputSchema: { done: { type: "boolean" } } }
  ]
})

### checkpoint(id, output) — Mark a milestone as complete
When you reach a milestone, call checkpoint() with its id and an output object matching the declared outputSchema. Non-blocking. Must be called in declaration order — do not skip checkpoints.

Example:
checkpoint("load", { count: 10 })

If your stream ends before all checkpoints are complete, the host will send you a reminder:
  ⚠ [system] Checkpoint plan incomplete. Remaining: analyze, report. Continue from where you left off.
When you see this, continue from the next incomplete checkpoint. Do NOT re-declare checkpoints() or redo completed work.

## Workspace — Current Scope
${scope || '(no variables declared)'}

## Available Functions
${fnSigs || '(none)'}

## Rules
1. Output ONLY valid TypeScript. No markdown. No prose outside // comments.
2. Plan before you build — call checkpoints() first to declare milestones, then call checkpoint(id, output) as you complete each one.
3. Await every async call: var x = await fn()
4. Use stop() to read runtime values before branching.
5. Do not use console.log — use stop() to inspect values.
6. Do not import modules. Do not use export.
7. Use var for all declarations (not const/let) so they persist in the REPL scope across turns.
8. Handle nullability with ?. and ??
9. After calling await stop(...), STOP. Do not write any more code until you receive the stop response.

## Execution Flow Pattern

A typical interaction follows this pattern:

// 1. Plan — always start with checkpoints
checkpoints({
  description: "...",
  tasks: [
    { id: "step1", instructions: "...", outputSchema: { key: { type: "string" } } },
    { id: "step2", instructions: "...", outputSchema: { done: { type: "boolean" } } }
  ]
})

// 2. Do work for step 1
var result = await someFunction()
await stop(result)
// ← stop { result: ... }

// 3. Mark step 1 complete
checkpoint("step1", { key: result.key })

// 4. Do work for step 2
var final = await anotherFunction()
checkpoint("step2", { done: true })
`
  if (instruct) prompt += `\n## Special Instructions\n${instruct}\n`
  return prompt
}

// ── REPL Runner ──

export interface RunnerOptions {
  /** Model string, e.g. "openai:gpt-4o-mini", "zai:glm-4.5", "anthropic:claude-sonnet-4-20250514" */
  model: string
  /** User message to start the conversation */
  userMessage: string
  /** Functions to inject into the sandbox */
  globals?: Record<string, unknown>
  /** Function signatures for the system prompt */
  functionSignatures?: string
  /** Max LLM turns (stop/resume cycles). Default: 10 */
  maxTurns?: number
  /** Max checkpoint reminder cycles before giving up. Default: 3 */
  maxCheckpointReminders?: number
  /** Custom instructions appended to system prompt */
  instruct?: string
  /** Path to write a debug log of the entire run (messages, events, scope) */
  debugFile?: string
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function runRepl(options: RunnerOptions): Promise<void> {
  const {
    model: modelId,
    userMessage,
    globals = {},
    functionSignatures = '',
    maxTurns = 10,
    maxCheckpointReminders = 3,
    instruct,
    debugFile,
  } = options

  const model = resolveModel(modelId)

  // Debug history collector
  interface DebugEntry {
    timestamp: number
    type: 'system_prompt' | 'message' | 'event' | 'scope' | 'api_error' | 'turn' | 'turn_result' | 'finalize'
    data: unknown
  }
  const debugLog: DebugEntry[] = []
  const debug = !!debugFile

  // Accumulated token totals across all turns
  const tokenTotals = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

  function logDebug(type: DebugEntry['type'], data: unknown) {
    if (debug) debugLog.push({ timestamp: Date.now(), type, data })
  }

  console.log('\x1b[36m━━━ @lmthing/repl ━━━\x1b[0m')
  console.log(`\x1b[90mModel: ${modelId}\x1b[0m`)
  if (debug) console.log(`\x1b[90mDebug: ${debugFile}\x1b[0m`)
  console.log(`\x1b[33m[user]\x1b[0m ${userMessage}\n`)

  const session = new Session({ globals, config: { maxCheckpointReminders } })

  // Track events from sandbox execution
  let stopPayload: StopPayload | null = null
  let errorPayload: ErrorPayload | null = null

  session.on('event', (event: SessionEvent) => {
    logDebug('event', event)
    switch (event.type) {
      case 'read':
        stopPayload = {}
        for (const [k, v] of Object.entries(event.payload)) {
          stopPayload[k] = { value: v, display: serialize(v) }
        }
        // Immediately resolve so the sandbox unblocks and feedToken returns
        session.resolveStop()
        break
      case 'error':
        errorPayload = event.error
        break
      case 'display':
        console.log(`\x1b[35m  [display]\x1b[0m component rendered`)
        break
      case 'async_start':
        console.log(`\x1b[34m  [async]\x1b[0m started: ${event.label}`)
        break
      case 'checkpoint_plan':
        console.log(`\x1b[36m  [checkpoints]\x1b[0m plan registered: ${event.plan.description} (${event.plan.tasks.length} tasks)`)
        break
      case 'checkpoint_complete':
        console.log(`\x1b[32m  [checkpoint]\x1b[0m ✓ ${event.id}`)
        break
      case 'checkpoint_reminder':
        console.log(`\x1b[33m  [system]\x1b[0m checkpoint reminder — remaining: ${event.remaining.join(', ')}`)
        break
    }
  })

  // Build conversation
  const messages: ChatMessage[] = []
  const scope = generateScopeTable(session.snapshot().scope)
  const systemPrompt = buildSystemPrompt(functionSignatures, scope, instruct)
  messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: userMessage })

  logDebug('system_prompt', systemPrompt)
  logDebug('message', { role: 'user', content: userMessage })

  let turn = 0

  while (turn < maxTurns) {
    turn++
    stopPayload = null
    errorPayload = null

    console.log(`\x1b[90m--- turn ${turn} ---\x1b[0m`)
    logDebug('turn', { turn, messageCount: messages.length })

    // Stream LLM response using AI SDK streamText
    let code = ''
    try {
      const result = streamText({
        model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: 0.2,
        maxTokens: 2048,
      })

      for await (const chunk of result.textStream) {
        process.stdout.write(`\x1b[32m${chunk}\x1b[0m`)
        code += chunk
      }
      console.log() // newline after streamed code

      // Collect turn metadata (usage, finish reason, response info)
      if (debug) {
        const [usage, finishReason, response] = await Promise.all([
          result.usage,
          result.finishReason,
          result.response,
        ])
        tokenTotals.inputTokens += usage.inputTokens ?? 0
        tokenTotals.outputTokens += usage.outputTokens ?? 0
        tokenTotals.totalTokens += usage.totalTokens ?? 0
        logDebug('turn_result', {
          turn,
          finishReason,
          usage: {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            totalTokens: usage.totalTokens,
            inputTokenDetails: usage.inputTokenDetails,
            outputTokenDetails: usage.outputTokenDetails,
          },
          response: {
            id: response.id,
            modelId: response.modelId,
            timestamp: response.timestamp,
          },
        })
      }
    } catch (err: any) {
      console.error(`\n\x1b[31m  [api error]\x1b[0m ${err.message}`)
      logDebug('api_error', { message: err.message, stack: err.stack })
      break
    }

    // Clean up model output
    code = cleanCode(code)

    // Feed code to session line by line
    // stop()/error events fire synchronously during feedToken via the sandbox.
    // The event handler calls resolveStop() so feedToken returns immediately.
    const lines = code.split('\n')
    for (const line of lines) {
      if (stopPayload || errorPayload) break
      // Skip empty lines and comment-only lines early
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        await session.feedToken(line + '\n')
      } catch {
        // execution errors captured via event
      }
    }

    // Flush remaining buffer if no interruption
    let checkpointIncomplete = false
    if (!stopPayload && !errorPayload) {
      try {
        const result = await session.finalize()
        if (result === 'checkpoint_incomplete') {
          checkpointIncomplete = true
        }
      } catch { /* ignore */ }
    }

    // Handle checkpoint incomplete → inject reminder and loop
    if (checkpointIncomplete) {
      const freshScope = generateScopeTable(session.snapshot().scope)
      const updatedSystemPrompt = buildSystemPrompt(functionSignatures, freshScope, instruct)
      messages[0] = { role: 'system', content: updatedSystemPrompt }
      const sessionMsgs = session.getMessages()
      const reminderMsg = sessionMsgs[sessionMsgs.length - 1]
      messages.push({ role: 'assistant', content: code })
      messages.push({ role: 'user' as const, content: reminderMsg.content })
      logDebug('message', { role: 'assistant', content: code })
      logDebug('message', { role: 'user', content: reminderMsg.content })
      logDebug('system_prompt', updatedSystemPrompt)
      logDebug('scope', session.snapshot().scope)
      continue
    }

    // Handle stop → inject as user message and loop
    if (stopPayload) {
      const entries = Object.entries(stopPayload)
        .map(([k, v]) => `${k}: ${v.display}`)
        .join(', ')
      const stopMsg = `← stop { ${entries} }`
      console.log(`\x1b[33m  [stop]\x1b[0m ${stopMsg}`)

      const codeUpToStop = truncateAtStop(code)
      messages.push({ role: 'assistant', content: codeUpToStop })
      messages.push({ role: 'user', content: stopMsg })

      const freshScope = generateScopeTable(session.snapshot().scope)
      const updatedSystemPrompt = buildSystemPrompt(functionSignatures, freshScope, instruct)
      messages[0] = { role: 'system', content: updatedSystemPrompt }
      logDebug('message', { role: 'assistant', content: codeUpToStop })
      logDebug('message', { role: 'user', content: stopMsg })
      logDebug('system_prompt', updatedSystemPrompt)
      logDebug('scope', session.snapshot().scope)
      continue
    }

    // Handle error → inject as user message and loop
    if (errorPayload) {
      const errMsg = `← error [${errorPayload.type}] ${errorPayload.message} (line ${errorPayload.line})`
      console.log(`\x1b[31m  [error]\x1b[0m ${errMsg}`)

      messages.push({ role: 'assistant', content: code })
      messages.push({ role: 'user', content: errMsg })

      const freshScope = generateScopeTable(session.snapshot().scope)
      const updatedSystemPrompt = buildSystemPrompt(functionSignatures, freshScope, instruct)
      messages[0] = { role: 'system', content: updatedSystemPrompt }
      logDebug('message', { role: 'assistant', content: code })
      logDebug('message', { role: 'user', content: errMsg })
      logDebug('system_prompt', updatedSystemPrompt)
      logDebug('scope', session.snapshot().scope)
      continue
    }

    // No stop/error — LLM finished naturally
    console.log(`\x1b[36m[done]\x1b[0m Completed after ${turn} turn(s)`)
    break
  }

  if (turn >= maxTurns) {
    console.log(`\x1b[33m[limit]\x1b[0m Reached max turns (${maxTurns})`)
  }

  // Print checkpoint summary
  const cpState = session.snapshot().checkpointState
  if (cpState.plan) {
    const total = cpState.plan.tasks.length
    const done = cpState.completed.size
    console.log(`\n\x1b[36m━━━ Checkpoints ━━━\x1b[0m`)
    console.log(`${cpState.plan.description} — ${done}/${total} complete`)
    for (const task of cpState.plan.tasks) {
      const completion = cpState.completed.get(task.id)
      if (completion) {
        console.log(`  \x1b[32m✓\x1b[0m ${task.id}: ${JSON.stringify(completion.output)}`)
      } else {
        console.log(`  \x1b[31m✗\x1b[0m ${task.id}: incomplete`)
      }
    }
  }

  // Print final scope
  const finalScope = generateScopeTable(session.snapshot().scope)
  if (finalScope !== '(no variables declared)') {
    console.log(`\n\x1b[36m━━━ Final Scope ━━━\x1b[0m`)
    console.log(finalScope)
  }

  // Write debug log
  if (debug && debugFile) {
    const snapshot = session.snapshot()
    logDebug('finalize', {
      model: modelId,
      turns: turn,
      maxTurns,
      status: snapshot.status,
      tokenTotals,
      scope: snapshot.scope,
      checkpointState: snapshot.checkpointState.plan ? {
        description: snapshot.checkpointState.plan.description,
        tasks: snapshot.checkpointState.plan.tasks,
        completed: Object.fromEntries(snapshot.checkpointState.completed),
        currentIndex: snapshot.checkpointState.currentIndex,
      } : null,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    const isXml = /\.xml$/i.test(debugFile)
    const output = isXml ? debugLogToXml(debugLog) : JSON.stringify(debugLog, null, 2)
    writeFileSync(resolve(debugFile), output, 'utf-8')
    console.log(`\x1b[90m[debug] Written to ${debugFile}\x1b[0m`)
  }

  session.destroy()
}

/**
 * Clean model output: strip markdown fences, <think> tags, and prose lines.
 */
function cleanCode(raw: string): string {
  let s = raw.trim()
  // Strip markdown fences
  s = s.replace(/^```(?:typescript|ts|tsx|javascript|js)?\s*\n?/, '')
  s = s.replace(/\n?```\s*$/, '')
  // Strip <think>...</think> blocks (some models use these)
  s = s.replace(/<think>[\s\S]*?<\/think>/g, '')
  // Strip leftover </think> tags
  s = s.replace(/<\/?think>/g, '')
  // Remove lines that are clearly prose (don't start with valid TS tokens)
  const lines = s.split('\n')
  const cleaned = lines.filter(line => {
    const t = line.trim()
    if (!t) return true // keep blank lines
    if (t.startsWith('//')) return true // keep comments
    // Heuristic: reject lines that start with a capital letter followed by lowercase
    // and don't look like variable declarations or function calls
    if (/^[A-Z][a-z]/.test(t) && !t.startsWith('React') && !t.startsWith('Promise') &&
        !t.startsWith('Array') && !t.startsWith('Object') && !t.startsWith('Map') &&
        !t.startsWith('Set') && !t.startsWith('Date') && !t.startsWith('Error') &&
        !t.startsWith('String') && !t.startsWith('Number') && !t.startsWith('Boolean')) {
      return false
    }
    // Reject lines starting with "← " (model simulating stop response)
    if (t.startsWith('←')) return false
    // Reject lines starting with common prose markers
    if (/^(Now |Let me |I |Good|Great|Here|The |This |Next|From |Total|Summary)/.test(t)) return false
    // Reject numbered list items like "1. ...", "- ..."
    if (/^\d+\.\s+[A-Z]/.test(t) || /^-\s+[A-Z]/.test(t)) return false
    return true
  })
  return cleaned.join('\n')
}

/**
 * Truncate code at the last stop() call — discard anything the model
 * hallucinated after stop (it shouldn't write more, but some models do).
 */
function truncateAtStop(code: string): string {
  const lines = code.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes('await stop(') || lines[i].includes('stop(')) {
      return lines.slice(0, i + 1).join('\n')
    }
  }
  return code
}

// ── XML Debug Serializer ──

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function debugLogToXml(entries: Array<{ timestamp: number; type: string; data: unknown }>): string {
  const lines: string[] = []
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push('<debug-log>')

  for (const entry of entries) {
    lines.push(`  <entry type="${xmlEscape(entry.type)}" timestamp="${entry.timestamp}">`)
    lines.push(valueToXml(entry.data, 4))
    lines.push('  </entry>')
  }

  lines.push('</debug-log>')
  return lines.join('\n')
}

function valueToXml(value: unknown, indent: number): string {
  const pad = ' '.repeat(indent)

  if (value === null || value === undefined) {
    return `${pad}<value null="true" />`
  }

  if (typeof value === 'string') {
    // Use CDATA for multiline strings to preserve formatting
    if (value.includes('\n') || value.includes('<') || value.includes('&')) {
      return `${pad}<text><![CDATA[\n${value}\n${pad}]]></text>`
    }
    return `${pad}<text>${xmlEscape(value)}</text>`
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return `${pad}<value type="${typeof value}">${String(value)}</value>`
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}<list />`
    const items = value.map(item => {
      const inner = valueToXml(item, indent + 4)
      return `${pad}  <item>\n${inner}\n${pad}  </item>`
    })
    return `${pad}<list count="${value.length}">\n${items.join('\n')}\n${pad}</list>`
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj)
    if (keys.length === 0) return `${pad}<object />`
    const fields = keys.map(key => {
      const inner = valueToXml(obj[key], indent + 4)
      return `${pad}  <field name="${xmlEscape(key)}">\n${inner}\n${pad}  </field>`
    })
    return `${pad}<object>\n${fields.join('\n')}\n${pad}</object>`
  }

  return `${pad}<value>${xmlEscape(String(value))}</value>`
}
