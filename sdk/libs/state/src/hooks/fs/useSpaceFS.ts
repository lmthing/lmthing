// src/hooks/fs/useSpaceFS.ts

import { useSpaceContext } from '../../lib/contexts/SpaceContext'
import { useProject } from '../../lib/contexts/ProjectContext'
import { SpaceFS } from '../../lib/fs/ScopedFS'

export function useSpaceFS(spaceId?: string): SpaceFS | null {
  const { projectFS, currentSpaceId } = useProject()
  const { spaceFS: contextSpaceFS } = useSpaceContext()

  if (!projectFS) return null

  if (spaceId) {
    return SpaceFS.fromProjectFS(projectFS, spaceId)
  }

  return contextSpaceFS ?? (currentSpaceId ? SpaceFS.fromProjectFS(projectFS, currentSpaceId) : null)
}
