/**
 * Keyless, scripted LLM adapter for live-verifying
 * `@lmthing/dsh-space-components` (see the package README for the run recipe).
 *
 * Deliberately its own file here rather than a new trigger branch in
 * `dsh/packages/llm-mock`: that module is the shared scripted test double every
 * feature plugin's verification reaches for, and this plugin was built in
 * parallel with others, so keeping this harness self-contained avoids editing a
 * file three unrelated verifications would touch at once. It follows llm-mock's
 * design exactly (including the `source.kind === 'user'` trap — see its doc
 * comment; a bare `role === 'user'` filter also matches tool results,
 * system-prompt snapshots, and the repo's own CLAUDE.md fed in as workspace
 * instructions).
 *
 * A dsh profile mounts it by subpath — `name:
 * '@lmthing/dsh-space-components/demo/display-mock.js'` — which is why it lives
 * inside this package instead of being its own linked package: a package under
 * `demo/` is outside the `packages/*` pnpm workspace glob, so its peer
 * `@deepseek-ai/dsh-llm` would never get installed (it fails at boot with
 * `Cannot find package '@deepseek-ai/dsh-llm'`). Mounted by subpath, the import
 * resolves from THIS package's own node_modules, where `dsh-llm` is a
 * demo-only devDependency.
 *
 * Two behaviors, both aimed at what a unit test cannot prove:
 *
 *  1. It ALWAYS prints the tool names actually visible in `options.tools` to
 *     stderr. That is the live tool-schema snapshot — the exact thing the
 *     Phase 2 missing-`await` bug silently corrupted (dsh/packages/README.md),
 *     and the only direct evidence that `display` reached the model at all
 *     (or, for the negative case, that it correctly did not).
 *  2. On a `display: <text>` prompt it calls the `display` tool with a
 *     deliberately MIXED props object — correct `message`, plus a wrong-typed
 *     `repeats` — so one run exercises both the happy path and the fail-soft
 *     prop warning. `display! <text>` sends only valid props.
 */
import { LlmAdapter } from '@deepseek-ai/dsh-llm'

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

class DisplayMockAdapter extends LlmAdapter {
  providerInfo(provider) {
    return { id: provider, name: 'space-components display mock (keyless)' }
  }

  async listModels(provider) {
    return [{ provider, id: 'mock-1', name: 'display mock-1' }]
  }

  async resolveModel(provider, model) {
    return { provider, id: model, name: 'display mock-1' }
  }

  async *stream(options) {
    const toolNames = (options.tools ?? []).map((t) => t.name)
    console.error(`[display-mock] TOOLS: ${toolNames.join(', ') || '(none)'}`)
    const displayTool = (options.tools ?? []).find((t) => t.name === 'display')
    if (displayTool) {
      console.error(`[display-mock] DISPLAY SCHEMA: ${JSON.stringify(displayTool.parameters)}`)
      console.error(`[display-mock] DISPLAY DESCRIPTION: ${displayTool.description}`)
    }

    const toolResult = lastToolResultText(options.messages)
    if (toolResult) {
      yield* textReply(`[display-mock] tool result: ${toolResult.isError ? 'ERROR: ' : ''}${toolResult.text}`)
      return
    }

    const text = lastUserText(options.messages)

    const strictMatch = text.match(/^display!\s*(.*)$/i)
    if (strictMatch && displayTool) {
      yield* toolCallReply('mock-call-1', 'display', {
        component: 'EchoCard',
        props: { message: strictMatch[1], stamp: 'live-verified', repeats: 2, shouted: false, tags: ['demo'] },
      })
      return
    }

    const looseMatch = text.match(/^display:\s*(.*)$/i)
    if (looseMatch && displayTool) {
      // `repeats` is declared `number` — a string here must come back as a
      // visible warning, not a tool error.
      yield* toolCallReply('mock-call-1', 'display', {
        component: 'EchoCard',
        props: { message: looseMatch[1], repeats: 'twice' },
      })
      return
    }

    yield* textReply(`[display-mock] no display tool used. tools=[${toolNames.join(', ')}] text=${text}`)
  }
}

export const name = 'lmthing-space-components-display-mock'
export const inject = ['llm']

export function apply(ctx) {
  ctx.llm.registerAdapter(['components-demo-mock'], new DisplayMockAdapter())
}
