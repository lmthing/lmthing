// src/hooks/tasklist/useTasklistTask.ts

import { useMemo } from 'react'
import { useFile } from '../fs/useFile'
import { parseTasklistTask, type TasklistTask } from '../../lib/fs/parsers/tasklist'

export function useTasklistTask(path: string): TasklistTask | null {
  const filename = path.split('/').pop() ?? ''
  const content = useFile(path)

  return useMemo(() => {
    if (!content) return null
    try {
      return parseTasklistTask(filename, content)
    } catch {
      return null
    }
  }, [content, filename])
}
