// src/hooks/tasklist/useTasklistTaskList.ts

import { useMemo } from 'react'
import { useGlob } from '../fs/useGlob'
import { P } from '../../lib/fs/paths'
import { parseTasklistTask, type TasklistTask } from '../../lib/fs/parsers/tasklist'
import { useFile } from '../fs/useFile'

export interface TasklistTaskItem {
  path: string
  order: number
  id: string
  task?: TasklistTask
}

function TasklistTaskReader({ path, name }: { path: string; name: string }): TasklistTask | null {
  // Note: this is a helper; do not call as a hook outside of useTasklistTaskList
  void path; void name
  return null
}

export function useTasklistTaskList(tasklistName: string): TasklistTaskItem[] {
  const pattern = P.globs.tasklistTasks(tasklistName)
  const matches = useGlob(pattern)

  return useMemo(() => {
    return matches
      .map((path) => {
        const filename = path.split('/').pop() ?? ''
        // filename: "01-boil_water.md"
        const match = filename.match(/^(\d+)[_-](.+)\.md$/)
        const order = match ? parseInt(match[1], 10) : 0
        const id = match ? match[2] : filename.replace(/\.md$/, '')
        return { path, order, id }
      })
      .sort((a, b) => a.order - b.order)
  }, [matches])
}
