// src/hooks/fs/useDir.ts

import { useRef, useSyncExternalStore } from 'react'
import { useSpaceFS } from './useSpaceFS'
import type { DirEntry } from '../../types/studio'

const EMPTY: DirEntry[] = []
const NOOP = () => () => {}

export function useDir(dir: string): DirEntry[] {
  const fs = useSpaceFS()
  const cachedRef = useRef<{ dir: string; results: DirEntry[]; key: string }>({ dir: '', results: [], key: '' })

  return useSyncExternalStore(
    fs ? cb => fs.onDir(dir, cb) : NOOP,
    () => {
      if (!fs) return EMPTY

      const entries = fs.readDir(dir)
      const cacheKey = entries.map(e => `${e.name}:${e.type}:${e.path}`).join('|')

      if (cachedRef.current.dir === dir && cachedRef.current.key === cacheKey) {
        return cachedRef.current.results
      }

      cachedRef.current = { dir, results: entries, key: cacheKey }
      return cachedRef.current.results
    },
  )
}

export function useDirWatch(dir: string, cb: (entries: DirEntry[]) => void): void {
  const fs = useSpaceFS()
  const watchCached = useRef<{ dir: string; results: DirEntry[]; key: string }>({ dir: '', results: [], key: '' })
  useSyncExternalStore(
    fs ? () => fs.onDir(dir, () => cb(fs.readDir(dir))) : NOOP,
    () => {
      if (!fs) return EMPTY
      const entries = fs.readDir(dir)
      const cacheKey = entries.map(e => `${e.name}:${e.type}:${e.path}`).join('|')
      if (watchCached.current.dir === dir && watchCached.current.key === cacheKey) {
        return watchCached.current.results
      }
      watchCached.current = { dir, results: entries, key: cacheKey }
      return entries
    },
  )
}
