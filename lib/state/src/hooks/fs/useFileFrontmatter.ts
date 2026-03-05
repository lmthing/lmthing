// src/hooks/fs/useFileFrontmatter.ts

import { useMemo } from 'react'
import { useSyncExternalStore } from 'react'
import { useSpaceFS } from './useSpaceFS'
import { parseFrontmatter, type FrontmatterResult } from '@/lib/fs/parsers/frontmatter'

export function useFileFrontmatter<T = Record<string, unknown>>(
  path: string
): FrontmatterResult<T> | null {
  const fs = useSpaceFS()

  const content = useSyncExternalStore(
    cb => fs.onFileUpdate(path, cb),
    () => fs.readFile(path),
  )

  return useMemo(() => {
    if (!content) return null
    return parseFrontmatter<T>(content)
  }, [content])
}
