// src/lib/contexts/AppContext.tsx

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AppFS } from '../fs/AppFS'
import { DraftStore } from '../fs/DraftStore'
import { UIStore } from '../fs/UIStore'
import { PodTransport } from '../pod/transport'
import type { PodProject } from '../../types/project'

export interface AppPodConfig {
  /** Base URL of the compute pod's REST API (no trailing slash). */
  podBaseUrl: string
  /** Returns the current access token (JWT). Called per request. */
  getAccessToken: () => string | null | undefined
}

export interface ProjectSummary {
  id: string
  name: string
  createdAt?: number | string
}

interface AppContextValue {
  appFS: AppFS
  drafts: DraftStore
  ui: UIStore
  /**
   * Pod REST transport (exposed for advanced/direct use by providers).
   * `null` when `AppProvider` is mounted without pod config (ephemeral-store
   * mode, e.g. the `computer` app which only needs AppFS/drafts/UI and never
   * calls the pod REST API itself). Pod features (`refreshProjects`,
   * `createProject`, `deleteProject`) are no-ops/empty in that mode.
   */
  transport: PodTransport | null
  projects: ProjectSummary[]
  currentProjectId: string | null
  isLoading: boolean
  error: string | null

  refreshProjects(): Promise<void>
  setCurrentProject(projectId: string): void
  createProject(name: string): Promise<{ id: string }>
  deleteProject(id: string): Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

interface AppProviderProps {
  children: ReactNode
  /** Pod connection config. Required in production (the transport is built from it). */
  pod?: AppPodConfig
  /** Optional AppFS instance for testing. If not provided, creates a new one. */
  appFS?: AppFS
  /** Optional DraftStore instance for testing. If not provided, creates a new one. */
  draftStore?: DraftStore
  /** Optional UIStore instance for testing. If not provided, creates a new one. */
  uiStore?: UIStore
  /** Optional initial project id for testing. */
  initialProjectId?: string | null
  /** Skip the initial projects fetch (useful for testing). */
  skipFetch?: boolean
  /**
   * Optional pre-built transport (testing seam). When provided, `pod` is not
   * required and this transport is used instead of constructing one. Production
   * callers pass `pod` instead.
   */
  transport?: PodTransport
}

export function AppProvider({
  children,
  pod,
  appFS: providedAppFS,
  draftStore: providedDraftStore,
  uiStore: providedUIStore,
  initialProjectId,
  skipFetch = false,
  transport: providedTransport,
}: AppProviderProps) {
  const [appFS] = useState(() => providedAppFS ?? new AppFS())
  const [drafts] = useState(() => providedDraftStore ?? new DraftStore())
  const [ui] = useState(() => providedUIStore ?? new UIStore())

  // Only construct a transport when pod config (or a prebuilt transport) is
  // supplied. Callers that mount <AppProvider> purely for the ephemeral
  // AppFS/drafts/UI store (e.g. `computer`) pass neither; in that mode the pod
  // features are disabled rather than crashing on a missing base URL.
  const transport = useMemo<PodTransport | null>(() => {
    if (providedTransport) return providedTransport
    if (pod) {
      return new PodTransport({
        baseUrl: pod.podBaseUrl,
        getAccessToken: pod.getAccessToken,
      })
    }
    return null
  }, [providedTransport, pod?.podBaseUrl, pod?.getAccessToken])

  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(initialProjectId ?? null)
  const [isLoading, setIsLoading] = useState(skipFetch ? false : true)
  const [error, setError] = useState<string | null>(null)

  // Keep latest state inside a ref so the refresh closure passed to
  // `refreshProjects` stays stable without stale captures.
  const stateRef = useRef({ transport, skipFetch })
  stateRef.current.transport = transport

  const refreshProjects = useCallback(async () => {
    if (!stateRef.current.transport) {
      setIsLoading(false)
      return
    }
    setError(null)
    try {
      const list = await stateRef.current.transport.listProjects()
      const summary: ProjectSummary[] = list.map((p: PodProject) => ({
        id: p.id,
        name: p.name,
        createdAt: p.createdAt,
      }))
      setProjects(summary)
      return
    } catch (e) {
      console.error('Failed to load projects:', e)
      setError(e instanceof Error ? e.message : 'Failed to load projects')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load projects on mount (skip in tests when skipFetch is true, and skip
  // when there is no pod transport — ephemeral-store mode).
  useEffect(() => {
    if (skipFetch || providedAppFS || !transport) {
      setIsLoading(false)
      return
    }
    refreshProjects()
  }, [skipFetch, providedAppFS, transport, refreshProjects])

  // Refetch on window focus (liveness per the plan).
  useEffect(() => {
    if (skipFetch || !transport) return
    const onFocus = () => refreshProjects()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [skipFetch, transport, refreshProjects])

  const setCurrentProject = useCallback((projectId: string) => {
    setCurrentProjectId(projectId)
  }, [])

  const createProject = useCallback(
    async (name: string) => {
      if (!transport) throw new Error('AppProvider: no pod transport configured')
      const { id } = await transport.createProject(name)
      await refreshProjects()
      return { id }
    },
    [transport, refreshProjects],
  )

  const deleteProject = useCallback(
    async (id: string) => {
      if (!transport) throw new Error('AppProvider: no pod transport configured')
      await transport.deleteProject(id)
      setCurrentProjectId((cur) => (cur === id ? null : cur))
      await refreshProjects()
    },
    [transport, refreshProjects],
  )

  const value: AppContextValue = {
    appFS,
    drafts,
    ui,
    transport,
    projects,
    currentProjectId,
    isLoading,
    error,
    refreshProjects,
    setCurrentProject,
    createProject,
    deleteProject,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}
