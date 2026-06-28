// src/hooks/useDomainDirectory.ts

import { useMemo } from 'react'
import { useGlob } from './fs/useGlob'
import { P } from '../lib/fs/paths'

export interface DomainMeta {
  id: string
  path: string
}

export function useDomainDirectory(): DomainMeta[] {
  // A domain exists if it has a descriptor `knowledge/<domain>/index.md` OR any
  // field `knowledge/<domain>/<field>/index.md`. The domain descriptor is
  // OPTIONAL (the core runtime derives domains from subdirectories), so relying
  // on it alone misses knowledge that has fields but no domain index.md.
  const domainIndexes = useGlob(P.globs.allKnowledgeDomainIndexes) // knowledge/*/index.md
  const fieldIndexes = useGlob(P.globs.allKnowledgeIndexes) // knowledge/*/*/index.md

  return useMemo(() => {
    const domains = new Set<string>()
    for (const path of domainIndexes) {
      const segments = path.split('/')
      if (segments.length >= 3) domains.add(segments[1]) // knowledge/<domain>/index.md
    }
    for (const path of fieldIndexes) {
      const segments = path.split('/')
      if (segments.length >= 4) domains.add(segments[1]) // knowledge/<domain>/<field>/index.md
    }
    return Array.from(domains)
      .sort((a, b) => a.localeCompare(b))
      .map((dir) => ({ id: dir, path: dir }))
  }, [domainIndexes, fieldIndexes])
}
