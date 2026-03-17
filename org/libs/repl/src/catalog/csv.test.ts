import { describe, it, expect } from 'vitest'
import csvModule from './csv'

describe('catalog/csv', () => {
  const fns = Object.fromEntries(csvModule.functions.map(f => [f.name, f.fn]))

  it('csvParse with header', () => {
    const csv = 'name,age\nAlice,30\nBob,25'
    const result = fns.csvParse(csv) as any[]
    expect(result).toEqual([
      { name: 'Alice', age: '30' },
      { name: 'Bob', age: '25' },
    ])
  })

  it('csvParse without header', () => {
    const csv = '1,2,3\n4,5,6'
    const result = fns.csvParse(csv, { header: false }) as any[]
    expect(result).toEqual([['1', '2', '3'], ['4', '5', '6']])
  })

  it('csvParse with custom delimiter', () => {
    const csv = 'name;age\nAlice;30'
    const result = fns.csvParse(csv, { delimiter: ';' }) as any[]
    expect(result).toEqual([{ name: 'Alice', age: '30' }])
  })

  it('csvStringify from objects', () => {
    const data = [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }]
    const result = fns.csvStringify(data) as string
    expect(result).toContain('name,age')
    expect(result).toContain('Alice,30')
  })

  it('csvStringify from arrays', () => {
    const data = [[1, 2], [3, 4]]
    const result = fns.csvStringify(data) as string
    expect(result).toBe('1,2\n3,4')
  })

  it('handles quoted fields', () => {
    const csv = 'name,desc\nAlice,"hello, world"\nBob,"he said ""hi"""'
    const result = fns.csvParse(csv) as any[]
    expect(result[0].desc).toBe('hello, world')
    expect(result[1].desc).toBe('he said "hi"')
  })
})
