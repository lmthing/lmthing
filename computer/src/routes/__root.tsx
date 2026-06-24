import { createRootRoute, Outlet, useRouter, useRouterState } from '@tanstack/react-router'
import { AppProvider, ProjectProvider, SpaceProvider } from '@lmthing/state'
import { AuthProvider, useAuth, useRepoSync } from '@lmthing/auth'
import { ComputerProvider, useComputer } from '@/lib/runtime/ComputerContext'
import { ComputerLayout } from '@lmthing/ui/components/computer/computer-layout'
import { LoginScreen } from '@lmthing/ui/components/auth/login-screen'
import { PinGate } from '@lmthing/ui/components/auth/pin-gate'
import { useCallback, useEffect, useState, useRef } from 'react'
import '@/index.css'

const CLOUD_BASE_URL =
  import.meta.env.VITE_CLOUD_URL ??
  (import.meta.env.DEV ? 'https://cloud.test' : 'https://lmthing.cloud')

const COMPUTER_BASE_URL =
  import.meta.env.VITE_COMPUTER_BASE_URL ??
  (import.meta.env.DEV ? 'https://computer.test' : window.location.origin)

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  if (!isAuthenticated) return <LoginScreen />
  return <>{children}</>
}

function RepoSyncGate({ children }: { children: React.ReactNode }) {
  const { session, isAuthenticated } = useAuth()
  const githubToken = typeof window !== 'undefined' ? localStorage.getItem('github_token') : null

  const onFilesLoaded = useCallback((files: Record<string, string>) => {
    console.log(`[RepoSync] Loaded ${Object.keys(files).length} files from GitHub repo`)
  }, [])

  useRepoSync({
    session,
    isAuthenticated,
    githubToken,
    onFilesLoaded,
  })

  return <>{children}</>
}

function ComputerShell() {
  const { status, error, boot } = useComputer()
  const { session } = useAuth()
  const router = useRouter()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const [restarting, setRestarting] = useState(false)

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type !== 'lmthing:navigate' || !e.data.path) return
      router.navigate({ to: e.data.path })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [router])

  const handleRestart = async () => {
    if (!session?.accessToken) return
    setRestarting(true)
    try {
      await fetch(`${COMPUTER_BASE_URL}/api/restart`, {
        method: 'POST',
        headers: { authorization: `Bearer ${session.accessToken}` },
      })
    } catch { /* expected — pod exits */ }
    const poll = async () => {
      try {
        const r = await fetch(`${COMPUTER_BASE_URL}/api/env`, {
          headers: { authorization: `Bearer ${session.accessToken}` },
        })
        if (r.ok) { window.location.reload(); return; }
      } catch { /* still down */ }
      setTimeout(poll, 800)
    }
    setTimeout(poll, 1000)
  }

  // IDE gets full-screen layout (no sidebar)
  if (currentPath === '/') {
    return <Outlet />
  }

  return (
    <ComputerLayout
      status={status}
      tier="flyio"
      currentPath={currentPath}
      onNavigate={(path) => router.navigate({ to: path })}
      error={error}
      onRetry={boot}
      onRestart={() => { void handleRestart() }}
      restarting={restarting}
    >
      <Outlet />
    </ComputerLayout>
  )
}

async function ensurePod(cloudBaseUrl: string, accessToken: string): Promise<void> {
  const res = await fetch(`${cloudBaseUrl}/api/compute/ensure`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(`compute/ensure failed: ${res.status}`)
  }
}

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
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f', color: '#666' }}>Signing in…</div>
  }

  if (status === 'error') {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f', color: '#666', flexDirection: 'column', gap: 12 }}>
        <p style={{ color: '#c00' }}>Failed to start compute pod: {error}</p>
        <button onClick={handleRetry}>Retry</button>
      </div>
    )
  }

  if (status === 'pending') {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f', color: '#666' }}>Starting compute pod…</div>
  }

  return (
    <ComputerProvider computerBaseUrl={COMPUTER_BASE_URL} accessToken={session.accessToken}>
      <AppProvider
        pod={{
          podBaseUrl: COMPUTER_BASE_URL,
          getAccessToken: () => session.accessToken,
        }}
      >
        <ProjectProvider projectId="user">
          <SpaceProvider spaceId="default">
            {children}
          </SpaceProvider>
        </ProjectProvider>
      </AppProvider>
    </ComputerProvider>
  )
}

function RootComponent() {
  return (
    <AuthProvider appName="computer">
      <AuthGate>
        <PinGate>
          <RepoSyncGate>
            <PodEnsureGate>
              <ComputerShell />
            </PodEnsureGate>
          </RepoSyncGate>
        </PinGate>
      </AuthGate>
    </AuthProvider>
  )
}

export const Route = createRootRoute({
  component: RootComponent,
})
