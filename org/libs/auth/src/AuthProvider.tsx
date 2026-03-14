import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { AuthSession, AuthConfig } from './types'
import { getSession, clearSession, redirectToLogin, handleAuthCallback } from './client'

interface AuthContextValue {
  session: AuthSession | null
  loading: boolean
  login: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  config: AuthConfig
  children: React.ReactNode
}

export function AuthProvider({ config, children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for SSO callback
    const url = new URL(window.location.href)
    if (url.searchParams.has('code')) {
      handleAuthCallback(config)
        .then(sess => {
          if (sess) setSession(sess)
          // Clean up URL
          url.searchParams.delete('code')
          url.searchParams.delete('state')
          window.history.replaceState({}, '', url.pathname)
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    } else {
      setSession(getSession())
      setLoading(false)
    }
  }, [config])

  const login = useCallback(() => {
    redirectToLogin(config)
  }, [config])

  const logout = useCallback(() => {
    clearSession()
    setSession(null)
  }, [])

  return (
    <AuthContext.Provider value={{ session, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
