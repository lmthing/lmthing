import { appendFileSync } from 'node:fs'
import { LlmAdapter } from '@deepseek-ai/dsh-llm'

/**
 * LIVE-VERIFICATION SCAFFOLDING for `@lmthing/dsh-space-knowledge` — not part
 * of the port, and deliberately separate from `packages/llm-mock` (which is
 * shared with the rest of the track and left untouched).
 *
 * Two jobs a real model can't do deterministically:
 *
 *  1. It dumps what dsh ACTUALLY assembled for the request — `options.system`
 *     (the rendered system prompt, i.e. whether our `lmthing:knowledge-tree:*`
 *     section really landed) and the visible tool-schema names (i.e. whether
 *     `loadKnowledge` really got registered) — to `KNOWLEDGE_DEMO_DUMP`.
 *     This is the check the plan wants and the same class of evidence the
 *     Phase 2 `await` bug needed: the bug there was silent precisely because
 *     nothing ever printed the registered set.
 *  2. It calls `loadKnowledge` on a scripted cue so the tool's execute path
 *     (and its scoping refusal) is exercised keylessly:
 *       "hours: <option>"       -> loadKnowledge(service, hours, <option>)
 *       "brew: <option>"        -> loadKnowledge(brewing, method, <option>)
 *       "out of scope"          -> loadKnowledge(brewing, grind, coarse)  [must be REFUSED]
 *       "domain: <slug>"        -> loadKnowledge(<slug>)                  [index, not content]
 *     Anything else echoes.
 *
 * `source.kind === 'user'` is the only reliable "the human's own text" filter —
 * see packages/llm-mock's doc comment for why a bare `role === 'user'` is not.
 */
function lastUserText(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message.role !== 'user' || message.source?.kind !== 'user') continue
    const textBlock = message.content.find((block) => block.type === 'text')
    if (textBlock) return textBlock.text
  }
  return ''
}

function lastToolResultText(messages) {
  const last = messages[messages.length - 1]
  if (last?.role !== 'user' || last.content[0]?.type !== 'tool-result') return undefined
  const block = last.content[0]
  const textBlock = block.content.find((b) => b.type === 'text')
  return { text: textBlock?.text ?? JSON.stringify(block.content), isError: block.isError }
}

function hasTool(options, name) {
  return (options.tools ?? []).some((t) => t.name === name)
}

async function* textReply(text) {
  yield { type: 'block-start', index: 0, blockType: 'text' }
  yield { type: 'text-delta', index: 0, text }
  yield { type: 'block-end', index: 0, block: { type: 'text', text } }
  yield { type: 'usage', usage: { inputTokens: 0, outputTokens: text.length } }
  yield { type: 'finish', reason: { kind: 'stop' } }
}

async function* toolCallReply(id, name, args) {
  const argsJson = JSON.stringify(args)
  yield { type: 'block-start', index: 0, blockType: 'tool-call' }
  yield { type: 'tool-call-delta', index: 0, id, name, argumentsDelta: argsJson }
  yield { type: 'block-end', index: 0, block: { type: 'tool-call', id, name, arguments: argsJson } }
  yield { type: 'usage', usage: { inputTokens: 0, outputTokens: argsJson.length } }
  yield { type: 'finish', reason: { kind: 'tool-calls' } }
}

class KnowledgeDemoAdapter extends LlmAdapter {
  providerInfo(provider) {
    return { id: provider, name: 'knowledge-demo scripted (keyless)' }
  }

  async listModels(provider) {
    return [{ provider, id: 'demo-1', name: 'knowledge-demo demo-1' }]
  }

  async resolveModel(provider, model) {
    return { provider, id: model, name: 'knowledge-demo demo-1' }
  }

  async *stream(options) {
    const dumpPath = process.env['KNOWLEDGE_DEMO_DUMP']
    // APPEND, one JSON object per line: a single `dsh` invocation makes more
    // than one LLM request (the agent turn, plus a toolless session-TITLE
    // request with its own tiny system prompt) — a truncating write loses the
    // turn that matters to whichever request happens to run last.
    if (dumpPath) {
      appendFileSync(dumpPath, `${JSON.stringify({
        system: options.system ?? null,
        tools: (options.tools ?? []).map((t) => t.name),
        loadKnowledgeSchema: (options.tools ?? []).find((t) => t.name === 'loadKnowledge') ?? null,
      })}\n`)
    }

    const toolResult = lastToolResultText(options.messages)
    if (toolResult) {
      yield* textReply(`[knowledge-demo] tool result${toolResult.isError ? ' (ERROR)' : ''}: ${toolResult.text}`)
      return
    }

    const text = lastUserText(options.messages)

    const hours = text.match(/^hours:\s*(\S+)/i)
    if (hours && hasTool(options, 'loadKnowledge')) {
      yield* toolCallReply('demo-1', 'loadKnowledge', { domain: 'service', field: 'hours', option: hours[1] })
      return
    }

    const brew = text.match(/^brew:\s*(\S+)/i)
    if (brew && hasTool(options, 'loadKnowledge')) {
      yield* toolCallReply('demo-1', 'loadKnowledge', { domain: 'brewing', field: 'method', option: brew[1] })
      return
    }

    if (/^out of scope/i.test(text) && hasTool(options, 'loadKnowledge')) {
      yield* toolCallReply('demo-1', 'loadKnowledge', { domain: 'brewing', field: 'grind', option: 'coarse' })
      return
    }

    const domain = text.match(/^domain:\s*(\S+)/i)
    if (domain && hasTool(options, 'loadKnowledge')) {
      yield* toolCallReply('demo-1', 'loadKnowledge', { domain: domain[1] })
      return
    }

    yield* textReply(`[knowledge-demo] echo: ${text} (loadKnowledge visible: ${hasTool(options, 'loadKnowledge')})`)
  }
}

export const name = 'lmthing-knowledge-demo-llm'
export const inject = ['llm']

export function apply(ctx) {
  ctx.llm.registerAdapter(['knowledge-demo-mock'], new KnowledgeDemoAdapter())
}
