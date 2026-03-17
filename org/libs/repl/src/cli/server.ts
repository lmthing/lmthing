import { createServer, type Server } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, join, extname } from 'node:path'
import { WebSocketServer, type WebSocket } from 'ws'
import { Session } from '../session/session'
import { ReplSessionServer } from '../rpc/server'
import type { SessionEvent } from '../session/types'

export interface ServerOptions {
  port: number
  session: Session
  staticDir?: string
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

/**
 * Create and start the WebSocket server for the REPL.
 */
export function createReplServer(options: ServerOptions): { server: Server; close: () => void } {
  const { port, session, staticDir } = options
  const rpcServer = new ReplSessionServer(session)

  const httpServer = createServer((req, res) => {
    if (!staticDir) {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<html><body><h1>@lmthing/repl</h1><p>WebSocket endpoint ready.</p></body></html>')
      return
    }

    // Serve static files
    const urlPath = req.url === '/' ? '/index.html' : req.url!
    const filePath = join(staticDir, urlPath)

    if (!existsSync(filePath)) {
      // SPA fallback
      const indexPath = join(staticDir, 'index.html')
      if (existsSync(indexPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(readFileSync(indexPath))
        return
      }
      res.writeHead(404)
      res.end('Not found')
      return
    }

    const ext = extname(filePath)
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': contentType })
    res.end(readFileSync(filePath))
  })

  const wss = new WebSocketServer({ server: httpServer })

  wss.on('connection', (ws: WebSocket) => {
    // Subscribe to session events
    const listener = (event: SessionEvent) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(event))
      }
    }
    session.on('event', listener)

    // Handle incoming messages
    ws.on('message', async (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString())
        switch (msg.type) {
          case 'sendMessage':
            await rpcServer.sendMessage(msg.text)
            break
          case 'submitForm':
            await rpcServer.submitForm(msg.formId, msg.data)
            break
          case 'cancelAsk':
            await rpcServer.cancelAsk(msg.formId)
            break
          case 'cancelTask':
            await rpcServer.cancelTask(msg.taskId, msg.message)
            break
          case 'pause':
            await rpcServer.pause()
            break
          case 'resume':
            await rpcServer.resume()
            break
          case 'intervene':
            await rpcServer.intervene(msg.text)
            break
          case 'getSnapshot':
            const snapshot = await rpcServer.getSnapshot()
            ws.send(JSON.stringify({ type: 'snapshot', data: snapshot }))
            break
        }
      } catch (err) {
        ws.send(JSON.stringify({
          type: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
        }))
      }
    })

    ws.on('close', () => {
      session.off('event', listener)
    })
  })

  httpServer.listen(port)

  return {
    server: httpServer,
    close: () => {
      wss.close()
      httpServer.close()
    },
  }
}
