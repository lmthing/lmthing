// src/hooks/workspace/useEnvFileList.ts

import { useGlob } from '../fs/useGlob'
import { P } from '../../lib/fs/paths'

export function useEnvFileList(): string[] {
  const matches = useGlob(P.globs.studioEnvFiles)

  return matches.filter(p => /^\.env(\.\w+)?$/.test(p))
}
