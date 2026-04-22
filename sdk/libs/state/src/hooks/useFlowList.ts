// src/hooks/useFlowList.ts

import { useMemo } from 'react'
import { useGlob } from './fs/useGlob'
import { P } from '../lib/fs/paths'

export interface FlowListItem {
  id: string
  path: string
}

export function useFlowList(): FlowListItem[] {
  const matches = useGlob(P.globs.allFlows)

  return useMemo(() => {
    return matches.map(path => {
      const segments = path.split('/')
      const id = segments[segments.length - 2] // flows/{id}/index.md
      return {
        id,
        path: id
      }
    })
  }, [matches])
}
