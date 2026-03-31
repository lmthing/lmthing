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
import { WebContainerRuntime, markIdeInitialized, isIdeInitialized } from './webcontainer'
import { PodRuntime } from './pod'
import { defaultTemplate } from './template'
import { buildFileTree, watchFileSystem } from './file-watcher'
import { hasSnapshot, restoreSnapshot, saveSnapshot } from './opfs'
import { useIdeStore } from '../store'
import { setBridgeProcess, BRIDGE_SCRIPT } from './repl-bridge'

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
    if (!rt || isIdeInitialized()) return
    markIdeInitialized()

    const wc = rt instanceof WebContainerRuntime ? rt.container : null
    if (!wc) throw new Error('WebContainer not booted')

    const store = useIdeStore.getState()
    store.setBooting(true)

    try {
      // Restore from OPFS if a snapshot exists, otherwise mount the default template
      const snapshot = await hasSnapshot()
      if (snapshot) {
        await restoreSnapshot(wc)
      } else {
        await wc.mount(defaultTemplate as any)
      }

      // Build initial file tree
      const tree = await buildFileTree(wc)
      store.setFileTree(tree)
      store.setBooting(false)

      // Listen for server-ready on any port
      wc.on('server-ready', (port: number, url: string) => {
        store.setPreviewUrl(url)
        if (window.parent !== window) {
          window.parent.postMessage({ type: 'lmthing:server-ready', url }, '*')
        }
        // Spawn bridge process to relay REPL events via process I/O.
        // WebContainer preview URLs don't work on custom local domains
        // (they require StackBlitz's CloudFront relay), so we bridge via stdin/stdout.
        // The script is written to bridge.cjs (CommonJS) since package.json has "type":"module".
        if (port === 3010) {
          wc.fs.writeFile('bridge.cjs', BRIDGE_SCRIPT).then(() =>
            wc.spawn('node', ['bridge.cjs'])
          ).then(proc => {
            setBridgeProcess(proc.output, proc.input)
          }).catch(() => {})
        }
      })

      // Install deps
      store.setInstalling(true)
      const installProc = await wc.spawn('pnpm', ['install'])
      await installProc.exit
      store.setInstalling(false)

      // Persist to OPFS after install so node_modules are cached for fast subsequent boots
      saveSnapshot(wc).catch(() => {})

      store.setInstallComplete(true)

      // Start the REPL dev server in the background.
      // Model config comes from localStorage (set via Settings) with VITE env var as fallback.
      const model = localStorage.getItem('lmthing_wc_model') || import.meta.env.VITE_COMPUTER_MODEL
      if (model) {
        const spawnEnv: Record<string, string> = {}
        const apiKey = localStorage.getItem('lmthing_wc_api_key') || import.meta.env.VITE_COMPUTER_API_KEY
        const apiBase = localStorage.getItem('lmthing_wc_api_base') || import.meta.env.VITE_COMPUTER_API_BASE
        if (apiKey) spawnEnv.OPENAI_API_KEY = apiKey
        if (apiBase) spawnEnv.OPENAI_BASE_URL = apiBase

        const devProc = await wc.spawn('node', [
          'node_modules/.bin/lmthing',
          '--space', 'spaces/knowledge',
          '--port', '3010',
          '--model', model,
        ], { env: spawnEnv })
        devProc.output.pipeTo(new WritableStream({ write() {} })).catch(() => {})
      }

      // Watch file system and debounce-sync changes to OPFS
      let syncTimer: ReturnType<typeof setTimeout> | null = null
      watchFileSystem(wc, (tree) => {
        useIdeStore.getState().setFileTree(tree)
        if (syncTimer) clearTimeout(syncTimer)
        syncTimer = setTimeout(() => { saveSnapshot(wc).catch(() => {}) }, 2000)
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
