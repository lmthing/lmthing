// src/hooks/useTasklistList.ts
//
// Lists all tasklist names from tasklists/*/ in the current space.

import { useMemo } from 'react'
import { useGlob } from './fs/useGlob'
import { P } from '../lib/fs/paths'

export interface TasklistListItem {
  name: string
  path: string
}

export function useTasklistList(): TasklistListItem[] {
  const matches = useGlob(P.globs.allTasklists)

  return useMemo(() => {
    // allTasklists glob: 'tasklists/*/[0-9][0-9]-*.md'
    // Extract unique tasklist names from paths like "tasklists/<name>/01-foo.md"
    const seen = new Set<string>()
    const items: TasklistListItem[] = []
    for (const path of matches) {
      const segments = path.split('/')
      // segments: ['tasklists', '<name>', '01-foo.md']
      const name = segments[1]
      if (name && !seen.has(name)) {
        seen.add(name)
        items.push({ name, path: `tasklists/${name}` })
      }
    }
    return items
  }, [matches])
}
