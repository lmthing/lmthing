// src/hooks/useUnsavedChanges.ts

import { useRef, useSyncExternalStore } from 'react'
import { useApp } from './studio/useApp'

export function useUnsavedChanges(): number {
  const { drafts } = useApp()

  return useSyncExternalStore(
    cb => drafts.subscribe(cb),
    () => drafts.getCount(),
  )
}

export function useHasUnsavedChanges(): boolean {
  const count = useUnsavedChanges()
  return count > 0
}

export function useDraftPaths(): string[] {
  const { drafts } = useApp()
  const cachedRef = useRef<{ paths: string[]; key: string }>({ paths: [], key: '' })

  return useSyncExternalStore(
    cb => drafts.subscribe(cb),
    () => {
      const paths = drafts.getPaths()
      const cacheKey = paths.join('|')
      if (cachedRef.current.key === cacheKey) {
        return cachedRef.current.paths
      }
      cachedRef.current = { paths, key: cacheKey }
      return paths
    },
  )
}
