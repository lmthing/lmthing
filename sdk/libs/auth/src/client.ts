import type { AuthConfig, AuthSession } from './types'

const SESSION_KEY = 'lmthing_session'
const PIN_HASH_KEY = 'lmthing_pin_hash'
const PIN_SET_KEY = 'lmthing_pin_set'

/** Refresh this many seconds before the access token actually expires. */
const REFRESH_BUFFER = 60

// Pub/sub so React state stays in sync when a token is rotated out-of-band
// (e.g. by authFetch's 401-retry, which writes to localStorage directly).
const sessionListeners = new Set<(session: AuthSession | null) => void>()

export function onSessionChange(cb: (session: AuthSession | null) => void): () => void {
  sessionListeners.add(cb)
  return () => sessionListeners.delete(cb)
}

function emitSessionChange(session: AuthSession | null): void {
  sessionListeners.forEach(cb => cb(session))
}

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
  // Note: don't remove from sessionStorage until exchange succeeds,
  // because React StrictMode double-invokes effects in dev
  const savedState = sessionStorage.getItem('sso_state')
  if (state !== savedState) {
    // If state is missing entirely, this is likely a StrictMode re-run after
    // a successful exchange already cleared it — treat as no-op
    if (!savedState) return getSession()
    throw new Error('Invalid state parameter — possible CSRF attack')
  }

  const callbackUrl = `${window.location.origin}${config.callbackPath}`

  const res = await fetch(`${config.cloudUrl}/api/auth/sso/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: callbackUrl }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: 'SSO exchange failed' } }))
    throw new Error(body.error?.message || 'SSO exchange failed')
  }

  // Exchange succeeded — now safe to clear the state
  sessionStorage.removeItem('sso_state')

  const data = await res.json()
  const session: AuthSession = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? undefined,
    expiresAt: data.expires_at ?? undefined,
    userId: data.user.id,
    email: data.user.email,
    githubRepo: data.user.github_repo ?? null,
    githubUsername: data.user.github_username ?? null,
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  emitSessionChange(session)
  return session
}

export async function refreshSession(config: AuthConfig): Promise<AuthSession | null> {
  const current = getSession()
  if (!current?.refreshToken) return null

  const res = await fetch(`${config.cloudUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: current.refreshToken }),
  })

  if (!res.ok) return null

  const data = await res.json()
  const session: AuthSession = {
    ...current,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? current.refreshToken,
    expiresAt: data.expires_at ?? undefined,
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  emitSessionChange(session)
  return session
}

/** True when the access token is within REFRESH_BUFFER of expiry (or past it). */
export function isSessionExpired(session: AuthSession | null, bufferSec = REFRESH_BUFFER): boolean {
  if (!session?.expiresAt) return false
  return Math.floor(Date.now() / 1000) >= session.expiresAt - bufferSec
}

/**
 * Return a live access token, refreshing first if the current one is near
 * expiry. Clears the session and throws if there is no refresh token or the
 * refresh fails — callers should treat the throw as "force re-login".
 */
export async function ensureValidToken(config: AuthConfig): Promise<string> {
  const current = getSession()
  if (!current) throw new Error('Not authenticated')

  if (!isSessionExpired(current)) return current.accessToken
  if (!current.refreshToken) {
    clearSession()
    throw new Error('Session expired')
  }

  const refreshed = await refreshSession(config)
  if (!refreshed) {
    clearSession()
    throw new Error('Session expired')
  }
  return refreshed.accessToken
}

/**
 * Authenticated fetch with automatic token rotation.
 *
 * Sets `Authorization: Bearer <token>` from the stored session, refreshing it
 * first if it is near expiry. On a 401 response it force-refreshes once and
 * retries — this is what keeps long-lived tabs working after the 12h access
 * token expires. Returns the raw Response; callers check `res.ok` like fetch.
 */
export async function authFetch(
  config: AuthConfig,
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await ensureValidToken(config)
  const headers = new Headers(options.headers)
  headers.set('authorization', `Bearer ${token}`)

  let res = await fetch(url, { ...options, headers })

  if (res.status === 401) {
    const refreshed = await refreshSession(config)
    if (refreshed) {
      headers.set('authorization', `Bearer ${refreshed.accessToken}`)
      res = await fetch(url, { ...options, headers })
    } else {
      clearSession()
    }
  }

  return res
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
  emitSessionChange(null)
}

export function storeSession(session: AuthSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  emitSessionChange(session)
}

// PIN utilities for client-side encryption

export function isPinSet(): boolean {
  return localStorage.getItem(PIN_SET_KEY) === 'true'
}

export function getPinHash(): string | null {
  return localStorage.getItem(PIN_HASH_KEY)
}

export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyPin(pin: string): Promise<boolean> {
  const storedHash = getPinHash()
  if (!storedHash) return false
  const inputHash = await hashPin(pin)
  return inputHash === storedHash
}

/**
 * Derive a CryptoKey from the PIN for encrypting/decrypting sensitive data.
 * Uses PBKDF2 with a fixed salt derived from the user ID.
 */
export async function derivePinKey(pin: string, userId: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(`lmthing_${userId}`),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}
