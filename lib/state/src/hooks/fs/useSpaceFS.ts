// src/hooks/fs/useSpaceFS.ts

import { useSyncExternalStore } from 'react'
import { useSpaceContext } from '@/lib/contexts/SpaceContext'
import { useStudio } from '@/lib/contexts/StudioContext'
import { SpaceFS } from '@/lib/fs/ScopedFS'

export function useSpaceFS(spaceId?: string): SpaceFS {
  const { studioFS, currentSpaceId: studioCurrentSpaceId } = useStudio()
  const { spaceFS: contextSpaceFS } = useSpaceContext()

  if (spaceId) {
    // Create SpaceFS for specific space
    return SpaceFS.fromStudioFS(studioFS, spaceId)
  }

  return contextSpaceFS ?? SpaceFS.fromStudioFS(studioFS, studioCurrentSpaceId ?? '')
}
