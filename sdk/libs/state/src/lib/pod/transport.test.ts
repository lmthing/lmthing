// src/lib/pod/transport.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PodTransport, isRunnableSpaceFile } from './transport'
import type { FileTree } from '../../types/project'

/**
 * Minimal fetch mock that records calls and returns canned JSON keyed by
 * `${method} ${url}`. Body is parsed for assertions.
 */
function mockFetch() {
  const calls: Array<{ url: string; method: string; body?: unknown; headers?: Record<string, string> }> = []
  const handlers = new Map<string, (body?: unknown) => { status: number; json: unknown }>()

  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase()
    let body: unknown
    if (init?.body) {
      try {
        body = JSON.parse(init.body as string)
      } catch {
        body = init.body
      }
    }
    calls.push({
      url,
      method,
      body,
      headers: (init?.headers as Record<string, string>) ?? {},
    })
    const key = `${method} ${url}`
    const handler = handlers.get(key)
    if (!handler) return new Response(JSON.stringify({ error: 'no handler' }), { status: 404 })
    const { status, json } = handler(body)
    return new Response(JSON.stringify(json), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  })

  function setHandler(method: string, url: string, fn: (body?: unknown) => { status: number; json: unknown }) {
    handlers.set(`${method.toUpperCase()} ${url}`, fn)
  }

  return { fetchImpl, calls, setHandler }
}

describe('PodTransport', () => {
  let mock: ReturnType<typeof mockFetch>
  const BASE = 'https://pod.test'

  beforeEach(() => {
    mock = mockFetch()
    vi.stubGlobal('fetch', mock.fetchImpl)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function makeTransport(token = 'tkn') {
    return new PodTransport({ baseUrl: BASE, getAccessToken: () => token })
  }

  it('listProjects parses { projects }', async () => {
    const projects = [{ id: 'user', name: 'Personal', createdAt: 1 }]
    mock.setHandler('GET', `${BASE}/api/projects`, () => ({ status: 200, json: { projects } }))

    const t = makeTransport()
    const result = await t.listProjects()

    expect(result).toEqual(projects)
    expect(mock.calls[0]?.method).toBe('GET')
    expect(mock.calls[0]?.headers?.authorization).toBe('Bearer tkn')
  })

  it('createProject POSTs { name } and returns { id }', async () => {
    mock.setHandler('POST', `${BASE}/api/projects`, (body) => ({
      status: 201,
      json: { id: (body as { name: string }).name },
    }))

    const t = makeTransport()
    const result = await t.createProject('My Proj')

    expect(result).toEqual({ id: 'My Proj' })
    expect(mock.calls[0]?.body).toEqual({ name: 'My Proj' })
  })

  it('deleteProject DELETEs and resolves on 204', async () => {
    // 204 returns no body; the handler returns empty json with status 204.
    mock.setHandler('DELETE', `${BASE}/api/projects/user`, () => ({ status: 204, json: {} }))

    const t = makeTransport()
    await expect(t.deleteProject('user')).resolves.toBeUndefined()
    expect(mock.calls[0]?.method).toBe('DELETE')
  })

  it('listSpaces parses { spaces }', async () => {
    const spaces = [{ id: 's1', name: 'Space 1' }]
    mock.setHandler('GET', `${BASE}/api/projects/user/spaces`, () => ({
      status: 200,
      json: { spaces },
    }))

    const t = makeTransport()
    const result = await t.listSpaces('user')

    expect(result).toEqual(spaces)
  })

  it('loadSpaceFiles parses { files } and strips runtime files', async () => {
    const files: FileTree = {
      'package.json': '{}',
      'agents/bot/instruct.md': 'hi',
      'agents/bot/conversations/c1.json': '{}',
      '.env': 'SECRET=1',
    }
    mock.setHandler(
      'GET',
      `${BASE}/api/projects/user/spaces/s1/files`,
      () => ({ status: 200, json: { files } }),
    )

    const t = makeTransport()
    const result = await t.loadSpaceFiles('user', 's1')

    expect(result['package.json']).toBe('{}')
    expect(result['agents/bot/instruct.md']).toBe('hi')
    // conversations/ and .env filtered out defensively.
    expect(result['agents/bot/conversations/c1.json']).toBeUndefined()
    expect(result['.env']).toBeUndefined()
  })

  it('saveSpaceFiles PUTs filtered { files }', async () => {
    let captured: { files?: FileTree } = {}
    mock.setHandler('PUT', `${BASE}/api/projects/user/spaces/s1/files`, (body) => {
      captured = body as { files?: FileTree }
      return { status: 200, json: { ok: true } }
    })

    const t = makeTransport()
    await t.saveSpaceFiles('user', 's1', {
      'package.json': '{}',
      'agents/bot/conversations/c.json': 'x',
      '.env': 'y',
    })

    expect(mock.calls[0]?.method).toBe('PUT')
    expect(captured.files).toEqual({ 'package.json': '{}' })
  })

  it('throws with status + url on non-ok response', async () => {
    mock.setHandler('GET', `${BASE}/api/projects`, () => ({
      status: 503,
      json: { error: 'pod down' },
    }))

    const t = makeTransport()
    await expect(t.listProjects()).rejects.toThrow(/503/)
  })

  it('omits Authorization when getAccessToken returns null', async () => {
    mock.setHandler('GET', `${BASE}/api/projects`, () => ({ status: 200, json: { projects: [] } }))

    const t = new PodTransport({ baseUrl: BASE, getAccessToken: () => null })
    await t.listProjects()

    expect(mock.calls[0]?.headers?.authorization).toBeUndefined()
  })
})

describe('isRunnableSpaceFile', () => {
  it('excludes conversations/ paths', () => {
    expect(isRunnableSpaceFile('agents/bot/conversations/c1.json')).toBe(false)
  })

  it('excludes .env files', () => {
    expect(isRunnableSpaceFile('.env')).toBe(false)
    expect(isRunnableSpaceFile('.env.local')).toBe(false)
  })

  it('includes normal files', () => {
    expect(isRunnableSpaceFile('package.json')).toBe(true)
    expect(isRunnableSpaceFile('agents/bot/instruct.md')).toBe(true)
  })
})
