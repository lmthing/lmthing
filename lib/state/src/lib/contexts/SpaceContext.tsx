// src/lib/contexts/SpaceContext.tsx

import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { SpaceFS } from '../fs/ScopedFS'
import { useStudio } from './StudioContext'

interface SpaceContextValue {
  spaceFS: SpaceFS | null
  spaceId: string | null
}

const SpaceContext = createContext<SpaceContextValue | null>(null)

export function SpaceProvider({ children }: { children: ReactNode }) {
  const { studioFS, currentSpaceId } = useStudio()

  const spaceFS = useMemo(() => {
    if (!studioFS || !currentSpaceId) return null
    return SpaceFS.fromStudioFS(studioFS, currentSpaceId)
  }, [studioFS, currentSpaceId])

  const value: SpaceContextValue = {
    spaceFS,
    spaceId: currentSpaceId
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
