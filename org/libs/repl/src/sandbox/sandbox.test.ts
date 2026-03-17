import { describe, it, expect } from 'vitest'
import { Sandbox } from './sandbox'

describe('sandbox/sandbox', () => {
  it('executes simple code', async () => {
    const sandbox = new Sandbox()
    const result = await sandbox.execute('var x = 42')
    expect(result.ok).toBe(true)
  })

  it('persists scope across executions', async () => {
    const sandbox = new Sandbox()
    await sandbox.execute('var a = 10')
    await sandbox.execute('var b = 20')
    const result = await sandbox.execute('a + b')
    expect(result.ok).toBe(true)
    expect(result.result).toBe(30)
  })

  it('tracks declared variable names', async () => {
    const sandbox = new Sandbox()
    await sandbox.execute('const x = 1')
    await sandbox.execute('let y = 2')
    expect(sandbox.getDeclaredNames()).toContain('x')
    expect(sandbox.getDeclaredNames()).toContain('y')
  })

  it('getScope returns scope entries', async () => {
    const sandbox = new Sandbox()
    await sandbox.execute('var name = "Alice"')
    await sandbox.execute('var count = 42')
    const scope = sandbox.getScope()
    expect(scope.find(e => e.name === 'name')?.type).toBe('string')
    expect(scope.find(e => e.name === 'count')?.type).toBe('number')
  })

  it('inject adds globals', async () => {
    const sandbox = new Sandbox()
    sandbox.inject('myFunc', (x: number) => x * 2)
    const result = await sandbox.execute('myFunc(5)')
    expect(result.ok).toBe(true)
    expect(result.result).toBe(10)
  })

  it('getValue reads scope', async () => {
    const sandbox = new Sandbox()
    await sandbox.execute('var val = "hello"')
    expect(sandbox.getValue('val')).toBe('hello')
  })

  it('blocks process access', async () => {
    const sandbox = new Sandbox()
    const result = await sandbox.execute('process.exit()')
    expect(result.ok).toBe(false)
    expect(result.error?.message).toContain('process')
  })

  it('blocks require', async () => {
    const sandbox = new Sandbox()
    const result = await sandbox.execute('require("fs")')
    expect(result.ok).toBe(false)
    expect(result.error?.message).toContain('require')
  })

  it('blocks eval', async () => {
    const sandbox = new Sandbox()
    const result = await sandbox.execute('eval("1+1")')
    expect(result.ok).toBe(false)
    expect(result.error?.message).toContain('eval')
  })

  it('blocks Function constructor', async () => {
    const sandbox = new Sandbox()
    const result = await sandbox.execute('new Function("return 1")()')
    expect(result.ok).toBe(false)
    expect(result.error?.message).toContain('Function')
  })

  it('captures errors with line numbers', async () => {
    const sandbox = new Sandbox()
    await sandbox.execute('var x = 1')
    const result = await sandbox.execute('throw new TypeError("boom")')
    expect(result.ok).toBe(false)
    expect(result.error?.type).toBe('TypeError')
    expect(result.error?.line).toBe(2)
  })

  it('supports custom globals', async () => {
    const sandbox = new Sandbox({
      globals: { React: { createElement: () => ({}) } },
    })
    const result = await sandbox.execute('React.createElement("div")')
    expect(result.ok).toBe(true)
  })

  it('lineCount increments', async () => {
    const sandbox = new Sandbox()
    expect(sandbox.getLineCount()).toBe(0)
    await sandbox.execute('var x = 1')
    expect(sandbox.getLineCount()).toBe(1)
    await sandbox.execute('var y = 2')
    expect(sandbox.getLineCount()).toBe(2)
  })

  it('handles TypeScript syntax', async () => {
    const sandbox = new Sandbox()
    const result = await sandbox.execute('var x: number = 42')
    expect(result.ok).toBe(true)
  })

  it('handles destructuring', async () => {
    const sandbox = new Sandbox()
    await sandbox.execute('var obj = { a: 1, b: 2 }')
    await sandbox.execute('const { a, b } = obj')
    expect(sandbox.getDeclaredNames()).toContain('a')
    expect(sandbox.getDeclaredNames()).toContain('b')
  })

  it('destroy clears state', () => {
    const sandbox = new Sandbox()
    sandbox.destroy()
    expect(sandbox.getDeclaredNames()).toEqual([])
  })
})
