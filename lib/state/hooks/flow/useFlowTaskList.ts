// src/hooks/flow/useFlowTaskList.ts

import { useMemo } from 'react'
import { useGlob } from '../fs/useGlob'
import { P } from '../../../lib/fs/paths'
import { parseFlowTask, type FlowTask } from '../../../lib/fs/parsers/task'
import { useFile } from '../fs/useFile'

export interface FlowTaskItem extends FlowTask {
  path: string
  order: number
  name: string
}

export function useFlowTaskList(flowId: string): FlowTaskItem[] {
  const pattern = P.globs.flowTasks(flowId)
  const matches = useGlob(pattern)

  // Read each task file
  const tasks = useMemo(() => {
    return matches.map(path => {
      // Parse order and name from path like flows/flowId/01.task-name.md
      const filename = path.split('/').pop() || ''
      const match = filename.match(/^(\d+)\.(.+)\.md$/)
      const order = match ? parseInt(match[1], 10) : 0
      const name = match ? match[2] : filename.replace('.md', '')

      return { path, order, name }
    })
  }, [matches])

  return tasks
}
