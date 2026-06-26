import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react'
import type { AuthSession, AuthConfig, AuthContextValue } from './types'
import { getSession, clearSession, storeSession, redirectToLogin, handleAuthCallback, refreshSession, ensureValidToken, authFetch, isSessionExpired, onSessionChange, isPinSet, verifyPin, derivePinKey } from './client'

const AuthContext = createContext<AuthContextValue | null>(null)

function resolveConfig(appName: string, callbackPath: string): AuthConfig {
  const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:'

  return {
    comUrl: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_COM_URL)
      || (isDev ? `${protocol}//com.test` : 'https://lmthing.com'),
    cloudUrl: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUD_URL)
      || (isDev ? `${protocol}//cloud.test` : 'https://lmthing.cloud'),
    appName,
    callbackPath,
  }
}

interface AuthProviderProps {
  appName: string
  callbackPath?: string
  children: React.ReactNode
}

const DEMO_SESSION: AuthSession = {
  accessToken: 'demo',
  userId: 'demo-user',
  email: 'demo@lmthing.local',
  githubRepo: null,
  githubUsername: null,
}

export function AuthProvider({ appName, callbackPath = '/', children }: AuthProviderProps) {
  const config = useMemo(() => resolveConfig(appName, callbackPath), [appName, callbackPath])
  const isDemo = typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEMO_USER === 'true'
  const [session, setSession] = useState<AuthSession | null>(isDemo ? DEMO_SESSION : null)
  const [isLoading, setIsLoading] = useState(!isDemo)
  const [pinUnlocked, setPinUnlocked] = useState(false)
  const pinKeyRef = useRef<CryptoKey | null>(null)

  // Accept session injected by a parent frame (e.g. lmthing.chat → lmthing.computer iframe)
  useEffect(() => {
    if (isDemo) return
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'lmthing:session' && e.data.session) {
        storeSession(e.data.session)
        setSession(e.data.session)
        setIsLoading(false)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [isDemo])

  useEffect(() => {
    if (isDemo) return
    const url = new URL(window.location.href)
    if (url.searchParams.has('code')) {
      handleAuthCallback(config)
        .then(sess => {
          if (sess) setSession(sess)
        })
        .catch(console.error)
        .finally(() => {
          url.searchParams.delete('code')
          url.searchParams.delete('state')
          window.history.replaceState({}, '', url.pathname)
          setIsLoading(false)
        })
    } else {
      // Cold reload: if the access token is already expired but we still have a
      // refresh token, rotate it BEFORE unblocking the UI. Otherwise the app's
      // first requests fly out with a stale token and 401 before the proactive
      // timer runs — the exact "stuck on 401" state we're fixing.
      const existing = getSession()
      if (existing && isSessionExpired(existing) && existing.refreshToken) {
        refreshSession(config)
          .then(refreshed => {
            if (refreshed) {
              setSession(refreshed)
            } else {
              clearSession()
              setSession(null)
            }
          })
          .catch(() => {
            clearSession()
            setSession(null)
          })
          .finally(() => setIsLoading(false))
      } else {
        setSession(existing)
        setIsLoading(false)
      }
    }
  }, [config, isDemo])

  // Stay in sync with token rotations that happen out-of-band (e.g. inside
  // authFetch's 401-retry, which writes directly to localStorage). Without this
  // the `session` state held by React — and the sync `session.accessToken`
  // getter passed to some runtimes — would go stale until next reload.
  useEffect(() => {
    if (isDemo) return
    return onSessionChange(sess => setSession(sess))
  }, [isDemo])

  // Proactively refresh the access token 5 minutes before expiry.
  // If already expired on load, refresh immediately.
  useEffect(() => {
    if (isDemo || !session?.refreshToken || !session.expiresAt) return

    const REFRESH_BUFFER = 5 * 60 // seconds
    const now = Math.floor(Date.now() / 1000)
    const delay = Math.max(0, session.expiresAt - now - REFRESH_BUFFER) * 1000

    const timer = setTimeout(async () => {
      const refreshed = await refreshSession(config)
      if (refreshed) {
        setSession(refreshed)
      } else {
        // Refresh token is also expired — force re-login
        clearSession()
        setSession(null)
      }
    }, delay)

    return () => clearTimeout(timer)
  }, [isDemo, session?.refreshToken, session?.expiresAt, config])

  const login = useCallback(() => {
    if (isDemo) return
    if (window !== window.top) {
      // Embedded as iframe — ask parent to provide the session instead of navigating
      window.parent.postMessage({ type: 'lmthing:auth-needed' }, '*')
      return
    }
    redirectToLogin(config)
  }, [config, isDemo])

  const logout = useCallback(() => {
    if (isDemo) return
    clearSession()
    setSession(null)
    setPinUnlocked(false)
    pinKeyRef.current = null
  }, [isDemo])

  const unlockPin = useCallback(async (pin: string): Promise<boolean> => {
    const valid = await verifyPin(pin)
    if (valid && session) {
      pinKeyRef.current = await derivePinKey(pin, session.userId)
      setPinUnlocked(true)
    }
    return valid
  }, [session])

  const getPinKey = useCallback(async (): Promise<CryptoKey | null> => {
    return pinKeyRef.current
  }, [])

  const getAccessToken = useCallback(() => ensureValidToken(config), [config])

  const authFetchBound = useCallback(
    (url: string, options?: RequestInit) => authFetch(config, url, options),
    [config],
  )

  const username = session?.email ?? null
  const isAuthenticated = !!session
  const needsPin = !isDemo && isPinSet() && !pinUnlocked
  const githubRepo = session?.githubRepo ?? null
  const githubUsername = session?.githubUsername ?? null

  return (
    <AuthContext.Provider value={{
      session,
      username,
      isAuthenticated,
      isLoading,
      githubRepo,
      githubUsername,
      needsPin,
      pinUnlocked,
      login,
      logout,
      getAccessToken,
      authFetch: authFetchBound,
      unlockPin,
      getPinKey,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
