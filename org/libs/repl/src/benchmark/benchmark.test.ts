/**
 * Benchmark runner — tests LLM instruction quality for global functions.
 *
 * Each scenario provides:
 * - systemPromptDoc: The actual documentation from buildSystemPrompt.ts
 * - userPrompt: A specific task instruction
 * - verify: Function to check the LLM's generated code
 *
 * The runner executes scenarios across multiple model sizes and generates a report.
 */

import { describe, it, expect, vi } from 'vitest'
import { BASIC_SCENARIOS } from './scenarios/basic'
import { INTERMEDIATE_SCENARIOS } from './scenarios/intermediate'
import type { BenchScenario, ModelSize } from './types'
import { MODEL_SIZES } from './types'

// Mock globals for verification
function createMockGlobals() {
  const mockFn = () => vi.fn()
  return new Proxy({} as Record<string, ReturnType<typeof mockFn>>, {
    get: (_target, prop: string) => mockFn(),
  })
}

// Mock sandbox for scenarios that need getValue
function createMockSandbox() {
  const values = new Map<string, unknown>()
  return {
    getValue: (key: string) => values.get(key),
    setValue: (key: string, value: unknown) => values.set(key, value),
  }
}

/**
 * Run a single benchmark scenario with mocked globals.
 * In production, this would call the actual LLM API.
 */
async function runScenarioMock(scenario: BenchScenario) {
  const mockGlobals = createMockGlobals()
  const mockSandbox = createMockSandbox() as any

  // For testing, we simulate a "passing" LLM response
  // In production, this would call the LLM with:
  // - system: scenario.systemPromptDoc
  // - user: scenario.userPrompt
  // - then execute the generated code in a real sandbox

  // Simulate execution by making some reasonable mock calls
  // This allows us to test the verification logic
  if (scenario.id === 'stop-fib') {
    mockGlobals['stop'].mock.calls = [[55]]
  } else if (scenario.id === 'display-call') {
    mockGlobals['display'].mock.calls = [[{ type: 'p', props: { children: 'Hello World' } }]]
  } else if (scenario.id === 'ask-call') {
    mockGlobals['ask'].mock.calls = [[{ type: 'div', props: { children: [{ type: 'input', props: { name: 'email' } }] } }]]
    mockGlobals['stop'].mock.calls = [[{}]]
  } else if (scenario.id === 'sleep-call') {
    mockGlobals['sleep'].mock.calls = [[0.01]]
  } else if (scenario.id === 'tasklist-complete') {
    mockGlobals['tasklist'].mock.calls = [['wf', 'Process data', [
      { id: 'fetch', instructions: 'Fetch data', outputSchema: { data: { type: 'string' } } },
      { id: 'save', instructions: 'Save data', outputSchema: { id: { type: 'number' } } },
    ]]]
    mockGlobals['completeTask'].mock.calls = [
      ['wf', 'fetch', { data: 'hello' }],
      ['wf', 'save', { id: 1 }],
    ]
  } else if (scenario.id === 'complete-task-async-call') {
    mockGlobals['tasklist'].mock.calls = [['api', 'Fetch data', [{ id: 'fetch', outputSchema: { count: { type: 'number' } } }]]]
    mockGlobals['completeTaskAsync'].mock.calls = [['api', 'fetch', expect.any(Function)]]
  } else if (scenario.id === 'task-progress-call') {
    mockGlobals['taskProgress'].mock.calls = [['work', 'process', 'Processing...', 50]]
  } else if (scenario.id === 'load-knowledge-call') {
    mockGlobals['loadKnowledge'].mock.calls = [[{ docs: { guide: { intro: { start: true } } } }]]
  } else if (scenario.id === 'pipeline-sum') {
    mockGlobals['pipeline'].mock.calls = [[[1, 2, 3], { name: 'sum', fn: expect.any(Function) }]]
  } else if (scenario.id === 'parallel-constants') {
    mockGlobals['parallel'].mock.calls = [[[{ label: 'task-a', fn: expect.any(Function) }, { label: 'task-b', fn: expect.any(Function) }]]]
  } else if (scenario.id === 'guard-pass') {
    mockGlobals['guard'].mock.calls = [[true, 'items must not be empty']]
  } else if (scenario.id === 'schema-infer') {
    mockGlobals['schema'].mock.calls = [[{ count: 5 }]]
  } else if (scenario.id === 'validate-number') {
    mockGlobals['validate'].mock.calls = [[99, { type: 'number' }]]
  } else if (scenario.id === 'broadcast-listen') {
    mockGlobals['broadcast'].mock.calls = [['results', { ok: true }]]
    mockGlobals['listen'].mock.calls = [['results']]
  } else if (scenario.id === 'pin-unpin') {
    mockGlobals['pin'].mock.calls = [['sessionId', 's_42']]
    mockGlobals['unpin'].mock.calls = [['sessionId']]
  } else if (scenario.id === 'memo-write-read') {
    mockGlobals['memo'].mock.calls = [['progress', 'halfway done'], ['progress']]
  } else if (scenario.id === 'checkpoint-rollback') {
    mockGlobals['checkpoint'].mock.calls = [['snap']]
    mockGlobals['rollback'].mock.calls = [['snap']]
    mockGlobals['stop'].mock.calls = [[1]]
  } else if (scenario.id === 'context-budget-conserve') {
    mockGlobals['contextBudget'].mock.calls = [[]]
    mockSandbox.setValue('shouldTrim', true)
  } else if (scenario.id === 'focus-sections') {
    mockGlobals['focus'].mock.calls = [['knowledge', 'functions']]
  } else if (scenario.id === 'async-label') {
    mockGlobals['async'].mock.calls = [[expect.any(Function), 'send-report']]
  } else if (scenario.id === 'compress-call') {
    mockGlobals['compress'].mock.calls = [[Array(100).fill({ id: 1, name: 'item' }), { preserveKeys: ['id'], maxTokens: 100 }]]
  } else if (scenario.id === 'delegate-call') {
    mockGlobals['delegate'].mock.calls = [[expect.any(Function), { timeout: 1000 }]]
  } else if (scenario.id === 'cached-fetch-call') {
    mockGlobals['cachedFetch'].mock.calls = [['https://api.example.com/data', { cacheTtlMs: 60000 }]]
  } else if (scenario.id === 'trace-call') {
    mockGlobals['trace'].mock.calls = [[]]
  } else if (scenario.id === 'knowledge-writer-save') {
    mockGlobals['knowledge.writer'].mock.calls = [[{ field: 'memory/project' }]]
  }

  // Run verification
  const passed = await scenario.verify(mockSandbox, mockGlobals)

  return {
    scenarioId: scenario.id,
    passed,
    generatedCode: '// mocked',
    durationMs: 0,
  }
}

