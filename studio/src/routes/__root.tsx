import { createRootRoute, Outlet } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { AuthProvider, useAuth } from '@lmthing/auth'
import { LoginScreen } from '@lmthing/ui/components/auth/login-screen'
import { PinGate } from '@lmthing/ui/components/auth/pin-gate'
import { AppProvider } from '@lmthing/state'
import '@/index.css'

// Gateway origin — must match @lmthing/auth's cloudUrl (prod: lmthing.cloud).
const CLOUD_BASE_URL =
  import.meta.env.VITE_CLOUD_URL ??
  (import.meta.env.DEV ? 'https://cloud.test' : 'https://lmthing.cloud')

// Compute pod REST API origin. Studio keeps the JWT and calls the pod API
// directly (unlike chat, it does NOT full-route to the pod's served UI).
const COMPUTER_BASE_URL =
  import.meta.env.VITE_COMPUTER_BASE_URL ??
  (import.meta.env.DEV ? 'https://computer.test' : window.location.origin)

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  if (!isAuthenticated) return <LoginScreen />
  return <>{children}</>
}

/** Ensure the user's compute pod is running before any pod API call. */
async function ensurePod(cloudBaseUrl: string, accessToken: string): Promise<void> {
  const res = await fetch(`${cloudBaseUrl}/api/compute/ensure`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(`compute/ensure failed: ${res.status}`)
  }
}

/**
 * PodEnsureGate — replicates chat's `ensurePod` bootstrap semantics, but as a
 * gate (studio is the UI; it never redirects to the pod). On an authenticated
 * session it POSTs {CLOUD_BASE_URL}/api/compute/ensure (Bearer JWT), renders a
 * "Starting compute pod…" state + Retry on failure, and only renders children
 * once ensure resolves.
 */
function PodEnsureGate({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  const [status, setStatus] = useState<'pending' | 'ready' | 'error'>('pending')
  const [error, setError] = useState<string | null>(null)
  const initRef = useRef(false)

  useEffect(() => {
    if (!session?.accessToken || initRef.current) return
    initRef.current = true

    let cancelled = false
    async function init() {
      try {
        await ensurePod(CLOUD_BASE_URL, session!.accessToken)
        if (!cancelled) setStatus('ready')
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setStatus('error')
        }
      }
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [session])

  const handleRetry = () => {
    initRef.current = false
    setError(null)
    setStatus('pending')
  }

  if (!session) {
    return <div style={styles.center}>Signing in…</div>
  }

  if (status === 'error') {
    return (
      <div style={styles.center}>
        <p style={{ color: '#c00' }}>Failed to start compute pod: {error}</p>
        <button onClick={handleRetry}>Retry</button>
      </div>
    )
  }

  if (status === 'pending') {
    return <div style={styles.center}>Starting compute pod…</div>
  }

  return <>{children}</>
}

/** Inner component — lives inside AuthProvider so useAuth() is safe here. */
function AuthenticatedApp() {
  const { session } = useAuth()

  return (
    <AuthGate>
      <PinGate>
        <PodEnsureGate>
          <AppProvider
            pod={{
              podBaseUrl: COMPUTER_BASE_URL,
              getAccessToken: () => session?.accessToken,
            }}
          >
            <Outlet />
          </AppProvider>
        </PodEnsureGate>
      </PinGate>
    </AuthGate>
  )
}

function RootComponent() {
  return (
    <AuthProvider appName="studio">
      <AuthenticatedApp />
    </AuthProvider>
  )
}

export const Route = createRootRoute({
  component: RootComponent,
})

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
