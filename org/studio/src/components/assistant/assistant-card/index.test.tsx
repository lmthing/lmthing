import { describe, it, expect } from 'vitest'

describe('AssistantCard', () => {
  it('should be defined', async () => {
    const mod = await import('./index')
    expect(mod).toBeDefined()
    expect(mod.AssistantCard).toBeDefined()
  })
})
