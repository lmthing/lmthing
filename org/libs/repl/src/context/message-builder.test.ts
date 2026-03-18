import { describe, it, expect } from 'vitest'
import {
  buildStopMessage,
  buildErrorMessage,
  buildInterventionMessage,
  buildHookInterruptMessage,
  buildTasklistReminderMessage,
} from './message-builder'
import type { StopPayload, ErrorPayload } from '../session/types'

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
})
