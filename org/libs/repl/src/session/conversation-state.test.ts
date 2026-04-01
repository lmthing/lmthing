import { describe, it, expect } from 'vitest'
import {
  computeScopeDelta,
  serializeTasklistsState,
  ConversationRecorder,
} from './conversation-state'
import type { ScopeEntry, TasklistsState, SessionEvent } from './types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function entry(name: string, type = 'number', value = '42'): ScopeEntry {
  return { name, type, value }
}

function emptyTasklistsState(): TasklistsState {
  return { tasklists: new Map() }
}

function makeTasklistsState(): TasklistsState {
  return {
    tasklists: new Map([
      ['plan', {
        plan: {
          tasklistId: 'plan',
          description: 'Test plan',
          tasks: [
            { id: 'step1', instructions: 'Do step 1', outputSchema: { done: { type: 'boolean' } } },
          ],
        },
        completed: new Map([['step1', { output: { done: true }, timestamp: 1000, status: 'completed' }]]),
        readyTasks: new Set(['step2']),
        runningTasks: new Set(['step3']),
        outputs: new Map([['step1', { done: true }]]),
        progressMessages: new Map([['step3', { message: 'Processing...', percent: 50 }]]),
        retryCount: new Map([['step2', 1]]),
      }],
    ]),
  }
}

// ── computeScopeDelta ─────────────────────────────────────────────────────────

describe('computeScopeDelta', () => {
  it('detects added variables', () => {
    const prev: ScopeEntry[] = [entry('x')]
    const curr: ScopeEntry[] = [entry('x'), entry('y')]
    const delta = computeScopeDelta(prev, curr)
    expect(delta.added).toHaveLength(1)
    expect(delta.added[0].name).toBe('y')
    expect(delta.changed).toHaveLength(0)
    expect(delta.removed).toHaveLength(0)
  })

  it('detects removed variables', () => {
    const prev: ScopeEntry[] = [entry('x'), entry('y')]
    const curr: ScopeEntry[] = [entry('x')]
    const delta = computeScopeDelta(prev, curr)
    expect(delta.removed).toEqual(['y'])
    expect(delta.added).toHaveLength(0)
    expect(delta.changed).toHaveLength(0)
  })

  it('detects changed type', () => {
    const prev: ScopeEntry[] = [entry('x', 'number', '42')]
    const curr: ScopeEntry[] = [entry('x', 'string', '"hello"')]
    const delta = computeScopeDelta(prev, curr)
    expect(delta.changed).toHaveLength(1)
    expect(delta.changed[0].name).toBe('x')
    expect(delta.changed[0].previousType).toBe('number')
    expect(delta.changed[0].type).toBe('string')
  })

  it('detects changed value (same type)', () => {
    const prev: ScopeEntry[] = [entry('x', 'number', '1')]
    const curr: ScopeEntry[] = [entry('x', 'number', '2')]
    const delta = computeScopeDelta(prev, curr)
    expect(delta.changed).toHaveLength(1)
    expect(delta.changed[0].previousValue).toBe('1')
    expect(delta.changed[0].value).toBe('2')
  })

  it('returns empty delta for identical snapshots', () => {
    const scope = [entry('x'), entry('y', 'string', '"hi"')]
    const delta = computeScopeDelta(scope, scope)
    expect(delta.added).toHaveLength(0)
    expect(delta.changed).toHaveLength(0)
    expect(delta.removed).toHaveLength(0)
  })

  it('handles both arrays being empty', () => {
    const delta = computeScopeDelta([], [])
    expect(delta.added).toHaveLength(0)
    expect(delta.changed).toHaveLength(0)
    expect(delta.removed).toHaveLength(0)
  })
})

// ── serializeTasklistsState ───────────────────────────────────────────────────

