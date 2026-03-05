// src/hooks/fs/useStudioFS.ts

import { useStudio } from '@/lib/contexts/StudioContext'
import type { StudioFS } from '@/lib/fs/ScopedFS'

export function useStudioFS(): StudioFS {
  const { studioFS } = useStudio()
  return studioFS
}
