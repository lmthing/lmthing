import { describe, it, expect } from 'vitest'
import { transpile } from './transpiler'

describe('sandbox/transpiler', () => {
  it('transpiles simple TypeScript', () => {
    const js = transpile('const x: number = 1')
    expect(js).toContain('const x = 1')
  })

  it('strips type annotations', () => {
    const js = transpile('function greet(name: string): string { return name }')
    expect(js).toContain('function greet(name)')
    expect(js).not.toContain(': string')
  })

  it('transpiles JSX', () => {
    const js = transpile('const el = <div>hello</div>')
    expect(js).toContain('React.createElement')
  })

  it('transpiles JSX fragments', () => {
    const js = transpile('const el = <>hello</>')
    expect(js).toContain('React.Fragment')
  })

  it('handles async/await', () => {
    const js = transpile('const data = await fetch("url")')
    expect(js).toContain('await')
  })

  it('handles template literals', () => {
    const js = transpile('const x = `hello ${name}`')
    expect(js).toContain('hello')
  })

  it('handles interfaces (removed)', () => {
    const js = transpile('interface Foo { bar: string }')
    // Interfaces should be removed during transpilation
    expect(js.trim()).toBe('')
  })

  it('handles type aliases (removed)', () => {
    const js = transpile('type Foo = string | number')
    expect(js.trim()).toBe('')
  })

  it('handles destructuring', () => {
    const js = transpile('const { a, b } = obj')
    expect(js).toContain('const { a, b }')
  })
})
