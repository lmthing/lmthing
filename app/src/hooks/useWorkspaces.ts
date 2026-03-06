// useWorkspaces — returns studios list from AppContext (app-level, no StudioProvider needed)
import { useApp } from '@lmthing/state'

export function useWorkspaces() {
  const { studios, isLoading, error } = useApp()

  // Map studios to a shape compatible with SpacesLayout (expects data.agents)
  const data = {
    agents: studios.map(s => ({ id: `${s.username}/${s.studioId}`, name: s.name })),
    flows: [] as { id: string }[],
    domains: [] as { id: string }[],
    packageJson: null,
  }

  return {
    data,
    isLoading,
    error,
  }
}

