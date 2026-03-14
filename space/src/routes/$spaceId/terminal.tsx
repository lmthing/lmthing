import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@lmthing/ui/elements/content/terminal'
import type { TerminalSession } from '@lmthing/ui/elements/content/terminal'

const CLOUD_BASE_URL = import.meta.env.VITE_CLOUD_BASE_URL ?? 'https://cloud.lmthing.org'
const CLOUD_AUTH_KEY = 'lmthing-cloud-auth'

export const Route = createFileRoute('/$spaceId/terminal')({
  component: SpaceTerminal,
})

function getAuthHeader(): string | null {
  try {
    const raw = localStorage.getItem(CLOUD_AUTH_KEY)
    if (!raw) return null
    const { accessToken } = JSON.parse(raw)
    return accessToken ? `Bearer ${accessToken}` : null
  } catch {
    return null
  }
}

function createSpaceTerminalSession(spaceId: string, ws: WebSocket): TerminalSession {
  const dataListeners = new Set<(data: string) => void>()

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string)
      if (msg.type === 'terminal.data') {
        for (const cb of dataListeners) cb(msg.data)
      }
    } catch {
      // Raw data fallback
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
  const { spaceId } = Route.useParams()
  const [session, setSession] = useState<TerminalSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const authHeader = getAuthHeader()
    if (!authHeader) {
      setError('Not authenticated. Please log in to access the terminal.')
      return
    }

    let disposed = false

    // Fetch the space's host, then connect via WebSocket
    fetch(`${CLOUD_BASE_URL}/functions/v1/issue-computer-token`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ spaceId }),
    })
      .then(async (res) => {
        if (disposed) return
        if (!res.ok) {
          setError('Failed to authenticate for terminal access.')
          return
        }
        const { token, appHost } = await res.json()
        if (disposed || !appHost) return

        const ws = new WebSocket(`wss://${appHost}/ws?token=${encodeURIComponent(token)}&spaceId=${encodeURIComponent(spaceId)}`)
        wsRef.current = ws

        ws.onopen = () => {
          if (disposed) {
            ws.close()
            return
          }
          const termSession = createSpaceTerminalSession(spaceId, ws)
          setSession(termSession)
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
  }, [spaceId])

  if (error) {
    return (
      <div className="p-8">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  return <Terminal session={session} />
}
