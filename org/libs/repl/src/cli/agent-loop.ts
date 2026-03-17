/**
 * Agent loop — drives the LLM streaming cycle in response to user messages.
 *
 * Mirrors the console output and debug logging of examples/runner.ts,
 * but runs as a long-lived server loop instead of a one-shot script.
 */

import { streamText, type LanguageModel } from 'ai'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Session } from '../session/session'
import { generateScopeTable } from '../context/scope-generator'
import { serialize } from '../stream/serializer'
import type { SessionEvent, StopPayload, ErrorPayload } from '../session/types'

export interface AgentLoopOptions {
  session: Session
  model: LanguageModel
  modelId: string
  instruct?: string
  functionSignatures?: string
  maxTurns?: number
  maxCheckpointReminders?: number
  debugFile?: string
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface DebugEntry {
  timestamp: number
  type: 'system_prompt' | 'message' | 'event' | 'scope' | 'api_error' | 'turn' | 'turn_result' | 'finalize'
  data: unknown
}

export class AgentLoop {
  private session: Session
  private model: LanguageModel
  private modelId: string
  private instruct?: string
  private functionSignatures: string
  private maxTurns: number
  private maxCheckpointReminders: number
  private debugFile?: string
  private messages: ChatMessage[] = []
  private running = false
  private debugLog: DebugEntry[] = []
  private tokenTotals = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  private totalTurns = 0

  constructor(options: AgentLoopOptions) {
    this.session = options.session
    this.model = options.model
    this.modelId = options.modelId
    this.instruct = options.instruct
    this.functionSignatures = options.functionSignatures ?? ''
    this.maxTurns = options.maxTurns ?? 10
    this.maxCheckpointReminders = options.maxCheckpointReminders ?? 3
    this.debugFile = options.debugFile
  }

  get debug(): boolean {
    return !!this.debugFile
  }

  isRunning(): boolean {
    return this.running
  }

  private logDebug(type: DebugEntry['type'], data: unknown): void {
    if (this.debug) this.debugLog.push({ timestamp: Date.now(), type, data })
  }

  /**
   * Handle a new user message — starts the LLM streaming cycle.
   */
  async handleMessage(text: string): Promise<void> {
    if (this.running) {
      // User intervention while running — handled by session
      console.log(`\n\x1b[33m[intervention]\x1b[0m ${text}`)
      this.session.handleIntervention(text)
      return
    }

    this.running = true
    this.session.handleUserMessage(text)

    console.log(`\n\x1b[33m[user]\x1b[0m ${text}\n`)

    // Build initial system prompt
    const scope = this.session.getScopeTable()
    const systemPrompt = buildSystemPrompt(this.functionSignatures, scope, this.instruct)

    // Initialize or update messages
    if (this.messages.length === 0) {
      this.messages.push({ role: 'system', content: systemPrompt })
    } else {
      this.messages[0] = { role: 'system', content: systemPrompt }
    }
    this.messages.push({ role: 'user', content: text })

    this.logDebug('system_prompt', systemPrompt)
    this.logDebug('message', { role: 'user', content: text })

    try {
      await this.runTurnLoop()
    } finally {
      this.running = false
    }
  }

