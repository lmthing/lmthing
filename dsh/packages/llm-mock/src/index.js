/**
 * Deterministic, keyless LLM adapter for dsh. Not part of the LMThing space
 * port — this is the tracer-bullet plugin that proves the out-of-tree
 * authoring loop (package -> profile plugin -> booted context) works, and
 * doubles as a scripted test double for Phase 1's delegation verification
 * (dsh/packages/README.md step 7): it looks for simple trigger phrases in
 * the last user text and, when a matching tool is actually visible in
 * `options.tools`, calls it — otherwise it falls through to a plain echo.
 * A real @lmthing/dsh-space-format-authored space never talks to this
 * adapter; it is scaffolding, not ported content.
 */
import { LlmAdapter } from '@deepseek-ai/dsh-llm'

/**
 * The most recent message that's actually the caller's own task text: role
 * 'user' AND `source.kind === 'user'`. Empirically (LMTHING_MOCK_DEBUG=1),
 * a single turn's `options.messages` also carries role:'user' entries whose
 * source.kind is 'tool' (a tool result), 'plugin' (a system-prompt runtime
 * snapshot), or 'agent-instructions' (dsh-agent-instructions feeding this
 * REPO'S OWN root CLAUDE.md in as workspace instructions, form:
 * 'instructions') — a bare `role === 'user'` filter matches all of those
 * too, and picking the wrong one silently echoes CLAUDE.md instead of the
 * real task (found the hard way — see the commit that added this comment).
 * Only `source.kind === 'user'` is guaranteed to be the human/caller's own
 * words, so that's the sole positive match here rather than an exclusion
 * list of every OTHER kind dsh might add later.
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
  return { toolCallId: block.toolCallId, text: textBlock?.text ?? JSON.stringify(block.content), isError: block.isError }
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

class MockAdapter extends LlmAdapter {
  providerInfo(provider) {
    return { id: provider, name: 'LMThing mock (keyless)' }
  }

  async listModels(provider) {
    return [{ provider, id: 'mock-1', name: 'lmthing mock-1' }]
  }

  async resolveModel(provider, model) {
    return { provider, id: model, name: 'lmthing mock-1' }
  }

  async *stream(options) {
    if (process.env['LMTHING_MOCK_DEBUG']) {
      console.error(
        '[lmthing-mock DEBUG] messages:',
        JSON.stringify(
          options.messages.map((m) => ({ role: m.role, source: m.source, content: m.content.map((c) => c.type) })),
          null,
          2,
        ),
      )
    }
    const toolResult = lastToolResultText(options.messages)
    if (toolResult) {
      yield* textReply(`[lmthing-mock] tool result: ${toolResult.isError ? 'ERROR: ' : ''}${toolResult.text}`)
      return
    }

    const text = lastUserText(options.messages)

    const echoMatch = text.match(/^echo:\s*(.*)$/i)
    if (echoMatch && hasTool(options, 'delegate_echo')) {
      // dsh-tool-subagent's real schema is {description, prompt}, not a
      // free-form "message" — it's a generic delegation tool, not one that
      // knows about our specific echoBack function's argument shape.
      yield* toolCallReply('mock-call-1', 'delegate_echo', {
        description: 'Echo a message',
        prompt: `Call echoBack with message: "${echoMatch[1]}" and reply with exactly what it returns.`,
      })
      return
    }

    // A delegated child (see the delegate_echo branch below) receives its
    // task as plain user text, not a trigger keyword — it needs its own
    // scripted branch to decide to call echoBack.
    const childEchoMatch = text.match(/call echoBack with message:\s*"([^"]*)"/i)
    if (childEchoMatch && hasTool(options, 'echoBack')) {
      yield* toolCallReply('mock-call-1', 'echoBack', { message: childEchoMatch[1] })
      return
    }

    const rememberMatch = text.match(/^remember:\s*([^=]+)=(.*)$/i)
    if (rememberMatch && hasTool(options, 'remember')) {
      yield* toolCallReply('mock-call-1', 'remember', { key: rememberMatch[1].trim(), value: rememberMatch[2].trim() })
      return
    }

    const recallMatch = text.match(/^recall:\s*(.*)$/i)
    if (recallMatch && hasTool(options, 'recall')) {
      yield* toolCallReply('mock-call-1', 'recall', { key: recallMatch[1].trim() })
      return
    }

    yield* textReply(`[lmthing-mock] echo: ${text}`)
  }
}

export const name = 'lmthing-llm-mock'
export const inject = ['llm']

export function apply(ctx) {
  ctx.llm.registerAdapter(['lmthing-mock'], new MockAdapter())
}
