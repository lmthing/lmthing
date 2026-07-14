import type { Context, Next } from 'hono'
import { config } from './config.js'

/** Extract the shared-secret bearer token from header or ?token= (SSE/EventSource can't set headers). */
function extractToken(c: Context): string {
  const auth = c.req.header('authorization')
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim()
  return c.req.query('token') ?? ''
}

export async function tokenGate(c: Context, next: Next) {
  if (!config.DASH_VIEW_TOKEN) return c.json({ error: 'DASH_VIEW_TOKEN not set on the server' }, 500)
  if (extractToken(c) !== config.DASH_VIEW_TOKEN) return c.json({ error: 'unauthorized' }, 401)
  await next()
}
