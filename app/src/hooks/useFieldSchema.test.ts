import { describe, it, expect } from 'vitest'

describe('useFieldSchema', () => {
  it('should be defined', async () => {
    const mod = await import('./useFieldSchema')
    expect(mod).toBeDefined()
    expect(mod.useFieldSchema).toBeDefined()
  })
})