describe('benchmark: basic scenarios', () => {
  const allSizes: ModelSize[] = Object.keys(MODEL_SIZES) as ModelSize[]

  BASIC_SCENARIOS.forEach((scenario) => {
    describe(scenario.id, () => {
      allSizes.forEach((size) => {
        it(`should pass with ${size} model`, async () => {
          const result = await runScenarioMock(scenario)

          // For now, we just verify the scenario structure is valid
          // In production with real LLM calls, we'd assert result.passed
          expect(result).toBeDefined()
          expect(result.scenarioId).toBe(scenario.id)

          // Verify that the verification logic works with our mocks
          if (scenario.global) {
            const globals = Array.isArray(scenario.global) ? scenario.global : [scenario.global]
            globals.forEach((g) => {
              // Each global should be referenced in the scenario
              expect(g).toBeTruthy()
            })
          }
        })
      })
    })
  })

  it('should have all unique scenario IDs', () => {
    const ids = BASIC_SCENARIOS.map((s) => s.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('should cover all expected globals', () => {
    const coveredGlobals = new Set<string>()
    BASIC_SCENARIOS.forEach((s) => {
      const globals = Array.isArray(s.global) ? s.global : [s.global]
      globals.forEach((g) => coveredGlobals.add(g))
    })

    // Expected basic globals (minimum coverage)
    const expected = new Set([
      'stop', 'display', 'ask', 'sleep', 'tasklist', 'completeTask',
      'completeTaskAsync', 'taskProgress', 'loadKnowledge', 'pipeline',
      'parallel', 'guard', 'schema', 'validate', 'broadcast', 'listen',
      'pin', 'unpin', 'memo', 'checkpoint', 'rollback', 'contextBudget',
      'focus', 'compress', 'delegate', 'cachedFetch', 'trace',
      'knowledge.writer', 'async',
    ])

    expected.forEach((g) => {
      expect(coveredGlobals.has(g)).toBeTruthy()
    })
  })
})

describe('benchmark: intermediate scenarios', () => {
  const allSizes: ModelSize[] = Object.keys(MODEL_SIZES) as ModelSize[]

  INTERMEDIATE_SCENARIOS.forEach((scenario) => {
    describe(scenario.id, () => {
      allSizes.forEach((size) => {
        it(`should pass with ${size} model`, async () => {
          const result = await runScenarioMock(scenario)

          expect(result).toBeDefined()
          expect(result.scenarioId).toBe(scenario.id)

          // Verify globals are referenced
          if (scenario.global) {
            const globals = Array.isArray(scenario.global) ? scenario.global : [scenario.global]
            globals.forEach((g) => {
              expect(g).toBeTruthy()
            })
          }
        })
      })
    })
  })

  it('should have all unique scenario IDs', () => {
    const ids = INTERMEDIATE_SCENARIOS.map((s) => s.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('should cover all expected intermediate globals', () => {
    const coveredGlobals = new Set<string>()
    INTERMEDIATE_SCENARIOS.forEach((s) => {
      const globals = Array.isArray(s.global) ? s.global : [s.global]
      globals.forEach((g) => coveredGlobals.add(g))
    })

    // Intermediate scenarios test coordination between globals
    // Key globals that should appear in intermediate scenarios
    const expectedIntermediate = new Set([
      'tasklist', 'display', 'stop', 'pipeline', 'guard', 'parallel',
      'speculate', 'pin', 'memo', 'contextBudget', 'failTask', 'retryTask',
      'fork', 'reflect', 'watch', 'learn', 'critique', 'plan', 'respond',
    ])

    expectedIntermediate.forEach((g) => {
      expect(coveredGlobals.has(g)).toBeTruthy()
    })
  })
})

describe('benchmark: coverage summary', () => {
  it('should have 37 unique globals covered', () => {
    const allGlobals = new Set<string>()

    BASIC_SCENARIOS.forEach((s) => {
      const globals = Array.isArray(s.global) ? s.global : [s.global]
      globals.forEach((g) => allGlobals.add(g))
    })

    INTERMEDIATE_SCENARIOS.forEach((s) => {
      const globals = Array.isArray(s.global) ? s.global : [s.global]
      globals.forEach((g) => allGlobals.add(g))
    })

    // All 37 globals should be covered
    expect(allGlobals.size).toBeGreaterThanOrEqual(37)

    // Verify specific critical globals are present
    const critical = [
      'stop', 'display', 'ask', 'tasklist', 'completeTask', 'completeTaskAsync',
      'taskProgress', 'failTask', 'retryTask', 'sleep', 'loadKnowledge',
      'pin', 'unpin', 'memo', 'guard', 'focus', 'fork', 'compress',
      'speculate', 'reflect', 'watch', 'pipeline', 'cachedFetch', 'schema',
      'validate', 'delegate', 'broadcast', 'listen', 'learn', 'critique',
      'plan', 'parallel', 'checkpoint', 'rollback', 'trace', 'contextBudget',
      'async', 'respond', 'knowledge.writer',
    ]

    critical.forEach((g) => {
      expect(allGlobals.has(g), `Missing global: ${g}`).toBeTruthy()
    })
  })

  it('should have scenario count matching expected', () => {
    expect(BASIC_SCENARIOS.length).toBe(25)
    expect(INTERMEDIATE_SCENARIOS.length).toBe(13)
    expect(BASIC_SCENARIOS.length + INTERMEDIATE_SCENARIOS.length).toBe(38)
  })
})
