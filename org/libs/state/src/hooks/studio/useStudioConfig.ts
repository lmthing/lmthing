// src/hooks/studio/useStudioConfig.ts

import { useCallback } from 'react'
import { useMemo } from 'react'
import { useStudio } from './useStudio'
import { useFileFrontmatter } from '../fs/useFileFrontmatter'
import type { StudioConfig } from '../../types/studio'

export function useStudioConfig(): StudioConfig | null {
  const { studioConfig } = useStudio()
  return studioConfig
}

export function useStudioConfigValue<K extends keyof StudioConfig>(
  key: K
): StudioConfig[K] | null {
  const config = useStudioConfig()
  return config?.[key] ?? null
}

export function useUpdateStudioConfig(): (updates: Partial<StudioConfig>) => void {
  const { studioFS } = useStudio()

  return useCallback((updates: Partial<StudioConfig>) => {
    const current = studioFS.readFile('lmthing.json')
    if (!current) return

    try {
      const config = JSON.parse(current) as StudioConfig
      const updated = { ...config, ...updates }
      studioFS.writeFile('lmthing.json', JSON.stringify(updated, null, 2))
    } catch {
      // Ignore parse errors
    }
  }, [studioFS])
}
