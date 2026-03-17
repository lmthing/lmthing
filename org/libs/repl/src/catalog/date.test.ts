import { describe, it, expect } from 'vitest'
import dateModule from './date'

describe('catalog/date', () => {
  const fns = Object.fromEntries(dateModule.functions.map(f => [f.name, f.fn]))

  it('now returns ISO string', () => {
    const result = fns.now() as string
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('parseDate parses string to Date', () => {
    const result = fns.parseDate('2024-01-15') as Date
    expect(result).toBeInstanceOf(Date)
    expect(result.getFullYear()).toBe(2024)
  })

  it('formatDate formats date', () => {
    const result = fns.formatDate('2024-01-15', 'YYYY-MM-DD')
    expect(result).toBe('2024-01-15')
  })

  it('addDays adds days', () => {
    const result = fns.addDays('2024-01-15', 5) as Date
    expect(result.getDate()).toBe(20)
  })

  it('diffDays calculates difference', () => {
    const result = fns.diffDays('2024-01-01', '2024-01-11') as number
    expect(result).toBe(10)
  })
})
