/**
 * Shared REPL runner — connects to an OpenAI-compatible endpoint
 * and drives the Session through the streaming REPL loop.
 *
 * Usage:
 *   OPENAI_BASE_URL=http://localhost:11434/v1 OPENAI_MODEL=qwen2.5-coder npx tsx examples/01-math.ts
 *   OPENAI_API_KEY=sk-... npx tsx examples/01-math.ts
 */

import { Session } from '../src/session/session'
import type { SessionEvent, StopPayload, ErrorPayload } from '../src/session/types'
import { generateScopeTable } from '../src/context/scope-generator'
import { serialize } from '../src/stream/serializer'

// ── Config ──

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
const OPENAI_API_KEY  = process.env.OPENAI_API_KEY  ?? ''
const OPENAI_MODEL    = process.env.OPENAI_MODEL    ?? 'gpt-4o-mini'

// ── System Prompt ──

function buildSystemPrompt(fnSigs: string, scope: string, instruct?: string): string {
  let prompt = `You are a code-execution agent. You respond EXCLUSIVELY with valid TypeScript code. No markdown. No prose. No explanations outside of code comments. Every character you emit is fed line-by-line into a live TypeScript REPL that executes as you stream.

## Execution Model

Your output is NOT a script that runs after you finish. Each line is parsed and executed as it arrives. Think of yourself as typing into a live terminal.

The REPL supports top-level await. Every async function call must be awaited.

CRITICAL: Do NOT wrap code in markdown fences (\`\`\`). Output raw TypeScript only.

## Available Globals

### await stop(...values) — Pause and read
Suspends your execution. The runtime evaluates each argument, serializes the results, and injects them as a user message prefixed with "← stop". You resume with knowledge of those values.

Use stop when you need to inspect a runtime value before deciding what to write next.
Example: await stop(x, y) → you will see: ← stop { x: <value>, y: <value> }

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
`
  if (instruct) prompt += `\n## Special Instructions\n${instruct}\n`
  return prompt
}

// ── OpenAI-compatible streaming (collect full response) ──

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function chatCompletion(messages: ChatMessage[]): Promise<string> {
  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(OPENAI_API_KEY ? { 'Authorization': `Bearer ${OPENAI_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      stream: true,
      temperature: 0.2,
      max_tokens: 2048,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`API error ${response.status}: ${text}`)
  }

  // Stream and collect
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let sseBuffer = ''
  let result = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    sseBuffer += decoder.decode(value, { stream: true })
    const lines = sseBuffer.split('\n')
    sseBuffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed === 'data: [DONE]') continue
      if (!trimmed.startsWith('data: ')) continue
      try {
        const json = JSON.parse(trimmed.slice(6))
        const delta = json.choices?.[0]?.delta?.content
        if (delta) {
          process.stdout.write(`\x1b[32m${delta}\x1b[0m`)
          result += delta
        }
      } catch { /* skip */ }
    }
  }

  return result
}

// ── REPL Runner ──

export interface RunnerOptions {
  userMessage: string
  globals?: Record<string, unknown>
  functionSignatures?: string
  maxTurns?: number
  instruct?: string
}

export async function runRepl(options: RunnerOptions): Promise<void> {
  const {
    userMessage,
    globals = {},
    functionSignatures = '',
    maxTurns = 10,
    instruct,
  } = options

  console.log('\x1b[36m━━━ @lmthing/repl ━━━\x1b[0m')
  console.log(`\x1b[90mEndpoint: ${OPENAI_BASE_URL}\x1b[0m`)
  console.log(`\x1b[90mModel:    ${OPENAI_MODEL}\x1b[0m`)
  console.log(`\x1b[33m[user]\x1b[0m ${userMessage}\n`)

  const session = new Session({ globals })

  // Track events
  let stopPayload: StopPayload | null = null
  let errorPayload: ErrorPayload | null = null

  session.on('event', (event: SessionEvent) => {
    switch (event.type) {
      case 'read':
        stopPayload = {}
        for (const [k, v] of Object.entries(event.payload)) {
          stopPayload[k] = { value: v, display: serialize(v) }
        }
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

    // Get full LLM response
    let code: string
    try {
      code = await chatCompletion(messages)
      console.log() // newline after streamed code
    } catch (err: any) {
      console.error(`\n\x1b[31m  [api error]\x1b[0m ${err.message}`)
      break
    }

    // Strip markdown fences if LLM wrapped output
    code = stripFences(code)

    // Feed code to session line by line
    // When stop() is called in the sandbox, it blocks. We process line by line
    // and break when stop/error is detected.
    const lines = code.split('\n')
    for (const line of lines) {
      if (stopPayload || errorPayload) break
      try {
        await session.feedToken(line + '\n')
      } catch {
        // execution error — will be captured via event
      }
    }

    // Flush remaining if no interruption
    if (!stopPayload && !errorPayload) {
      try { await session.finalize() } catch { /* ignore */ }
    }

    // Handle stop
    if (stopPayload) {
      const entries = Object.entries(stopPayload)
        .map(([k, v]) => `${k}: ${v.display}`)
        .join(', ')
      const stopMsg = `← stop { ${entries} }`
      console.log(`\x1b[33m  [stop]\x1b[0m ${stopMsg}`)

      session.resolveStop()

      messages.push({ role: 'assistant', content: code })
      messages.push({ role: 'user', content: stopMsg })

      const freshScope = generateScopeTable(session.snapshot().scope)
      messages[0] = { role: 'system', content: buildSystemPrompt(functionSignatures, freshScope, instruct) }
      continue
    }

    // Handle error
    if (errorPayload) {
      const errMsg = `← error [${errorPayload.type}] ${errorPayload.message} (line ${errorPayload.line})`
      console.log(`\x1b[31m  [error]\x1b[0m ${errMsg}`)

      messages.push({ role: 'assistant', content: code })
      messages.push({ role: 'user', content: errMsg })

      const freshScope = generateScopeTable(session.snapshot().scope)
      messages[0] = { role: 'system', content: buildSystemPrompt(functionSignatures, freshScope, instruct) }
      continue
    }

    // No stop/error — done
    console.log(`\x1b[36m[done]\x1b[0m Completed after ${turn} turn(s)`)
    break
  }

  if (turn >= maxTurns) {
    console.log(`\x1b[33m[limit]\x1b[0m Reached max turns (${maxTurns})`)
  }

  // Final scope
  const finalScope = generateScopeTable(session.snapshot().scope)
  if (finalScope !== '(no variables declared)') {
    console.log(`\n\x1b[36m━━━ Final Scope ━━━\x1b[0m`)
    console.log(finalScope)
  }

  session.destroy()
}

function stripFences(code: string): string {
  let s = code.trim()
  s = s.replace(/^```(?:typescript|ts|tsx|javascript|js)?\s*\n?/, '')
  s = s.replace(/\n?```\s*$/, '')
  return s
}
