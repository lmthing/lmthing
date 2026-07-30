const CLOUD_URL = import.meta.env.VITE_CLOUD_URL || 'https://lmthing.cloud'

// ── Token storage ─────────────────────────────────────────────
const TOKEN_KEY = 'lmt_access_token'
const REFRESH_KEY = 'lmt_refresh_token'
const EXPIRES_KEY = 'lmt_expires_at'

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY)
}

export function storeTokens(tokens: { access_token: string; refresh_token: string; expires_at: number }) {
  localStorage.setItem(TOKEN_KEY, tokens.access_token)
  localStorage.setItem(REFRESH_KEY, tokens.refresh_token)
  localStorage.setItem(EXPIRES_KEY, String(tokens.expires_at))
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(EXPIRES_KEY)
}

function isTokenExpired(): boolean {
  const expires = localStorage.getItem(EXPIRES_KEY)
  if (!expires) return true
  return Date.now() / 1000 > Number(expires) - 60 // 60s buffer
}

// ── API client ────────────────────────────────────────────────
async function ensureValidToken(): Promise<string> {
  let token = getStoredToken()
  if (!token) throw new Error('Not authenticated')

  if (isTokenExpired()) {
    const refreshToken = getStoredRefreshToken()
    if (!refreshToken) {
      clearTokens()
      throw new Error('Session expired')
    }

    const res = await fetch(`${CLOUD_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!res.ok) {
      clearTokens()
      throw new Error('Session expired')
    }

    const data = await res.json()
    storeTokens(data)
    token = data.access_token
  }

  return token!
}

export async function cloudFetch(path: string, options: RequestInit = {}) {
  const token = await ensureValidToken()

  const res = await fetch(`${CLOUD_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error?.message || body.error || res.statusText)
  }

  return res.json()
}

// Unauthenticated fetch (for login, register, sso exchange)
export async function cloudFetchPublic(path: string, options: RequestInit = {}) {
  const res = await fetch(`${CLOUD_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error?.message || body.error || res.statusText)
  }

  return res.json()
}

// ── Auth API ──────────────────────────────────────────────────
export async function register(email: string, password: string) {
  return cloudFetchPublic('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function login(email: string, password: string) {
  const data = await cloudFetchPublic('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  storeTokens(data)
  return data
}

export async function getOAuthUrl(provider: string, redirectTo: string) {
  return cloudFetchPublic(`/api/auth/oauth/url?provider=${provider}&redirect_to=${encodeURIComponent(redirectTo)}`)
}

export async function provision() {
  return cloudFetch('/api/auth/provision', { method: 'POST' })
}

export function getMe() {
  return cloudFetch('/api/auth/me')
}

// ── SSO API ───────────────────────────────────────────────────
export function createSsoCode(redirectUri: string, app: string) {
  return cloudFetch('/api/auth/sso/create', {
    method: 'POST',
    body: JSON.stringify({ redirect_uri: redirectUri, app }),
  })
}

export function exchangeSsoCode(code: string, redirectUri: string) {
  return cloudFetchPublic('/api/auth/sso/exchange', {
    method: 'POST',
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
  })
}

// ── Keys API ──────────────────────────────────────────────────
export function listApiKeys() {
  return cloudFetch('/api/keys')
}

export function createApiKey(name?: string) {
  return cloudFetch('/api/keys', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function revokeApiKey(token: string) {
  return cloudFetch(`/api/keys/${token}`, { method: 'DELETE' })
}

// ── Billing API ───────────────────────────────────────────────
export function createCheckout(tier: string) {
  return cloudFetch('/api/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({
      tier,
      return_url: `${window.location.origin}/checkout?session_id={CHECKOUT_SESSION_ID}`,
    }),
  }) as Promise<{ client_secret: string }>
}

export function getCheckoutStatus(sessionId: string) {
  return cloudFetch(`/api/billing/checkout/status?session_id=${sessionId}`)
}

export function billingPortal() {
  return cloudFetch('/api/billing/portal', { method: 'POST' })
}

export function getUsage() {
  return cloudFetch('/api/billing/usage')
}

// ── Passwordless email sign-in ────────────────────────────────
//
// Two calls: ask the gateway to mail a 6-digit code + magic link, then hand the
// code back. There is no separate signup — any address that can receive the code
// gets an account on first use, and an address that already signed in with GitHub
// resolves to that same account.

export interface EmailLoginStart {
  sent: boolean
  /** Masked (`a••••@example.com`) — the gateway never echoes the address back in full. */
  email: string
  expires_at: number
  /** Present only on a dev deployment with no mail transport configured. */
  dev_code?: string
  dev_link?: string
}

/**
 * `redirectUri` is where the magic link lands when it is clicked — this app's
 * `/callback`, which reads the token fragment. The gateway validates it against
 * an origin allowlist, so it must be a real origin and not a bare path.
 */
export function startEmailLogin(email: string, redirectUri?: string) {
  return cloudFetchPublic('/api/auth/email/start', {
    method: 'POST',
    body: JSON.stringify({ email, ...(redirectUri ? { redirect_uri: redirectUri } : {}) }),
  }) as Promise<EmailLoginStart>
}

export async function verifyEmailLogin(email: string, code: string) {
  const data = await cloudFetchPublic('/api/auth/email/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  })
  storeTokens(data)
  return data as {
    access_token: string
    refresh_token: string
    expires_at: number
    user: { id: string; email: string }
  }
}
