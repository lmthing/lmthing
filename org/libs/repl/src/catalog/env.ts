import type { CatalogModule } from './types'

const SECRET_PATTERNS = [/_KEY$/, /_SECRET$/, /_TOKEN$/, /_PASSWORD$/, /^PASSWORD$/, /^SECRET$/]
const DEFAULT_ALLOW = ['HOME', 'USER', 'PATH', 'LANG', 'TERM', 'SHELL', 'EDITOR', 'NODE_ENV']
const ALLOW_PREFIXES = ['LMTHING_']

let customAllowlist: Set<string> | null = null

export function setEnvAllowlist(names: string[]): void {
  customAllowlist = new Set(names)
}

function isAllowed(key: string): boolean {
  if (customAllowlist?.has(key)) return true
  if (DEFAULT_ALLOW.includes(key)) return true
  if (ALLOW_PREFIXES.some(p => key.startsWith(p))) return true
  if (SECRET_PATTERNS.some(p => p.test(key))) return false
  return false
}

function getAllowedKeys(): string[] {
  return Object.keys(process.env).filter(isAllowed).sort()
}

const envModule: CatalogModule = {
  id: 'env',
  description: 'Environment variable access (allowlisted)',
  functions: [
    {
      name: 'getEnv',
      description: 'Read environment variable (allowlisted only)',
      signature: '(key: string) => string | undefined',
      fn: (key: unknown) => {
        const k = key as string
        if (!isAllowed(k)) {
          throw new Error(`Environment variable ${k} is not in the allowlist`)
        }
        return process.env[k]
      },
    },
    {
      name: 'listEnv',
      description: 'List available (allowlisted) variable names',
      signature: '() => string[]',
      fn: () => getAllowedKeys(),
    },
  ],
}

export default envModule
