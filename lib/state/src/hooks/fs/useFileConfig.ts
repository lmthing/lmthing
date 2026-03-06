// src/hooks/fs/useFileConfig.ts

import { useMemo } from 'react'
import { useSyncExternalStore } from 'react'
import { useSpaceFS } from './useSpaceFS'

const NOOP = () => () => {}

export function useFileConfig<T = Record<string, unknown>>(path: string): T | null {
  const fs = useSpaceFS()

  const content = useSyncExternalStore(
    fs ? cb => fs.onFileUpdate(path, cb) : NOOP,
    () => fs ? fs.readFile(path) : null,
  )

  return useMemo(() => {
    if (!content) return null
    try {
      return JSON.parse(content) as T
    } catch {
      return null
    }
  }, [content])
}
