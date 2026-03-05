// src/hooks/useWorkFlow.ts

import { useMemo } from 'react'
import { useFlowIndex } from './flow/useFlowIndex'
import { useFlowTaskList } from './flow/useFlowTaskList'
import type { FlowIndex } from '@/lib/fs/parsers/task'
import type { FlowTaskItem } from './flow/useFlowTaskList'

export interface WorkFlow {
  id: string
  index: FlowIndex | null
  tasks: FlowTaskItem[]
}

export function useWorkFlow(id: string): WorkFlow {
  const index = useFlowIndex(id)
  const tasks = useFlowTaskList(id)

  return useMemo(() => ({
    id,
    index,
    tasks
  }), [id, index, tasks])
}
