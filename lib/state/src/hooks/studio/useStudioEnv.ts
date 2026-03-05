// src/hooks/studio/useStudioEnv.ts

import { useCallback } from 'react'
import { useMemo } from 'react'
import { useStudio } from './useStudio'
import { useFile } from '@/hooks/fs/useFile'
import { parseEnvFile, serializeEnvFile, decryptEnvFile, encryptEnvFile, isEncrypted } from '@/lib/fs/crypto/env'

export function useStudioEnv(name: string = '.env'): Record<string, string> | null {
  const { studioFS } = useStudio()
  const envPath = name.startsWith('.env') ? name : `.env.${name}`

  const content = useFile(envPath)

  return useMemo(() => {
    if (!content) return null
    try {
      return parseEnvFile(content)
    } catch {
      // Encrypted or invalid
      return null
    }
  }, [content])
}

export function useStudioEnvWritable(name: string = '.env') {
  const { studioFS } = useStudio()
  const envPath = name.startsWith('.env') ? name : `.env.${name}`

  const write = useCallback((env: Record<string, string>) => {
    const content = serializeEnvFile(env)
    studioFS.writeFile(envPath, content)
  }, [studioFS, envPath])

  const set = useCallback((key: string, value: string) => {
    const current = studioFS.readFile(envPath) || ''
    const env = parseEnvFile(current)
    env[key] = value
    write(env)
  }, [studioFS, envPath, write])

  const remove = useCallback((key: string) => {
    const current = studioFS.readFile(envPath) || ''
    const env = parseEnvFile(current)
    delete env[key]
    write(env)
  }, [studioFS, envPath, write])

  return { write, set, remove }
}
