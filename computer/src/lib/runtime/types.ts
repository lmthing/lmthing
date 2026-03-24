// Runtime abstraction — both WebContainer and Pod backends implement this

export type RuntimeTier = 'webcontainer' | 'pod'
export type RuntimeStatus = 'booting' | 'running' | 'stopped' | 'error'

export interface RuntimeMetrics {
  cpuPercent: number | null
  memoryUsedMB: number | null
  memoryTotalMB: number | null
}

export interface RuntimeProcess {
  pid: number
  command: string
  cpu: number | null
  memoryMB: number | null
}

export interface RuntimeAgent {
  id: string
  name: string
  status: 'idle' | 'running' | 'error'
  spaceId?: string
}

export interface LogEntry {
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'debug'
  source: string
  message: string
}

export interface NetworkEntry {
  id: string
  timestamp: number
  method: string
  url: string
  status: number | null
  durationMs: number | null
  sizeBytes: number | null
}

export interface TerminalSession {
  readonly id: string
  write(data: string): void
  onData(cb: (data: string) => void): () => void
  resize(cols: number, rows: number): void
  dispose(): void
}

export interface ComputerRuntime {
  readonly tier: RuntimeTier
  readonly status: RuntimeStatus

  boot(): Promise<void>
  shutdown(): Promise<void>
  createTerminalSession(): Promise<TerminalSession>

  onStatusChange(cb: (status: RuntimeStatus) => void): () => void
  onMetrics(cb: (metrics: RuntimeMetrics) => void): () => void
  onProcessList(cb: (processes: RuntimeProcess[]) => void): () => void
  onAgentList(cb: (agents: RuntimeAgent[]) => void): () => void
  onLog(cb: (entry: LogEntry) => void): () => void
  onNetwork(cb: (entry: NetworkEntry) => void): () => void
}
