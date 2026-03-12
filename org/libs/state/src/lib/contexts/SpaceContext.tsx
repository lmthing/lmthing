// src/lib/contexts/SpaceContext.tsx

import { createContext, useContext, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { SpaceFS } from '../fs/ScopedFS'
import { useStudio } from './StudioContext'

interface SpaceContextValue {
  spaceFS: SpaceFS | null
  spaceId: string | null
}

const SpaceContext = createContext<SpaceContextValue | null>(null)

interface SpaceProviderProps {
  children: ReactNode
  spaceId?: string
}

export function SpaceProvider({ children, spaceId: spaceIdProp }: SpaceProviderProps) {
  const { studioFS, currentSpaceId, setCurrentSpace } = useStudio()

  // Sync the provided spaceId prop into StudioContext
  useEffect(() => {
    if (spaceIdProp && spaceIdProp !== currentSpaceId) {
      setCurrentSpace(spaceIdProp)
    }
  }, [spaceIdProp])

  const activeSpaceId = spaceIdProp ?? currentSpaceId

  const spaceFS = useMemo(() => {
    if (!studioFS || !activeSpaceId) return null
    return SpaceFS.fromStudioFS(studioFS, activeSpaceId)
  }, [studioFS, activeSpaceId])

  const value: SpaceContextValue = {
    spaceFS,
    spaceId: activeSpaceId
  }

  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>
}

export function useSpaceContext(): SpaceContextValue {
  const context = useContext(SpaceContext)
  if (!context) {
    throw new Error('useSpaceContext must be used within SpaceProvider')
  }
  return context
}
