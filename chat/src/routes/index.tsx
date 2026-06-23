import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@lmthing/auth'

// Gateway origin — must match @lmthing/auth's cloudUrl (prod: lmthing.cloud).
const CLOUD_BASE_URL =
  import.meta.env.VITE_CLOUD_URL ??
  (import.meta.env.DEV ? 'https://cloud.test' : 'https://lmthing.cloud')

/** Ensure the user's compute pod is running before redirecting. */
async function ensurePod(cloudBaseUrl: string, accessToken: string): Promise<void> {
  const res = await fetch(`${cloudBaseUrl}/api/compute/ensure`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(`compute/ensure failed: ${res.status}`)
  }
}

export const Route = createFileRoute('/')({
  component: ChatHome,
})

function ChatHome() {
  const { session } = useAuth()
  const [podError, setPodError] = useState<string | null>(null)
  const initRef = useRef(false)

  useEffect(() => {
    // Guard: if access_token is already in the URL this page is being served by
    // the pod itself (or we already redirected) — do not redirect again.
    if (new URLSearchParams(window.location.search).has('access_token')) return

    if (!session?.accessToken || initRef.current) return
    initRef.current = true

    async function init() {
      try {
        await ensurePod(CLOUD_BASE_URL, session!.accessToken)
        window.location.replace('/?access_token=' + encodeURIComponent(session!.accessToken))
      } catch (err) {
        setPodError(err instanceof Error ? err.message : String(err))
      }
    }

    void init()
  }, [session])

  const handleRetry = () => {
    initRef.current = false
    setPodError(null)
  }

  if (!session) {
    return <div style={styles.center}>Signing in…</div>
  }

  if (podError) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#c00' }}>Failed to start compute pod: {podError}</p>
        <button onClick={handleRetry}>Retry</button>
      </div>
    )
  }

  return <div style={styles.center}>Starting…</div>
}

const styles = {
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    color: '#6b7280',
    flexDirection: 'column' as const,
    gap: 12,
  } as React.CSSProperties,
}
