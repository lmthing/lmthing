// src/hooks/fs/useGlobRead.ts

import { useSyncExternalStore } from 'react'
import { useSpaceFS } from './useSpaceFS'
import type { FileTree } from '../../types/studio'

const EMPTY: FileTree = {}
const NOOP = () => () => {}

export function useGlobRead(pattern: string): FileTree {
  const fs = useSpaceFS()
  return useSyncExternalStore(
    fs ? cb => fs.onGlob(pattern, cb) : NOOP,
    () => fs ? fs.globRead(pattern) : EMPTY,
  )
}
