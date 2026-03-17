import { describe, it, expect } from 'vitest'
import jsonModule from './json'

describe('catalog/json', () => {
  const fns = Object.fromEntries(jsonModule.functions.map(f => [f.name, f.fn]))

  it('jsonParse parses valid JSON', () => {
    expect(fns.jsonParse('{"a":1}')).toEqual({ a: 1 })
  })

  it('jsonParse throws on invalid JSON', () => {
    expect(() => fns.jsonParse('{')).toThrow('JSON parse error')
  })

  it('jsonQuery traverses path', () => {
    const data = { store: { books: [{ author: 'Alice' }, { author: 'Bob' }] } }
    expect(fns.jsonQuery(data, '$.store.books[0].author')).toBe('Alice')
    expect(fns.jsonQuery(data, 'store.books[*]')).toEqual([{ author: 'Alice' }, { author: 'Bob' }])
  })

  it('jsonTransform maps arrays', () => {
    expect(fns.jsonTransform([1, 2, 3], (x: number) => x * 2)).toEqual([2, 4, 6])
  })

  it('jsonTransform maps objects', () => {
    expect(fns.jsonTransform({ a: 1, b: 2 }, (x: number) => x + 10)).toEqual({ a: 11, b: 12 })
  })

  it('jsonMerge deep merges', () => {
    const a = { x: 1, nested: { a: 1 } }
    const b = { y: 2, nested: { b: 2 } }
    expect(fns.jsonMerge(a, b)).toEqual({ x: 1, y: 2, nested: { a: 1, b: 2 } })
  })

  it('jsonDiff finds differences', () => {
    const a = { x: 1, y: 2 }
    const b = { x: 1, y: 3, z: 4 }
    const diffs = fns.jsonDiff(a, b) as any[]
    expect(diffs.some((d: any) => d.path === '$.y' && d.type === 'changed')).toBe(true)
    expect(diffs.some((d: any) => d.path === '$.z' && d.type === 'added')).toBe(true)
  })
})
