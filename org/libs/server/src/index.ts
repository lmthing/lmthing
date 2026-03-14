import { createServer } from 'node:http'
import { parse as parseUrl } from 'node:url'
import { WebSocketServer } from 'ws'
import { verifyToken } from './auth.js'
import { handleConnection } from './ws-handler.js'

const PORT = parseInt(process.env.PORT ?? '8080', 10)

const server = createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }))
    return
  }

  res.writeHead(404)
  res.end()
})

const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (req, socket, head) => {
  const url = parseUrl(req.url ?? '', true)

  // Only accept connections on /ws
  if (url.pathname !== '/ws') {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n')
    socket.destroy()
    return
  }

  const token = url.query.token as string | undefined
  if (!token) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
    socket.destroy()
    return
  }

  // Verify the HMAC token
  let payload: ReturnType<typeof verifyToken>
  try {
    payload = verifyToken(token)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Auth failed'
    socket.write(`HTTP/1.1 401 ${msg}\r\n\r\n`)
    socket.destroy()
    return
  }

  // Complete the WebSocket upgrade
  wss.handleUpgrade(req, socket, head, (ws) => {
    const spaceId = (url.query.spaceId as string | undefined) ?? payload.space_id
    handleConnection(ws, payload.user_id, spaceId)
  })
})

server.listen(PORT, () => {
  console.log(`Container runtime server listening on port ${PORT}`)
})
