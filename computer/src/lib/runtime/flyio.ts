import type {
  ComputerRuntime,
  RuntimeTier,
  RuntimeStatus,
  RuntimeMetrics,
  RuntimeProcess,
  RuntimeAgent,
  LogEntry,
  NetworkEntry,
  TerminalSession,
} from './types'
import type { ClientMessage, ServerMessage } from './flyio-protocol'
import { encodeMessage, decodeMessage } from './flyio-protocol'

type Listener<T> = (value: T) => void

const MAX_RETRIES = 5
const BASE_DELAY_MS = 1000

let sessionCounter = 0

export interface FlyioRuntimeOptions {
  /** The user's Fly.io app hostname, e.g. "user-abc123.fly.dev" */
  appHost: string
  /** Cloud API base URL for token issuance */
  cloudBaseUrl: string
  /** Authorization header value (Bearer JWT or lmt_ key) */
  authHeader: string
}

export class FlyioRuntime implements ComputerRuntime {
  readonly tier: RuntimeTier = 'flyio'
  private _status: RuntimeStatus = 'stopped'
  private ws: WebSocket | null = null
  private token: string | null = null
  private retryCount = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private disposed = false

  private readonly appHost: string
  private readonly cloudBaseUrl: string
  private readonly authHeader: string

  private statusListeners = new Set<Listener<RuntimeStatus>>()
  private metricsListeners = new Set<Listener<RuntimeMetrics>>()
  private processListeners = new Set<Listener<RuntimeProcess[]>>()
  private agentListeners = new Set<Listener<RuntimeAgent[]>>()
  private logListeners = new Set<Listener<LogEntry>>()
  private networkListeners = new Set<Listener<NetworkEntry>>()

  private terminalDataListeners = new Map<string, Set<Listener<string>>>()

  constructor(options: FlyioRuntimeOptions) {
    this.appHost = options.appHost
    this.cloudBaseUrl = options.cloudBaseUrl
    this.authHeader = options.authHeader
  }

  get status(): RuntimeStatus {
    return this._status
  }

  private setStatus(status: RuntimeStatus) {
    this._status = status
    for (const cb of this.statusListeners) cb(status)
  }

  async boot(): Promise<void> {
    if (this._status === 'running' || this._status === 'booting') return

    this.disposed = false
    this.retryCount = 0
    this.setStatus('booting')

    try {
      await this.connect()
    } catch (err) {
      this.setStatus('error')
      this.emitLog('error', 'runtime', `Boot failed: ${err}`)
      throw err
    }
  }

  async shutdown(): Promise<void> {
    this.disposed = true
    this.clearReconnectTimer()
    if (this.ws) {
      this.ws.close(1000, 'shutdown')
      this.ws = null
    }
    this.token = null
    this.setStatus('stopped')
  }

