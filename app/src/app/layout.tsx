'use client'

import { AppProvider } from '@/lib/contexts/AppContext'
import { AuthProvider } from '@/lib/auth'
import { useAuth } from '@/lib/auth/useAuth'
import { LoginScreen } from '@/components/auth/login-screen'
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Nunito:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppProvider>
          <AuthProvider>
            <QueryClientProvider client={queryClient}>
              <GithubProvider>
                <AuthGate>
                  {children}
                </AuthGate>
              </GithubProvider>
            </QueryClientProvider>
          </AuthProvider>
        </AppProvider>
      </body>
    </html>
  )
}
