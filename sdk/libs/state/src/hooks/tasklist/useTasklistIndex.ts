// src/hooks/tasklist/useTasklistIndex.ts
//
// Hook for reading tasklists/<name>/index.md — the optional tasklist manifest
// (input schema + description body). Excluded from the ordered task-file set.

import { useMemo } from 'react'
import { useFile } from '../fs/useFile'
import { P } from '../../lib/fs/paths'
import { parseTasklistIndex, type TasklistIndex } from '../../lib/fs/parsers/tasklist'

export type { TasklistIndex }

/**
 * Reads `tasklists/<name>/index.md` and returns the parsed manifest, or `null`
 * when the file does not exist or cannot be parsed.
 *
 * @param tasklistName - the directory name under `tasklists/`
 *
 * @example
 * ```tsx
 * const index = useTasklistIndex('make_pasta')
 * // index?.input === { dish: 'string', servings: 'number' }
 * // index?.description === 'Cook a full pasta dish end to end…'
 * ```
 */
export function useTasklistIndex(tasklistName: string): TasklistIndex | null {
  const content = useFile(P.tasklistIndex(tasklistName))

  return useMemo(() => {
    if (!content) return null
    try {
      return parseTasklistIndex(content)
    } catch {
      return null
    }
  }, [content])
}
