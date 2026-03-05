import { Search, UserPlus, Clock, Mail } from 'lucide-react'
import { useState } from 'react'

export interface SpaceUser {
  id: string
  name: string
  email: string
  role: SpaceUserRole
  status: 'active' | 'invited' | 'pending'
  avatarUrl?: string
  lastActive: string | null
  joinedAt: string | null
}

export type SpaceUserRole = 'admin' | 'editor' | 'viewer'

export interface RoleDefinition {
  value: string
  label: string
  description: string
}

interface SpaceListProps {
  users: SpaceUser[]
  selectedUserId?: string | null
  searchQuery?: string
  onSelectUser?: (userId: string) => void
  onSearchChange?: (query: string) => void
  onInviteUser?: (email: string, role: SpaceUserRole) => void
}

interface InviteDialogProps {
  isOpen: boolean
  onClose: () => void
  onInvite: (email: string, role: SpaceUserRole) => void
}

function getStatusColor(status: SpaceUser['status']) {
  switch (status) {
    case 'active':
      return 'bg-emerald-500'
    case 'invited':
      return 'bg-amber-500'
    case 'pending':
      return 'bg-slate-400'
    default:
      return 'bg-slate-400'
  }
}

function getRoleBadgeColor(role: SpaceUserRole) {
  switch (role) {
    case 'admin':
      return 'text-violet-700 bg-violet-50 dark:bg-violet-950/30 dark:text-violet-300 border-violet-200 dark:border-violet-800'
    case 'editor':
      return 'text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300 border-amber-200 dark:border-amber-800'
    case 'viewer':
      return 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
    default:
      return 'text-slate-600 bg-slate-100 border-slate-200'
  }
}

function InviteDialog({ isOpen, onClose, onInvite }: InviteDialogProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<SpaceUserRole>('viewer')

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email.trim()) {
      onInvite(email.trim(), role)
      setEmail('')
      setRole('viewer')
      onClose()
    }
  }

  return (
    <div className="dialog__backdrop">
      <div className="dialog__content" style={{ maxWidth: '28rem' }}>
        <div className="dialog__header">
          <h3 className="heading-3">Invite User</h3>
          <p className="caption caption--muted">Add a new member to your space</p>
        </div>
        <form onSubmit={handleSubmit} className="stack stack--gap-md" style={{ padding: '1.5rem' }}>
          <div>
            <label className="label label--sm">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@organization.org"
              className="input"
              autoFocus
            />
          </div>
          <div>
            <label className="label label--sm">Role</label>
            <div className="stack stack--gap-sm">
              {[
                { value: 'viewer' as const, label: 'Viewer', desc: 'Read-only access' },
                { value: 'editor' as const, label: 'Editor', desc: 'Can create and modify' },
                { value: 'admin' as const, label: 'Admin', desc: 'Full access including users' }
              ].map((r) => (
                <label
                  key={r.value}
                  className={`list-item ${role === r.value ? 'list-item--selected' : ''}`}
                  style={{ cursor: 'pointer' }}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={role === r.value}
                    onChange={(e) => setRole(e.target.value as SpaceUserRole)}
                    style={{ marginRight: '0.75rem' }}
                  />
                  <div>
                    <div className="label">{r.label}</div>
                    <div className="caption caption--muted">{r.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="stack stack--row stack--gap-sm" style={{ paddingTop: '0.5rem' }}>
            <button type="button" onClick={onClose} className="btn btn--ghost" style={{ flex: 1 }}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" style={{ flex: 1 }}>
              Send Invite
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function SpaceList({
  users,
  selectedUserId,
  searchQuery = '',
  onSelectUser,
  onSearchChange,
  onInviteUser
}: SpaceListProps) {
  const [showInvite, setShowInvite] = useState(false)

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <>
      <div className="sidebar">
        <div className="panel__header">
          <div className="stack stack--row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="heading-3">Members</h2>
              <p className="caption caption--muted">
                {users.length} {users.length === 1 ? 'member' : 'members'}
              </p>
            </div>
            <button
              onClick={() => setShowInvite(true)}
              className="btn btn--primary btn--sm"
              aria-label="Add user"
            >
              <UserPlus className="w-4 h-4" />
            </button>
          </div>

          <div style={{ position: 'relative', marginTop: '1rem' }}>
            <Search className="w-4 h-4" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search by name or email..."
              className="input input--sm"
              style={{ paddingLeft: '2.25rem' }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredUsers.length === 0 ? (
            <div className="stack" style={{ alignItems: 'center', justifyContent: 'center', height: '12rem' }}>
              <Search className="w-10 h-10" style={{ opacity: 0.5 }} />
              <p className="caption caption--muted">No users found</p>
            </div>
          ) : (
            <div className="stack stack--gap-sm" style={{ padding: '0.5rem' }}>
              {filteredUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => onSelectUser?.(user.id)}
                  className={`list-item ${selectedUserId === user.id ? 'list-item--selected' : ''}`}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.name}
                        className="avatar"
                      />
                    ) : (
                      <div className="avatar" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className={`${getStatusColor(user.status)}`} style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '0.875rem', height: '0.875rem', borderRadius: '9999px', border: '2px solid white' }} />
                  </div>

                  <div className="list-item__label" style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div className="stack stack--row stack--gap-sm" style={{ alignItems: 'center' }}>
                      <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.name}
                      </span>
                      <span className={`badge ${getRoleBadgeColor(user.role)}`} style={{ fontSize: '0.625rem', padding: '0.125rem 0.375rem' }}>
                        {user.role.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="stack stack--row stack--gap-sm" style={{ alignItems: 'center', marginTop: '0.125rem' }}>
                      <Mail className="w-3 h-3" style={{ flexShrink: 0, opacity: 0.5 }} />
                      <span className="caption caption--muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.email}
                      </span>
                    </div>
                  </div>

                  <div className="list-item__meta" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                    <span className={`badge ${
                      user.status === 'active' ? 'badge--success' :
                      user.status === 'invited' ? 'badge--primary' :
                      'badge--muted'
                    }`} style={{ fontSize: '0.625rem' }}>
                      {user.status}
                    </span>
                    {user.lastActive && (
                      <div className="caption caption--muted" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.6875rem' }}>
                        <Clock className="w-3 h-3" />
                        {formatDate(user.lastActive)}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {onInviteUser && (
        <InviteDialog
          isOpen={showInvite}
          onClose={() => setShowInvite(false)}
          onInvite={onInviteUser}
        />
      )}
    </>
  )
}
