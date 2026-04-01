import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SPACE = resolve(__dirname, '..')

const hasKeys = !!process.env.AZURE_API_KEY || !!process.env.ZAI_API_KEY

// ── Structure ─────────────────────────────────────────────────────────────────

describe('space-creator: structure', () => {
  it('has package.json with name', () => {
    const pkg = JSON.parse(readFileSync(join(SPACE, 'package.json'), 'utf-8'))
    expect(pkg.name).toBe('space-creator')
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

  it('each knowledge field has config.json', () => {
    const knowledgeDir = join(SPACE, 'knowledge')
    for (const domain of readdirSync(knowledgeDir)) {
      const domainDir = join(knowledgeDir, domain)
      for (const field of readdirSync(domainDir).filter(f => !f.endsWith('.json'))) {
        if (!existsSync(join(domainDir, field))) continue
        const fieldDir = join(domainDir, field)
        if (!readdirSync(fieldDir).length) continue
        expect(existsSync(join(fieldDir, 'config.json')), `${domain}/${field}/config.json`).toBe(true)
      }
    }
  })
})

// ── LLM integration ───────────────────────────────────────────────────────────

const LLM_MODELS = ['small', 'large'] as const

for (const size of LLM_MODELS) {
  describe(`space-creator: SpaceArchitect [${size}]`, () => {
    it.skipIf(!hasKeys)('responds to a space design request and calls stop()', { timeout: 90_000 }, async () => {
      const { Session } = await import('lmthing')
      const { AgentLoop } = await import('lmthing')
      const { resolveModel } = await import('lmthing')

      const instruct = readFileSync(join(SPACE, 'agents/agent-space-architect/instruct.md'), 'utf-8')
      const session = new Session()
      const model = resolveModel(size)
      const loop = new AgentLoop({ session, model, modelId: size, instruct, maxTurns: 3 })

      await loop.handleMessage('Design a space for tracking personal fitness goals. Just outline the agents and knowledge domains.')

      expect(session.getMessages()).toMatchSnapshot()
      expect(session.getConversationState()).toMatchSnapshot()

      const state = session.getConversationState()
      expect(state.turns.length).toBeGreaterThan(0)
      expect(state.stopCount).toBeGreaterThan(0)
    })
  })
}
