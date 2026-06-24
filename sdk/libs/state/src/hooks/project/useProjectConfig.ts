// src/hooks/project/useProjectConfig.ts

import { useCallback } from 'react'
import type { ProjectConfig } from '../../types/project'
import { useProject } from './useProject'
import { useFile } from '../fs/useFile'

/**
 * Read the project's `lmthing.json` config from the {@link ProjectFS} scope.
 * Returns `null` if the project scope isn't ready or the file is absent/invalid.
 */
export function useProjectConfig(): ProjectConfig | null {
  const { projectFS } = useProject()
  const content = useFile('lmthing.json')

  if (!projectFS) return null
  if (!content) return null
  try {
    return JSON.parse(content) as ProjectConfig
  } catch {
    return null
  }
}

export function useProjectConfigValue<K extends keyof ProjectConfig>(
  key: K,
): ProjectConfig[K] | null {
  const config = useProjectConfig()
  return config?.[key] ?? null
}

/**
 * Imperatively update `lmthing.json` with a partial merge. Reads the current
 * file from {@link ProjectFS}, merges, and writes it back.
 */
export function useUpdateProjectConfig(): (updates: Partial<ProjectConfig>) => void {
  const { projectFS } = useProject()

  return useCallback(
    (updates: Partial<ProjectConfig>) => {
      if (!projectFS) return
      const current = projectFS.readFile('lmthing.json')
      if (!current) return
      try {
        const config = JSON.parse(current) as ProjectConfig
        const updated = { ...config, ...updates }
        projectFS.writeFile('lmthing.json', JSON.stringify(updated, null, 2))
      } catch {
        // Ignore parse errors
      }
    },
    [projectFS],
  )
}
