// src/hooks/flow/useFlowIndex.ts

import { useMemo } from 'react'
import { useFile } from '@/hooks/fs/useFile'
import { P } from '@/lib/fs/paths'
import { parseFlowIndex, type FlowIndex } from '@/lib/fs/parsers/task'

export function useFlowIndex(id: string): FlowIndex | null {
  const content = useFile(P.flowIndex(id))

  return useMemo(() => {
    if (!content) return null
    try {
      return parseFlowIndex(content)
    } catch {
      return null
    }
  }, [content])
}
