import { createRootRoute, Outlet, useRouter, useRouterState } from '@tanstack/react-router'
import { AppProvider } from '@lmthing/state'
import { AuthProvider, useAuth, useRepoSync } from '@lmthing/auth'
import { ComputerProvider, useComputer } from '@/lib/runtime/ComputerContext'
import { ReplRelay } from '@/lib/runtime/ReplRelay'
import { FsRelay } from '@/lib/runtime/FsRelay'
import { useTierDetection } from '@/lib/runtime/use-tier-detection'
import { ComputerLayout } from '@lmthing/ui/components/computer/computer-layout'
import { LoginScreen } from '@lmthing/ui/components/auth/login-screen'
import { PinGate } from '@lmthing/ui/components/auth/pin-gate'
import { useCallback, useEffect } from 'react'
import '@/index.css'

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
  const { status, tier, error, boot } = useComputer()
  const router = useRouter()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type !== 'lmthing:navigate' || !e.data.path) return
      router.navigate({ to: e.data.path })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [router])

  // IDE and chat routes get full-screen layout (no sidebar)
  if (currentPath === '/' || currentPath === '/chat') {
    return <Outlet />
  }

  return (
    <ComputerLayout
      status={status}
      tier={tier}
      currentPath={currentPath}
      onNavigate={(path) => router.navigate({ to: path })}
      error={error}
      onRetry={boot}
    >
      <Outlet />
    </ComputerLayout>
  )
}

function IdeInitializer() {
  const { status, container, initIDE, tier } = useComputer()
  useEffect(() => {
    if (tier === 'webcontainer' && status === 'running' && container) {
      initIDE()
    }
  }, [status, container, initIDE, tier])
  return null
}

function TierAwareProvider({ children }: { children: React.ReactNode }) {
  const { tier, podConfig } = useTierDetection()
  return (
    <ComputerProvider tier={tier} podConfig={podConfig}>
      <IdeInitializer />
      <ReplRelay />
      <FsRelay />
      {children}
    </ComputerProvider>
  )
}

function RootComponent() {
  return (
    <AppProvider>
      <AuthProvider appName="computer">
        <AuthGate>
          <PinGate>
            <RepoSyncGate>
              <TierAwareProvider>
                <ComputerShell />
              </TierAwareProvider>
            </RepoSyncGate>
          </PinGate>
        </AuthGate>
      </AuthProvider>
    </AppProvider>
  )
}

export const Route = createRootRoute({
  component: RootComponent,
})
