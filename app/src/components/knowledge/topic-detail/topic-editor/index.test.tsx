import { describe, it, expect } from 'vitest'

describe('TopicEditor', () => {
  it('should be defined', async () => {
    const mod = await import('./index')
    expect(mod).toBeDefined()
    expect(mod.TopicEditor).toBeDefined()
  })
})
