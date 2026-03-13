import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useComputer } from '@/lib/runtime/ComputerContext'
import { Terminal } from '@lmthing/ui/elements/content/terminal'
import type { TerminalSession } from '@/lib/runtime/types'

export const Route = createFileRoute('/terminal')({
  component: TerminalRoute,
})

function TerminalRoute() {
  const { createTerminalSession, status } = useComputer()
  const [session, setSession] = useState<TerminalSession | null>(null)

  useEffect(() => {
    if (status !== 'running') return

    let disposed = false
    let currentSession: TerminalSession | null = null

    createTerminalSession().then((s) => {
      if (disposed) {
        s.dispose()
        return
      }
      currentSession = s
      setSession(s)
    })

    return () => {
      disposed = true
      if (currentSession) {
        currentSession.dispose()
        setSession(null)
      }
    }
  }, [status, createTerminalSession])

  return <Terminal session={session} />
}
