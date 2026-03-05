// src/hooks/knowledge/useKnowledgeFile.ts

import { useFile } from '@/hooks/fs/useFile'
import { P } from '@/lib/fs/paths'

export function useKnowledgeFile(file: string): string | null {
  return useFile(P.knowledgeFile(file))
}
