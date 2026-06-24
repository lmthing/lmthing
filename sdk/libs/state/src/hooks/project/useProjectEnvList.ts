// src/hooks/project/useProjectEnvList.ts

import { useGlob } from '../fs/useGlob'

/**
 * List `.env*` files in the current project scope
 * (`.env`, `.env.local`, `.env.production`, …).
 */
export function useProjectEnvList(): string[] {
  const matches = useGlob('.env*')
  return matches.filter((p) => /^\.env(\.\w+)?$/.test(p))
}
