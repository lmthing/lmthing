// src/hooks/project/useProject.ts

import { useProject as useProjectContext } from '../../lib/contexts/ProjectContext'

export function useProject() {
  const {
    projectId,
    projectFS,
    spaces,
    currentSpaceId,
    isLoadingSpaces,
    spacesError,
    setCurrentSpace,
    refreshSpaces,
  } = useProjectContext()

  return {
    projectId,
    projectFS,
    spaces,
    currentSpaceId,
    isLoadingSpaces,
    spacesError,
    setCurrentSpace,
    refreshSpaces,
  }
}
