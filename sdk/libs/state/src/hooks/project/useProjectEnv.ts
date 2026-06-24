// src/hooks/project/useProjectEnv.ts

import { useCallback, useMemo } from 'react'
import { useProject } from './useProject'
import { useFile } from '../fs/useFile'
import {
  parseEnvFile,
  serializeEnvFile,
  decryptEnvFile,
  encryptEnvFile,
  isEncrypted,
} from '../../lib/fs/crypto/env'

export function useProjectEnv(name: string = '.env'): Record<string, string> | null {
  const { projectFS } = useProject()
  const envPath = name.startsWith('.env') ? name : `.env.${name}`

  const content = useFile(envPath)

  return useMemo(() => {
    if (!projectFS) return null
    if (!content) return null
    try {
      return parseEnvFile(content)
    } catch {
      // Encrypted or invalid
      return null
    }
  }, [content, projectFS])
}

export function useProjectEnvWritable(name: string = '.env') {
  const { projectFS } = useProject()
  const envPath = name.startsWith('.env') ? name : `.env.${name}`

  const write = useCallback(
    (env: Record<string, string>) => {
      if (!projectFS) return
      const content = serializeEnvFile(env)
      projectFS.writeFile(envPath, content)
    },
    [projectFS, envPath],
  )

  const set = useCallback(
    (key: string, value: string) => {
      if (!projectFS) return
      const current = projectFS.readFile(envPath) || ''
      const env = parseEnvFile(current)
      env[key] = value
      write(env)
    },
    [projectFS, envPath, write],
  )

  const remove = useCallback(
    (key: string) => {
      if (!projectFS) return
      const current = projectFS.readFile(envPath) || ''
      const env = parseEnvFile(current)
      delete env[key]
      write(env)
    },
    [projectFS, envPath, write],
  )

  return { write, set, remove }
}

export { decryptEnvFile, encryptEnvFile, isEncrypted }
