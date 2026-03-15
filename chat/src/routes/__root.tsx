import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AuthProvider, useAuth, useRepoSync } from '@lmthing/auth'
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

function RootComponent() {
  return (
    <AuthProvider appName="chat">
      <AuthGate>
        <PinGate>
          <RepoSyncGate>
            <Outlet />
          </RepoSyncGate>
        </PinGate>
      </AuthGate>
    </AuthProvider>
  )
}

export const Route = createRootRoute({
  component: RootComponent,
})
