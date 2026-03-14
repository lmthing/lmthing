import { createContext, useContext, useMemo } from 'react'
import { useAuth } from '@lmthing/auth'
import type { Space } from './types'

interface SpaceContextValue {
  space: Space
  isOwner: boolean
}

const SpaceContext = createContext<SpaceContextValue | null>(null)

export function SpaceProvider({ space, children }: { space: Space; children: React.ReactNode }) {
  const { session } = useAuth()

  const value = useMemo<SpaceContextValue>(() => ({
    space,
    isOwner: session?.userId === space.user_id,
  }), [space, session?.userId])

  return (
    <SpaceContext.Provider value={value}>
      {children}
    </SpaceContext.Provider>
  )
}

export function useSpace(): SpaceContextValue {
  const ctx = useContext(SpaceContext)
  if (!ctx) throw new Error('useSpace must be used within a SpaceProvider')
  return ctx
}
