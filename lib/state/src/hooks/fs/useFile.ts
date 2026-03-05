// src/hooks/fs/useFile.ts

import { useSyncExternalStore } from 'react'
import { useSpaceFS } from './useSpaceFS'

export function useFile(path: string): string | null {
  const fs = useSpaceFS()
  return useSyncExternalStore(
    cb => fs.onFile(path, cb),
    () => fs.readFile(path),
  )
}

export function useFileWatch(path: string, cb: (content: string | null) => void): void {
  const fs = useSpaceFS()
  useSyncExternalStore(
    () => fs.onFile(path, () => cb(fs.readFile(path))),
    () => fs.readFile(path),
  )
}
