// src/hooks/project/useProjects.ts

import { useApp } from './useApp'

/**
 * Convenience hook over the projects list from {@link useApp}.
 * Returns `{ projects, isLoading, error, refreshProjects, createProject, deleteProject }`.
 */
export function useProjects() {
  const {
    projects,
    isLoading,
    error,
    refreshProjects,
    createProject,
    deleteProject,
    setCurrentProject,
    currentProjectId,
  } = useApp()

  return {
    projects,
    currentProjectId,
    isLoading,
    error,
    refreshProjects,
    createProject,
    deleteProject,
    setCurrentProject,
  }
}
