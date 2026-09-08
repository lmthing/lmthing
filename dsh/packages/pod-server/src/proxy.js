/**
 * A minimal HTTP + WebSocket reverse proxy to a loopback backend, plus a real
 * `/api/health` check — no `http-proxy` dependency (Part B1, see dsh/PROGRESS.md).
 *
 * Why this exists at all: `dsh --profile web` refuses `--host 0.0.0.0`
 * ("intentionally not supported yet for safety: it would expose remote code
 * execution to the network" — confirmed by reading `@deepseek-ai/dsh-web-app`'s
 * own `startup.js`), so dsh can only bind loopback. The K8s Service/startupProbe
 * needs something bound on all interfaces at the container's exposed port, and
 * dsh ships no `/api/health` route at all (confirmed: grepped every installed
 * dsh-* package for a health/status route — none exists). This process is that
 * something: it owns the exposed port, forwards everything else to dsh, and is
 * the ONLY thing that answers health.
 *
 * The health check is a live TCP probe on every request, not a cached flag set
 * once — a backend that dies mid-session (and is restarted by the caller) must
 * be reflected immediately, and a startupProbe with failureThreshold=120 keeps
 * polling long after the first successful connect, so staleness would silently
 * paper over a real crash.
 *
 * Host/Origin rewriting (confirmed live, the hard way — see dsh/PROGRESS.md Part B):
 * dsh's own DNS-rebinding fence (`isTrustedApiRequest`) checks the `Host` header against a
 * `--trusted-host` allowlist, but the actual `Host` a request carries by the time it reaches this
 * process is NOT the public one a browser used (`lmthing.chat`) — Envoy's `rewrite-host-from-header`
 * filter (the SAME mechanism that dynamically routes to a per-user pod at all) already rewrote it
 * to the per-user Service DNS name (`lmthing-dsh.user-<id>.svc.cluster.local:8080`), which
 * `--trusted-host` can never enumerate (it's dynamic per user). Fix: since this process IS a
 * genuine loopback caller of dsh (the hop below is over 127.0.0.1), present dsh with the loopback
 * Host it actually trusts unconditionally — `isTrustedApiRequest` treats loopback specially,
 * needing no `trustedHosts` entry at all. The paired `Origin` header must be stripped, not just
 * left as `https://lmthing.chat`: `isTrustedApiRequest` also requires `new URL(origin).host ===
 * host` when Origin is present, and rewriting only one of the pair would fail that check instead.
 * An absent Origin skips it entirely — safe here, since Envoy + the JWT/cookie policy already
 * gated who could reach this process before this hop ever happens.
 *
 * dsh 0.1.2-rc.1 upgrade — browser-session cookie (see dsh/PROGRESS.md, the upgrade section):
 * `@deepseek-ai/dsh-client-connection`'s `requestRejection` now ALSO requires a signed
 * `dsh-auth-<hash>` cookie on every `/api/*` request (`isTrustedApiRequest` alone is no longer
 * sufficient — a real behavior change from 0.1.1-rc.2, confirmed by reading the shipped bundle),
 * and the index document route (`authorizeIndex`) requires the same cookie or dsh's one-time launch
 * token. There is no config flag to disable this. `getDshAuthCookie()` (wired by index.js, which
 * performs the token exchange once at boot — see its own doc comment) supplies that cookie so this
 * hop stays transparent: dsh sees a loopback caller that is ALSO an authenticated browser session,
 * exactly as a developer's own browser would after visiting the printed token URL once.
 */
import http from 'node:http'
import net from 'node:net'

const HEALTH_PATH = '/api/health'
const HEALTH_PROBE_TIMEOUT_MS = 2000

function probeBackend(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port })
    const done = (ok) => {
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(HEALTH_PROBE_TIMEOUT_MS)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
  })
}

/**
 * @param {object} opts
 * @param {number} opts.backendPort
 * @param {string} [opts.backendHost]
 * @param {() => string | undefined} [opts.getDshAuthCookie] - returns the current
 *   `dsh-auth-<hash>=<value>` cookie (see the module doc comment), or undefined before index.js has
 *   completed the token exchange. Omit entirely (as every existing test does) to skip auth-cookie
 *   handling altogether — only index.js's real boot sequence passes this.
 * @returns {import('node:http').Server}
 */
export function createPodServer({ backendPort, backendHost = '127.0.0.1', getDshAuthCookie }) {
  const server = http.createServer((req, res) => {
    if (req.url === HEALTH_PATH) {
      // Gate readiness on the auth handshake too, not just TCP connectivity, when the caller wired
      // one up — a startupProbe pass before the cookie exists would let real traffic through a
      // window where every /api/* call 401s (see the module doc comment).
      probeBackend(backendHost, backendPort).then((ok) => {
        const ready = ok && (getDshAuthCookie === undefined || getDshAuthCookie() !== undefined)
        res.writeHead(ready ? 200 : 503, { 'content-type': 'text/plain' })
        res.end(ready ? 'ok' : 'backend not ready')
      })
      return
    }

    const headers = { ...req.headers, host: `${backendHost}:${backendPort}` }
    delete headers.origin
    const dshAuthCookie = getDshAuthCookie?.()
    if (dshAuthCookie !== undefined) headers.cookie = headers.cookie ? `${headers.cookie}; ${dshAuthCookie}` : dshAuthCookie
    const upstream = http.request(
      { host: backendHost, port: backendPort, method: req.method, path: req.url, headers },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers)
        upstreamRes.pipe(res)
      },
    )
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' })
      res.end('bad gateway')
    })
    req.pipe(upstream)
  })

  // WebSocket / raw upgrade proxying: http.request can't do this, so replay the
  // original request line + headers over a plain TCP socket to the backend and
  // pipe both directions once it accepts (classic manual-upgrade-proxy shape).
  server.on('upgrade', (req, clientSocket, head) => {
    const upstreamSocket = net.connect({ host: backendHost, port: backendPort }, () => {
      const rawHeaders = req.rawHeaders
      const headerLines = []
      const dshAuthCookie = getDshAuthCookie?.()
      let sawCookie = false
      for (let i = 0; i < rawHeaders.length; i += 2) {
        const name = rawHeaders[i]
        const lower = name.toLowerCase()
        if (lower === 'origin') continue
        if (lower === 'cookie' && dshAuthCookie !== undefined) {
          sawCookie = true
          headerLines.push(`${name}: ${rawHeaders[i + 1]}; ${dshAuthCookie}`)
          continue
        }
        headerLines.push(lower === 'host' ? `Host: ${backendHost}:${backendPort}` : `${name}: ${rawHeaders[i + 1]}`)
      }
      if (dshAuthCookie !== undefined && !sawCookie) headerLines.push(`Cookie: ${dshAuthCookie}`)
      upstreamSocket.write(`${req.method} ${req.url} HTTP/1.1\r\n${headerLines.join('\r\n')}\r\n\r\n`)
      if (head?.length) upstreamSocket.write(head)
      upstreamSocket.pipe(clientSocket)
      clientSocket.pipe(upstreamSocket)
    })
    upstreamSocket.on('error', () => clientSocket.destroy())
    clientSocket.on('error', () => upstreamSocket.destroy())
  })

  return server
}
