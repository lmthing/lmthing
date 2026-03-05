// src/hooks/workspace/useEnvFile.ts

import { useMemo } from 'react'
import { useFile } from '../fs/useFile'
import { P } from '../../lib/fs/paths'
import { parseEnvFile, serializeEnvFile } from '../../lib/fs/crypto/env'

export function useEnvFile(name: string = '.env'): Record<string, string> | null {
  const envPath = name.startsWith('.env') ? name : P.studioEnv(name)
  const content = useFile(envPath)

  return useMemo(() => {
    if (!content) return null
    try {
      return parseEnvFile(content)
    } catch {
      return null
    }
  }, [content])
}
