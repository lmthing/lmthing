// src/hooks/project/useProjectSpaces.ts

import { useProject } from './useProject'

/**
 * Convenience hook over the spaces list for the current project
 * (from the pod via {@link ProjectProvider}).
 */
export function useProjectSpaces() {
  const { projectId, spaces, isLoadingSpaces, spacesError, refreshSpaces } = useProject()

  return {
    projectId,
    spaces,
    isLoading: isLoadingSpaces,
    error: spacesError,
    refreshSpaces,
  }
}
