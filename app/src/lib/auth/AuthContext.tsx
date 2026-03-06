'use client'

import { createContext, useState, useCallback, useEffect, type ReactNode } from 'react'

const TEXT_ENCODER = new TextEncoder()
const TEXT_DECODER = new TextDecoder()
const VERIFICATION_STRING = 'lmthing-auth-verification-token-v1'
const DEFAULT_ITERATIONS = 250_000

export interface AuthContextValue {
  username: string | null
  isAuthenticated: boolean
  login(username: string, password: string): Promise<{ success: boolean; error?: string }>
  logout(): void
  getEncryptionKey(): CryptoKey | null
}

export const AuthContext = createContext<AuthContextValue | null>(null)

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

interface StoredVerification {
  salt: string
  iv: string
  ciphertext: string
  iterations: number
}

function getStorageKey(username: string): string {
  return `lmthing-auth:${username}`
}

function getStoredVerification(username: string): StoredVerification | null {
  try {
    const raw = localStorage.getItem(getStorageKey(username))
    if (!raw) return null
    return JSON.parse(raw) as StoredVerification
  } catch {
    return null
  }
}

async function createVerificationToken(
  password: string
): Promise<{ verification: StoredVerification; key: CryptoKey }> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveAesKey(password, salt)

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    TEXT_ENCODER.encode(VERIFICATION_STRING)
  )

  return {
    verification: {
      salt: toBase64(salt),
      iv: toBase64(iv),
      ciphertext: toBase64(new Uint8Array(ciphertextBuffer)),
      iterations: DEFAULT_ITERATIONS,
    },
    key,
  }
}

async function verifyPassword(
  password: string,
  stored: StoredVerification
): Promise<{ valid: boolean; key: CryptoKey }> {
  const salt = fromBase64(stored.salt)
  const iv = fromBase64(stored.iv)
  const ciphertext = fromBase64(stored.ciphertext)
  const key = await deriveAesKey(password, salt, stored.iterations)

  try {
    const plaintextBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(ciphertext)
    )
    const plaintext = TEXT_DECODER.decode(plaintextBuffer)
    return { valid: plaintext === VERIFICATION_STRING, key }
  } catch {
    return { valid: false, key }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null)

  const login = useCallback(
    async (
      inputUsername: string,
      password: string
    ): Promise<{ success: boolean; error?: string }> => {
      const trimmedUsername = inputUsername.trim()
      if (!trimmedUsername) {
        return { success: false, error: 'Username is required.' }
      }
      if (!password) {
        return { success: false, error: 'Password is required.' }
      }

      const existing = getStoredVerification(trimmedUsername)

      if (existing) {
        // Existing user: verify password
        const { valid, key } = await verifyPassword(password, existing)
        if (!valid) {
          return { success: false, error: 'Invalid password.' }
        }
        setUsername(trimmedUsername)
        setEncryptionKey(key)
        setIsAuthenticated(true)
        return { success: true }
      }

      // New user: create verification token
      const { verification, key } = await createVerificationToken(password)
      localStorage.setItem(getStorageKey(trimmedUsername), JSON.stringify(verification))
      setUsername(trimmedUsername)
      setEncryptionKey(key)
      setIsAuthenticated(true)
      return { success: true }
    },
    []
  )

  const logout = useCallback(() => {
    setUsername(null)
    setEncryptionKey(null)
    setIsAuthenticated(false)
  }, [])

  const getEncryptionKey = useCallback(() => encryptionKey, [encryptionKey])

  // Persist last username so login screen can pre-fill it
  useEffect(() => {
    if (username) {
      localStorage.setItem('lmthing-auth:last-username', username)
    }
  }, [username])

  return (
    <AuthContext.Provider value={{ username, isAuthenticated, login, logout, getEncryptionKey }}>
      {children}
    </AuthContext.Provider>
  )
}

