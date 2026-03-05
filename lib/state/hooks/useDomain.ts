// src/hooks/useDomain.ts

import { useKnowledge } from './useKnowledge'

export function useDomain(dir: string) {
  return useKnowledge(dir)
}
