/**
 * Performs dsh 0.1.2-rc.1's browser-session token exchange once at boot, so this proxy — a genuine
 * loopback caller of dsh — also counts as an authenticated browser session. See proxy.js's module
 * doc comment for why this became necessary (dsh/PROGRESS.md, the upgrade section): as of
 * 0.1.2-rc.1, `@deepseek-ai/dsh-client-connection` requires a signed `dsh-auth-<hash>` cookie on
 * every `/api/*` request and on the index document, in addition to the pre-existing Host/Origin
 * fence — there is no config flag to disable it. Without this module a real end user would need to
 * manually visit the one-time token URL dsh prints to its own stdout, which is meaningless in a
 * server deployment where nobody ever sees that log line.
 */
import http from 'node:http'

const TOKEN_PATTERN = /\?token=([^\s&]+)/

/**
 * Scans dsh's own stdout for the launch-token URL it prints once at boot
 * (`dsh web: http://127.0.0.1:<port>/?token=<token>`), while forwarding every chunk through
 * untouched — `kubectl logs` must see exactly what dsh printed, this is a tap, not a filter.
 * @param {NodeJS.ReadableStream} stdout
 * @param {NodeJS.WritableStream} passthrough
 * @returns {Promise<string>} the launch token
 */
export function captureLaunchToken(stdout, passthrough) {
  return new Promise((resolve) => {
    let resolved = false
    let buffer = ''
    stdout.on('data', (chunk) => {
      passthrough.write(chunk)
      if (resolved) return
      buffer += chunk.toString('utf8')
      const match = buffer.match(TOKEN_PATTERN)
      if (match) {
        resolved = true
        resolve(match[1])
      }
    })
  })
}

/**
 * Exchanges the one-time launch token for dsh's signed `dsh-auth-<hash>` session cookie by
 * replaying exactly the request a developer's own first browser visit would make — GET / with
 * ?token=, over loopback (see @deepseek-ai/dsh-client-connection's `BrowserAuth.authorizeIndex`).
 * Retries while dsh is still starting its HTTP listener (the token is printed slightly before the
 * server is guaranteed to accept connections).
 * @param {object} opts
 * @param {string} opts.host
 * @param {number} opts.port
 * @param {string} opts.token
 * @param {number} [opts.retryDelayMs]
 * @param {number} [opts.maxAttempts]
 * @returns {Promise<string>} the `name=value` cookie pair to resend on every subsequent request
 */
export async function exchangeLaunchToken({ host, port, token, retryDelayMs = 500, maxAttempts = 60 }) {
  let lastError
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const req = http.request({ host, port, path: `/?token=${encodeURIComponent(token)}`, method: 'GET' }, (res) => {
          res.resume()
          const setCookie = res.headers['set-cookie']?.[0]
          if (setCookie === undefined) {
            reject(new Error(`dsh auth handshake: no Set-Cookie in the token-exchange response (status ${res.statusCode})`))
            return
          }
          resolve(setCookie.split(';')[0])
        })
        req.on('error', reject)
        req.end()
      })
    } catch (error) {
      lastError = error
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, retryDelayMs))
    }
  }
  throw lastError
}
