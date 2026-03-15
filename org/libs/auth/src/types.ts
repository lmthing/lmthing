export interface AuthSession {
  accessToken: string
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
  unlockPin: (pin: string) => Promise<boolean>
  getPinKey: () => Promise<CryptoKey | null>
}
