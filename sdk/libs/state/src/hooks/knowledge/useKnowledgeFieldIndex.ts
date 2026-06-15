// src/hooks/knowledge/useKnowledgeFieldIndex.ts

import { useMemo } from 'react'
import { useFile } from '../fs/useFile'
import { P } from '../../lib/fs/paths'
import { parseKnowledgeFieldIndex, type KnowledgeFieldIndex } from '../../lib/fs/parsers/config'

export interface KnowledgeFieldIndexResult extends KnowledgeFieldIndex {
  description: string
}

export function useKnowledgeFieldIndex(domain: string, field: string): KnowledgeFieldIndexResult | null {
  const content = useFile(P.knowledgeFieldIndex(domain, field))

  return useMemo(() => {
    if (!content) return null
    try {
      return parseKnowledgeFieldIndex(content)
    } catch {
      return null
    }
  }, [content])
}
