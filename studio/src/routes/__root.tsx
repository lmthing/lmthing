import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AppProvider } from '@/lib/contexts/AppContext'
import { AuthProvider, useAuth } from '@lmthing/auth'
import { LoginScreen } from '@lmthing/ui/components/auth/login-screen'
import { SystemStudioBootstrap } from '@lmthing/ui/components/auth/system-studio-bootstrap'
import { GithubProvider } from '@/lib/github/GithubContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@/index.css'

const queryClient = new QueryClient()

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  if (!isAuthenticated) return <LoginScreen />
  return <>{children}</>
}

function RootComponent() {
  return (
    <AppProvider>
      <AuthProvider appName="studio">
        <QueryClientProvider client={queryClient}>
          <AuthGate>
            <GithubProvider>
              <SystemStudioBootstrap>
                <Outlet />
              </SystemStudioBootstrap>
            </GithubProvider>
          </AuthGate>
        </QueryClientProvider>
      </AuthProvider>
    </AppProvider>
  )
}

export const Route = createRootRoute({
  component: RootComponent,
})
