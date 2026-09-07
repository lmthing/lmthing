import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import net from 'node:net'
import { createPodServer } from '../src/proxy.js'

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)))
}

test('proxy: /api/health is 503 when nothing is listening on the backend port', async () => {
  // An arbitrary port nothing is bound to.
  const proxy = createPodServer({ backendPort: 1 })
  const port = await listen(proxy)
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`)
    assert.equal(res.status, 503)
  } finally {
    proxy.close()
  }
})

test('proxy: /api/health is 200 once a backend is actually listening', async () => {
  const backend = http.createServer((_req, res) => res.end('backend'))
  const backendPort = await listen(backend)
  const proxy = createPodServer({ backendPort })
  const port = await listen(proxy)
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`)
    assert.equal(res.status, 200)
  } finally {
    proxy.close()
    backend.close()
  }
})

test('proxy: forwards a normal GET request to the backend, preserving status and body', async () => {
  const backend = http.createServer((req, res) => {
    res.writeHead(201, { 'x-from-backend': '1' })
    res.end(`echo:${req.url}`)
  })
  const backendPort = await listen(backend)
  const proxy = createPodServer({ backendPort })
  const port = await listen(proxy)
  try {
    const res = await fetch(`http://127.0.0.1:${port}/some/path?x=1`)
    assert.equal(res.status, 201)
    assert.equal(res.headers.get('x-from-backend'), '1')
    assert.equal(await res.text(), 'echo:/some/path?x=1')
  } finally {
    proxy.close()
    backend.close()
  }
})

test('proxy: rewrites Host to loopback and strips Origin before forwarding (dsh trust-fence fix, see module doc comment)', async () => {
  let seenHeaders
  const backend = http.createServer((req, res) => {
    seenHeaders = req.headers
    res.end('ok')
  })
  const backendPort = await listen(backend)
  const proxy = createPodServer({ backendPort })
  const port = await listen(proxy)
  try {
    await fetch(`http://127.0.0.1:${port}/api/agentPreset.list`, {
      headers: { host: 'lmthing-dsh.user-123.svc.cluster.local:8080', origin: 'https://lmthing.chat' },
    })
    assert.equal(seenHeaders.host, `127.0.0.1:${backendPort}`)
    assert.equal(seenHeaders.origin, undefined)
  } finally {
    proxy.close()
    backend.close()
  }
})

test('proxy: returns 502 when the backend refuses the connection', async () => {
  const proxy = createPodServer({ backendPort: 1 })
  const port = await listen(proxy)
  try {
    const res = await fetch(`http://127.0.0.1:${port}/anything`)
    assert.equal(res.status, 502)
  } finally {
    proxy.close()
  }
})

test('proxy: upgrades (WebSocket-style) are replayed to the backend over a raw socket, with Host rewritten to loopback and Origin stripped', async () => {
  // A raw TCP "backend" that hand-answers the HTTP Upgrade handshake, so this
  // test exercises the proxy's manual upgrade-replay path (src/proxy.js) without
  // depending on a real WebSocket library.
  let receivedRequestLine = ''
  const backend = net.createServer((socket) => {
    let buf = ''
    socket.on('data', (chunk) => {
      buf += chunk.toString('utf8')
      if (buf.includes('\r\n\r\n')) {
        receivedRequestLine = buf
        socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n')
        socket.write('hello-from-backend')
      }
    })
  })
  await new Promise((resolve) => backend.listen(0, '127.0.0.1', resolve))
  const backendPort = backend.address().port

  const proxy = createPodServer({ backendPort })
  const port = await listen(proxy)
  try {
    const client = net.connect({ host: '127.0.0.1', port })
    const received = await new Promise((resolve, reject) => {
      let data = ''
      client.on('data', (chunk) => {
        data += chunk.toString('utf8')
        if (data.includes('hello-from-backend')) resolve(data)
      })
      client.on('error', reject)
      client.on('connect', () => {
        client.write(
          'GET /ws HTTP/1.1\r\nHost: lmthing-dsh.user-123.svc.cluster.local:8080\r\n' +
            'Origin: https://lmthing.chat\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n' +
            'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n',
        )
      })
    })
    assert.match(received, /101 Switching Protocols/)
    assert.match(received, /hello-from-backend/)
    assert.match(receivedRequestLine, new RegExp(`Host: 127\\.0\\.0\\.1:${backendPort}`))
    assert.ok(!/Origin:/i.test(receivedRequestLine), 'Origin must be stripped, not just left stale, on the loopback hop')
    client.destroy()
  } finally {
    proxy.close()
    backend.close()
  }
})
