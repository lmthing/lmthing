// src/hooks/fs/useGlob.ts

import { useSyncExternalStore } from 'react'
import { useSpaceFS } from './useSpaceFS'

export function useGlob(pattern: string): string[] {
  const fs = useSpaceFS()
  return useSyncExternalStore(
    cb => fs.onGlob(pattern, cb),
    () => fs.glob(pattern),
  )
}

export function useGlobWatch(pattern: string, cb: (paths: string[]) => void): void {
  const fs = useSpaceFS()
  useSyncExternalStore(
    () => fs.onGlob(pattern, () => cb(fs.glob(pattern))),
    () => fs.glob(pattern),
  )
}
