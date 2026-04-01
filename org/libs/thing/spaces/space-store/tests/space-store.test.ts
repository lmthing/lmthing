import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SPACE = resolve(__dirname, '..')

const hasKeys = !!process.env.AZURE_API_KEY || !!process.env.ZAI_API_KEY

// ── Structure ─────────────────────────────────────────────────────────────────

describe('space-store: structure', () => {
  it('has package.json with name', () => {
    const pkg = JSON.parse(readFileSync(join(SPACE, 'package.json'), 'utf-8'))
    expect(pkg.name).toBe('space-store')
  })

  it('each agent has config.json and instruct.md', () => {
    const agentsDir = join(SPACE, 'agents')
    for (const agent of readdirSync(agentsDir)) {
      expect(existsSync(join(agentsDir, agent, 'config.json')), `${agent}/config.json`).toBe(true)
      expect(existsSync(join(agentsDir, agent, 'instruct.md')), `${agent}/instruct.md`).toBe(true)
    }
  })

  it('each agent instruct.md has a name in frontmatter', () => {
    const agentsDir = join(SPACE, 'agents')
    for (const agent of readdirSync(agentsDir)) {
      const instruct = readFileSync(join(agentsDir, agent, 'instruct.md'), 'utf-8')
      expect(instruct, `${agent}/instruct.md`).toMatch(/^---/)
      expect(instruct, `${agent}/instruct.md`).toMatch(/name:/)
    }
  })

  it('each flow has index.md and at least one step file', () => {
    const flowsDir = join(SPACE, 'flows')
    for (const flow of readdirSync(flowsDir)) {
      const dir = join(flowsDir, flow)
      expect(existsSync(join(dir, 'index.md')), `${flow}/index.md`).toBe(true)
      const steps = readdirSync(dir).filter(f => /^\d+/.test(f) && f.endsWith('.md'))
      expect(steps.length, `${flow} must have at least one step`).toBeGreaterThan(0)
    }
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
  describe(`space-store: StoreCurator [${size}]`, () => {
    it.skipIf(!hasKeys)('explains distribution models for a new agent', { timeout: 90_000 }, async () => {
      const { Session, AgentLoop, resolveModel } = await import('lmthing')

      const instruct = readFileSync(join(SPACE, 'agents/agent-store-curator/instruct.md'), 'utf-8')
      const session = new Session()
      const model = resolveModel(size)
      const loop = new AgentLoop({ session, model, modelId: size, instruct, maxTurns: 3 })

      await loop.handleMessage('I built a code review agent and want to monetize it. What distribution models are available on the store?')

      expect(session.getMessages()).toMatchSnapshot()
      expect(session.getConversationState()).toMatchSnapshot()

      const state = session.getConversationState()
      expect(state.stopCount).toBeGreaterThan(0)
    })
  })

  describe(`space-store: ListingOptimizer [${size}]`, () => {
    it.skipIf(!hasKeys)('gives listing improvement advice', { timeout: 90_000 }, async () => {
      const { Session, AgentLoop, resolveModel } = await import('lmthing')

      const instruct = readFileSync(join(SPACE, 'agents/agent-listing-optimizer/instruct.md'), 'utf-8')
      const session = new Session()
      const model = resolveModel(size)
      const loop = new AgentLoop({ session, model, modelId: size, instruct, maxTurns: 3 })

      await loop.handleMessage('My listing title is "Code Helper". The description is "helps with code". How can I improve this?')

      expect(session.getMessages()).toMatchSnapshot()
      expect(session.getConversationState()).toMatchSnapshot()

      const state = session.getConversationState()
      expect(state.stopCount).toBeGreaterThan(0)
    })
  })
}
