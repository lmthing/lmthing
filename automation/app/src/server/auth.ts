import type { Context, Next } from 'hono'
import { config } from './config.js'

/**
 * Extract the shared-secret token from (in order): the Authorization bearer header
 * (XHR/fetch), the ?token= query param (SSE/EventSource can't set headers), or a
 * `dash_token` cookie. The cookie is what authorizes the served-app <iframe>: an
 * iframe document navigation AND the asset sub-requests it spawns carry neither a
 * bearer header nor a query param, but they DO send same-origin cookies.
 */
function extractToken(c: Context): string {
  const auth = c.req.header('authorization')
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim()
  const q = c.req.query('token')
  if (q) return q
  const cookie = c.req.header('cookie')
  if (cookie) {
    const m = cookie.match(/(?:^|;\s*)dash_token=([^;]+)/)
    if (m) return decodeURIComponent(m[1])
  }
  return ''
}

export async function tokenGate(c: Context, next: Next) {
  if (!config.DASH_VIEW_TOKEN) return c.json({ error: 'DASH_VIEW_TOKEN not set on the server' }, 500)
  if (extractToken(c) !== config.DASH_VIEW_TOKEN) return c.json({ error: 'unauthorized' }, 401)
  await next()
}
