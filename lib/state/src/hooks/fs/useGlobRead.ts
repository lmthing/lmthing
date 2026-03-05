// src/hooks/fs/useGlobRead.ts

import { useSyncExternalStore } from 'react'
import { useSpaceFS } from './useSpaceFS'
import type { FileTree } from '@/types/studio'

export function useGlobRead(pattern: string): FileTree {
  const fs = useSpaceFS()
  return useSyncExternalStore(
    cb => fs.onGlob(pattern, cb),
    () => fs.globRead(pattern),
  )
}
