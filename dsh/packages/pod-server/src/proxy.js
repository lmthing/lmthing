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
 * @returns {import('node:http').Server}
 */
export function createPodServer({ backendPort, backendHost = '127.0.0.1' }) {
  const server = http.createServer((req, res) => {
    if (req.url === HEALTH_PATH) {
      probeBackend(backendHost, backendPort).then((ok) => {
        res.writeHead(ok ? 200 : 503, { 'content-type': 'text/plain' })
        res.end(ok ? 'ok' : 'backend not ready')
      })
      return
    }

    const upstream = http.request(
      { host: backendHost, port: backendPort, method: req.method, path: req.url, headers: req.headers },
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
      for (let i = 0; i < rawHeaders.length; i += 2) headerLines.push(`${rawHeaders[i]}: ${rawHeaders[i + 1]}`)
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
