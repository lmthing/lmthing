// src/hooks/knowledge/useKnowledgeFile.ts

import { useFile } from '../fs/useFile'

/** @deprecated P.knowledgeFile is removed; pass the full path directly. */
export function useKnowledgeFile(file: string): string | null {
  return useFile(`knowledge/${file}.md`)
}