describe('serializeTasklistsState', () => {
  it('converts Map to plain object at top level', () => {
    const state = makeTasklistsState()
    const serialized = serializeTasklistsState(state)
    expect(typeof serialized.tasklists).toBe('object')
    expect(serialized.tasklists).not.toBeInstanceOf(Map)
    expect(serialized.tasklists['plan']).toBeDefined()
  })

  it('converts Set to array for readyTasks and runningTasks', () => {
    const state = makeTasklistsState()
    const serialized = serializeTasklistsState(state)
    const plan = serialized.tasklists['plan']
    expect(Array.isArray(plan.readyTasks)).toBe(true)
    expect(Array.isArray(plan.runningTasks)).toBe(true)
    expect(plan.readyTasks).toContain('step2')
    expect(plan.runningTasks).toContain('step3')
  })

  it('preserves completed as plain object', () => {
    const state = makeTasklistsState()
    const serialized = serializeTasklistsState(state)
    const completed = serialized.tasklists['plan'].completed
    expect(completed).not.toBeInstanceOf(Map)
    expect(completed['step1']).toMatchObject({ status: 'completed' })
  })

  it('preserves progressMessages', () => {
    const state = makeTasklistsState()
    const serialized = serializeTasklistsState(state)
    const progress = serialized.tasklists['plan'].progressMessages
    expect(progress['step3']).toEqual({ message: 'Processing...', percent: 50 })
  })

  it('preserves retryCount', () => {
    const state = makeTasklistsState()
    const serialized = serializeTasklistsState(state)
    expect(serialized.tasklists['plan'].retryCount['step2']).toBe(1)
  })

  it('handles empty tasklists state', () => {
    const serialized = serializeTasklistsState(emptyTasklistsState())
    expect(Object.keys(serialized.tasklists)).toHaveLength(0)
  })
})

// ── ConversationRecorder ──────────────────────────────────────────────────────

