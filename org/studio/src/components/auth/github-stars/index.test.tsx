import { describe, it, expect } from 'vitest'

describe('GithubStars', () => {
  it('should be defined', async () => {
    const mod = await import('./index')
    expect(mod).toBeDefined()
  })
})
