import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/account')({
  component: Account,
})

function Account() {
  const { user, loading, updatePassword } = useAuth()

  const [displayName, setDisplayName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (loading) return null
  if (!user) {
    window.location.href = '/login?redirect=/account'
    return null
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)
    try {
      const { error } = await supabase.from('profiles').update({ display_name: displayName }).eq('id', user.id)
      if (error) throw error
      setMessage('Profile updated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)
    try {
      await updatePassword(newPassword)
      setNewPassword('')
      setMessage('Password updated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password update failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold">Account settings</h1>

      {message && <div className="mb-4 rounded-md bg-primary/10 p-3 text-sm text-primary">{message}</div>}
      {error && <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Profile</h2>
        <form onSubmit={handleUpdateProfile} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Email</span>
            <input type="email" value={user.email || ''} disabled className="rounded-md border border-input bg-muted px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Display name</span>
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </label>
          <button type="submit" disabled={saving} className="self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            Save profile
          </button>
        </form>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Change password</h2>
        <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">New password</span>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </label>
          <button type="submit" disabled={saving} className="self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            Update password
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">API keys</h2>
        <p className="mb-2 text-sm text-muted-foreground">Manage your API keys for programmatic access.</p>
        <Link to="/account/keys" className="text-sm text-primary hover:underline">Manage API keys</Link>
      </section>
    </div>
  )
}
