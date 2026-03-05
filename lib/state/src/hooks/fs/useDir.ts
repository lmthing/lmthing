// src/hooks/fs/useDir.ts

import { useSyncExternalStore } from 'react'
import { useSpaceFS } from './useSpaceFS'
import type { DirEntry } from '@/types/studio'

export function useDir(dir: string): DirEntry[] {
  const fs = useSpaceFS()
  return useSyncExternalStore(
    cb => fs.onDir(dir, cb),
    () => fs.readDir(dir),
  )
}

export function useDirWatch(dir: string, cb: (entries: DirEntry[]) => void): void {
  const fs = useSpaceFS()
  useSyncExternalStore(
    () => fs.onDir(dir, () => cb(fs.readDir(dir))),
    () => fs.readDir(dir),
  )
}
