// src/hooks/useKnowledge.ts

import { useMemo } from 'react'
import { useKnowledgeConfig } from './knowledge/useKnowledgeConfig'
import { useKnowledgeDir } from './knowledge/useKnowledgeDir'
import type { KnowledgeConfig } from '../lib/fs/parsers/config'
import type { KnowledgeEntry } from './knowledge/useKnowledgeDir'

export interface Knowledge {
  dir: string
  config: KnowledgeConfig | null
  entries: KnowledgeEntry[]
}

export function useKnowledge(dir: string): Knowledge {
  const config = useKnowledgeConfig(dir)
  const entries = useKnowledgeDir(dir)

  return useMemo(() => ({
    dir,
    config,
    entries
  }), [dir, config, entries])
}
