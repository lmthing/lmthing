import { describe, it, expect } from 'vitest'

describe('AgentCard', () => {
  it('should be defined', async () => {
    const mod = await import('./index')
    expect(mod).toBeDefined()
    expect(mod.AgentCard).toBeDefined()
  })
})
