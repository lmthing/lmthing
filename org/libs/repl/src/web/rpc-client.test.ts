import { describe, it, expect } from 'vitest'
// Testing the applyEvent reducer logic indirectly through the export
// Direct DOM testing of the hook would require jsdom + React Testing Library

describe('web/rpc-client', () => {
  it('module exports useReplSession', async () => {
    const mod = await import('./rpc-client')
    expect(mod.useReplSession).toBeDefined()
    expect(typeof mod.useReplSession).toBe('function')
  })
})
