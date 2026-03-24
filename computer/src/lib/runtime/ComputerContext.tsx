import { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react'
import type { WebContainer } from '@webcontainer/api'
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
import { WebContainerRuntime } from './webcontainer'
import { PodRuntime } from './pod'
import { defaultTemplate } from './template'
import { buildFileTree, watchFileSystem } from './file-watcher'
import { useIdeStore } from '../store'

export interface ComputerContextValue {
  runtime: ComputerRuntime | null
  container: WebContainer | null
  tier: RuntimeTier
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
  initIDE(): Promise<void>
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

interface PodConfig {
  computerBaseUrl: string
  accessToken: string
}

interface ComputerProviderProps {
  children: React.ReactNode
  tier?: RuntimeTier
  podConfig?: PodConfig
}

export function ComputerProvider({ children, tier = 'webcontainer', podConfig }: ComputerProviderProps) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const runtimeRef = useRef<ComputerRuntime | null>(null)
  const ideInitRef = useRef(false)

  useEffect(() => {
    if (tier === 'webcontainer') {
      runtimeRef.current = new WebContainerRuntime()
    } else if (tier === 'pod' && podConfig) {
      runtimeRef.current = new PodRuntime(podConfig)
    }

    const rt = runtimeRef.current
    if (!rt) return

    const unsubs = [
      rt.onStatusChange((status) => dispatch({ type: 'status', status })),
      rt.onMetrics((metrics) => dispatch({ type: 'metrics', metrics })),
      rt.onProcessList((processes) => dispatch({ type: 'processes', processes })),
      rt.onAgentList((agents) => dispatch({ type: 'agents', agents })),
      rt.onLog((entry) => dispatch({ type: 'log', entry })),
      rt.onNetwork((entry) => dispatch({ type: 'network', entry })),
    ]

    return () => {
      unsubs.forEach((fn) => fn())
      rt.shutdown()
    }
  }, [tier, podConfig])

  // Auto-boot
  useEffect(() => {
    const rt = runtimeRef.current
    if (rt) {
      rt.boot().catch((err) => {
        dispatch({ type: 'error', error: String(err) })
      })
    }
  }, [tier, podConfig])

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

  const initIDE = useCallback(async () => {
    const rt = runtimeRef.current
    if (!rt || ideInitRef.current) return
    ideInitRef.current = true

    const wc = rt instanceof WebContainerRuntime ? rt.container : null
    if (!wc) throw new Error('WebContainer not booted')

    const store = useIdeStore.getState()
    store.setBooting(true)

    try {
      // Mount template files
      await wc.mount(defaultTemplate as any)

      // Build initial file tree
      const tree = await buildFileTree(wc)
      store.setFileTree(tree)
      store.setBooting(false)

      // Install deps
      store.setInstalling(true)
      const installProc = await wc.spawn('pnpm', ['install'])
      await installProc.exit
      store.setInstalling(false)

      // Start dev server
      store.setRunning(true)
      await wc.spawn('pnpm', ['run', 'dev'])

      // Listen for server-ready on port 3010
      wc.on('server-ready', (port: number, url: string) => {
        if (port === 3010) store.setPreviewUrl(url)
      })

      // Watch file system
      watchFileSystem(wc, (tree) => {
        useIdeStore.getState().setFileTree(tree)
      })
    } catch (err) {
      store.setBooting(false)
      store.setInstalling(false)
      dispatch({ type: 'error', error: String(err) })
    }
  }, [])

  const value: ComputerContextValue = {
    runtime: runtimeRef.current,
    container: runtimeRef.current instanceof WebContainerRuntime ? runtimeRef.current.container : null,
    tier,
    ...state,
    boot,
    shutdown,
    createTerminalSession,
    initIDE,
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
