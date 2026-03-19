import { describe, it, expect } from 'vitest'
import { AgentRegistry } from '../sandbox/agent-registry'
import { generateAgentsBlock } from './agents-block'

function createDeferred<T = unknown>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: any) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('context/agents-block', () => {
  it('returns null for empty registry', () => {
    const registry = new AgentRegistry()
    expect(generateAgentsBlock(registry, new Set())).toBeNull()
  })

  it('renders running agent without tasklist', () => {
    const registry = new AgentRegistry()
    const { promise } = createDeferred()
    registry.register('mealplan', promise, 'cooking.advisor.mealplan', null)

    const result = generateAgentsBlock(registry, new Set())
    expect(result).not.toBeNull()
    expect(result).toContain('{{AGENTS}}')
    expect(result).toContain('mealplan')
    expect(result).toContain('cooking.advisor.mealplan')
    expect(result).toContain('◉ running')
    expect(result).toContain('(no tasklist)')
  })

  it('renders running agent with nested tasks', () => {
    const registry = new AgentRegistry()
    const { promise } = createDeferred()

    const tasklistsState = {
      tasklists: new Map([
        ['research', {
          plan: {
            tasklistId: 'research',
            description: 'Research tasks',
            tasks: [
              { id: 'fetch', instructions: 'Fetch data', outputSchema: { data: { type: 'string' } } },
              { id: 'analyze', instructions: 'Analyze data', outputSchema: { result: { type: 'string' } }, dependsOn: ['fetch'] },
            ],
          },
          completed: new Map([['fetch', { output: { data: 'done' }, timestamp: Date.now(), status: 'completed' as const }]]),
          readyTasks: new Set(['analyze']),
          runningTasks: new Set<string>(),
          outputs: new Map(),
          progressMessages: new Map(),
          retryCount: new Map(),
        }],
      ]),
    }
    const fakeSession = { snapshot: () => ({ tasklistsState }) } as any

    registry.register('research', promise, 'label', fakeSession)

    const result = generateAgentsBlock(registry, new Set())
    expect(result).toContain('◉ running')
    expect(result).toContain('tasks')
    expect(result).toContain('✓')
    expect(result).toContain('fetch')
    expect(result).toContain('◎')
    expect(result).toContain('analyze')
  })

  it('renders resolved agent (value included in stop)', async () => {
    const registry = new AgentRegistry()
    const { promise, resolve } = createDeferred()
    registry.register('task', promise, 'label', null)
    resolve('done')
    await promise

    const result = generateAgentsBlock(registry, new Set(['task']))
    expect(result).toContain('✓')
    expect(result).toContain('value included in this stop payload')
  })

  it('renders resolved agent (value not in stop)', async () => {
    const registry = new AgentRegistry()
    const { promise, resolve } = createDeferred()
    registry.register('task', promise, 'label', null)
    resolve('done')
    await promise

    const result = generateAgentsBlock(registry, new Set())
    expect(result).toContain('✓ resolved')
  })

  it('renders failed agent with error', async () => {
    const registry = new AgentRegistry()
    const { promise, reject } = createDeferred()
    registry.register('task', promise, 'label', null)
    reject(new Error('API timeout'))
    try { await promise } catch {}

    const result = generateAgentsBlock(registry, new Set())
    expect(result).toContain('✗')
    expect(result).toContain('API timeout')
  })

  it('renders multiple agents in separate boxes', () => {
    const registry = new AgentRegistry()
    const d1 = createDeferred()
    const d2 = createDeferred()

    registry.register('agent1', d1.promise, 'label-1', null)
    registry.register('agent2', d2.promise, 'label-2', null)

    const result = generateAgentsBlock(registry, new Set())!
    expect(result).toContain('agent1')
    expect(result).toContain('agent2')
    // Should have multiple box starts
    const boxStarts = result.split('┌').length - 1
    expect(boxStarts).toBe(2)
  })

  it('renders waiting agent with question message', () => {
    const registry = new AgentRegistry()
    const { promise } = createDeferred()
    registry.register('task', promise, 'label', null)
    registry.setPendingQuestion('task', { message: 'Pick cuisine', schema: {} })

    const result = generateAgentsBlock(registry, new Set())
    expect(result).toContain('? waiting')
    expect(result).toContain('needs input from parent')
    expect(result).toContain('Pick cuisine')
  })

  it('renders waiting agent with schema', () => {
    const registry = new AgentRegistry()
    const { promise } = createDeferred()
    registry.register('task', promise, 'label', null)
    registry.setPendingQuestion('task', {
      message: 'What doneness level?',
      schema: {
        doneness: { type: 'string', enum: ['rare', 'medium-rare', 'medium', 'well'] },
        thickness_cm: { type: 'number' },
      },
    })

    const result = generateAgentsBlock(registry, new Set())!
    expect(result).toContain('? waiting')
    expect(result).toContain('What doneness level?')
    expect(result).toContain('schema:')
    expect(result).toContain('doneness:')
    expect(result).toContain('thickness_cm:')
    expect(result).toContain('number')
  })

  it('truncates schema with more than 5 keys', () => {
    const registry = new AgentRegistry()
    const { promise } = createDeferred()
    registry.register('task', promise, 'label', null)
    const schema: Record<string, unknown> = {}
    for (let i = 0; i < 8; i++) schema[`field${i}`] = { type: 'string' }
    registry.setPendingQuestion('task', { message: 'Big form', schema })

    const result = generateAgentsBlock(registry, new Set())!
    expect(result).toContain('... +3 more')
  })

  describe('decay', () => {
    it('shows compact after 3 turns for resolved', async () => {
      const registry = new AgentRegistry()
      const { promise, resolve } = createDeferred()
      registry.register('task', promise, 'label', null)
      resolve('done')
      await promise

      // 3 turns after
      registry.advanceTurn()
      registry.advanceTurn()
      registry.advanceTurn()

      const result = generateAgentsBlock(registry, new Set())
      expect(result).toContain('✓ resolved')
      // Should NOT contain 'value included' since compact
      expect(result).not.toContain('value included')
    })

    it('shows compact after 3 turns for failed', async () => {
      const registry = new AgentRegistry()
      const { promise, reject } = createDeferred()
      registry.register('task', promise, 'label', null)
      reject(new Error('bad'))
      try { await promise } catch {}

      registry.advanceTurn()
      registry.advanceTurn()
      registry.advanceTurn()

      const result = generateAgentsBlock(registry, new Set())
      expect(result).toContain('✗ failed')
      // Should not contain the detailed error message
      expect(result).not.toContain('bad')
    })

    it('removes after 6 turns', async () => {
      const registry = new AgentRegistry()
      const { promise, resolve } = createDeferred()
      registry.register('task', promise, 'label', null)
      resolve('done')
      await promise

      for (let i = 0; i < 6; i++) registry.advanceTurn()

      const result = generateAgentsBlock(registry, new Set())
      expect(result).toBeNull()
    })

    it('does not remove running agents regardless of turn count', () => {
      const registry = new AgentRegistry()
      registry.register('task', createDeferred().promise, 'label', null)

      for (let i = 0; i < 10; i++) registry.advanceTurn()

      const result = generateAgentsBlock(registry, new Set())
      expect(result).not.toBeNull()
      expect(result).toContain('◉ running')
    })
  })
})
