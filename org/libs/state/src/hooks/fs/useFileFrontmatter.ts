// src/hooks/fs/useFileFrontmatter.ts

import { useMemo } from 'react'
import { useSyncExternalStore } from 'react'
import { useSpaceFS } from './useSpaceFS'
import { parseFrontmatter, type FrontmatterResult } from '../../lib/fs/parsers/frontmatter'

const NOOP = () => () => {}

export function useFileFrontmatter<T = Record<string, unknown>>(
  path: string
): FrontmatterResult<T> | null {
  const fs = useSpaceFS()

  const content = useSyncExternalStore(
    fs ? cb => fs.onFileUpdate(path, cb) : NOOP,
    () => fs ? fs.readFile(path) : null,
  )

  return useMemo(() => {
    if (!content) return null
    return parseFrontmatter<T>(content)
  }, [content])
}
