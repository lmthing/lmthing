import { describe, it, expect, vi } from 'vitest'
import { ReplSessionServer } from './server'
import { Session } from '@lmthing/repl'
import type { SessionEvent } from '@lmthing/repl'

describe('rpc/server', () => {
  it('delegates sendMessage to session', async () => {
    const session = new Session()
    const server = new ReplSessionServer(session)
    await server.sendMessage('hello')
    expect(session.getStatus()).toBe('executing')
    session.destroy()
  })

  it('delegates pause/resume', async () => {
    const session = new Session()
    const server = new ReplSessionServer(session)
    await server.pause()
    expect(session.getStatus()).toBe('paused')
    await server.resume()
    expect(session.getStatus()).toBe('executing')
    session.destroy()
  })

  it('getSnapshot returns session snapshot', async () => {
    const session = new Session()
    const server = new ReplSessionServer(session)
    const snap = await server.getSnapshot()
    expect(snap.status).toBe('idle')
    session.destroy()
  })

  it('subscribe yields session events', async () => {
    const session = new Session()
    const server = new ReplSessionServer(session)
    const events: SessionEvent[] = []

    // Start subscribing in background
    const iter = server.subscribe()[Symbol.asyncIterator]()
    const nextPromise = iter.next()

    // Trigger an event
    await server.pause()

    const result = await nextPromise
    expect(result.done).toBe(false)
    expect(result.value).toBeDefined()

    session.destroy()
  })

  it('delegates cancelTask', async () => {
    const session = new Session()
    const server = new ReplSessionServer(session)
    const events: SessionEvent[] = []
    session.on('event', (e: SessionEvent) => events.push(e))

    await server.cancelTask('async_0')
    expect(events.some(e => e.type === 'async_cancelled')).toBe(true)
    session.destroy()
  })
})
