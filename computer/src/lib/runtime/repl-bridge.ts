/**
 * Module-level event bus for the REPL bridge process.
 *
 * Since WebContainer preview URLs don't work on custom local domains (they require
 * StackBlitz's CloudFront relay), we bridge the REPL server via a Node.js process
 * inside WebContainer whose stdout/stdin is piped through the WebContainer process API.
 *
 * Usage:
 *  - ComputerContext calls setBridgeProcess() after spawning the bridge
 *  - useReplBridge() subscribes to events and sends messages
 */

type ReplChunkListener = (chunk: string) => void

const listeners = new Set<ReplChunkListener>()
let writer: WritableStreamDefaultWriter<string> | null = null
let connected = false

export function setBridgeProcess(
  output: ReadableStream<string>,
  input: WritableStream<string>,
) {
  writer = input.getWriter()
  connected = true

  ;(async () => {
    const reader = output.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const cb of listeners) cb(value)
      }
    } finally {
      connected = false
      writer = null
      for (const cb of listeners) cb('BRIDGE_DISCONNECTED\n')
    }
  })()
}

export function isBridgeConnected(): boolean {
  return connected
}

export function subscribeToReplOutput(cb: ReplChunkListener): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function sendToRepl(msg: string): void {
  writer?.write(msg + '\n')
}

/** Inline Node.js script for the bridge process inside WebContainer. */
export const BRIDGE_SCRIPT = `
const http = require('http')
process.stdin.setEncoding('utf8')

// Forward newline-delimited JSON lines from stdin → POST /send
let buf = ''
process.stdin.on('data', chunk => {
  buf += chunk
  while (true) {
    const nl = buf.indexOf('\\n')
    if (nl < 0) break
    const line = buf.slice(0, nl).trim()
    buf = buf.slice(nl + 1)
    if (!line) continue
    http.request(
      { hostname: 'localhost', port: 3010, path: '/send', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(line) } },
      r => r.resume()
    ).end(line)
  }
})

// Connect to SSE /events and pipe to stdout
;(function connect() {
  const req = http.get('http://localhost:3010/events', res => {
    if (res.statusCode !== 200) { setTimeout(connect, 500); return }
    process.stdout.write('BRIDGE_CONNECTED\\n')
    res.on('data', c => process.stdout.write(c.toString()))
    res.on('end', () => { process.stdout.write('BRIDGE_DISCONNECTED\\n'); setTimeout(connect, 500) })
  })
  req.on('error', () => setTimeout(connect, 500))
})()
`
