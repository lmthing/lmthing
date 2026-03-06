'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useAuth } from '@/lib/auth'

import '@/css/elements/forms/button/index.css'
import '@/css/elements/forms/input/index.css'
import CozyThingText from '@/CozyText'

export function LoginScreen() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isExistingUser, setIsExistingUser] = useState(false)

  useEffect(() => {
    const lastUsername = localStorage.getItem('lmthing-auth:last-username')
    if (lastUsername) {
      setUsername(lastUsername)
      // Check if this user already exists
      const stored = localStorage.getItem(`lmthing-auth:${lastUsername}`)
      setIsExistingUser(!!stored)
    }
  }, [])

  function handleUsernameChange(value: string) {
    setUsername(value)
    setError(null)
    const stored = localStorage.getItem(`lmthing-auth:${value.trim()}`)
    setIsExistingUser(!!stored)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await login(username, password)
      if (!result.success) {
        setError(result.error ?? 'Login failed.')
      }
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '360px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2rem',
        }}
      >
        {/* Branding */}
        <div style={{ textAlign: 'center' }}>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            <CozyThingText text="lmthing" />
          </h1>
          <p
            style={{
              fontSize: '0.875rem',
              opacity: 0.6,
              marginTop: '0.25rem',
            }}
          >
            {isExistingUser ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label htmlFor="login-username" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
              Username
            </label>
            <input
              id="login-username"
              className="input"
              type="text"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              placeholder="Enter your username"
              autoComplete="username"
              autoFocus
              disabled={loading}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label htmlFor="login-password" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
              Password
            </label>
            <input
              id="login-password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError(null)
              }}
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && (
            <p
              style={{
                fontSize: '0.8125rem',
                color: 'hsl(var(--destructive))',
                margin: 0,
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn--primary"
            disabled={loading || !username.trim() || !password}
            style={{ width: '100%', marginTop: '0.25rem' }}
          >
            {loading ? 'Please wait...' : isExistingUser ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {!isExistingUser && username.trim() && (
          <p
            style={{
              fontSize: '0.75rem',
              opacity: 0.5,
              textAlign: 'center',
              margin: 0,
            }}
          >
            No account found for this username. Submitting will create a new one.
          </p>
        )}
      </div>
    </div>
  )
}
