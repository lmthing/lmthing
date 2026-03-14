export interface AuthSession {
  accessToken: string
  userId: string
  email: string
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
  login: () => void
  logout: () => void
}
