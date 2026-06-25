// src/hooks/knowledge/useKnowledgeDomainIndex.ts

import { useMemo } from 'react'
import { useFile } from '../fs/useFile'
import { P } from '../../lib/fs/paths'
import { parseKnowledgeDomainIndex, type KnowledgeDomainIndex } from '../../lib/fs/parsers/config'

export interface KnowledgeDomainIndexResult extends KnowledgeDomainIndex {
  description: string
}

/**
 * Reads knowledge/<domain>/index.md — the domain-level descriptor (label, icon,
 * color, description, and the `renderAs` studio UI hint: 'tabs' | 'list').
 */
export function useKnowledgeDomainIndex(domain: string): KnowledgeDomainIndexResult | null {
  const content = useFile(P.knowledgeDomainIndex(domain))

  return useMemo(() => {
    if (!content) return null
    try {
      return parseKnowledgeDomainIndex(content)
    } catch {
      return null
    }
  }, [content])
}
