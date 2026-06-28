// src/hooks/tasklist/useTasklistTasks.ts
//
// Hook that returns fully parsed TasklistTask objects for all tasks in a tasklist.
// This is the primary hook for Studio's task editors — it reads each task file
// from the VFS and parses it so editors get instruction/input/output/dependsOn/etc.
//
// Uses useGlobRead to subscribe to all task files in a single store subscription,
// avoiding the "variable number of hooks" problem.

import { useMemo } from 'react'
import { useGlobRead } from '../fs/useGlobRead'
import { P } from '../../lib/fs/paths'
import { parseTasklistTask, type TasklistTask } from '../../lib/fs/parsers/tasklist'

// Re-export so callers can import the type from this module.
export type { TasklistTask }

export interface TasklistTaskEntry {
  /** Relative path inside the space FS, e.g. "tasklists/make_pasta/01-boil_water.md" */
  path: string
  /** Fully parsed task (or null if the file could not be parsed) */
  task: TasklistTask | null
}

/**
 * Returns fully parsed {@link TasklistTask} objects for every task file in the
 * named tasklist, sorted by their NN- numeric prefix.
 *
 * `index.md` is excluded from the result set (it is the tasklist manifest;
 * use {@link useTasklistIndex} for that).
 *
 * This hook uses a single VFS glob subscription (`useGlobRead`) so it re-renders
 * only when any file in the tasklist changes — not on unrelated VFS writes.
 *
 * @param tasklistName - the directory name under `tasklists/`
 * @returns sorted (by NN- prefix) array of `{ path, task }` entries
 *
 * @example
 * ```tsx
 * const entries = useTasklistTasks('make_pasta')
 * // entries[0].task?.id === 'boil_water'
 * // entries[0].task?.instruction === 'Fill a large pot with water…'
 * // entries[0].task?.input  === { pot_size: 'number' }
 * // entries[0].task?.output === { water_ready: 'boolean', temperature: 'number' }
 * ```
 */
export function useTasklistTasks(tasklistName: string): TasklistTaskEntry[] {
  const pattern = P.globs.tasklistTasks(tasklistName)
  // useGlobRead returns { [path]: content } for all files matching the pattern.
  // The pattern already excludes index.md (it matches NN-*.md only).
  const files = useGlobRead(pattern)

  return useMemo(() => {
    const entries: TasklistTaskEntry[] = Object.entries(files).map(([path, content]) => {
      const filename = path.split('/').pop() ?? ''
      try {
        return { path, task: parseTasklistTask(filename, content) }
      } catch {
        return { path, task: null }
      }
    })

    // Sort by the NN- numeric prefix so callers always get deterministic order.
    entries.sort((a, b) => {
      const aNum = parseInt(a.path.split('/').pop()?.match(/^(\d+)/)?.[1] ?? '0', 10)
      const bNum = parseInt(b.path.split('/').pop()?.match(/^(\d+)/)?.[1] ?? '0', 10)
      return aNum - bNum
    })

    return entries
  }, [files])
}
