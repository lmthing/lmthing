import { describe, it, expect } from 'vitest'
import type {
  StopPayload,
  ErrorPayload,
  AsyncCancellation,
  AskCancellation,
  ScopeEntry,
  Hook,
  ASTPattern,
  HookMatch,
  HookContext,
  HookAction,
  SessionStatus,
  StreamPauseController,
  StatementExecutor,
  RenderSurface,
  LineResult,
  SessionEvent,
  SerializedJSX,
  SessionSnapshot,
  SerializedValue,
  CheckpointTask,
  CheckpointPlan,
  CheckpointCompletion,
  CheckpointState,
} from './types'

describe('session/types', () => {
  it('StopPayload holds named serialized values', () => {
    const payload: StopPayload = {
      'user.name': { value: 'Alice', display: '"Alice"' },
      x: { value: 42, display: '42' },
    }
    expect(payload['user.name'].display).toBe('"Alice"')
    expect(payload.x.value).toBe(42)
  })

  it('ErrorPayload has required fields', () => {
    const err: ErrorPayload = {
      type: 'TypeError',
      message: 'x is not a function',
      line: 5,
      source: 'x()',
    }
    expect(err.type).toBe('TypeError')
    expect(err.line).toBe(5)
  })

  it('AsyncCancellation shape', () => {
    const cancel: AsyncCancellation = { cancelled: true, message: 'user cancelled' }
    expect(cancel.cancelled).toBe(true)
  })

  it('AskCancellation shape', () => {
    const cancel: AskCancellation = { _cancelled: true }
    expect(cancel._cancelled).toBe(true)
  })

  it('ScopeEntry has name, type, value', () => {
    const entry: ScopeEntry = { name: 'x', type: 'number', value: '42' }
    expect(entry.name).toBe('x')
  })

  it('ASTPattern supports basic, oneOf, and negation forms', () => {
    const basic: ASTPattern = { type: 'CallExpression' }
    const or: ASTPattern = { oneOf: [{ type: 'CallExpression' }, { type: 'MemberExpression' }] }
    const neg: ASTPattern = { type: 'VariableDeclaration', not: { type: 'AwaitExpression' } }
    expect(basic.type).toBe('CallExpression')
    expect('oneOf' in or).toBe(true)
    expect('not' in neg).toBe(true)
  })

  it('HookAction discriminated union covers all types', () => {
    const actions: HookAction[] = [
      { type: 'continue' },
      { type: 'side_effect', fn: () => {} },
      { type: 'transform', newSource: 'x + 1' },
      { type: 'interrupt', message: 'blocked' },
      { type: 'skip', reason: 'unsafe' },
    ]
    expect(actions).toHaveLength(5)
    expect(actions.map(a => a.type)).toEqual([
      'continue', 'side_effect', 'transform', 'interrupt', 'skip',
    ])
  })

  it('SessionStatus covers all states', () => {
    const statuses: SessionStatus[] = [
      'idle', 'executing', 'waiting_for_input', 'paused', 'complete', 'error',
    ]
    expect(statuses).toHaveLength(6)
  })

  it('LineResult ok shape', () => {
    const ok: LineResult = { ok: true, result: 42 }
    const fail: LineResult = {
      ok: false,
      error: { type: 'Error', message: 'fail', line: 1, source: 'x' },
    }
    expect(ok.ok).toBe(true)
    expect(fail.ok).toBe(false)
  })

  it('SessionEvent discriminated union', () => {
    const event: SessionEvent = { type: 'code', lines: 'const x = 1', blockId: 'b1' }
    expect(event.type).toBe('code')
  })

  it('SerializedJSX supports nested children', () => {
    const jsx: SerializedJSX = {
      component: 'Form',
      props: {},
      children: [
        { component: 'TextInput', props: { name: 'email' } },
      ],
    }
    expect(jsx.children).toHaveLength(1)
  })

  it('SessionSnapshot has all required fields', () => {
    const snap: SessionSnapshot = {
      status: 'executing',
      blocks: [{ type: 'code', id: 'b1', data: {} }],
      scope: [{ name: 'x', type: 'number', value: '42' }],
      asyncTasks: [{ id: 'async_0', label: 'fetch', status: 'running', elapsed: 1000 }],
      activeFormId: null,
    }
    expect(snap.status).toBe('executing')
    expect(snap.blocks).toHaveLength(1)
  })

  it('Hook interface has all fields', () => {
    const hook: Hook = {
      id: 'test-hook',
      label: 'Test Hook',
      pattern: { type: 'CallExpression' },
      phase: 'before',
      handler: () => ({ type: 'continue' }),
    }
    expect(hook.id).toBe('test-hook')
    expect(hook.phase).toBe('before')
  })

  it('HookMatch and HookContext shapes', () => {
    const match: HookMatch = { node: {}, source: 'x()', captures: { name: 'x' } }
    const ctx: HookContext = {
      lineNumber: 1,
      sessionId: 'sess-1',
      scope: [{ name: 'x', type: 'function', value: '[Function]' }],
    }
    expect(match.captures.name).toBe('x')
    expect(ctx.lineNumber).toBe(1)
  })

  it('CheckpointTask has required fields', () => {
    const task: CheckpointTask = {
      id: 'gather_input',
      instructions: 'Ask the user for location',
      outputSchema: { zipcode: { type: 'string' } },
    }
    expect(task.id).toBe('gather_input')
    expect(task.outputSchema.zipcode.type).toBe('string')
  })

  it('CheckpointPlan has description and tasks', () => {
    const plan: CheckpointPlan = {
      description: 'Find restaurants',
      tasks: [
        { id: 'search', instructions: 'Search for restaurants', outputSchema: { count: { type: 'number' } } },
      ],
    }
    expect(plan.description).toBe('Find restaurants')
    expect(plan.tasks).toHaveLength(1)
  })

  it('CheckpointCompletion has output and timestamp', () => {
    const completion: CheckpointCompletion = {
      output: { count: 5 },
      timestamp: Date.now(),
    }
    expect(completion.output.count).toBe(5)
    expect(completion.timestamp).toBeGreaterThan(0)
  })

  it('CheckpointState tracks tasklists', () => {
    const state: CheckpointState = {
      tasklists: new Map(),
    }
    expect(state.tasklists.size).toBe(0)
  })

  it('SessionEvent covers checkpoint events', () => {
    const planEvent: SessionEvent = {
      type: 'checkpoint_plan',
      tasklistId: 'tl1',
      plan: { tasklistId: 'tl1', description: 'test', tasks: [] },
    }
    const completeEvent: SessionEvent = {
      type: 'checkpoint_complete',
      tasklistId: 'tl1',
      id: 'step1',
      output: { done: true },
    }
    const reminderEvent: SessionEvent = {
      type: 'checkpoint_reminder',
      tasklistId: 'tl1',
      remaining: ['step2', 'step3'],
    }
    expect(planEvent.type).toBe('checkpoint_plan')
    expect(completeEvent.type).toBe('checkpoint_complete')
    expect(reminderEvent.type).toBe('checkpoint_reminder')
  })

  it('SessionSnapshot includes checkpointState', () => {
    const snap: SessionSnapshot = {
      status: 'executing',
      blocks: [],
      scope: [],
      asyncTasks: [],
      activeFormId: null,
      checkpointState: { tasklists: new Map() },
    }
    expect(snap.checkpointState).toBeDefined()
    expect(snap.checkpointState.tasklists.size).toBe(0)
  })

  it('callback interfaces can be implemented', () => {
    const pauseCtrl: StreamPauseController = {
      pause: () => {},
      resume: () => {},
      isPaused: () => false,
    }
    expect(pauseCtrl.isPaused()).toBe(false)

    const executor: StatementExecutor = {
      execute: async () => ({ ok: true, result: undefined }),
      getScope: () => [],
      getScopeValue: () => undefined,
    }
    expect(executor.getScope()).toEqual([])
  })
})
