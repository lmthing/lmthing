import { describe, it, expect } from 'vitest'
import cryptoModule from './crypto'

describe('catalog/crypto', () => {
  const fns = Object.fromEntries(cryptoModule.functions.map(f => [f.name, f.fn]))

  it('hash produces sha256 by default', () => {
    const result = fns.hash('hello') as string
    expect(result).toHaveLength(64) // sha256 hex
  })

  it('hash supports md5', () => {
    const result = fns.hash('hello', 'md5') as string
    expect(result).toHaveLength(32)
  })

  it('randomBytes returns hex string', () => {
    const result = fns.randomBytes(16) as string
    expect(result).toHaveLength(32) // 16 bytes = 32 hex chars
  })

  it('uuid returns v4 format', () => {
    const result = fns.uuid() as string
    expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('base64 encode/decode roundtrip', () => {
    const encoded = fns.base64Encode('hello world') as string
    expect(encoded).toBe('aGVsbG8gd29ybGQ=')
    expect(fns.base64Decode(encoded)).toBe('hello world')
  })
})
