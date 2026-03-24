import { createServer, type Server } from 'node:http'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { resolve, join, extname } from 'node:path'
import { WebSocketServer, type WebSocket } from 'ws'
import { Session } from '../session/session'
import { ReplSessionServer } from '../rpc/server'
import { AgentLoop } from './agent-loop'
import type { SessionEvent } from '../session/types'

export interface ServerOptions {
  port: number
  session: Session
  agentLoop?: AgentLoop
  staticDir?: string
  conversationsDir?: string
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

/**
 * Create and start the WebSocket server for the REPL.
 */
const VALID_ID = /^[a-zA-Z0-9_-]+$/

export function createReplServer(options: ServerOptions): { server: Server; close: () => void } {
  const { port, session, agentLoop, staticDir, conversationsDir } = options
  const rpcServer = new ReplSessionServer(session)

  const httpServer = createServer((req, res) => {
    if (!staticDir) {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<html><body><h1>@lmthing/repl</h1><p>WebSocket endpoint ready.</p></body></html>')
      return
    }

    // Serve static files
    const urlPath = req.url === '/' ? '/index.html' : req.url!.split('?')[0]
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
            if (agentLoop) {
              // Agent loop drives the LLM — fire and forget
              agentLoop.handleMessage(msg.text).catch(err => {
                console.error('[server] agent loop error:', err)
              })
            } else {
              await rpcServer.sendMessage(msg.text)
            }
            break
          case 'submitForm':
            console.log(`\x1b[90m  [ws] submitForm ${msg.formId} keys=[${Object.keys(msg.data ?? {}).join(', ')}]\x1b[0m`)
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
            if (agentLoop) {
              agentLoop.handleMessage(msg.text).catch(err => {
                console.error('[server] agent loop error:', err)
              })
            } else {
              await rpcServer.intervene(msg.text)
            }
            break
          case 'getSnapshot':
            const snapshot = await rpcServer.getSnapshot()
            ws.send(JSON.stringify({ type: 'snapshot', data: snapshot }))
            // Send available actions if agent loop has them
            if (agentLoop) {
              const actions = agentLoop.getActions()
              if (actions.length > 0) {
                ws.send(JSON.stringify({ type: 'actions', data: actions }))
              }
            }
            break
          case 'getConversationState':
            const convState = await rpcServer.getConversationState()
            ws.send(JSON.stringify({ type: 'conversationState', data: convState }))
            break
          case 'saveConversation': {
            if (conversationsDir && msg.id && VALID_ID.test(msg.id)) {
              if (!existsSync(conversationsDir)) mkdirSync(conversationsDir, { recursive: true })
              const state = await rpcServer.getConversationState()
              writeFileSync(join(conversationsDir, `${msg.id}.json`), JSON.stringify(state, null, 2))
              ws.send(JSON.stringify({ type: 'conversationSaved', id: msg.id }))
            }
            break
          }
          case 'listConversations': {
            const summaries: Array<{ id: string; title: string; updatedAt: string; turnCount: number }> = []
            if (conversationsDir && existsSync(conversationsDir)) {
              const files = readdirSync(conversationsDir).filter(f => f.endsWith('.json'))
              for (const f of files) {
                try {
                  const content = readFileSync(join(conversationsDir, f), 'utf-8')
                  const s = JSON.parse(content)
                  const id = f.replace('.json', '')
                  const firstUser = s.turns?.find((t: any) => t.role === 'user')
                  const last = s.turns?.[s.turns.length - 1]
                  summaries.push({
                    id,
                    title: firstUser?.message?.slice(0, 50) || 'Untitled',
                    updatedAt: last ? new Date(last.endedAt).toISOString() : new Date(s.startedAt).toISOString(),
                    turnCount: s.turns?.length || 0,
                  })
                } catch { /* skip corrupt files */ }
              }
              summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            }
            ws.send(JSON.stringify({ type: 'conversations', data: summaries }))
            break
          }
          case 'loadConversation': {
            if (conversationsDir && msg.id && VALID_ID.test(msg.id)) {
              const convPath = join(conversationsDir, `${msg.id}.json`)
              if (existsSync(convPath)) {
                try {
                  const content = readFileSync(convPath, 'utf-8')
                  ws.send(JSON.stringify({ type: 'conversationLoaded', id: msg.id, data: JSON.parse(content) }))
                } catch {
                  ws.send(JSON.stringify({ type: 'error', message: 'Failed to parse conversation file' }))
                }
              }
            }
            break
          }
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
