import type { WebSocket } from 'ws'
import { createTerminal, type ManagedTerminal } from './terminal.js'
import { getCpuPercent, getMemoryInfo } from './metrics.js'
import { listProcesses } from './processes.js'

type SubscriptionChannel = 'metrics' | 'processes' | 'agents' | 'logs' | 'network'

interface ClientState {
  userId: string
  spaceId?: string
  subscriptions: Set<SubscriptionChannel>
  terminals: Map<string, ManagedTerminal>
  intervals: Set<ReturnType<typeof setInterval>>
}

const METRICS_INTERVAL_MS = 2_000
const PROCESSES_INTERVAL_MS = 5_000

/**
 * Handle an authenticated WebSocket connection.
 * Implements the server half of the flyio-protocol.
 */
export function handleConnection(
  ws: WebSocket,
  userId: string,
  spaceId?: string,
): void {
  const state: ClientState = {
    userId,
    spaceId,
    subscriptions: new Set(),
    terminals: new Map(),
    intervals: new Set(),
  }

  // Confirm auth
  send(ws, { type: 'auth.ok' })

  ws.on('message', (raw) => {
    let msg: any
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      send(ws, { type: 'error', message: 'Invalid JSON' })
      return
    }

    switch (msg.type) {
      case 'subscribe':
        handleSubscribe(ws, state, msg.channels ?? [])
        break
      case 'terminal.open':
        handleTerminalOpen(ws, state, msg.sessionId)
        break
      case 'terminal.input':
        handleTerminalInput(state, msg.sessionId, msg.data)
        break
      case 'terminal.resize':
        handleTerminalResize(state, msg.sessionId, msg.cols, msg.rows)
        break
      case 'terminal.close':
        handleTerminalClose(state, msg.sessionId)
        break
      default:
        send(ws, { type: 'error', message: `Unknown message type: ${msg.type}` })
    }
  })

  ws.on('close', () => cleanup(state))
  ws.on('error', () => cleanup(state))
}

function handleSubscribe(
  ws: WebSocket,
  state: ClientState,
  channels: SubscriptionChannel[],
): void {
  for (const channel of channels) {
    if (state.subscriptions.has(channel)) continue
    state.subscriptions.add(channel)

    switch (channel) {
      case 'metrics': {
        const interval = setInterval(async () => {
          const [cpuPercent, mem] = await Promise.all([getCpuPercent(), getMemoryInfo()])
          send(ws, {
            type: 'metrics',
            cpuPercent,
            memoryUsedMB: mem.usedMb,
            memoryTotalMB: mem.totalMb,
          })
        }, METRICS_INTERVAL_MS)
        state.intervals.add(interval)
        break
      }
      case 'processes': {
        const interval = setInterval(async () => {
          const processes = await listProcesses()
          send(ws, {
            type: 'processes',
            processes: processes.map((p) => ({
              pid: p.pid,
              command: p.command,
              cpu: p.cpu,
              memoryMB: p.memoryMB,
            })),
          })
        }, PROCESSES_INTERVAL_MS)
        state.intervals.add(interval)
        break
      }
      case 'agents': {
        // Send current agent list (empty for now — agents are managed externally)
        send(ws, { type: 'agents', agents: [] })
        break
      }
      case 'logs':
      case 'network':
        // These channels push data as events occur — nothing to poll
        break
    }
  }
}

function handleTerminalOpen(ws: WebSocket, state: ClientState, sessionId: string): void {
  if (state.terminals.has(sessionId)) {
    send(ws, { type: 'error', message: `Session ${sessionId} already exists` })
    return
  }

  const terminal = createTerminal()

  terminal.onData((data) => {
    send(ws, { type: 'terminal.data', sessionId, data })
  })

  state.terminals.set(sessionId, terminal)
  send(ws, { type: 'terminal.opened', sessionId })
}

function handleTerminalInput(state: ClientState, sessionId: string, data: string): void {
  const terminal = state.terminals.get(sessionId)
  if (terminal) terminal.write(data)
}

function handleTerminalResize(
  state: ClientState,
  sessionId: string,
  cols: number,
  rows: number,
): void {
  const terminal = state.terminals.get(sessionId)
  if (terminal) terminal.resize(cols, rows)
}

function handleTerminalClose(state: ClientState, sessionId: string): void {
  const terminal = state.terminals.get(sessionId)
  if (terminal) {
    terminal.kill()
    state.terminals.delete(sessionId)
  }
}

function cleanup(state: ClientState): void {
  for (const interval of state.intervals) {
    clearInterval(interval)
  }
  state.intervals.clear()

  for (const terminal of state.terminals.values()) {
    terminal.kill()
  }
  state.terminals.clear()

  state.subscriptions.clear()
}

function send(ws: WebSocket, msg: Record<string, unknown>): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg))
  }
}
