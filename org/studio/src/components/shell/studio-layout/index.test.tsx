import { describe, it, expect } from 'vitest'

describe('StudioLayout', () => {
  it('should be defined', async () => {
    const mod = await import('./index')
    expect(mod).toBeDefined()
  })
})
