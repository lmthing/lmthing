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
