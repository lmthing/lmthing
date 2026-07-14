import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { config } from './config.js'
import { tokenGate } from './auth.js'
import { ingestRouter } from './routes/ingest.js'
import { scenariosRouter } from './routes/scenarios.js'
import { podProxyRouter } from './routes/pod-proxy.js'
import { podLifeRouter } from './routes/pod-life.js'
import { podLogsRouter } from './routes/pod-logs.js'

const PREFIX = config.PREFIX
const UI_DIST = path.resolve(process.cwd(), config.UI_DIST)

const app = new Hono()

// Ungated liveness probe.
app.get(`${PREFIX}/health`, (c) => c.json({ ok: true, ts: Date.now() }))

// Everything under /api is token-gated (viewer + ingest share the secret).
app.use(`${PREFIX}/api/*`, tokenGate)

app.route(`${PREFIX}/api/ingest`, ingestRouter)
app.route(`${PREFIX}/api/scenarios`, scenariosRouter)
app.route(`${PREFIX}/api/pod`, podProxyRouter)
app.route(`${PREFIX}/api/podlife`, podLifeRouter)
app.route(`${PREFIX}/api/podlogs`, podLogsRouter)

// ── SPA static (prod). Ungated: the token prompt lives inside the SPA. ──────────
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
}

app.get(`${PREFIX}/*`, async (c) => {
  if (!existsSync(UI_DIST)) {
    return c.text('SPA not built. Run `pnpm build` (or use the Vite dev server in dev).', 404)
  }
  const url = new URL(c.req.url)
  let rel = decodeURIComponent(url.pathname).slice(PREFIX.length)
  if (!rel || rel === '/') rel = '/index.html'
  rel = rel.replace(/^\/+/, '')
  const safe = path.normalize(rel).replace(/^(\.\.[/\\])+/, '')
  const file = path.join(UI_DIST, safe)
  try {
    if (existsSync(file) && (await stat(file)).isFile()) {
      const buf = await readFile(file)
      return new Response(buf, {
        headers: { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' },
      })
    }
  } catch {
    /* fall through */
  }
  // SPA fallback for client-side routes.
  const idx = path.join(UI_DIST, 'index.html')
  if (existsSync(idx)) {
    return new Response(await readFile(idx), { headers: { 'content-type': 'text/html; charset=utf-8' } })
  }
  return c.text('not found', 404)
})

// Root redirect → the dashboard (so lmthing.cloud/ isn't left bare if hit directly).
app.get('/', (c) => c.redirect(PREFIX + '/'))

serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(`[scenario-dash] listening on :${info.port} (prefix ${PREFIX})`)
  console.log(`[scenario-dash] in-cluster pod access: ${config.POD_EDGE_BASE ? 'edge ' + config.POD_EDGE_BASE : 'dns lmthing.user-<id>.svc:8080'}`)
  if (!config.DASH_VIEW_TOKEN) console.warn('[scenario-dash] WARNING: DASH_VIEW_TOKEN unset — /api is ungated')
})
