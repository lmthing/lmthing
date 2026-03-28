import type { AuthConfig, AuthSession } from './types'

const SESSION_KEY = 'lmthing_session'
const PIN_HASH_KEY = 'lmthing_pin_hash'
const PIN_SET_KEY = 'lmthing_pin_set'

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
    userId: data.user.id,
    email: data.user.email,
    githubRepo: data.user.github_repo ?? null,
    githubUsername: data.user.github_username ?? null,
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

export function storeSession(session: AuthSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
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
