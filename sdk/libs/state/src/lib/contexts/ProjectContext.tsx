// src/lib/contexts/ProjectContext.tsx

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { ProjectFS } from '../fs/ScopedFS'
import { useApp } from './AppContext'
import type { PodSpaceMeta } from '../../types/project'

export type ProjectSpaceSummary = PodSpaceMeta

interface ProjectContextValue {
  projectId: string | null
  projectFS: ProjectFS | null
  spaces: ProjectSpaceSummary[]
  currentSpaceId: string | null
  isLoadingSpaces: boolean
  spacesError: string | null

  setCurrentSpace(spaceId: string): void
  refreshSpaces(): Promise<void>
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

interface ProjectProviderProps {
  children: ReactNode
  /** The pod project id this provider is scoped to. */
  projectId?: string | null
}

export function ProjectProvider({ children, projectId }: ProjectProviderProps) {
  const { appFS, transport, currentProjectId } = useApp()

  const activeProjectId = projectId ?? currentProjectId

  const projectFS = useMemo(() => {
    if (!activeProjectId) return null
    return new ProjectFS(appFS, activeProjectId)
  }, [appFS, activeProjectId])

  const [spaces, setSpaces] = useState<ProjectSpaceSummary[]>([])
  const [currentSpaceId, setCurrentSpaceId] = useState<string | null>(null)
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(false)
  const [spacesError, setSpacesError] = useState<string | null>(null)

  const refreshSpaces = useCallback(async () => {
    if (!activeProjectId) {
      setSpaces([])
      return
    }
    setSpacesError(null)
    setIsLoadingSpaces(true)
    try {
      const list = await transport.listSpaces(activeProjectId)
      setSpaces(list)
    } catch (e) {
      console.error('Failed to load spaces:', e)
      setSpacesError(e instanceof Error ? e.message : 'Failed to load spaces')
    } finally {
      setIsLoadingSpaces(false)
    }
  }, [transport, activeProjectId])

  // Load spaces when the project changes, and refetch on window focus.
  useEffect(() => {
    if (!activeProjectId) {
      setSpaces([])
      return
    }
    refreshSpaces()
  }, [activeProjectId, refreshSpaces])

  useEffect(() => {
    if (!activeProjectId) return
    const onFocus = () => refreshSpaces()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [activeProjectId, refreshSpaces])

  const setCurrentSpace = useCallback((spaceId: string) => {
    setCurrentSpaceId(spaceId)
  }, [])

  const value: ProjectContextValue = {
    projectId: activeProjectId,
    projectFS,
    spaces,
    currentSpaceId,
    isLoadingSpaces,
    spacesError,
    setCurrentSpace,
    refreshSpaces,
  }

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProject(): ProjectContextValue {
  const context = useContext(ProjectContext)
  if (!context) {
    throw new Error('useProject must be used within ProjectProvider')
  }
  return context
}
