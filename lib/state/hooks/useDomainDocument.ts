// src/hooks/useDomainDocument.ts

import { useKnowledgeFile } from './knowledge/useKnowledgeFile'

export function useDomainDocument(file: string) {
  return useKnowledgeFile(file)
}
