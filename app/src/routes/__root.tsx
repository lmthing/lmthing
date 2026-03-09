import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AppProvider } from '@/lib/contexts/AppContext'
import { AuthProvider } from '@/lib/auth'
import { useAuth } from '@/lib/auth/useAuth'
import { LoginScreen } from '@/components/auth/login-screen'
import { SystemStudioBootstrap } from '@/components/auth/system-studio-bootstrap'
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
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <GithubProvider>
            <AuthGate>
              <SystemStudioBootstrap>
                <Outlet />
              </SystemStudioBootstrap>
            </AuthGate>
          </GithubProvider>
        </QueryClientProvider>
      </AuthProvider>
    </AppProvider>
  )
}

export const Route = createRootRoute({
  component: RootComponent,
})
