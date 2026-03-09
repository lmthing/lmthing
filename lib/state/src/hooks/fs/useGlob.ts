// src/hooks/fs/useGlob.ts

import { useRef } from 'react'
import { useSyncExternalStore } from 'react'
import { useSpaceFS } from './useSpaceFS'

const EMPTY: string[] = []
const NOOP = () => () => {}

export function useGlob(pattern: string): string[] {
  const fs = useSpaceFS()
  const cachedRef = useRef<{ pattern: string; results: string[]; key: string }>({ pattern: '', results: [], key: '' })

  return useSyncExternalStore(
    fs ? cb => fs.onGlob(pattern, cb) : NOOP,
    () => {
      if (!fs) return EMPTY

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
  const watchCached = useRef<{ pattern: string; results: string[]; key: string }>({ pattern: '', results: [], key: '' })
  useSyncExternalStore(
    fs ? () => fs.onGlob(pattern, () => cb(fs.glob(pattern))) : NOOP,
    () => {
      if (!fs) return EMPTY
      const results = fs.glob(pattern)
      results.sort()
      const cacheKey = results.join('|')
      if (watchCached.current.pattern === pattern && watchCached.current.key === cacheKey) {
        return watchCached.current.results
      }
      watchCached.current = { pattern, results, key: cacheKey }
      return results
    },
  )
}
