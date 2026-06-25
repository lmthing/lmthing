import { describe, it, expect } from 'vitest'

describe('FieldIndexPanel', () => {
  it('should be defined', async () => {
    const mod = await import('./index')
    expect(mod).toBeDefined()
    expect(mod.FieldIndexPanel).toBeDefined()
    // backward-compat alias
    expect(mod.DirectoryMetadataPanel).toBe(mod.FieldIndexPanel)
  })
})
