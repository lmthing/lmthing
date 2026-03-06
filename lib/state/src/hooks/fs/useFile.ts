// src/hooks/fs/useFile.ts

import { useSyncExternalStore } from 'react'
import { useSpaceFS } from './useSpaceFS'

const NOOP = () => () => {}

export function useFile(path: string): string | null {
  const fs = useSpaceFS()
  return useSyncExternalStore(
    fs ? cb => fs.onFile(path, cb) : NOOP,
    () => fs ? fs.readFile(path) : null,
  )
}

export function useFileWatch(path: string, cb: (content: string | null) => void): void {
  const fs = useSpaceFS()
  useSyncExternalStore(
    fs ? () => fs.onFile(path, () => cb(fs.readFile(path))) : NOOP,
    () => fs ? fs.readFile(path) : null,
  )
}
