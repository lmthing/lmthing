// src/hooks/flow/useFlowTask.ts

import { useMemo } from 'react'
import { useFile } from '@/hooks/fs/useFile'
import { P } from '@/lib/fs/paths'
import { parseFlowTask, type FlowTask } from '@/lib/fs/parsers/task'

export function useFlowTask(flowId: string, order: number, name: string): FlowTask | null {
  const content = useFile(P.flowTask(flowId, order, name))

  return useMemo(() => {
    if (!content) return null
    try {
      return parseFlowTask(content)
    } catch {
      return null
    }
  }, [content])
}
