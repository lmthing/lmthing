import { createRootRoute, Outlet, useRouter, useRouterState } from '@tanstack/react-router'
import { AppProvider } from '@lmthing/state'
import { AuthProvider, useAuth, useRepoSync } from '@lmthing/auth'
import { ComputerProvider, useComputer } from '@/lib/runtime/ComputerContext'
import { useTierDetection } from '@/lib/runtime/use-tier-detection'
import { ComputerLayout } from '@lmthing/ui/components/computer/computer-layout'
import { LoginScreen } from '@lmthing/ui/components/auth/login-screen'
import { PinGate } from '@lmthing/ui/components/auth/pin-gate'
import { useCallback } from 'react'
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

  // IDE route gets full-screen layout (no sidebar)
  if (currentPath === '/') {
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

function TierAwareProvider({ children }: { children: React.ReactNode }) {
  const { tier, flyioConfig } = useTierDetection()
  return (
    <ComputerProvider tier={tier} flyioConfig={flyioConfig}>
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
