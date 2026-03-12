// src/hooks/studio/useStudioEnvList.ts

import { useStudio } from './useStudio'
import { useGlob } from '../fs/useGlob'

export function useStudioEnvList(): string[] {
  const { studioFS } = useStudio()

  const matches = useGlob('.env*')

  // Filter to only .env, .env.local, .env.production, etc.
  return matches.filter(p => /^\.env(\.\w+)?$/.test(p))
}
