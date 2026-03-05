// src/hooks/fs/useGlob.ts

import { useRef } from 'react'
import { useSyncExternalStore } from 'react'
import { useSpaceFS } from './useSpaceFS'

export function useGlob(pattern: string): string[] {
  const fs = useSpaceFS()
  const cachedRef = useRef<{ pattern: string; results: string[]; key: string }>({ pattern: '', results: [], key: '' })

  return useSyncExternalStore(
    cb => fs.onGlob(pattern, cb),
    () => {
      const rawResults = fs.glob(pattern)
      // Sort for consistent ordering
      rawResults.sort()
      // Create a cache key from sorted results
      const cacheKey = rawResults.join('|')

      if (cachedRef.current.pattern === pattern && cachedRef.current.key === cacheKey) {
        // Return cached array to maintain reference equality
        return cachedRef.current.results
      }

      // Create new cached entry
      cachedRef.current = {
        pattern,
        results: rawResults,
        key: cacheKey
      }
      return cachedRef.current.results
    },
  )
}

export function useGlobWatch(pattern: string, cb: (paths: string[]) => void): void {
  const fs = useSpaceFS()
  useSyncExternalStore(
    () => fs.onGlob(pattern, () => cb(fs.glob(pattern))),
    () => fs.glob(pattern),
  )
}
