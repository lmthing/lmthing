import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fetchModule from './fetch'

describe('catalog/fetch', () => {
  const fns = Object.fromEntries(fetchModule.functions.map(f => [f.name, f.fn]))
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('httpGet auto-parses JSON', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ data: 42 }),
    }) as any

    const result = await fns.httpGet('https://api.example.com/data')
    expect(result).toEqual({ data: 42 })
  })

  it('httpGet returns text for non-JSON', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      headers: new Headers({ 'content-type': 'text/plain' }),
      text: () => Promise.resolve('hello'),
    }) as any

    const result = await fns.httpGet('https://example.com')
    expect(result).toBe('hello')
  })

  it('httpPost sends JSON body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ ok: true }),
    }) as any

    await fns.httpPost('https://api.example.com/create', { name: 'test' })
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.example.com/create',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
      }),
    )
  })

  it('httpRequest provides full control', async () => {
    const mockHeaders = new Headers({ 'content-type': 'application/json', 'x-custom': 'val' })
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 201,
      headers: mockHeaders,
      json: () => Promise.resolve({ id: 1 }),
    }) as any

    const result = await fns.httpRequest({ url: 'https://api.example.com', method: 'POST' }) as any
    expect(result.status).toBe(201)
    expect(result.body).toEqual({ id: 1 })
  })
})
