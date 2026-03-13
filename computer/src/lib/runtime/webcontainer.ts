import { WebContainer } from '@webcontainer/api'
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

type Listener<T> = (value: T) => void

let bootPromise: Promise<WebContainer> | null = null

function getOrBootInstance(): Promise<WebContainer> {
  if (!bootPromise) {
    bootPromise = WebContainer.boot()
  }
  return bootPromise
}

let sessionCounter = 0

export class WebContainerRuntime implements ComputerRuntime {
  readonly tier: RuntimeTier = 'webcontainer'
  private _status: RuntimeStatus = 'stopped'
  private _container: WebContainer | null = null

  private statusListeners = new Set<Listener<RuntimeStatus>>()
  private metricsListeners = new Set<Listener<RuntimeMetrics>>()
  private processListeners = new Set<Listener<RuntimeProcess[]>>()
  private agentListeners = new Set<Listener<RuntimeAgent[]>>()
  private logListeners = new Set<Listener<LogEntry>>()
  private networkListeners = new Set<Listener<NetworkEntry>>()

  private metricsInterval: ReturnType<typeof setInterval> | null = null
  private processInterval: ReturnType<typeof setInterval> | null = null

  get status(): RuntimeStatus {
    return this._status
  }

  get container(): WebContainer | null {
    return this._container
  }

  private setStatus(status: RuntimeStatus) {
    this._status = status
    for (const cb of this.statusListeners) cb(status)
  }

  async boot(): Promise<void> {
    if (this._status === 'running' || this._status === 'booting') return

    this.setStatus('booting')
    try {
      this._container = await getOrBootInstance()
      this.setStatus('running')
      this.startPolling()
    } catch (err) {
      this.setStatus('error')
      this.emitLog('error', 'runtime', `Boot failed: ${err}`)
      throw err
    }
  }

  async shutdown(): Promise<void> {
    this.stopPolling()
    this._container = null
    this.setStatus('stopped')
  }

  async createTerminalSession(): Promise<TerminalSession> {
    if (!this._container) {
      throw new Error('WebContainer not booted')
    }

    const id = `wc-session-${++sessionCounter}`
    const process = await this._container.spawn('jsh', {
      terminal: { cols: 80, rows: 24 },
    })

    const dataListeners = new Set<Listener<string>>()
    const reader = process.output.getReader()

    // Read output stream
    const readLoop = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          for (const cb of dataListeners) cb(value)
        }
      } catch {
        // Stream closed
      }
    }
    readLoop()

    const writer = process.input.getWriter()

    return {
      id,
      write(data: string) {
        writer.write(data)
      },
      onData(cb: Listener<string>) {
        dataListeners.add(cb)
        return () => { dataListeners.delete(cb) }
      },
      resize(cols: number, rows: number) {
        process.resize({ cols, rows })
      },
      dispose() {
        dataListeners.clear()
        writer.close()
        reader.cancel()
        process.kill()
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

  private emitLog(level: LogEntry['level'], source: string, message: string) {
    const entry: LogEntry = { timestamp: Date.now(), level, source, message }
    for (const cb of this.logListeners) cb(entry)
  }

  private startPolling() {
    // Metrics: memory estimate, CPU N/A on free tier
    this.metricsInterval = setInterval(() => {
      const metrics: RuntimeMetrics = {
        cpuPercent: null,
        memoryUsedMB: (performance as any).memory?.usedJSHeapSize
          ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)
          : null,
        memoryTotalMB: (performance as any).memory?.jsHeapSizeLimit
          ? Math.round((performance as any).memory.jsHeapSizeLimit / 1024 / 1024)
          : null,
      }
      for (const cb of this.metricsListeners) cb(metrics)
    }, 5000)

    // Process list: poll via ps
    this.processInterval = setInterval(() => {
      this.pollProcesses()
    }, 10000)
  }

  private stopPolling() {
    if (this.metricsInterval) clearInterval(this.metricsInterval)
    if (this.processInterval) clearInterval(this.processInterval)
    this.metricsInterval = null
    this.processInterval = null
  }

  private async pollProcesses() {
    if (!this._container) return
    try {
      const proc = await this._container.spawn('ps', [])
      const reader = proc.output.getReader()
      let output = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        output += value
      }
      const processes = this.parsePsOutput(output)
      for (const cb of this.processListeners) cb(processes)
    } catch {
      // Ignore poll failures
    }
  }

  private parsePsOutput(output: string): RuntimeProcess[] {
    const lines = output.trim().split('\n')
    if (lines.length <= 1) return []
    return lines.slice(1).map((line) => {
      const parts = line.trim().split(/\s+/)
      return {
        pid: parseInt(parts[0], 10) || 0,
        command: parts.slice(1).join(' '),
        cpu: null,
        memoryMB: null,
      }
    })
  }
}
