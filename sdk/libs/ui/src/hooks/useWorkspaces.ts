// useWorkspaces — returns projects list from AppContext (app-level, no ProjectProvider needed)
import { useApp } from '@lmthing/state'

export function useWorkspaces() {
  const { projects, isLoading, error } = useApp()

  // Map projects to a shape compatible with list layouts (expects data.agents)
  const data = {
    agents: projects.map(s => ({ id: s.id, name: s.name })),
    flows: [] as { id: string }[],
    fields: [] as { id: string }[],
    packageJson: null,
  }

  return {
    data,
    isLoading,
    error,
  }
}
