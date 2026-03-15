import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AppProvider } from '@/lib/contexts/AppContext'
import { AuthProvider, useAuth, useRepoSync } from '@lmthing/auth'
import { LoginScreen } from '@lmthing/ui/components/auth/login-screen'
import { PinGate } from '@lmthing/ui/components/auth/pin-gate'
import { SystemStudioBootstrap } from '@lmthing/ui/components/auth/system-studio-bootstrap'
import { GithubProvider, useGithub } from '@/lib/github/GithubContext'
import { useApp } from '@lmthing/state'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCallback } from 'react'
import '@/index.css'

const queryClient = new QueryClient()

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  if (!isAuthenticated) return <LoginScreen />
  return <>{children}</>
}

function RepoSyncGate({ children }: { children: React.ReactNode }) {
  const { session, isAuthenticated } = useAuth()
  const { octokit, isAuthenticated: isGithubAuthed } = useGithub()

  // Get the GitHub token from localStorage (set by GithubContext)
  const githubToken = typeof window !== 'undefined' ? localStorage.getItem('github_token') : null

  const onFilesLoaded = useCallback((files: Record<string, string>) => {
    // Files from the repo are loaded — they'll be imported via SystemStudioBootstrap
    // or directly into the VFS via AppProvider
    console.log(`[RepoSync] Loaded ${Object.keys(files).length} files from GitHub repo`)
  }, [])

  useRepoSync({
    session,
    isAuthenticated,
    githubToken: isGithubAuthed ? githubToken : null,
    onFilesLoaded,
  })

  return <>{children}</>
}

function RootComponent() {
  return (
    <AppProvider>
      <AuthProvider appName="studio">
        <QueryClientProvider client={queryClient}>
          <AuthGate>
            <PinGate>
              <GithubProvider>
                <RepoSyncGate>
                  <SystemStudioBootstrap>
                    <Outlet />
                  </SystemStudioBootstrap>
                </RepoSyncGate>
              </GithubProvider>
            </PinGate>
          </AuthGate>
        </QueryClientProvider>
      </AuthProvider>
    </AppProvider>
  )
}

export const Route = createRootRoute({
  component: RootComponent,
})
