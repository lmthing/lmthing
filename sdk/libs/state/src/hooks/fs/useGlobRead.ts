// src/hooks/fs/useGlobRead.ts

import { useRef, useSyncExternalStore } from 'react'
import { useSpaceFS } from './useSpaceFS'
import type { FileTree } from '../../types/studio'

const EMPTY: FileTree = {}
const NOOP = () => () => {}

export function useGlobRead(pattern: string): FileTree {
  const fs = useSpaceFS()
  const cachedRef = useRef<{ pattern: string; result: FileTree; key: string }>({ pattern: '', result: EMPTY, key: '' })

  return useSyncExternalStore(
    fs ? cb => fs.onGlob(pattern, cb) : NOOP,
    () => {
      if (!fs) return EMPTY

      const result = fs.globRead(pattern)
      // Build cache key from sorted path+content pairs
      const entries = Object.entries(result)
      entries.sort(([a], [b]) => a.localeCompare(b))
      const cacheKey = entries.map(([p, c]) => `${p}:${c.length}`).join('|')

      if (cachedRef.current.pattern === pattern && cachedRef.current.key === cacheKey) {
        return cachedRef.current.result
      }

      cachedRef.current = { pattern, result, key: cacheKey }
      return cachedRef.current.result
    },
  )
}
