export interface AuthSession {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  userId: string
  email: string
  githubRepo: string | null
  githubUsername: string | null
}

export interface AuthConfig {
  comUrl: string
  cloudUrl: string
  appName: string
  callbackPath: string
}

export interface AuthContextValue {
  session: AuthSession | null
  username: string | null
  isAuthenticated: boolean
  isLoading: boolean
  githubRepo: string | null
  githubUsername: string | null
  needsPin: boolean
  pinUnlocked: boolean
  login: () => void
  logout: () => void
  /** Returns a live access token, refreshing first if near expiry. */
  getAccessToken: () => Promise<string>
  /** Sync read of the current access token from the session store (no refresh).
   *  Use for inject-into-runtimes getters that must always return the latest
   *  stored token, paired with `refreshAuth` for the 401-retry path. */
  getAccessTokenSync: () => string | null
  /** Force-rotates the token pair now (used as the transport's `refresh`). */
  refreshAuth: () => Promise<void>
  /** Authenticated fetch with automatic refresh + 401 retry. */
  authFetch: (url: string, options?: RequestInit) => Promise<Response>
  unlockPin: (pin: string) => Promise<boolean>
  getPinKey: () => Promise<CryptoKey | null>
}
