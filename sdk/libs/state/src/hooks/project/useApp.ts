// src/hooks/project/useApp.ts

import { useApp as useAppContext } from '../../lib/contexts/AppContext'

export function useApp() {
  const {
    appFS,
    drafts,
    ui,
    transport,
    projects,
    currentProjectId,
    isLoading,
    error,
    refreshProjects,
    setCurrentProject,
    createProject,
    deleteProject,
  } = useAppContext()

  return {
    appFS,
    drafts,
    ui,
    transport,
    projects,
    currentProjectId,
    isLoading,
    error,
    refreshProjects,
    setCurrentProject,
    createProject,
    deleteProject,
  }
}
