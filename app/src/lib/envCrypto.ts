import type { EncryptedEnvFile } from '@/types/workspace-data'

const TEXT_ENCODER = new TextEncoder()
const TEXT_DECODER = new TextDecoder()

const DEFAULT_ITERATIONS = 250_000
const ENV_SESSION_CACHE_PREFIX = 'lmthing-session-env'

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

async function deriveAesKey(password: string, salt: Uint8Array, iterations = DEFAULT_ITERATIONS) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    TEXT_ENCODER.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptEnvContent(params: {
  plaintext: string
  password: string
  previous?: EncryptedEnvFile
  expiresInDays?: number
}): Promise<EncryptedEnvFile> {
  const { plaintext, password, previous, expiresInDays } = params

  if (!password.trim()) {
    throw new Error('Password is required to encrypt env data.')
  }

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const iterations = previous?.iterations ?? DEFAULT_ITERATIONS
  const key = await deriveAesKey(password, salt, iterations)
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    TEXT_ENCODER.encode(plaintext)
  )

  const nowIso = new Date().toISOString()
  const expiresAt =
    typeof expiresInDays === 'number' && Number.isFinite(expiresInDays) && expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined

  return {
    schema: 'lmthing-env-v1',
    algorithm: 'AES-GCM',
    kdf: 'PBKDF2',
    digest: 'SHA-256',
    iterations,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertextBuffer)),
    createdAt: previous?.createdAt || nowIso,
    updatedAt: nowIso,
    ...(expiresAt ? { expiresAt } : {}),
  }
}

export async function decryptEnvContent(payload: EncryptedEnvFile, password: string): Promise<string> {
  if (!password.trim()) {
    throw new Error('Password is required to decrypt env data.')
  }

  const salt = fromBase64(payload.salt)
  const iv = fromBase64(payload.iv)
  const ciphertext = fromBase64(payload.ciphertext)

  const key = await deriveAesKey(password, salt, payload.iterations)

  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(ciphertext)
  )

  return TEXT_DECODER.decode(plaintextBuffer)
}

export function parseDotEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {}

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const eqIndex = line.indexOf('=')
    if (eqIndex <= 0) continue

    const key = line.slice(0, eqIndex).trim()
    let value = line.slice(eqIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (key) {
      result[key] = value
    }
  }

  return result
}

export function stringifyDotEnv(envMap: Record<string, string>): string {
  return Object.entries(envMap)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
}

export function normalizeEnvFileName(fileName: string): string {
  const normalized = fileName.trim()
  if (!normalized) return '.env.local'
  if (normalized.startsWith('.env')) return normalized
  if (normalized.startsWith('env.')) return `.${normalized}`
  if (normalized === 'env') return '.env'
  return `.env.${normalized.replace(/^\.+/, '')}`
}

export function isValidEnvFileName(fileName: string): boolean {
  return /^\.env(?:\.[A-Za-z0-9_-]+)*$/.test(fileName)
}

export function parseEncryptedEnvFileContent(content: string): EncryptedEnvFile | null {
  try {
    const parsed = JSON.parse(content) as Partial<EncryptedEnvFile>

    if (
      parsed?.schema === 'lmthing-env-v1' &&
      parsed.algorithm === 'AES-GCM' &&
      parsed.kdf === 'PBKDF2' &&
      parsed.digest === 'SHA-256' &&
      typeof parsed.iterations === 'number' &&
      typeof parsed.salt === 'string' &&
      typeof parsed.iv === 'string' &&
      typeof parsed.ciphertext === 'string' &&
      typeof parsed.createdAt === 'string' &&
      typeof parsed.updatedAt === 'string'
    ) {
      return parsed as EncryptedEnvFile
    }

    return null
  } catch {
    return null
  }
}

export function serializeEncryptedEnvFileContent(file: EncryptedEnvFile): string {
  return JSON.stringify(file, null, 2)
}

export function applyEnvToWindowProcessEnv(envMap: Record<string, string>) {
  if (typeof window === 'undefined') return

  const globalWindow = window as Window & {
    process?: {
      env?: Record<string, string>
    }
  }

  if (!globalWindow.process) {
    globalWindow.process = { env: {} }
  }

  if (!globalWindow.process.env) {
    globalWindow.process.env = {}
  }

  Object.assign(globalWindow.process.env, envMap)
}

export function hydrateWindowProcessEnvFromSessionCache() {
  if (typeof window === 'undefined') return

  try {
    const sessionKeys: string[] = []

    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index)
      if (!key) continue
      if (key.startsWith(`${ENV_SESSION_CACHE_PREFIX}:`)) {
        sessionKeys.push(key)
      }
    }

    for (const key of sessionKeys) {
      const plaintext = window.sessionStorage.getItem(key)
      if (!plaintext) continue
      const envMap = parseDotEnv(plaintext)
      applyEnvToWindowProcessEnv(envMap)
    }
  } catch {
    // Ignore session storage errors
  }
}
