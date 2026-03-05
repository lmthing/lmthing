// src/hooks/fs/useFileConfig.ts

import { useMemo } from 'react'
import { useSyncExternalStore } from 'react'
import { useSpaceFS } from './useSpaceFS'

export function useFileConfig<T = Record<string, unknown>>(path: string): T | null {
  const fs = useSpaceFS()

  const content = useSyncExternalStore(
    cb => fs.onFileUpdate(path, cb),
    () => fs.readFile(path),
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
