// src/hooks/knowledge/useKnowledgeDir.ts

import { useMemo } from 'react'
import { useDir } from '../fs/useDir'
import { P } from '../../../lib/fs/paths'

export interface KnowledgeEntry {
  name: string
  path: string
  type: 'file' | 'dir'
}

export function useKnowledgeDir(dir: string): KnowledgeEntry[] {
  const entries = useDir(P.knowledgeDir(dir))

  return useMemo(() => {
    return entries.map(e => ({
      name: e.name,
      path: e.path,
      type: e.type
    }))
  }, [entries])
}
