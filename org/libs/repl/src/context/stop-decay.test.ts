import { describe, it, expect } from 'vitest'
import { getDecayLevel, decayStopPayload, decayErrorMessage } from './stop-decay'
import type { StopPayload } from '../session/types'

describe('context/stop-decay', () => {
  const payload: StopPayload = {
    x: { value: 42, display: '42' },
    name: { value: 'Alice', display: '"Alice"' },
  }

  describe('getDecayLevel', () => {
    it('returns full for 0-2', () => {
      expect(getDecayLevel(0)).toBe('full')
      expect(getDecayLevel(1)).toBe('full')
      expect(getDecayLevel(2)).toBe('full')
    })

    it('returns keys for 3-5', () => {
      expect(getDecayLevel(3)).toBe('keys')
      expect(getDecayLevel(5)).toBe('keys')
    })

    it('returns count for 6-10', () => {
      expect(getDecayLevel(6)).toBe('count')
      expect(getDecayLevel(10)).toBe('count')
    })

    it('returns removed for 11+', () => {
      expect(getDecayLevel(11)).toBe('removed')
      expect(getDecayLevel(100)).toBe('removed')
    })
  })

  describe('decayStopPayload', () => {
    it('full — shows complete values', () => {
      const result = decayStopPayload(payload, 0)
      expect(result).toContain('← stop')
      expect(result).toContain('42')
      expect(result).toContain('"Alice"')
    })

    it('keys — shows types only', () => {
      const result = decayStopPayload(payload, 3)
      expect(result).toContain('← stop')
      expect(result).toContain('number')
      expect(result).toContain('string')
      expect(result).not.toContain('42')
    })

    it('count — shows value count', () => {
      const result = decayStopPayload(payload, 7)
      expect(result).toBe('← stop (2 values read)')
    })

    it('removed — returns null', () => {
      expect(decayStopPayload(payload, 15)).toBeNull()
    })

    it('handles single value count', () => {
      const single: StopPayload = { x: { value: 1, display: '1' } }
      expect(decayStopPayload(single, 7)).toBe('← stop (1 value read)')
    })
  })

  describe('decayErrorMessage', () => {
    it('keeps full error for recent turns', () => {
      expect(decayErrorMessage('← error [TypeError] oops', 0)).toBe('← error [TypeError] oops')
    })

    it('keeps error for keys tier', () => {
      expect(decayErrorMessage('← error [TypeError] oops', 4)).toBe('← error [TypeError] oops')
    })

    it('summarizes for count tier', () => {
      expect(decayErrorMessage('← error [TypeError] oops', 7)).toBe('← error (1 error occurred)')
    })

    it('removes for old turns', () => {
      expect(decayErrorMessage('← error [TypeError] oops', 15)).toBeNull()
    })
  })
})
