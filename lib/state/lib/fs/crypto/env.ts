// src/lib/fs/crypto/env.ts

const ENV_HEADER = '-----BEGIN ENCRYPTED ENV-----'
const ENV_FOOTER = '-----END ENCRYPTED ENV-----'

export interface EnvEntry {
  key: string
  value: string
  encrypted?: boolean
}

export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {}

  // Check if file is encrypted
  if (content.includes(ENV_HEADER)) {
    throw new Error('Encrypted env files must be decrypted first')
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

    result[key] = value
  }

  return result
}

export function serializeEnvFile(env: Record<string, string>): string {
  return Object.entries(env)
    .map(([key, value]) => {
      // Quote values that contain spaces or special characters
      if (/[\s"'\\]/.test(value)) {
        return `${key}="${value.replace(/"/g, '\\"')}"`
      }
      return `${key}=${value}`
    })
    .join('\n')
}

export function encryptEnvFile(content: string, password: string): string {
  // Simple XOR encryption for demonstration
  // In production, use proper encryption like Web Crypto API
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const keyData = encoder.encode(password.padEnd(32, '0').slice(0, 32))

  const encrypted = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i++) {
    encrypted[i] = data[i] ^ keyData[i % keyData.length]
  }

  const base64 = btoa(String.fromCharCode(...encrypted))
  return `${ENV_HEADER}\n${base64}\n${ENV_FOOTER}\n`
}

export function decryptEnvFile(content: string, password: string): string {
  // Extract base64 content
  const startMarker = content.indexOf(ENV_HEADER)
  const endMarker = content.indexOf(ENV_FOOTER)

  if (startMarker === -1 || endMarker === -1) {
    // Not encrypted, return as-is
    return content
  }

  const base64 = content.slice(startMarker + ENV_HEADER.length, endMarker).trim()
  const encrypted = Uint8Array.from(atob(base64), c => c.charCodeAt(0))

  const keyData = new TextEncoder().encode(password.padEnd(32, '0').slice(0, 32))
  const decrypted = new Uint8Array(encrypted.length)

  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ keyData[i % keyData.length]
  }

  return new TextDecoder().decode(decrypted)
}

export function isEncrypted(content: string): boolean {
  return content.includes(ENV_HEADER) && content.includes(ENV_FOOTER)
}
