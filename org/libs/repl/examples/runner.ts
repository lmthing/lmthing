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

## Workspace — Current Scope
${scope || '(no variables declared)'}

## Available Functions
${fnSigs || '(none)'}

## Rules
1. Output ONLY valid TypeScript. No markdown. No prose outside // comments.
2. Await every async call: var x = await fn()
3. Use stop() to read runtime values before branching.
4. Do not use console.log — use stop() to inspect values.
5. Do not import modules. Do not use export.
6. Use var for all declarations (not const/let) so they persist in the REPL scope across turns.
7. Handle nullability with ?. and ??
8. After calling await stop(...), STOP. Do not write any more code until you receive the stop response.
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
  /** Custom instructions appended to system prompt */
  instruct?: string
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
    instruct,
  } = options

  const model = resolveModel(modelId)

  console.log('\x1b[36m━━━ @lmthing/repl ━━━\x1b[0m')
  console.log(`\x1b[90mModel: ${modelId}\x1b[0m`)
  console.log(`\x1b[33m[user]\x1b[0m ${userMessage}\n`)

  const session = new Session({ globals })

  // Track events from sandbox execution
  let stopPayload: StopPayload | null = null
  let errorPayload: ErrorPayload | null = null

  session.on('event', (event: SessionEvent) => {
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
    }
  })

  // Build conversation
  const messages: ChatMessage[] = []
  const scope = generateScopeTable(session.snapshot().scope)
  messages.push({ role: 'system', content: buildSystemPrompt(functionSignatures, scope, instruct) })
  messages.push({ role: 'user', content: userMessage })

  let turn = 0

  while (turn < maxTurns) {
    turn++
    stopPayload = null
    errorPayload = null

    console.log(`\x1b[90m--- turn ${turn} ---\x1b[0m`)

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
    } catch (err: any) {
      console.error(`\n\x1b[31m  [api error]\x1b[0m ${err.message}`)
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
    if (!stopPayload && !errorPayload) {
      try { await session.finalize() } catch { /* ignore */ }
    }

    // Handle stop → inject as user message and loop
    if (stopPayload) {
      const entries = Object.entries(stopPayload)
        .map(([k, v]) => `${k}: ${v.display}`)
        .join(', ')
      const stopMsg = `← stop { ${entries} }`
      console.log(`\x1b[33m  [stop]\x1b[0m ${stopMsg}`)

      // Only include code up to the stop call in the assistant message
      const codeUpToStop = truncateAtStop(code)
      messages.push({ role: 'assistant', content: codeUpToStop })
      messages.push({ role: 'user', content: stopMsg })

      // Refresh scope in system prompt
      const freshScope = generateScopeTable(session.snapshot().scope)
      messages[0] = { role: 'system', content: buildSystemPrompt(functionSignatures, freshScope, instruct) }
      continue
    }

    // Handle error → inject as user message and loop
    if (errorPayload) {
      const errMsg = `← error [${errorPayload.type}] ${errorPayload.message} (line ${errorPayload.line})`
      console.log(`\x1b[31m  [error]\x1b[0m ${errMsg}`)

      messages.push({ role: 'assistant', content: code })
      messages.push({ role: 'user', content: errMsg })

      const freshScope = generateScopeTable(session.snapshot().scope)
      messages[0] = { role: 'system', content: buildSystemPrompt(functionSignatures, freshScope, instruct) }
      continue
    }

    // No stop/error — LLM finished naturally
    console.log(`\x1b[36m[done]\x1b[0m Completed after ${turn} turn(s)`)
    break
  }

  if (turn >= maxTurns) {
    console.log(`\x1b[33m[limit]\x1b[0m Reached max turns (${maxTurns})`)
  }

  // Print final scope
  const finalScope = generateScopeTable(session.snapshot().scope)
  if (finalScope !== '(no variables declared)') {
    console.log(`\n\x1b[36m━━━ Final Scope ━━━\x1b[0m`)
    console.log(finalScope)
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
