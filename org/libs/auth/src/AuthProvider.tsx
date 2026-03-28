import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react'
import type { AuthSession, AuthConfig, AuthContextValue } from './types'
import { getSession, clearSession, storeSession, redirectToLogin, handleAuthCallback, isPinSet, verifyPin, derivePinKey } from './client'

const AuthContext = createContext<AuthContextValue | null>(null)

function resolveConfig(appName: string, callbackPath: string): AuthConfig {
  const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:'

  return {
    comUrl: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_COM_URL)
      || (isDev ? `${protocol}//com.local` : 'https://lmthing.com'),
    cloudUrl: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUD_URL)
      || (isDev ? `${protocol}//cloud.local` : 'https://lmthing.cloud'),
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
      setSession(getSession())
      setIsLoading(false)
    }
  }, [config, isDemo])

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
