import { describe, it, expect } from 'vitest'
import { serialize } from './serializer'

describe('stream/serializer', () => {
  it('serializes strings', () => {
    expect(serialize('hello')).toBe('"hello"')
  })

  it('serializes numbers', () => {
    expect(serialize(42)).toBe('42')
    expect(serialize(3.14)).toBe('3.14')
  })

  it('serializes booleans', () => {
    expect(serialize(true)).toBe('true')
    expect(serialize(false)).toBe('false')
  })

  it('serializes null', () => {
    expect(serialize(null)).toBe('null')
  })

  it('serializes undefined', () => {
    expect(serialize(undefined)).toBe('undefined')
  })

  it('serializes functions', () => {
    function myFunc() {}
    expect(serialize(myFunc)).toBe('[Function: myFunc]')
    expect(serialize(() => {})).toBe('[Function: anonymous]')
  })

  it('serializes errors', () => {
    expect(serialize(new Error('oops'))).toBe('[Error: oops]')
  })

  it('serializes promises', () => {
    expect(serialize(Promise.resolve())).toBe('[Promise]')
  })

  it('serializes dates', () => {
    const d = new Date('2024-01-01T00:00:00.000Z')
    expect(serialize(d)).toBe('"2024-01-01T00:00:00.000Z"')
  })

  it('serializes regex', () => {
    expect(serialize(/foo/gi)).toBe('/foo/gi')
  })

  it('serializes arrays', () => {
    expect(serialize([1, 2, 3])).toBe('[1, 2, 3]')
    expect(serialize([])).toBe('[]')
  })

  it('truncates large arrays', () => {
    const arr = Array.from({ length: 60 }, (_, i) => i)
    const result = serialize(arr)
    expect(result).toContain('... +10 more')
  })

  it('serializes objects', () => {
    expect(serialize({ a: 1, b: 'two' })).toBe('{ "a": 1, "b": "two" }')
    expect(serialize({})).toBe('{}')
  })

  it('truncates large objects', () => {
    const obj: Record<string, number> = {}
    for (let i = 0; i < 30; i++) obj[`key${i}`] = i
    const result = serialize(obj)
    expect(result).toContain('... +10 more')
  })

  it('truncates long strings', () => {
    const long = 'x'.repeat(3000)
    const result = serialize(long)
    expect(result).toContain('truncated')
    expect(result).toContain('3000 chars total')
  })

  it('handles circular references', () => {
    const obj: Record<string, unknown> = { a: 1 }
    obj.self = obj
    const result = serialize(obj)
    expect(result).toContain('[Circular]')
  })

  it('limits depth', () => {
    const deep = { a: { b: { c: { d: { e: { f: 'deep' } } } } } }
    const result = serialize(deep, { maxDepth: 3 })
    expect(result).toContain('[Object]')
  })

  it('serializes nested arrays/objects', () => {
    const data = { users: [{ name: 'Alice' }, { name: 'Bob' }] }
    const result = serialize(data)
    expect(result).toContain('"Alice"')
    expect(result).toContain('"Bob"')
  })

  it('serializes Map', () => {
    const m = new Map([['a', 1], ['b', 2]])
    const result = serialize(m)
    expect(result).toContain('Map')
    expect(result).toContain('"a"')
  })

  it('serializes Set', () => {
    const s = new Set([1, 2, 3])
    const result = serialize(s)
    expect(result).toContain('Set')
    expect(result).toContain('1')
  })

  it('serializes bigint', () => {
    expect(serialize(42n)).toBe('42n')
  })

  it('serializes symbols', () => {
    expect(serialize(Symbol('test'))).toBe('[Symbol: test]')
  })
})
