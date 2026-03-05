// src/hooks/workspace/usePackageJson.ts

import { useMemo } from 'react'
import { useFile } from '@/hooks/fs/useFile'
import { P } from '@/lib/fs/paths'

export interface PackageJson {
  name: string
  version?: string
  private?: boolean
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  [key: string]: unknown
}

export function usePackageJson(): PackageJson | null {
  const content = useFile(P.packageJson)

  return useMemo(() => {
    if (!content) return null
    try {
      return JSON.parse(content) as PackageJson
    } catch {
      return null
    }
  }, [content])
}
