// src/hooks/fs/useProjectFS.ts

import { useProject } from '../../lib/contexts/ProjectContext'
import type { ProjectFS } from '../../lib/fs/ScopedFS'

export function useProjectFS(): ProjectFS | null {
  const { projectFS } = useProject()
  return projectFS
}
