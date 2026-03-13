// WebSocket protocol for Fly.io runtime communication

// --- Client → Server messages ---

export interface TerminalInputMessage {
  type: 'terminal.input'
  sessionId: string
  data: string
}

export interface TerminalResizeMessage {
  type: 'terminal.resize'
  sessionId: string
  cols: number
  rows: number
}

export interface TerminalOpenMessage {
  type: 'terminal.open'
  sessionId: string
}

export interface TerminalCloseMessage {
  type: 'terminal.close'
  sessionId: string
}

export interface SubscribeMessage {
  type: 'subscribe'
  channels: SubscriptionChannel[]
}

export type SubscriptionChannel =
  | 'metrics'
  | 'processes'
  | 'agents'
  | 'logs'
  | 'network'

export type ClientMessage =
  | TerminalInputMessage
  | TerminalResizeMessage
  | TerminalOpenMessage
  | TerminalCloseMessage
  | SubscribeMessage

// --- Server → Client messages ---

export interface TerminalDataMessage {
  type: 'terminal.data'
  sessionId: string
  data: string
}

export interface TerminalOpenedMessage {
  type: 'terminal.opened'
  sessionId: string
}

export interface MetricsMessage {
  type: 'metrics'
  cpuPercent: number | null
  memoryUsedMB: number | null
  memoryTotalMB: number | null
}

export interface ProcessesMessage {
  type: 'processes'
  processes: Array<{
    pid: number
    command: string
    cpu: number | null
    memoryMB: number | null
  }>
}

export interface AgentsMessage {
  type: 'agents'
  agents: Array<{
    id: string
    name: string
    status: 'idle' | 'running' | 'error'
    spaceId?: string
  }>
}

export interface LogMessage {
  type: 'log'
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'debug'
  source: string
  message: string
}

export interface NetworkMessage {
  type: 'network'
  id: string
  timestamp: number
  method: string
  url: string
  status: number | null
  durationMs: number | null
  sizeBytes: number | null
}

export interface AuthOkMessage {
  type: 'auth.ok'
}

export interface AuthFailMessage {
  type: 'auth.fail'
  reason: string
}

export interface ErrorMessage {
  type: 'error'
  message: string
}

export type ServerMessage =
  | TerminalDataMessage
  | TerminalOpenedMessage
  | MetricsMessage
  | ProcessesMessage
  | AgentsMessage
  | LogMessage
  | NetworkMessage
  | AuthOkMessage
  | AuthFailMessage
  | ErrorMessage

// --- Helpers ---

export function encodeMessage(msg: ClientMessage): string {
  return JSON.stringify(msg)
}

export function decodeMessage(data: string): ServerMessage {
  return JSON.parse(data) as ServerMessage
}