  private async runTurnLoop(): Promise<void> {
    let turn = 0

    while (turn < this.maxTurns) {
      turn++
      this.totalTurns++

      console.log(`\x1b[90m--- turn ${turn} ---\x1b[0m`)
      this.logDebug('turn', { turn, messageCount: this.messages.length })

      // Track stop/error from session events via mutable ref
      const state: { stop: StopPayload | null; error: ErrorPayload | null } = { stop: null, error: null }

      const listener = (event: SessionEvent) => {
        this.logDebug('event', event)
        switch (event.type) {
          case 'read':
            state.stop = {}
            for (const [k, v] of Object.entries(event.payload)) {
              state.stop[k] = { value: v, display: serialize(v as any) }
            }
            this.session.resolveStop()
            break
          case 'error':
            state.error = event.error
            break
          case 'display':
            console.log(`\x1b[35m  [display]\x1b[0m component rendered`)
            break
          case 'async_start':
            console.log(`\x1b[34m  [async]\x1b[0m started: ${event.label}`)
            break
          case 'async_complete':
            console.log(`\x1b[34m  [async]\x1b[0m completed: ${event.taskId} (${(event.elapsed / 1000).toFixed(1)}s)`)
            break
          case 'async_failed':
            console.log(`\x1b[31m  [async]\x1b[0m failed: ${event.taskId} — ${event.error}`)
            break
          case 'async_cancelled':
            console.log(`\x1b[33m  [async]\x1b[0m cancelled: ${event.taskId}`)
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
          case 'hook':
            console.log(`\x1b[35m  [hook]\x1b[0m ${event.hookId} → ${event.action}: ${event.detail}`)
            break
          case 'status':
            // don't log status changes to console, they're noisy
            break
        }
      }
      this.session.on('event', listener)

      // Step 1: Stream entire LLM response, printing as it arrives
      let code = ''
      let streamResult: ReturnType<typeof streamText> | null = null
      try {
        streamResult = streamText({
          model: this.model,
          messages: this.messages.map(m => ({ role: m.role, content: m.content })),
          temperature: 0.2,
          maxOutputTokens: 4096,
        })

        for await (const chunk of streamResult.textStream) {
          process.stdout.write(`\x1b[32m${chunk}\x1b[0m`)
          code += chunk
        }
        console.log() // newline after streamed code

        // Collect usage metadata for debug
        if (this.debug) {
          try {
            const [usage, finishReason, response] = await Promise.all([
              streamResult.usage,
              streamResult.finishReason,
              streamResult.response,
            ])
            this.tokenTotals.inputTokens += usage.inputTokens ?? 0
            this.tokenTotals.outputTokens += usage.outputTokens ?? 0
            this.tokenTotals.totalTokens += usage.totalTokens ?? 0
            this.logDebug('turn_result', {
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
          } catch { /* usage metadata optional */ }
        }
      } catch (err: any) {
        console.error(`\n\x1b[31m  [api error]\x1b[0m ${err.message}`)
        this.logDebug('api_error', { message: err.message, stack: err.stack })
        this.session.off('event', listener)
        break
      }

      // Step 2: Clean model output
      code = cleanCode(code)

      // Step 3: Feed cleaned code to session line by line (same as runner.ts)
      const lines = code.split('\n')
      for (const line of lines) {
        if (state.stop || state.error) break
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          await this.session.feedToken(line + '\n')
        } catch {
          // execution errors captured via event
        }
      }

      this.session.off('event', listener)

      // Step 4: Flush remaining buffer if no interruption
      let checkpointIncomplete = false
      if (!state.stop && !state.error) {
        try {
          const result = await this.session.finalize()
          if (result === 'checkpoint_incomplete') {
            checkpointIncomplete = true
          }
        } catch { /* ignore */ }
      }

      // Handle checkpoint incomplete → inject reminder and loop
      if (checkpointIncomplete) {
        this.refreshSystemPrompt()
        const sessionMsgs = this.session.getMessages()
        const reminderMsg = sessionMsgs[sessionMsgs.length - 1]
        this.messages.push({ role: 'assistant', content: code })
        this.messages.push({ role: 'user', content: reminderMsg.content })
        this.logDebug('message', { role: 'assistant', content: code })
        this.logDebug('message', { role: 'user', content: reminderMsg.content })
        this.logDebug('scope', this.session.snapshot().scope)
        continue
      }

      // Handle stop → inject as user message and loop
      if (state.stop) {
        const entries = Object.entries(state.stop)
          .map(([k, v]) => `${k}: ${v.display}`)
          .join(', ')
        const stopMsg = `← stop { ${entries} }`
        console.log(`\x1b[33m  [stop]\x1b[0m ${stopMsg}`)

        const codeUpToStop = truncateAtStop(code)
        this.messages.push({ role: 'assistant', content: codeUpToStop })
        this.messages.push({ role: 'user', content: stopMsg })
        this.refreshSystemPrompt()
        this.logDebug('message', { role: 'assistant', content: codeUpToStop })
        this.logDebug('message', { role: 'user', content: stopMsg })
        this.logDebug('scope', this.session.snapshot().scope)
        continue
      }

      // Handle error → inject as user message and loop
      if (state.error) {
        const errMsg = `← error [${state.error.type}] ${state.error.message} (line ${state.error.line})`
        console.log(`\x1b[31m  [error]\x1b[0m ${errMsg}`)

        this.messages.push({ role: 'assistant', content: code })
        this.messages.push({ role: 'user', content: errMsg })
        this.refreshSystemPrompt()
        this.logDebug('message', { role: 'assistant', content: code })
        this.logDebug('message', { role: 'user', content: errMsg })
        this.logDebug('scope', this.session.snapshot().scope)
        continue
      }

      // No stop/error — LLM finished naturally
      console.log(`\x1b[36m[done]\x1b[0m Completed after ${turn} turn(s)`)
      break
    }

    if (turn >= this.maxTurns) {
      console.log(`\x1b[33m[limit]\x1b[0m Reached max turns (${this.maxTurns})`)
    }

    // Print checkpoint summary
    const cpState = this.session.snapshot().checkpointState
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
    const finalScope = generateScopeTable(this.session.snapshot().scope)
    if (finalScope !== '(no variables declared)') {
      console.log(`\n\x1b[36m━━━ Final Scope ━━━\x1b[0m`)
      console.log(finalScope)
    }

    // Write debug log
    this.writeDebugLog()
  }

  private refreshSystemPrompt(): void {
    const scope = this.session.getScopeTable()
    const systemPrompt = buildSystemPrompt(this.functionSignatures, scope, this.instruct)
    this.messages[0] = { role: 'system', content: systemPrompt }
    this.logDebug('system_prompt', systemPrompt)
  }

  private writeDebugLog(): void {
    if (!this.debug || !this.debugFile) return

    const snapshot = this.session.snapshot()
    this.logDebug('finalize', {
      model: this.modelId,
      turns: this.totalTurns,
      maxTurns: this.maxTurns,
      status: snapshot.status,
      tokenTotals: this.tokenTotals,
      scope: snapshot.scope,
      checkpointState: snapshot.checkpointState.plan ? {
        description: snapshot.checkpointState.plan.description,
        tasks: snapshot.checkpointState.plan.tasks,
        completed: Object.fromEntries(snapshot.checkpointState.completed),
        currentIndex: snapshot.checkpointState.currentIndex,
      } : null,
      messages: this.messages.map(m => ({ role: m.role, content: m.content })),
    })

    const isXml = /\.xml$/i.test(this.debugFile)
    const output = isXml ? debugLogToXml(this.debugLog) : JSON.stringify(this.debugLog, null, 2)
    writeFileSync(resolve(this.debugFile), output, 'utf-8')
    console.log(`\x1b[90m[debug] Written to ${this.debugFile}\x1b[0m`)
  }
}

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
checkpoint("step2", { done: true })`

  if (instruct) prompt += `\n\n## Special Instructions\n${instruct}\n`
  return prompt
}

// ── Utilities ──

function cleanCode(raw: string): string {
  let s = raw.trim()
  s = s.replace(/^```(?:typescript|ts|tsx|javascript|js)?\s*\n?/, '')
  s = s.replace(/\n?```\s*$/, '')
  s = s.replace(/<think>[\s\S]*?<\/think>/g, '')
  s = s.replace(/<\/?think>/g, '')
  const lines = s.split('\n')
  const cleaned = lines.filter(line => {
    const t = line.trim()
    if (!t) return true
    if (t.startsWith('//')) return true
    if (/^[A-Z][a-z]/.test(t) && !t.startsWith('React') && !t.startsWith('Promise') &&
        !t.startsWith('Array') && !t.startsWith('Object') && !t.startsWith('Map') &&
        !t.startsWith('Set') && !t.startsWith('Date') && !t.startsWith('Error') &&
        !t.startsWith('String') && !t.startsWith('Number') && !t.startsWith('Boolean')) {
      return false
    }
    if (t.startsWith('←')) return false
    if (/^(Now |Let me |I |Good|Great|Here|The |This |Next|From |Total|Summary)/.test(t)) return false
    if (/^\d+\.\s+[A-Z]/.test(t) || /^-\s+[A-Z]/.test(t)) return false
    return true
  })
  return cleaned.join('\n')
}

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

function debugLogToXml(entries: DebugEntry[]): string {
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
