import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@lmthing/ui/elements/content/terminal'
import type { TerminalSession } from '@lmthing/ui/elements/content/terminal'
import { getAuthHeaders } from '@lmthing/auth'
import { useSpace } from '@/lib/SpaceContext'

const CLOUD_URL = import.meta.env.VITE_CLOUD_URL
  || (import.meta.env.DEV ? `${window.location.protocol}//cloud.test/functions/v1` : 'https://lmthing.cloud/functions/v1')

export const Route = createFileRoute('/$spaceSlug/admin/terminal')({
  component: SpaceTerminal,
})

function createSpaceTerminalSession(spaceId: string, ws: WebSocket): TerminalSession {
  const dataListeners = new Set<(data: string) => void>()

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string)
      if (msg.type === 'terminal.data') {
        for (const cb of dataListeners) cb(msg.data)
      }
    } catch {
      for (const cb of dataListeners) cb(event.data as string)
    }
  }

  return {
    id: `space-terminal-${spaceId}`,
    write(data: string) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'terminal.input', data }))
      }
    },
    onData(cb: (data: string) => void) {
      dataListeners.add(cb)
      return () => { dataListeners.delete(cb) }
    },
    resize(cols: number, rows: number) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'terminal.resize', cols, rows }))
      }
    },
    dispose() {
      dataListeners.clear()
      ws.close(1000, 'dispose')
    },
  }
}

function SpaceTerminal() {
  const { space } = useSpace()
  const [session, setSession] = useState<TerminalSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const headers = getAuthHeaders()
    if (!headers.Authorization) {
      setError('Not authenticated.')
      return
    }

    let disposed = false

    fetch(`${CLOUD_URL}/issue-space-token`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ spaceId: space.id }),
    })
      .then(async (res) => {
        if (disposed) return
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: { message: 'Failed to get token' } }))
          setError(data.error?.message || 'Failed to authenticate for terminal access.')
          return
        }
        const { token, appHost } = await res.json()
        if (disposed || !appHost) {
          if (!appHost && !disposed) setError('Space has no running node.')
          return
        }

        const ws = new WebSocket(`wss://${appHost}/ws?token=${encodeURIComponent(token)}&spaceId=${encodeURIComponent(space.id)}`)
        wsRef.current = ws

        ws.onopen = () => {
          if (disposed) { ws.close(); return }
          setSession(createSpaceTerminalSession(space.id, ws))
        }

        ws.onerror = () => {
          if (!disposed) setError('Terminal connection failed.')
        }

        ws.onclose = () => {
          if (!disposed) setSession(null)
        }
      })
      .catch(() => {
        if (!disposed) setError('Failed to connect to terminal.')
      })

    return () => {
      disposed = true
      if (wsRef.current) {
        wsRef.current.close(1000, 'cleanup')
        wsRef.current = null
      }
      setSession(null)
    }
  }, [space.id])

  if (error) {
    return (
      <div className="p-8">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  return <Terminal session={session} />
}
