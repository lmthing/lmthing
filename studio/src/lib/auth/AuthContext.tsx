'use client'

import { createContext, useCallback, useEffect, type ReactNode } from 'react'
import { useUIState, useToggle } from '../../../../org/state/src'

const TEXT_ENCODER = new TextEncoder()
const TEXT_DECODER = new TextDecoder()
const VERIFICATION_STRING = 'lmthing-auth-verification-token-v1'
const DEFAULT_ITERATIONS = 250_000
const SESSION_KEY = 'lmthing-session'

export interface AuthContextValue {
  username: string | null
  isAuthenticated: boolean
  isLoading: boolean
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
    true,
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

async function saveSession(name: string, key: CryptoKey): Promise<void> {
  try {
    const raw = await crypto.subtle.exportKey('raw', key)
    const encoded = toBase64(new Uint8Array(raw))
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username: name, key: encoded }))
  } catch {
    // Silently fail — session just won't persist
  }
}

async function restoreSession(): Promise<{ username: string; key: CryptoKey } | null> {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const { username, key: encoded } = JSON.parse(raw) as { username: string; key: string }
    if (!username || !encoded) return null
    // Verify the user still has a stored verification token
    if (!getStoredVerification(username)) {
      sessionStorage.removeItem(SESSION_KEY)
      return null
    }
    const keyBytes = fromBase64(encoded)
    const key = await crypto.subtle.importKey(
      'raw',
      toArrayBuffer(keyBytes),
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    )
    return { username, key }
  } catch {
    sessionStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useUIState<string | null>('auth.username', null)
  const [isAuthenticated, , setIsAuthenticated] = useToggle('auth.isAuthenticated', false)
  const [isLoading, , setIsLoading] = useToggle('auth.isLoading', true)
  const [encryptionKey, setEncryptionKey] = useUIState<CryptoKey | null>('auth.encryptionKey', null)

  // Restore session on mount
  useEffect(() => {
    restoreSession().then((session) => {
      if (session) {
        setUsername(session.username)
        setEncryptionKey(session.key)
        setIsAuthenticated(true)
      }
      setIsLoading(false)
    })
  }, [])

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
        await saveSession(trimmedUsername, key)
        return { success: true }
      }

      // New user: create verification token
      const { verification, key } = await createVerificationToken(password)
      localStorage.setItem(getStorageKey(trimmedUsername), JSON.stringify(verification))
      setUsername(trimmedUsername)
      setEncryptionKey(key)
      setIsAuthenticated(true)
      await saveSession(trimmedUsername, key)
      return { success: true }
    },
    []
  )

  const logout = useCallback(() => {
    setUsername(null)
    setEncryptionKey(null)
    setIsAuthenticated(false)
    sessionStorage.removeItem(SESSION_KEY)
  }, [])

  const getEncryptionKey = useCallback(() => encryptionKey, [encryptionKey])

  // Persist last username so login screen can pre-fill it
  useEffect(() => {
    if (username) {
      localStorage.setItem('lmthing-auth:last-username', username)
    }
  }, [username])

  return (
    <AuthContext.Provider value={{ username, isAuthenticated, isLoading, login, logout, getEncryptionKey }}>
      {children}
    </AuthContext.Provider>
  )
}

