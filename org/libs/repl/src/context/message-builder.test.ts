import { describe, it, expect } from 'vitest'
import {
  buildStopMessage,
  buildErrorMessage,
  buildInterventionMessage,
  buildHookInterruptMessage,
  buildCheckpointReminderMessage,
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

  describe('buildCheckpointReminderMessage', () => {
    it('formats checkpoint reminder with tasklist id and remaining ids', () => {
      const msg = buildCheckpointReminderMessage('find_restaurants', ['search', 'present'])
      expect(msg).toBe('⚠ [system] Tasklist "find_restaurants" incomplete. Remaining: search, present. Continue from where you left off.')
    })

    it('formats single remaining checkpoint', () => {
      const msg = buildCheckpointReminderMessage('main', ['final'])
      expect(msg).toBe('⚠ [system] Tasklist "main" incomplete. Remaining: final. Continue from where you left off.')
    })
  })
})
