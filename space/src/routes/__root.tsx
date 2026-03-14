import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AppProvider } from '@lmthing/state'
import { AuthProvider, useAuth } from '@lmthing/auth'
import { LoginScreen } from '@lmthing/ui/components/auth/login-screen'
import '@/index.css'

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  if (!isAuthenticated) return <LoginScreen />
  return <>{children}</>
}

function RootComponent() {
  return (
    <AppProvider>
      <AuthProvider appName="space">
        <AuthGate>
          <Outlet />
        </AuthGate>
      </AuthProvider>
    </AppProvider>
  )
}

export const Route = createRootRoute({
  component: RootComponent,
})
