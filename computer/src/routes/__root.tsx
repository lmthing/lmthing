import { createRootRoute, Outlet, useRouter, useRouterState } from '@tanstack/react-router'
import { AppProvider } from '@lmthing/state'
import { AuthProvider, useAuth } from '@/lib/auth/AuthContext'
import { ComputerProvider, useComputer } from '@/lib/runtime/ComputerContext'
import { useTierDetection } from '@/lib/runtime/use-tier-detection'
import { ComputerLayout } from '@lmthing/ui/components/computer/computer-layout'
import { LoginScreen } from '@lmthing/ui/components/auth/login-screen'
import '@/index.css'

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  if (!isAuthenticated) return <LoginScreen />
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
      <AuthProvider>
        <AuthGate>
          <TierAwareProvider>
            <ComputerShell />
          </TierAwareProvider>
        </AuthGate>
      </AuthProvider>
    </AppProvider>
  )
}

export const Route = createRootRoute({
  component: RootComponent,
})
