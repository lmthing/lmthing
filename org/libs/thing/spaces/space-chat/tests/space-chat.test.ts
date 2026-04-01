import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SPACE = resolve(__dirname, '..')

const hasKeys = !!process.env.AZURE_API_KEY || !!process.env.ZAI_API_KEY

// ── Structure ─────────────────────────────────────────────────────────────────

describe('space-chat: structure', () => {
  it('has package.json with name', () => {
    const pkg = JSON.parse(readFileSync(join(SPACE, 'package.json'), 'utf-8'))
    expect(pkg.name).toBe('space-chat')
  })

  it('agent-chat-assistant has config.json and instruct.md', () => {
    const agentDir = join(SPACE, 'agents/agent-chat-assistant')
    expect(existsSync(join(agentDir, 'config.json'))).toBe(true)
    expect(existsSync(join(agentDir, 'instruct.md'))).toBe(true)
  })

  it('agent instruct.md has a name in frontmatter', () => {
    const instruct = readFileSync(join(SPACE, 'agents/agent-chat-assistant/instruct.md'), 'utf-8')
    expect(instruct).toMatch(/^---/)
    expect(instruct).toMatch(/name:/)
  })

  it('flow_start_conversation has index.md and step files', () => {
    const flowDir = join(SPACE, 'flows/flow_start_conversation')
    expect(existsSync(join(flowDir, 'index.md'))).toBe(true)
    const steps = readdirSync(flowDir).filter(f => /^\d+/.test(f) && f.endsWith('.md'))
    expect(steps.length).toBeGreaterThan(0)
  })

  it('each knowledge domain has config.json', () => {
    const knowledgeDir = join(SPACE, 'knowledge')
    for (const domain of readdirSync(knowledgeDir)) {
      expect(existsSync(join(knowledgeDir, domain, 'config.json')), `${domain}/config.json`).toBe(true)
    }
  })
})

// ── LLM integration ───────────────────────────────────────────────────────────

const LLM_MODELS = ['small', 'large'] as const

for (const size of LLM_MODELS) {
  describe(`space-chat: ChatAssistant [${size}]`, () => {
    it.skipIf(!hasKeys)('recommends a model for a coding task', { timeout: 90_000 }, async () => {
      const { Session, AgentLoop, resolveModel } = await import('lmthing')

      const instruct = readFileSync(join(SPACE, 'agents/agent-chat-assistant/instruct.md'), 'utf-8')
      const session = new Session()
      const model = resolveModel(size)
      const loop = new AgentLoop({ session, model, modelId: size, instruct, maxTurns: 3 })

      await loop.handleMessage('I want to chat about writing TypeScript. Which model and chat mode should I use on the free tier?')

      expect(session.getMessages()).toMatchSnapshot()
      expect(session.getConversationState()).toMatchSnapshot()

      const state = session.getConversationState()
      expect(state.stopCount).toBeGreaterThan(0)
    })
  })
}
