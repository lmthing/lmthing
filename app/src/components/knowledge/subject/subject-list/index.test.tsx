import { describe, it, expect } from 'vitest'

describe('SubjectList', () => {
  it('should be defined', async () => {
    const mod = await import('./index')
    expect(mod).toBeDefined()
    expect(mod.SubjectList).toBeDefined()
  })
})
