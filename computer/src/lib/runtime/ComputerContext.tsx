import { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react'
import type {
  ComputerRuntime,
  RuntimeStatus,
  RuntimeMetrics,
  RuntimeProcess,
  RuntimeAgent,
  LogEntry,
  NetworkEntry,
  TerminalSession,
} from './types'
import { PodRuntime } from './pod'

export interface ComputerContextValue {
  runtime: ComputerRuntime | null
  status: RuntimeStatus
  metrics: RuntimeMetrics
  processes: RuntimeProcess[]
  agents: RuntimeAgent[]
  logs: LogEntry[]
  network: NetworkEntry[]
  error: string | null
  boot(): Promise<void>
  shutdown(): Promise<void>
  createTerminalSession(): Promise<TerminalSession>
}

const ComputerContext = createContext<ComputerContextValue | null>(null)

interface State {
  status: RuntimeStatus
  metrics: RuntimeMetrics
  processes: RuntimeProcess[]
  agents: RuntimeAgent[]
  logs: LogEntry[]
  network: NetworkEntry[]
  error: string | null
}

type Action =
  | { type: 'status'; status: RuntimeStatus }
  | { type: 'metrics'; metrics: RuntimeMetrics }
  | { type: 'processes'; processes: RuntimeProcess[] }
  | { type: 'agents'; agents: RuntimeAgent[] }
  | { type: 'log'; entry: LogEntry }
  | { type: 'network'; entry: NetworkEntry }
  | { type: 'error'; error: string | null }

const MAX_LOGS = 500
const MAX_NETWORK = 200

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'status':
      return { ...state, status: action.status }
    case 'metrics':
      return { ...state, metrics: action.metrics }
    case 'processes':
      return { ...state, processes: action.processes }
    case 'agents':
      return { ...state, agents: action.agents }
    case 'log': {
      const logs = [...state.logs, action.entry]
      return { ...state, logs: logs.length > MAX_LOGS ? logs.slice(-MAX_LOGS) : logs }
    }
    case 'network': {
      const network = [...state.network, action.entry]
      return { ...state, network: network.length > MAX_NETWORK ? network.slice(-MAX_NETWORK) : network }
    }
    case 'error':
      return { ...state, error: action.error }
  }
}

const initialState: State = {
  status: 'stopped',
  metrics: { cpuPercent: null, memoryUsedMB: null, memoryTotalMB: null },
  processes: [],
  agents: [],
  logs: [],
  network: [],
  error: null,
}

export interface ComputerProviderProps {
  children: React.ReactNode
  computerBaseUrl: string
  accessToken: string
}

export function ComputerProvider({ children, computerBaseUrl, accessToken }: ComputerProviderProps) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const runtimeRef = useRef<ComputerRuntime | null>(null)

  useEffect(() => {
    runtimeRef.current = new PodRuntime({ computerBaseUrl, accessToken })

    const rt = runtimeRef.current

    const unsubs = [
      rt.onStatusChange((status) => dispatch({ type: 'status', status })),
      rt.onMetrics((metrics) => dispatch({ type: 'metrics', metrics })),
      rt.onProcessList((processes) => dispatch({ type: 'processes', processes })),
      rt.onAgentList((agents) => dispatch({ type: 'agents', agents })),
      rt.onLog((entry) => dispatch({ type: 'log', entry })),
      rt.onNetwork((entry) => dispatch({ type: 'network', entry })),
    ]

    rt.boot().catch((err) => {
      dispatch({ type: 'error', error: String(err) })
    })

    return () => {
      unsubs.forEach((fn) => fn())
      rt.shutdown()
      runtimeRef.current = null
    }
  }, [computerBaseUrl, accessToken])

  const boot = useCallback(async () => {
    const rt = runtimeRef.current
    if (!rt) return
    dispatch({ type: 'error', error: null })
    try { await rt.boot() } catch (err) { dispatch({ type: 'error', error: String(err) }) }
  }, [])

  const shutdown = useCallback(async () => {
    const rt = runtimeRef.current
    if (rt) await rt.shutdown()
  }, [])

  const createTerminalSession = useCallback(async () => {
    const rt = runtimeRef.current
    if (!rt) throw new Error('Runtime not initialized')
    return rt.createTerminalSession()
  }, [])

  const value: ComputerContextValue = {
    runtime: runtimeRef.current,
    ...state,
    boot,
    shutdown,
    createTerminalSession,
  }

  return (
    <ComputerContext.Provider value={value}>
      {children}
    </ComputerContext.Provider>
  )
}

export function useComputer(): ComputerContextValue {
  const ctx = useContext(ComputerContext)
  if (!ctx) throw new Error('useComputer must be used within ComputerProvider')
  return ctx
}
