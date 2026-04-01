import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SPACE = resolve(__dirname, '..')

const hasKeys = !!process.env.AZURE_API_KEY || !!process.env.ZAI_API_KEY

// ── Structure ─────────────────────────────────────────────────────────────────

describe('space-ecosystem: structure', () => {
  it('has package.json with name', () => {
    const pkg = JSON.parse(readFileSync(join(SPACE, 'package.json'), 'utf-8'))
    expect(pkg.name).toBe('space-ecosystem')
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

  it('platform-map has 10 service option files', () => {
    const serviceDir = join(SPACE, 'knowledge/platform-map/service')
    const options = readdirSync(serviceDir).filter(f => f.endsWith('.md'))
    expect(options.length).toBe(10)
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
  describe(`space-ecosystem: PlatformGuide [${size}]`, () => {
    it.skipIf(!hasKeys)('answers a platform navigation question', { timeout: 90_000 }, async () => {
      const { Session, AgentLoop, resolveModel } = await import('lmthing')

      const instruct = readFileSync(join(SPACE, 'agents/agent-platform-guide/instruct.md'), 'utf-8')
      const session = new Session()
      const model = resolveModel(size)
      const loop = new AgentLoop({ session, model, modelId: size, instruct, maxTurns: 3 })

      await loop.handleMessage('What is lmthing.studio and how does it differ from lmthing.chat?')

      expect(session.getMessages()).toMatchSnapshot()
      expect(session.getConversationState()).toMatchSnapshot()

      const state = session.getConversationState()
      expect(state.stopCount).toBeGreaterThan(0)
    })
  })

  describe(`space-ecosystem: AccountManager [${size}]`, () => {
    it.skipIf(!hasKeys)('explains billing tiers clearly', { timeout: 90_000 }, async () => {
      const { Session, AgentLoop, resolveModel } = await import('lmthing')

      const instruct = readFileSync(join(SPACE, 'agents/agent-account-manager/instruct.md'), 'utf-8')
      const session = new Session()
      const model = resolveModel(size)
      const loop = new AgentLoop({ session, model, modelId: size, instruct, maxTurns: 3 })

      await loop.handleMessage('What is the difference between the Free and Pro tier?')

      expect(session.getMessages()).toMatchSnapshot()
      expect(session.getConversationState()).toMatchSnapshot()

      const state = session.getConversationState()
      expect(state.stopCount).toBeGreaterThan(0)
    })
  })
}
