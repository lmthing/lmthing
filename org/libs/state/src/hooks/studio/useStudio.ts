// src/hooks/studio/useStudio.ts

import { useStudio as useStudioContext } from '../../lib/contexts/StudioContext'
import type { StudioConfig, SpaceConfig } from '../../types/studio'

export function useStudio() {
  const {
    studioFS,
    username,
    studioId,
    studioConfig,
    spaces,
    currentSpaceId,
    setCurrentSpace,
    createSpace,
    deleteSpace,
    renameSpace
  } = useStudioContext()

  return {
    studioFS,
    username,
    studioId,
    studioConfig,
    spaces,
    currentSpaceId,
    setCurrentSpace,
    createSpace,
    deleteSpace,
    renameSpace
  }
}
