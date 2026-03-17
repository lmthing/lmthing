import { describe, it, expect } from 'vitest'
import { generateScopeTable, describeType, truncateValue } from './scope-generator'
import type { ScopeEntry } from '../session/types'

describe('context/scope-generator', () => {
  describe('generateScopeTable', () => {
    it('generates table with entries', () => {
      const entries: ScopeEntry[] = [
        { name: 'x', type: 'number', value: '42' },
        { name: 'name', type: 'string', value: '"Alice"' },
      ]
      const table = generateScopeTable(entries)
      expect(table).toContain('x')
      expect(table).toContain('number')
      expect(table).toContain('42')
      expect(table).toContain('name')
      expect(table).toContain('"Alice"')
    })

    it('returns placeholder for empty scope', () => {
      expect(generateScopeTable([])).toBe('(no variables declared)')
    })

    it('truncates long values', () => {
      const entries: ScopeEntry[] = [
        { name: 'long', type: 'string', value: 'x'.repeat(100) },
      ]
      const table = generateScopeTable(entries, { maxValueWidth: 30 })
      expect(table).toContain('...')
    })

    it('limits max variables', () => {
      const entries: ScopeEntry[] = Array.from({ length: 60 }, (_, i) => ({
        name: `var${i}`, type: 'number', value: String(i),
      }))
      const table = generateScopeTable(entries, { maxVariables: 50 })
      expect(table).toContain('... +10 more variables')
    })
  })

  describe('describeType', () => {
    it('describes primitives', () => {
      expect(describeType(42)).toBe('number')
      expect(describeType('hello')).toBe('string')
      expect(describeType(true)).toBe('boolean')
      expect(describeType(null)).toBe('null')
      expect(describeType(undefined)).toBe('undefined')
    })

    it('describes arrays', () => {
      expect(describeType([])).toBe('Array')
      expect(describeType([1, 2])).toBe('Array<number>')
      expect(describeType([{ a: 1 }])).toBe('Array<Object>')
    })

    it('describes objects', () => {
      expect(describeType({})).toBe('Object')
      expect(describeType(new Date())).toBe('Date')
      expect(describeType(new Map())).toBe('Map')
    })

    it('describes functions', () => {
      expect(describeType(() => {})).toBe('function')
    })
  })

  describe('truncateValue', () => {
    it('truncates strings', () => {
      expect(truncateValue('hello')).toBe('"hello"')
      expect(truncateValue('x'.repeat(100), 20)).toContain('...')
    })

    it('previews arrays', () => {
      expect(truncateValue([1, 2, 3])).toBe('[1, 2, 3]')
      expect(truncateValue([1, 2, 3, 4, 5])).toContain('... +2')
    })

    it('previews objects', () => {
      expect(truncateValue({ a: 1 })).toBe('{a}')
    })

    it('handles null/undefined', () => {
      expect(truncateValue(null)).toBe('null')
      expect(truncateValue(undefined)).toBe('undefined')
    })

    it('handles functions', () => {
      function myFn() {}
      expect(truncateValue(myFn)).toBe('[Function: myFn]')
    })
  })
})
