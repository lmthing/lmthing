// src/hooks/fs/useSpaceFS.ts

import { useSpaceContext } from '../../lib/contexts/SpaceContext'
import { useStudio } from '../../lib/contexts/StudioContext'
import { SpaceFS } from '../../lib/fs/ScopedFS'

export function useSpaceFS(spaceId?: string): SpaceFS | null {
  const { studioFS, currentSpaceId: studioCurrentSpaceId } = useStudio()
  const { spaceFS: contextSpaceFS } = useSpaceContext()

  if (!studioFS) return null

  if (spaceId) {
    return SpaceFS.fromStudioFS(studioFS, spaceId)
  }

  return contextSpaceFS ?? SpaceFS.fromStudioFS(studioFS, studioCurrentSpaceId ?? '')
}
