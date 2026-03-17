import { describe, it, expect } from 'vitest'
import { isCompleteStatement } from './statement-detector'

describe('parser/statement-detector', () => {
  it('returns false for empty string', () => {
    expect(isCompleteStatement('')).toBe(false)
    expect(isCompleteStatement('   ')).toBe(false)
  })

  it('simple variable declaration is complete', () => {
    expect(isCompleteStatement('const x = 1')).toBe(true)
  })

  it('function call is complete', () => {
    expect(isCompleteStatement('console.log("hello")')).toBe(true)
  })

  it('incomplete parentheses', () => {
    expect(isCompleteStatement('console.log("hello"')).toBe(false)
  })

  it('incomplete curly braces', () => {
    expect(isCompleteStatement('if (true) {')).toBe(false)
    expect(isCompleteStatement('if (true) { x = 1 }')).toBe(true)
  })

  it('incomplete square brackets', () => {
    expect(isCompleteStatement('const arr = [1, 2,')).toBe(false)
    expect(isCompleteStatement('const arr = [1, 2, 3]')).toBe(true)
  })

  it('handles multi-line object literal', () => {
    expect(isCompleteStatement('const obj = {\n  a: 1,\n  b: 2\n}')).toBe(true)
    expect(isCompleteStatement('const obj = {\n  a: 1,')).toBe(false)
  })

  it('handles strings with brackets inside', () => {
    expect(isCompleteStatement('const x = "hello { world"')).toBe(true)
    expect(isCompleteStatement("const x = 'hello ( world'")).toBe(true)
  })

  it('handles template literals', () => {
    expect(isCompleteStatement('const x = `hello`')).toBe(true)
    expect(isCompleteStatement('const x = `hello')).toBe(false)
  })

  it('handles escaped characters in strings', () => {
    expect(isCompleteStatement('const x = "hello \\" world"')).toBe(true)
    expect(isCompleteStatement("const x = 'it\\'s'")).toBe(true)
  })

  it('handles line comments', () => {
    expect(isCompleteStatement('const x = 1 // comment')).toBe(true)
    expect(isCompleteStatement('// just a comment')).toBe(true)
  })

  it('handles block comments', () => {
    expect(isCompleteStatement('const x = 1 /* comment */')).toBe(true)
    expect(isCompleteStatement('const x = 1 /* unclosed')).toBe(false)
  })

  it('await stop call is complete', () => {
    expect(isCompleteStatement('await stop(x, y)')).toBe(true)
  })

  it('multi-line function definition', () => {
    const fn = `function greet(name: string) {
  return "Hello " + name
}`
    expect(isCompleteStatement(fn)).toBe(true)
  })

  it('arrow function with body', () => {
    expect(isCompleteStatement('const f = (x: number) => { return x + 1 }')).toBe(true)
    expect(isCompleteStatement('const f = (x: number) => {')).toBe(false)
  })

  it('handles nested brackets', () => {
    expect(isCompleteStatement('foo(bar(baz([1, 2])))')).toBe(true)
    expect(isCompleteStatement('foo(bar(baz([1, 2]))')).toBe(false)
  })
})
