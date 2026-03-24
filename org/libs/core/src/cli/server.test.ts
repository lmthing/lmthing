import { describe, it, expect, afterEach } from 'vitest'
import { createReplServer } from './server'
import { Session } from '../session/session'

describe('cli/server', () => {
  let cleanup: (() => void) | null = null

  afterEach(() => {
    cleanup?.()
    cleanup = null
  })

  it('creates and starts a server', async () => {
    const session = new Session()
    const { server, close } = createReplServer({
      port: 0, // random port
      session,
    })
    cleanup = () => { close(); session.destroy() }

    // Wait for server to be listening
    await new Promise<void>(resolve => {
      if (server.listening) resolve()
      else server.on('listening', resolve)
    })

    const addr = server.address()
    expect(addr).not.toBeNull()
    expect(typeof addr === 'object' && addr?.port).toBeTruthy()
  })

  it('serves a default page without staticDir', async () => {
    const session = new Session()
    const { server, close } = createReplServer({
      port: 0,
      session,
    })
    cleanup = () => { close(); session.destroy() }

    await new Promise<void>(resolve => {
      if (server.listening) resolve()
      else server.on('listening', resolve)
    })

    const addr = server.address() as { port: number }
    const response = await fetch(`http://localhost:${addr.port}`)
    const text = await response.text()
    expect(text).toContain('@lmthing/repl')
  })
})
