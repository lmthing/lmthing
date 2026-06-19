// src/hooks/useDomainDirectory.ts

import { useMemo } from 'react'
import { useGlob } from './fs/useGlob'
import { P } from '../lib/fs/paths'

export interface DomainMeta {
  id: string
  path: string
}

export function useDomainDirectory(): DomainMeta[] {
  // Use allKnowledgeDomainIndexes (knowledge/*/index.md) to discover domains
  const matches = useGlob(P.globs.allKnowledgeDomainIndexes)

  return useMemo(() => {
    return matches.map(path => {
      const segments = path.split('/')
      const dir = segments[segments.length - 2] // knowledge/{dir}/index.md
      return {
        id: dir,
        path: dir
      }
    })
  }, [matches])
}
