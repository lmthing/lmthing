'use client'

import { useEffect, type FormEvent } from 'react'
import { useUIState, useToggle } from '@lmthing/state'
import { useAuth } from '@/lib/auth'

import '@lmthing/css/components/auth/index.css'
import '@lmthing/css/elements/forms/button/index.css'
import '@lmthing/css/elements/forms/input/index.css'
import { CozyThingText } from '@lmthing/ui/elements/branding/cozy-text'

export function LoginScreen() {
  const { login } = useAuth()
  const [username, setUsername] = useUIState<string>('login.username', '')
  const [password, setPassword] = useUIState<string>('login.password', '')
  const [error, setError] = useUIState<string | null>('login.error', null)
  const [loading, , setLoading] = useToggle('login.loading', false)
  const [isExistingUser, , setIsExistingUser] = useToggle('login.isExistingUser', false)

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
    <div className="login-screen">
      <div className="login-screen__container">
        {/* Branding */}
        <div className="login-screen__branding">
          <h1 className="login-screen__title">
            <CozyThingText text="lmthing" />
          </h1>
          <p className="login-screen__subtitle">
            {isExistingUser ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-screen__form">
          <div className="login-screen__field">
            <label htmlFor="login-username" className="login-screen__label">
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

          <div className="login-screen__field">
            <label htmlFor="login-password" className="login-screen__label">
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
            <p className="login-screen__error">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn--primary login-screen__submit"
            disabled={loading || !username.trim() || !password}
          >
            {loading ? 'Please wait...' : isExistingUser ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {!isExistingUser && username.trim() && (
          <p className="login-screen__new-account-hint">
            No account found for this username. Submitting will create a new one.
          </p>
        )}
      </div>
    </div>
  )
}
