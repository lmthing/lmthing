'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth'

import '@lmthing/css/components/auth/index.css'
import '@lmthing/css/elements/forms/button/index.css'
import { CozyThingText } from '@lmthing/ui/elements/branding/cozy-text'

export function PinGate({ children }: { children: React.ReactNode }) {
  const { needsPin, pinUnlocked, unlockPin } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!needsPin || pinUnlocked) {
    return <>{children}</>
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const valid = await unlockPin(pin)
      if (!valid) {
        setError('Incorrect PIN')
        setPin('')
      }
    } catch {
      setError('Failed to verify PIN')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-screen__container">
        <div className="login-screen__branding">
          <h1 className="login-screen__title">
            <CozyThingText text="lmthing" />
          </h1>
          <p className="login-screen__subtitle">
            Enter your PIN to unlock
          </p>
        </div>

        {error && (
          <p style={{ color: 'var(--color-destructive)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
          <input
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value)}
            placeholder="Enter your PIN"
            required
            minLength={4}
            autoFocus
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--color-border)',
              background: 'var(--color-background)',
              fontSize: '0.875rem',
              textAlign: 'center',
              letterSpacing: '0.25em',
            }}
          />
          <button
            type="submit"
            disabled={loading}
            className="btn btn--primary login-screen__submit"
          >
            {loading ? 'Unlocking...' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  )
}
