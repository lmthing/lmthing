// src/hooks/useKnowledge.ts

import { useMemo } from 'react'
import { useKnowledgeDir } from './knowledge/useKnowledgeDir'
import type { KnowledgeEntry } from './knowledge/useKnowledgeDir'

export interface Knowledge {
  dir: string
  /** @deprecated Always null — the old config.json is retired */
  config: null
  entries: KnowledgeEntry[]
}

export function useKnowledge(dir: string): Knowledge {
  const entries = useKnowledgeDir(dir)

  return useMemo(() => ({
    dir,
    config: null,
    entries
  }), [dir, entries])
}
