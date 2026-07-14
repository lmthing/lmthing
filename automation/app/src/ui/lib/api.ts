const TOKEN_KEY = 'scenario_dash_token'

/** The dashboard's path prefix, e.g. '/scenario-dash' (Vite base without trailing slash). */
export const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? ''
}
export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t)
  // Mirror into a scoped cookie so the served-app <iframe> preview — whose document
  // navigation + asset sub-requests can't carry a bearer header — is authorized by
  // the server's token gate (auth.ts reads `dash_token` from the cookie).
  const path = BASE || '/'
  document.cookie = t
    ? `dash_token=${encodeURIComponent(t)}; path=${path}; SameSite=Strict; Max-Age=604800`
    : `dash_token=; path=${path}; Max-Age=0`
}

export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: { authorization: `Bearer ${getToken()}`, 'content-type': 'application/json', ...(init?.headers || {}) },
  })
  if (res.status === 401) {
    setToken('')
    throw new Error('unauthorized')
  }
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => '')}`)
  return res.json()
}

/** SSE endpoint URL with the token in the query (EventSource can't set headers). */
export function sseUrl(path: string): string {
  return `${BASE}/api${path}?token=${encodeURIComponent(getToken())}`
}
