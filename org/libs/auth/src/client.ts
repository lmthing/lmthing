import type { AuthConfig, AuthSession } from './types'

const SESSION_KEY = 'lmthing_session'

function generateState(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function redirectToLogin(config: AuthConfig): void {
  const state = generateState()
  sessionStorage.setItem('sso_state', state)

  const callbackUrl = `${window.location.origin}${config.callbackPath}`
  const params = new URLSearchParams({
    redirect_uri: callbackUrl,
    app: config.appName,
    state,
  })

  window.location.href = `${config.comUrl}/auth/sso?${params.toString()}`
}

export async function handleAuthCallback(config: AuthConfig): Promise<AuthSession | null> {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!code) return null

  // Verify state to prevent CSRF
  const savedState = sessionStorage.getItem('sso_state')
  if (state !== savedState) {
    throw new Error('Invalid state parameter — possible CSRF attack')
  }
  sessionStorage.removeItem('sso_state')

  const callbackUrl = `${window.location.origin}${config.callbackPath}`

  const res = await fetch(`${config.cloudUrl}/exchange-sso-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: callbackUrl }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: 'SSO exchange failed' } }))
    throw new Error(body.error?.message || 'SSO exchange failed')
  }

  const data = await res.json()
  const session: AuthSession = {
    accessToken: data.access_token,
    userId: data.user.id,
    email: data.user.email,
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function getAuthHeaders(): Record<string, string> {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return {}

  try {
    const session: AuthSession = JSON.parse(raw)
    return { Authorization: `Bearer ${session.accessToken}` }
  } catch {
    return {}
  }
}

export function getSession(): AuthSession | null {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}
