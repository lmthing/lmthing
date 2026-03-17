import { describe, it, expect } from 'vitest'
import envModule from './env'

describe('catalog/env', () => {
  const fns = Object.fromEntries(envModule.functions.map(f => [f.name, f.fn]))

  it('getEnv reads allowed variables', () => {
    // HOME is in the default allowlist
    const result = fns.getEnv('HOME')
    expect(typeof result === 'string' || result === undefined).toBe(true)
  })

  it('getEnv blocks secret patterns', () => {
    expect(() => fns.getEnv('AWS_SECRET')).toThrow('not in the allowlist')
    expect(() => fns.getEnv('API_KEY')).toThrow('not in the allowlist')
    expect(() => fns.getEnv('DB_PASSWORD')).toThrow('not in the allowlist')
  })

  it('getEnv allows LMTHING_ prefixed vars', () => {
    process.env.LMTHING_TEST = 'value'
    expect(fns.getEnv('LMTHING_TEST')).toBe('value')
    delete process.env.LMTHING_TEST
  })

  it('listEnv returns array of allowed keys', () => {
    const keys = fns.listEnv() as string[]
    expect(Array.isArray(keys)).toBe(true)
    // Should include some default keys if they exist in env
  })
})
