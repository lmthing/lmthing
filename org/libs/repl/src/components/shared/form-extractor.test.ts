import { describe, it, expect } from 'vitest'
import { normalizeFormData } from './form-extractor'

// Note: extractFormData requires DOM (jsdom) and is tested in component tests.
// Here we test the normalizeFormData utility which is pure logic.

describe('components/shared/form-extractor', () => {
  describe('normalizeFormData', () => {
    it('passes through valid values', () => {
      const result = normalizeFormData({ name: 'Alice', age: 30 })
      expect(result).toEqual({ name: 'Alice', age: 30 })
    })

    it('strips empty strings', () => {
      const result = normalizeFormData({ name: 'Alice', email: '' })
      expect(result).toEqual({ name: 'Alice' })
    })

    it('strips undefined values', () => {
      const result = normalizeFormData({ name: 'Alice', bio: undefined })
      expect(result).toEqual({ name: 'Alice' })
    })

    it('preserves falsy non-empty values', () => {
      const result = normalizeFormData({ count: 0, active: false, label: null as unknown })
      expect(result).toEqual({ count: 0, active: false, label: null })
    })

    it('returns empty object for all-empty input', () => {
      const result = normalizeFormData({ a: '', b: undefined })
      expect(result).toEqual({})
    })

    it('preserves arrays', () => {
      const result = normalizeFormData({ tags: ['a', 'b'] })
      expect(result).toEqual({ tags: ['a', 'b'] })
    })
  })
})
