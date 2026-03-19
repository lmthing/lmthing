import { describe, it, expect } from 'vitest'
import {
  buildStopMessage,
  buildErrorMessage,
  buildInterventionMessage,
  buildHookInterruptMessage,
  buildTasklistReminderMessage,
  renderTaskLine,
  generateTasksBlock,
} from './message-builder'
import type { StopPayload, ErrorPayload, TaskDefinition, TasklistState, TasklistsState } from '../session/types'

describe('context/message-builder', () => {
  describe('buildStopMessage', () => {
    it('formats stop payload', () => {
      const payload: StopPayload = {
        x: { value: 42, display: '42' },
        name: { value: 'Alice', display: '"Alice"' },
      }
      const msg = buildStopMessage(payload)
      expect(msg).toBe('← stop { x: 42, name: "Alice" }')
    })

    it('handles empty payload', () => {
      expect(buildStopMessage({})).toBe('← stop {  }')
    })
  })

  describe('buildErrorMessage', () => {
    it('formats error payload', () => {
      const error: ErrorPayload = {
        type: 'TypeError',
        message: 'x is not a function',
        line: 5,
        source: 'x()',
      }
      const msg = buildErrorMessage(error)
      expect(msg).toBe('← error [TypeError] x is not a function (line 5)')
    })
  })

  describe('buildInterventionMessage', () => {
    it('returns raw text with no prefix', () => {
      expect(buildInterventionMessage('Please try a different approach')).toBe(
        'Please try a different approach',
      )
    })
  })

  describe('buildHookInterruptMessage', () => {
    it('formats hook interrupt', () => {
      const msg = buildHookInterruptMessage('await-guard', 'Missing await on async call')
      expect(msg).toBe('⚠ [hook:await-guard] Missing await on async call')
    })
  })

  describe('buildTasklistReminderMessage', () => {
    it('formats tasklist reminder with ready, blocked, and failed', () => {
      const msg = buildTasklistReminderMessage('find_restaurants', ['search'], ['present (waiting on search)'], [])
      expect(msg).toBe('⚠ [system] Tasklist "find_restaurants" incomplete. Ready: search. Blocked: present (waiting on search). Continue with a ready task.')
    })

    it('formats with failed tasks', () => {
      const msg = buildTasklistReminderMessage('main', ['retry_step'], [], ['failed_step'])
      expect(msg).toBe('⚠ [system] Tasklist "main" incomplete. Ready: retry_step. Failed: failed_step. Continue with a ready task.')
    })

    it('formats with only ready tasks', () => {
      const msg = buildTasklistReminderMessage('main', ['final'], [], [])
      expect(msg).toBe('⚠ [system] Tasklist "main" incomplete. Ready: final. Continue with a ready task.')
    })
  })

  describe('renderTaskLine', () => {
    function makeState(overrides: Partial<TasklistState> = {}): TasklistState {
      return {
        plan: { tasklistId: 'tl', description: 'test', tasks: [] },
        completed: new Map(),
        readyTasks: new Set(),
        runningTasks: new Set(),
        outputs: new Map(),
        progressMessages: new Map(),
        retryCount: new Map(),
        ...overrides,
      }
    }

    const task: TaskDefinition = {
      id: 'fetch',
      instructions: 'Fetch data',
      outputSchema: { data: { type: 'string' } },
      dependsOn: ['setup'],
    }

    it('returns ✓ for completed task', () => {
      const state = makeState({
        completed: new Map([['fetch', { output: { data: 'ok' }, timestamp: Date.now(), status: 'completed' }]]),
      })
      const { symbol, detail } = renderTaskLine(task, state)
      expect(symbol).toBe('✓')
      expect(detail).toContain('→')
    })

    it('returns ✗ for failed task', () => {
      const state = makeState({
        completed: new Map([['fetch', { output: {}, timestamp: Date.now(), status: 'failed', error: 'timeout' }]]),
      })
      const { symbol, detail } = renderTaskLine(task, state)
      expect(symbol).toBe('✗')
      expect(detail).toContain('timeout')
    })

    it('returns ⊘ for skipped task', () => {
      const state = makeState({
        completed: new Map([['fetch', { output: {}, timestamp: Date.now(), status: 'skipped' }]]),
      })
      const { symbol, detail } = renderTaskLine(task, state)
      expect(symbol).toBe('⊘')
      expect(detail).toContain('skipped')
    })

    it('returns ◉ for running task', () => {
      const state = makeState({ runningTasks: new Set(['fetch']) })
      const { symbol, detail } = renderTaskLine(task, state)
      expect(symbol).toBe('◉')
      expect(detail).toContain('running')
    })

    it('returns ◉ with progress', () => {
      const state = makeState({
        runningTasks: new Set(['fetch']),
        progressMessages: new Map([['fetch', { message: 'Loading...', percent: 50 }]]),
      })
      const { symbol, detail } = renderTaskLine(task, state)
      expect(symbol).toBe('◉')
      expect(detail).toContain('50%')
      expect(detail).toContain('Loading...')
    })

    it('returns ◎ for ready task', () => {
      const state = makeState({ readyTasks: new Set(['fetch']) })
      const { symbol, detail } = renderTaskLine(task, state)
      expect(symbol).toBe('◎')
      expect(detail).toContain('ready')
    })

    it('returns ○ for blocked task', () => {
      const state = makeState()
      const { symbol, detail } = renderTaskLine(task, state)
      expect(symbol).toBe('○')
      expect(detail).toContain('blocked')
      expect(detail).toContain('setup')
    })
  })

  describe('generateTasksBlock with renderTaskLine extraction', () => {
    it('generates correct block with multiple tasks', () => {
      const tasklistsState: TasklistsState = {
        tasklists: new Map([
          ['tl1', {
            plan: {
              tasklistId: 'tl1',
              description: 'Test',
              tasks: [
                { id: 'a', instructions: 'Do A', outputSchema: { x: { type: 'string' } } },
                { id: 'b', instructions: 'Do B', outputSchema: { y: { type: 'number' } }, dependsOn: ['a'] },
              ],
            },
            completed: new Map([['a', { output: { x: 'done' }, timestamp: Date.now(), status: 'completed' }]]),
            readyTasks: new Set(['b']),
            runningTasks: new Set(),
            outputs: new Map(),
            progressMessages: new Map(),
            retryCount: new Map(),
          }],
        ]),
      }

      const result = generateTasksBlock(tasklistsState)
      expect(result).not.toBeNull()
      expect(result).toContain('{{TASKS}}')
      expect(result).toContain('✓')
      expect(result).toContain('a')
      expect(result).toContain('◎')
      expect(result).toContain('b')
    })

    it('returns null for empty tasklists', () => {
      expect(generateTasksBlock({ tasklists: new Map() })).toBeNull()
    })
  })
})
