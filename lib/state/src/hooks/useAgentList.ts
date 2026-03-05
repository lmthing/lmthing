// src/hooks/useAgentList.ts

import { useMemo } from 'react'
import { useGlob } from './fs/useGlob'
import { P } from '../lib/fs/paths'

export interface AgentListItem {
  id: string
  path: string
}

export function useAgentList(): AgentListItem[] {
  const matches = useGlob(P.globs.allAgents)

  return useMemo(() => {
    return matches.map(path => {
      const segments = path.split('/')
      const id = segments[segments.length - 2] // agents/{id}/instruct.md
      return {
        id,
        path: id
      }
    })
  }, [matches])
}
