import { createServer, type Server } from 'node:http'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join, extname } from 'node:path'
import { WebSocketServer, type WebSocket } from 'ws'
import { Session } from '@lmthing/repl'
import type { SessionEvent } from '@lmthing/repl'
import { ReplSessionServer } from '../rpc/server'
import { AgentLoop } from './agent-loop'

export interface ServerOptions {
  port: number
  session: Session
  agentLoop?: AgentLoop
  staticDir?: string
  /** In-memory web assets: relative path → base64-encoded content */
  webAssets?: Record<string, string>
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
  const { port, session, agentLoop, staticDir, webAssets, conversationsDir } = options
  const rpcServer = new ReplSessionServer(session)

  const httpServer = createServer((req, res) => {
    // SSE + POST API endpoints (must come before static file handling)

    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      })
      res.end()
      return
    }

    // SSE stream: GET /events
    if (req.method === 'GET' && req.url?.split('?')[0] === '/events') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })
      res.flushHeaders()

      const send = (event: SessionEvent) => {
        if (!res.destroyed) {
          res.write(`data: ${JSON.stringify(event)}\n\n`)
        }
      }

      session.on('event', send)

      // Send initial snapshot so the client has current state immediately
      rpcServer.getSnapshot().then(snapshot => {
        if (!res.destroyed) {
          res.write(`data: ${JSON.stringify({ type: 'snapshot', data: snapshot })}\n\n`)
        }
      }).catch(() => {})

      req.on('close', () => {
        session.off('event', send)
      })
      return
    }

    // Command dispatch: POST /send
    if (req.method === 'POST' && req.url?.split('?')[0] === '/send') {
      const chunks: Buffer[] = []
      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', async () => {
        const corsHeaders = {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        }
        try {
          const msg = JSON.parse(Buffer.concat(chunks).toString())
          switch (msg.type) {
            case 'sendMessage':
              if (agentLoop) {
                agentLoop.handleMessage(msg.text).catch(err => {
                  console.error('[server] agent loop error:', err)
                })
              } else {
                await rpcServer.sendMessage(msg.text)
              }
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
          }
          res.writeHead(200, corsHeaders)
          res.end('{"ok":true}')
        } catch (err) {
          res.writeHead(400, corsHeaders)
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }))
        }
      })
      return
    }

    // In-memory assets take priority over staticDir
    if (webAssets) {
      const urlPath = req.url === '/' ? 'index.html' : req.url!.split('?')[0].replace(/^\//, '')
      const b64 = webAssets[urlPath]
      if (b64) {
        const contentType = MIME_TYPES[extname(urlPath)] ?? 'application/octet-stream'
        res.writeHead(200, { 'Content-Type': contentType })
        res.end(Buffer.from(b64, 'base64'))
        return
      }
      // SPA fallback
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(Buffer.from(webAssets['index.html'] ?? '', 'base64'))
      return
    }

    if (!staticDir) {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<html><body><h1>@lmthing/repl</h1><p>WebSocket endpoint ready.</p></body></html>')
      return
    }

    // Serve static files from disk (dev mode)
    const urlPath = req.url === '/' ? '/index.html' : req.url!.split('?')[0]
    const filePath = join(staticDir, urlPath)

    if (!existsSync(filePath)) {
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
