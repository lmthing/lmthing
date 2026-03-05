// src/hooks/knowledge/useKnowledgeConfig.ts

import { useMemo } from 'react'
import { useFile } from '@/hooks/fs/useFile'
import { P } from '@/lib/fs/paths'
import { parseKnowledgeConfig, type KnowledgeConfig } from '@/lib/fs/parsers/config'

export function useKnowledgeConfig(dir: string): KnowledgeConfig | null {
  const content = useFile(P.knowledgeConfig(dir))

  return useMemo(() => {
    if (!content) return null
    try {
      return parseKnowledgeConfig(content)
    } catch {
      return null
    }
  }, [content])
}
