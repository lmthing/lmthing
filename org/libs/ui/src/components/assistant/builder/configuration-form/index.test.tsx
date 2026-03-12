import { describe, it, expect } from 'vitest'

describe('ConfigurationForm', () => {
  it('should be defined', async () => {
    const mod = await import('./index')
    expect(mod).toBeDefined()
    expect(mod.ConfigurationForm).toBeDefined()
  })
})