  async createTerminalSession(): Promise<TerminalSession> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to Fly.io runtime')
    }

    const id = `fly-session-${++sessionCounter}`
    const dataListeners = new Set<Listener<string>>()
    this.terminalDataListeners.set(id, dataListeners)

    // Request the server to open a terminal session
    this.send({ type: 'terminal.open', sessionId: id })

    return {
      id,
      write: (data: string) => {
        this.send({ type: 'terminal.input', sessionId: id, data })
      },
      onData: (cb: Listener<string>) => {
        dataListeners.add(cb)
        return () => { dataListeners.delete(cb) }
      },
      resize: (cols: number, rows: number) => {
        this.send({ type: 'terminal.resize', sessionId: id, cols, rows })
      },
      dispose: () => {
        this.send({ type: 'terminal.close', sessionId: id })
        dataListeners.clear()
        this.terminalDataListeners.delete(id)
      },
    }
  }

  onStatusChange(cb: Listener<RuntimeStatus>) {
    this.statusListeners.add(cb)
    return () => { this.statusListeners.delete(cb) }
  }

  onMetrics(cb: Listener<RuntimeMetrics>) {
    this.metricsListeners.add(cb)
    return () => { this.metricsListeners.delete(cb) }
  }

  onProcessList(cb: Listener<RuntimeProcess[]>) {
    this.processListeners.add(cb)
    return () => { this.processListeners.delete(cb) }
  }

  onAgentList(cb: Listener<RuntimeAgent[]>) {
    this.agentListeners.add(cb)
    return () => { this.agentListeners.delete(cb) }
  }

  onLog(cb: Listener<LogEntry>) {
    this.logListeners.add(cb)
    return () => { this.logListeners.delete(cb) }
  }

  onNetwork(cb: Listener<NetworkEntry>) {
    this.networkListeners.add(cb)
    return () => { this.networkListeners.delete(cb) }
  }

  // --- Private ---

  private async fetchToken(): Promise<string> {
    const res = await fetch(`${this.cloudBaseUrl}/functions/v1/issue-computer-token`, {
      method: 'POST',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.error?.message ?? `Token issuance failed (${res.status})`)
    }

    const { token } = await res.json()
    return token
  }

  private async connect(): Promise<void> {
    // Always fetch a fresh token before connecting (token may have expired)
    this.token = await this.fetchToken()

    return new Promise<void>((resolve, reject) => {
      const url = `wss://${this.appHost}/ws?token=${encodeURIComponent(this.token!)}`
      const ws = new WebSocket(url)
      this.ws = ws

      ws.onopen = () => {
        // Subscribe to all channels
        this.send({
          type: 'subscribe',
          channels: ['metrics', 'processes', 'agents', 'logs', 'network'],
        })
      }

      ws.onmessage = (event) => {
        const msg = decodeMessage(event.data as string)
        this.handleMessage(msg, resolve, reject)
      }

      ws.onerror = () => {
        // onclose will fire after this — handle reconnect there
      }

      ws.onclose = (event) => {
        if (this.disposed) return

        // If we never resolved (still booting), reject
        if (this._status === 'booting') {
          reject(new Error(`WebSocket closed during boot (code ${event.code})`))
          return
        }

        this.emitLog('warn', 'runtime', `Connection lost (code ${event.code})`)
        this.setStatus('error')
        this.scheduleReconnect()
      }
    })
  }

  private handleMessage(
    msg: ServerMessage,
    onConnected?: (value: void) => void,
    onFailed?: (reason: Error) => void,
  ) {
    switch (msg.type) {
      case 'auth.ok':
        this.retryCount = 0
        this.setStatus('running')
        this.emitLog('info', 'runtime', 'Connected to Fly.io runtime')
        onConnected?.()
        break

      case 'auth.fail':
        this.emitLog('error', 'runtime', `Auth failed: ${msg.reason}`)
        this.setStatus('error')
        this.ws?.close()
        onFailed?.(new Error(`Auth failed: ${msg.reason}`))
        break

      case 'terminal.data': {
        const listeners = this.terminalDataListeners.get(msg.sessionId)
        if (listeners) {
          for (const cb of listeners) cb(msg.data)
        }
        break
      }

      case 'terminal.opened':
        // Session acknowledged by server — no action needed
        break

      case 'metrics':
        for (const cb of this.metricsListeners) {
          cb({
            cpuPercent: msg.cpuPercent,
            memoryUsedMB: msg.memoryUsedMB,
            memoryTotalMB: msg.memoryTotalMB,
          })
        }
        break

      case 'processes':
        for (const cb of this.processListeners) cb(msg.processes)
        break

      case 'agents':
        for (const cb of this.agentListeners) cb(msg.agents)
        break

      case 'log':
        for (const cb of this.logListeners) {
          cb({
            timestamp: msg.timestamp,
            level: msg.level,
            source: msg.source,
            message: msg.message,
          })
        }
        break

      case 'network':
        for (const cb of this.networkListeners) {
          cb({
            id: msg.id,
            timestamp: msg.timestamp,
            method: msg.method,
            url: msg.url,
            status: msg.status,
            durationMs: msg.durationMs,
            sizeBytes: msg.sizeBytes,
          })
        }
        break

      case 'error':
        this.emitLog('error', 'server', msg.message)
        break
    }
  }

  private send(msg: ClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(encodeMessage(msg))
    }
  }

  private emitLog(level: LogEntry['level'], source: string, message: string) {
    const entry: LogEntry = { timestamp: Date.now(), level, source, message }
    for (const cb of this.logListeners) cb(entry)
  }

  private scheduleReconnect() {
    if (this.disposed || this.retryCount >= MAX_RETRIES) {
      if (this.retryCount >= MAX_RETRIES) {
        this.emitLog('error', 'runtime', 'Max reconnection attempts reached')
      }
      return
    }

    const delay = BASE_DELAY_MS * Math.pow(2, this.retryCount)
    this.retryCount++
    this.emitLog('info', 'runtime', `Reconnecting in ${delay}ms (attempt ${this.retryCount}/${MAX_RETRIES})`)

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect()
      } catch {
        // connect() failure will trigger onclose → scheduleReconnect again
      }
    }, delay)
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
}