describe('ConversationRecorder', () => {
  it('starts with empty state and idle status', () => {
    const rec = new ConversationRecorder()
    const state = rec.getState()
    expect(state.turns).toHaveLength(0)
    expect(state.stopCount).toBe(0)
    expect(state.status).toBe('idle')
    expect(state.startedAt).toBeGreaterThan(0)
  })

  describe('recordStop', () => {
    it('increments stopCount', () => {
      const rec = new ConversationRecorder()
      rec.recordStop(
        ['var x = 1', 'await stop(x)'],
        { x: { value: 1, display: '1' } },
        [entry('x')],
        emptyTasklistsState(),
      )
      expect(rec.getState().stopCount).toBe(1)
    })

    it('creates a turn with type "stop" boundary', () => {
      const rec = new ConversationRecorder()
      rec.recordStop(['await stop(42)'], { val: { value: 42, display: '42' } }, [], emptyTasklistsState())
      const turn = rec.getState().turns[0]
      expect(turn.boundary?.type).toBe('stop')
      expect(turn.role).toBe('assistant')
    })

    it('first turn delta treats all current scope as "added"', () => {
      const rec = new ConversationRecorder()
      rec.recordStop(['var x = 1'], {}, [entry('x')], emptyTasklistsState())
      const turn = rec.getState().turns[0]
      expect(turn.scopeDelta?.added).toHaveLength(1)
      expect(turn.scopeDelta?.added[0].name).toBe('x')
    })

    it('second turn delta computes delta from first turn scope', () => {
      const rec = new ConversationRecorder()
      rec.recordStop(['var x = 1'], {}, [entry('x')], emptyTasklistsState())
      rec.recordStop(['var y = 2'], {}, [entry('x'), entry('y')], emptyTasklistsState())
      const second = rec.getState().turns[1]
      expect(second.scopeDelta?.added).toHaveLength(1)
      expect(second.scopeDelta?.added[0].name).toBe('y')
    })

    it('multiple stops increment stopCount', () => {
      const rec = new ConversationRecorder()
      rec.recordStop([], {}, [], emptyTasklistsState())
      rec.recordStop([], {}, [], emptyTasklistsState())
      rec.recordStop([], {}, [], emptyTasklistsState())
      expect(rec.getState().stopCount).toBe(3)
    })
  })

  describe('recordError', () => {
    it('creates a turn with type "error" boundary', () => {
      const rec = new ConversationRecorder()
      rec.recordError(
        ['var x = undefined.prop'],
        { type: 'TypeError', message: "Cannot read 'prop'", line: 1, source: 'var x = undefined.prop' },
        [],
      )
      const turn = rec.getState().turns[0]
      expect(turn.boundary?.type).toBe('error')
      if (turn.boundary?.type === 'error') {
        expect(turn.boundary.error.type).toBe('TypeError')
        expect(turn.boundary.error.message).toContain("prop")
      }
    })
  })

  describe('recordUserMessage', () => {
    it('creates a user role turn with null code and null boundary', () => {
      const rec = new ConversationRecorder()
      rec.recordUserMessage('Hello, show me the results', [])
      const turn = rec.getState().turns[0]
      expect(turn.role).toBe('user')
      expect(turn.code).toBeNull()
      expect(turn.boundary).toBeNull()
      expect(turn.message).toBe('Hello, show me the results')
    })
  })

  describe('turn indexing', () => {
    it('turn index is monotonically increasing from 0', () => {
      const rec = new ConversationRecorder()
      rec.recordStop([], {}, [], emptyTasklistsState())
      rec.recordUserMessage('hi', [])
      rec.recordStop([], {}, [], emptyTasklistsState())
      const turns = rec.getState().turns
      expect(turns[0].index).toBe(0)
      expect(turns[1].index).toBe(1)
      expect(turns[2].index).toBe(2)
    })

    it('turn startedAt and endedAt are set', () => {
      const rec = new ConversationRecorder()
      rec.recordStop([], {}, [], emptyTasklistsState())
      const turn = rec.getState().turns[0]
      expect(turn.startedAt).toBeGreaterThan(0)
      expect(turn.endedAt).toBeGreaterThanOrEqual(turn.startedAt)
    })
  })

  describe('recordEvent', () => {
    it('accumulates events and attaches them to the next turn', () => {
      const rec = new ConversationRecorder()
      const event = { type: 'display', componentId: 'comp-1', jsx: { component: 'div', props: {} } } as SessionEvent
      rec.recordEvent(event)
      rec.recordStop([], {}, [], emptyTasklistsState())
      const turn = rec.getState().turns[0]
      expect(turn.events).toHaveLength(1)
      expect(turn.events[0]).toMatchObject({ type: 'display', componentId: 'comp-1' })
    })

    it('clears pending events after turn is pushed', () => {
      const rec = new ConversationRecorder()
      rec.recordEvent({ type: 'display', componentId: 'c1' })
      rec.recordStop([], {}, [], emptyTasklistsState())
      rec.recordStop([], {}, [], emptyTasklistsState())
      const turns = rec.getState().turns
      expect(turns[0].events).toHaveLength(1)
      expect(turns[1].events).toHaveLength(0) // no events before second stop
    })

    it('updates status for "status" events', () => {
      const rec = new ConversationRecorder()
      const statusEvent = { type: 'status', status: 'executing' } as SessionEvent
      rec.recordEvent(statusEvent)
      expect(rec.getState().status).toBe('executing')
    })
  })

  describe('getState', () => {
    it('returns shallow copy — mutations do not affect internal state', () => {
      const rec = new ConversationRecorder()
      rec.recordStop([], {}, [], emptyTasklistsState())
      const state = rec.getState()
      state.turns.push({
        index: 99,
        startedAt: 0,
        endedAt: 0,
        role: 'user',
        code: null,
        message: 'injected',
        boundary: null,
        scopeSnapshot: [],
        scopeDelta: null,
        events: [],
      })
      // Internal state should still have only 1 turn
      expect(rec.getState().turns).toHaveLength(1)
    })
  })
})
