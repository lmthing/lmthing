import { describe, it, expect } from 'vitest'

describe('WorkflowList', () => {
  it('should be defined', async () => {
    const mod = await import('./index')
    expect(mod).toBeDefined()
  })
})
