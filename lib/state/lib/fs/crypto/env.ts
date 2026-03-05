// src/lib/fs/crypto/env.ts
//
// Environment file encryption using Web Crypto API (AES-GCM)

const ENV_HEADER = '-----BEGIN ENCRYPTED ENV-----'
const ENV_FOOTER = '-----END ENCRYPTED ENV-----'
const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const SALT_LENGTH = 16
const IV_LENGTH = 12
const ITERATIONS = 100000

export interface EnvEntry {
  key: string
  value: string
  encrypted?: boolean
}

export interface EncryptedEnvFile {
  header: string
  salt: string
  iv: string
  data: string
  footer: string
}

// ── Env file parsing (unencrypted) ─────────────────────────────────────

export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {}

  // Check if file is encrypted
  if (content.includes(ENV_HEADER)) {
    throw new Error('Encrypted env files must be decrypted first with decryptEnvFile()')
  }

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue

    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()

    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    // Handle escape sequences
    value = value.replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\')

    result[key] = value
  }

  return result
}

export function serializeEnvFile(env: Record<string, string>): string {
  const lines: string[] = []

  // Add a comment header
  lines.push('# Environment variables')
  lines.push('#')

  for (const [key, value] of Object.entries(env)) {
    // Escape special characters
    let escapedValue = value
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')

    // Quote values that contain spaces, quotes, or special characters
    if (/[\s"'#\\]/.test(escapedValue)) {
      // If value already contains quotes, escape them
      escapedValue = escapedValue.replace(/"/g, '\\"')
      lines.push(`${key}="${escapedValue}"`)
    } else {
      lines.push(`${key}=${escapedValue}`)
    }
  }

  return lines.join('\n')
}

// ── Encryption using Web Crypto API ─────────────────────────────────────

/**
 * Derive a cryptographic key from a password using PBKDF2
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const passwordBuffer = encoder.encode(password)

  // Import password as a key
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  // Derive the actual encryption key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt environment file content with a password
 */
export async function encryptEnvFile(content: string, password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)

  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

  // Derive key from password
  const key = await deriveKey(password, salt)

  // Encrypt the data
  const encryptedData = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv: iv
    },
    key,
    data
  )

  // Combine salt, iv, and encrypted data
  const combined = new Uint8Array(salt.length + iv.length + encryptedData.byteLength)
  combined.set(salt, 0)
  combined.set(iv, salt.length)
  combined.set(new Uint8Array(encryptedData), salt.length + iv.length)

  // Encode as base64
  const base64 = btoa(String.fromCharCode(...combined))

  return `${ENV_HEADER}\n${base64}\n${ENV_FOOTER}\n`
}

/**
 * Decrypt environment file content with a password
 */
export async function decryptEnvFile(content: string, password: string): Promise<string> {
  // Extract base64 content
  const startMarker = content.indexOf(ENV_HEADER)
  const endMarker = content.indexOf(ENV_FOOTER)

  if (startMarker === -1 || endMarker === -1) {
    // Not encrypted, return as-is
    return content
  }

  const base64 = content.slice(startMarker + ENV_HEADER.length, endMarker).trim()

  try {
    // Decode from base64
    const combined = Uint8Array.from(atob(base64), c => c.charCodeAt(0))

    // Extract salt, iv, and encrypted data
    const salt = combined.slice(0, SALT_LENGTH)
    const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
    const encryptedData = combined.slice(SALT_LENGTH + IV_LENGTH)

    // Derive key from password
    const key = await deriveKey(password, salt)

    // Decrypt the data
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: iv
      },
      key,
      encryptedData
    )

    const decoder = new TextDecoder()
    return decoder.decode(decryptedData)
  } catch (e) {
    throw new Error('Failed to decrypt env file. Wrong password or corrupted data.')
  }
}

/**
 * Check if content is an encrypted env file
 */
export function isEncrypted(content: string): boolean {
  return content.includes(ENV_HEADER) && content.includes(ENV_FOOTER)
}

/**
 * Check if content can be decrypted with the given password
 * (without actually decrypting the full content)
 */
export async function verifyPassword(content: string, password: string): Promise<boolean> {
  if (!isEncrypted(content)) return true

  try {
    await decryptEnvFile(content, password)
    return true
  } catch {
    return false
  }
}

// ── Synchronous versions (for non-async contexts) ───────────────────────
// These use a simpler XOR-based encryption and should only be used
// when async/await is not available

const SYNC_HEADER = '-----BEGIN XOR ENCRYPTED ENV-----'
const SYNC_FOOTER = '-----END XOR ENCRYPTED ENV-----'

/**
 * Simple XOR encryption (synchronous, less secure)
 * Only use when Web Crypto API is not available
 */
export function encryptEnvFileSync(content: string, password: string): string {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)

  // Create a key from the password (repeating to match data length)
  const keyData = encoder.encode(password.padEnd(32, '0').slice(0, 32))

  const encrypted = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i++) {
    encrypted[i] = data[i] ^ keyData[i % keyData.length]
  }

  const base64 = btoa(String.fromCharCode(...encrypted))
  return `${SYNC_HEADER}\n${base64}\n${SYNC_FOOTER}\n`
}

/**
 * Simple XOR decryption (synchronous, less secure)
 */
export function decryptEnvFileSync(content: string, password: string): string {
  const startMarker = content.indexOf(SYNC_HEADER)
  const endMarker = content.indexOf(SYNC_FOOTER)

  if (startMarker === -1 || endMarker === -1) {
    // Not encrypted or using different format, return as-is
    return content
  }

  const base64 = content.slice(startMarker + SYNC_HEADER.length, endMarker).trim()
  const encrypted = Uint8Array.from(atob(base64), c => c.charCodeAt(0))

  const keyData = new TextEncoder().encode(password.padEnd(32, '0').slice(0, 32))
  const decrypted = new Uint8Array(encrypted.length)

  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ keyData[i % keyData.length]
  }

  return new TextDecoder().decode(decrypted)
}

/**
 * Check if content is using sync XOR encryption
 */
export function isSyncEncrypted(content: string): boolean {
  return content.includes(SYNC_HEADER) && content.includes(SYNC_FOOTER)
}

// ── Key management utilities ─────────────────────────────────────────────

/**
 * Generate a random encryption key
 */
export async function generateEncryptionKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  )

  const exported = await crypto.subtle.exportKey('raw', key)
  return btoa(String.fromCharCode(...new Uint8Array(exported)))
}

/**
 * Import an encryption key from base64
 */
export async function importEncryptionKey(base64Key: string): Promise<CryptoKey> {
  const keyData = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  )
}
