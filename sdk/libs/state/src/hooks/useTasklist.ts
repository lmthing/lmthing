// src/hooks/useTasklist.ts
//
// Replaces useWorkFlow for the new spec.  Returns task metadata (order + id)
// for all tasks in a tasklist.  Use useTasklistTask(path) to read individual
// task content.

import { useMemo } from 'react'
import { useTasklistTaskList, type TasklistTaskItem } from './tasklist/useTasklistTaskList'

export interface Tasklist {
  name: string
  tasks: TasklistTaskItem[]
}

export function useTasklist(name: string): Tasklist {
  const tasks = useTasklistTaskList(name)

  return useMemo(() => ({
    name,
    tasks,
  }), [name, tasks])
}
