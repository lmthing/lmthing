import { describe, it, expect } from 'vitest'
import shellModule from './shell'

describe('catalog/shell', () => {
  const fns = Object.fromEntries(shellModule.functions.map(f => [f.name, f.fn]))

  it('exec runs a command', async () => {
    const result = await fns.exec('echo hello') as any
    expect(result.stdout.trim()).toBe('hello')
    expect(result.exitCode).toBe(0)
  })

  it('exec captures stderr', async () => {
    const result = await fns.exec('ls /nonexistent-path-12345') as any
    expect(result.exitCode).not.toBe(0)
  })

  it('which finds existing binary', async () => {
    const result = await fns.which('echo')
    expect(result).toBeTruthy()
  })

  it('which returns null for missing binary', async () => {
    const result = await fns.which('nonexistent-binary-12345')
    expect(result).toBeNull()
  })
})
