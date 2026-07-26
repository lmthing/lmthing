import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  getStoredToken,
  storeTokens,
  clearTokens,
  login as apiLogin,
  register as apiRegister,
  getOAuthUrl,
  getMe,
  startEmailLogin,
  verifyEmailLogin,
  type EmailLoginStart,
} from '../cloud'

interface User {
  id: string
  email: string
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<any>
  signOut: () => Promise<void>
  signInWithGitHub: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  /** Mail a one-time code + magic link to any address. Resolves when it's sent. */
  sendEmailCode: (email: string) => Promise<EmailLoginStart>
  /** Exchange the mailed code for a session. */
  signInWithEmailCode: (email: string, code: string) => Promise<void>
  setSessionFromOAuth: (accessToken: string, refreshToken: string, expiresAt: number) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Check for existing session on mount
  useEffect(() => {
    const token = getStoredToken()
    if (!token) {
      setLoading(false)
      return
    }

    getMe()
      .then(data => {
        setUser({ id: data.user_id, email: data.email })
      })
      .catch(() => {
        clearTokens()
      })
      .finally(() => setLoading(false))
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await apiLogin(email, password)
    setUser(data.user)
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const data = await apiRegister(email, password)
    // Register returns user_id + api_key but no session — log them in
    const loginData = await apiLogin(email, password)
    setUser(loginData.user)
    return data
  }, [])

  const signOut = useCallback(async () => {
    clearTokens()
    setUser(null)
  }, [])

  const signInWithGitHub = useCallback(async () => {
    const { url } = await getOAuthUrl('github', `${window.location.origin}/callback`)
    window.location.href = url
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const { url } = await getOAuthUrl('google', `${window.location.origin}/callback`)
    window.location.href = url
  }, [])

  // The magic link is delivered to an inbox, which may be opened on a different
  // device or browser than the one that asked for it — so it lands on /callback
  // (the same page the GitHub redirect uses) with the tokens in the fragment,
  // rather than trying to resume this tab's state.
  const sendEmailCode = useCallback(async (email: string) => {
    const redirect = new URLSearchParams(window.location.search).get('redirect')
    const callback = new URL('/callback', window.location.origin)
    if (redirect) callback.searchParams.set('next', redirect)
    return startEmailLogin(email, callback.toString())
  }, [])

  const signInWithEmailCode = useCallback(async (email: string, code: string) => {
    const data = await verifyEmailLogin(email, code)
    setUser(data.user)
  }, [])

  // Called by the OAuth callback page after extracting tokens from hash
  const setSessionFromOAuth = useCallback((accessToken: string, refreshToken: string, expiresAt: number) => {
    storeTokens({ access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt })
    // Fetch user info with the new token
    getMe()
      .then(data => setUser({ id: data.user_id, email: data.email }))
      .catch(() => clearTokens())
  }, [])

  return (
    <AuthContext.Provider value={{
      user, loading,
      signIn, signUp, signOut,
      signInWithGitHub, signInWithGoogle,
      sendEmailCode, signInWithEmailCode,
      setSessionFromOAuth,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
