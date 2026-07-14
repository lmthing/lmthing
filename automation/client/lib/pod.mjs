/**
 * Read the LOCAL pod (`lmthing serve` the campaign now runs against) and push its
 * data to the dashboard. The pod lives on THIS machine behind the home NAT, so the
 * in-cluster app can't reach it — the client mirrors it up instead:
 *
 *   fs tree + text file contents  → POST /api/ingest/pod/:id     (served-app + file panes)
 *   THING session-trace events    → POST /api/ingest/pod-events/:id (live pod-session pane)
 *
 * A scenario is "local" when its checkpoint projectId actually exists on the local
 * pod (GET /api/projects); older cluster scenarios are skipped (the app proxies
 * those live). Zero-dep (Node 24 global fetch).
 */

const TEXT_MAX = 512 * 1024 // per-file cap
const TOTAL_MAX = 12 * 1024 * 1024 // total captured text per bundle
const BIN_EXT = /\.(db|db-shm|db-wal|png|jpe?g|webp|gif|pdf|zip|ico|woff2?|ttf|otf|mp4|mov|wasm)$/i
// The persisted session trace/snapshot are large and captured separately (trace →
// pod-session events); don't also inline them into the file-content map.
const SKIP_FILE = /\/sessions\/[^/]+\/(trace|snapshot)\.json$/
const ASSET_MAX = 2 * 1024 * 1024
const ASSET_COUNT_MAX = 40

async function getJson(url, ms = 4000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms) })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

/** projectIds present on the local pod right now (empty if it's down). */
export async function localProjectIds(base) {
  try {
    const j = await getJson(`${base}/api/projects`, 2000)
    return new Set((j?.projects ?? []).map((p) => p.id))
  } catch {
    return new Set()
  }
}

/** fs tree (paths under `<projectId>/`) + text file contents, size-capped. */
async function readFs(base, projectId) {
  let tree = []
  try {
    const j = await getJson(`${base}/api/fs/tree`)
    tree = (j?.files ?? []).filter((p) => p === projectId || p.startsWith(`${projectId}/`))
  } catch {
    return { tree: [], files: {} }
  }
  const files = {}
  let total = 0
  for (const p of tree) {
    if (BIN_EXT.test(p) || SKIP_FILE.test(p)) continue
    if (total >= TOTAL_MAX) break
    try {
      const j = await getJson(`${base}/api/fs/read?path=${encodeURIComponent(p)}`)
      const content = typeof j?.content === 'string' ? j.content : ''
      if (content.length > TEXT_MAX) continue
      files[p] = content
      total += content.length
    } catch {
      /* skip unreadable */
    }
  }
  return { tree, files }
}

/** The served app HTML at `/app/<projectId>/` + the assets it references. */
async function readApp(base, projectId) {
  const appBase = `${base}/app/${projectId}/`
  let html
  try {
    const res = await fetch(appBase, { signal: AbortSignal.timeout(4000) })
    html = await res.text()
  } catch {
    return undefined
  }
  const assets = {}
  // Match asset URLs the built page references (absolute `/app/<pid>/…`, root
  // `/<pid>/…`, or relative `./…`/`assets/…`), normalized to a key relative to appBase.
  const refs = new Set()
  const re = /(?:src|href)\s*=\s*["']([^"']+)["']/g
  let m
  while ((m = re.exec(html))) {
    let u = m[1]
    if (/^(https?:)?\/\//.test(u) || u.startsWith('data:') || u.startsWith('#')) continue
    u = u.replace(/^\/app\/[^/]+\//, '').replace(new RegExp(`^/${projectId}/`), '').replace(/^\.?\//, '')
    if (u && !u.startsWith('?')) refs.add(u.split('?')[0])
  }
  for (const rel of refs) {
    if (Object.keys(assets).length >= ASSET_COUNT_MAX) break
    try {
      const res = await fetch(appBase + rel, { signal: AbortSignal.timeout(4000) })
      if (!res.ok) continue
      const contentType = res.headers.get('content-type') ?? 'application/octet-stream'
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length > ASSET_MAX) continue
      const isText = /text|javascript|json|css|svg|xml/.test(contentType)
      assets[rel] = isText
        ? { body: buf.toString('utf8'), contentType }
        : { body: buf.toString('base64'), contentType, base64: true }
    } catch {
      /* skip */
    }
  }
  return { html, assets }
}

export function makePodSync({ base, push }) {
  /** scenarioId → last pushed event seq (+1). */
  const sinceByScenario = new Map()

  /**
   * Mirror one local scenario's pod. `sc = { id, projectId, sessionId }`.
   * Returns false if the project isn't on the local pod (caller can skip logging).
   */
  async function syncOne(sc, localIds) {
    if (!localIds.has(sc.projectId)) return false

    // fs + manifest + served app → full bundle (events pushed separately, live).
    const { tree, files } = await readFs(base, sc.projectId)
    let manifest
    try {
      manifest = await getJson(`${base}/api/projects/${sc.projectId}/app`)
    } catch {
      /* no app yet */
    }
    const app = await readApp(base, sc.projectId)
    await push.post(`/pod/${sc.id}`, { projectId: sc.projectId, tree, files, manifest, app })

    // Incremental session-trace events → live pod-session pane. Read the PERSISTED
    // trace (`sessions/<sid>/trace.json`) rather than the live /events endpoint: the
    // latter only serves in-memory sessions (an idle/persisted one 404s "unknown
    // session"), while trace.json is the on-disk source of truth for both.
    if (sc.sessionId) {
      const since = sinceByScenario.get(sc.id) ?? 0
      try {
        const j = await getJson(
          `${base}/api/fs/read?path=${encodeURIComponent(`${sc.projectId}/sessions/${sc.sessionId}/trace.json`)}`,
        )
        const all = JSON.parse(j?.content ?? '[]')
        const events = Array.isArray(all) ? all.filter((e) => (e.seq ?? 0) >= since) : []
        if (events.length) {
          let max = since
          for (const e of events) max = Math.max(max, (e.seq ?? 0) + 1)
          // Batch so a large initial backfill doesn't make one multi-MB POST body.
          for (let i = 0; i < events.length; i += 500) {
            await push.post(`/pod-events/${sc.id}`, { events: events.slice(i, i + 500) })
          }
          sinceByScenario.set(sc.id, max)
        }
      } catch {
        /* session not started yet / no trace */
      }
    }
    return true
  }

  return { syncOne }
}
