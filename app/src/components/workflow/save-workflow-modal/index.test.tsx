import { describe, it, expect } from 'vitest'

describe('SaveWorkflowModal', () => {
  it('should be defined', async () => {
    const mod = await import('./index')
    expect(mod).toBeDefined()
    expect(mod.SaveWorkflowModal).toBeDefined()
  })
})
