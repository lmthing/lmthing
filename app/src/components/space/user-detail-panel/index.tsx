import { Mail, Calendar, Clock, Shield, Check, X, Trash2, User as UserIcon, Crown, Edit3, Eye } from 'lucide-react'
import { useState } from 'react'
import type { SpaceUser, SpaceUserRole, RoleDefinition } from '../space-list'

interface UserDetailPanelProps {
  user?: SpaceUser | null
  roles: RoleDefinition[]
  onUpdateRole?: (userId: string, role: SpaceUserRole) => void
  onRemoveUser?: (userId: string) => void
  onCancel?: () => void
}

interface ConfirmDialogProps {
  isOpen: boolean
  userName: string
  onConfirm: () => void
  onClose: () => void
}

function ConfirmDialog({ isOpen, userName, onConfirm, onClose }: ConfirmDialogProps) {
  if (!isOpen) return null

  return (
    <div className="dialog__backdrop">
      <div className="dialog__content" style={{ maxWidth: '24rem' }}>
        <div className="stack stack--gap-md" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ width: '3rem', height: '3rem', borderRadius: '9999px', background: 'var(--color-destructive-bg, #fef2f2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
            <Trash2 className="w-6 h-6" style={{ color: 'var(--color-destructive, #dc2626)' }} />
          </div>
          <h3 className="heading-3">Remove User</h3>
          <p className="caption caption--muted">
            Are you sure you want to remove <strong>{userName}</strong> from the space? This action cannot be undone.
          </p>
          <div className="stack stack--row stack--gap-sm">
            <button onClick={onClose} className="btn btn--ghost" style={{ flex: 1 }}>Cancel</button>
            <button onClick={onConfirm} className="btn btn--destructive" style={{ flex: 1 }}>Remove</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function getRoleIcon(role: SpaceUserRole) {
  switch (role) {
    case 'admin': return <Crown className="w-4 h-4" />
    case 'editor': return <Edit3 className="w-4 h-4" />
    case 'viewer': return <Eye className="w-4 h-4" />
  }
}

function getRoleBadgeClass(role: SpaceUserRole) {
  switch (role) {
    case 'admin':
      return 'bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/25'
    case 'editor':
      return 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/25'
    case 'viewer':
      return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
  }
}

export function UserDetailPanel({
  user,
  roles,
  onUpdateRole,
  onRemoveUser,
  onCancel
}: UserDetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [selectedRole, setSelectedRole] = useState<SpaceUserRole | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  if (!user) {
    return (
      <div className="panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="avatar avatar--lg" style={{ margin: '0 auto 1rem', background: 'var(--color-muted-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserIcon className="w-7 h-7" style={{ opacity: 0.5 }} />
          </div>
          <h3 className="heading-3">No User Selected</h3>
          <p className="caption caption--muted" style={{ maxWidth: '20rem' }}>
            Select a user from the sidebar to view and edit their profile and permissions
          </p>
        </div>
      </div>
    )
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not yet joined'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    })
  }

  const formatLastActive = (dateString: string | null) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    return formatDate(dateString)
  }

  const handleSaveRole = () => {
    if (selectedRole && selectedRole !== user.role && onUpdateRole) {
      onUpdateRole(user.id, selectedRole)
    }
    setIsEditing(false)
    setSelectedRole(null)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setSelectedRole(null)
    onCancel?.()
  }

  const handleRemove = () => {
    if (onRemoveUser) {
      onRemoveUser(user.id)
      setShowConfirm(false)
    }
  }

  return (
    <>
      <div className="panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div className="panel__header">
          <div className="stack stack--row stack--gap-md" style={{ alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0 }}>
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="avatar avatar--lg" />
              ) : (
                <div className="avatar avatar--lg" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.5rem' }}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="heading-2" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name}
              </h2>
              {!isEditing && (
                <span className={`badge ${getRoleBadgeClass(user.role)}`} style={{ marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.75rem' }}>
                  {getRoleIcon(user.role)}
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="panel__body" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>
          {/* Info Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div className="card__body">
              <div className="stack stack--row stack--gap-sm" style={{ alignItems: 'center' }}>
                <Mail className="w-4 h-4" style={{ opacity: 0.6 }} />
                <div>
                  <p className="caption caption--muted">Email</p>
                  <p className="label">{user.email}</p>
                </div>
              </div>
            </div>
            <div className="card__body">
              <div className="stack stack--row stack--gap-sm" style={{ alignItems: 'center' }}>
                <Calendar className="w-4 h-4" style={{ opacity: 0.6 }} />
                <div>
                  <p className="caption caption--muted">Joined</p>
                  <p className="label">{formatDate(user.joinedAt)}</p>
                </div>
              </div>
            </div>
            <div className="card__body">
              <div className="stack stack--row stack--gap-sm" style={{ alignItems: 'center' }}>
                <Clock className="w-4 h-4" style={{ opacity: 0.6 }} />
                <div>
                  <p className="caption caption--muted">Last Active</p>
                  <p className="label">{formatLastActive(user.lastActive)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Role Section */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 className="heading-4" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Shield className="w-4 h-4" />
              Permissions & Role
            </h3>

            {isEditing ? (
              <div className="stack stack--gap-sm">
                {roles.map((role) => {
                  const Icon = role.value === 'admin' ? Crown : role.value === 'editor' ? Edit3 : Eye
                  const isSelected = selectedRole === role.value
                  return (
                    <button
                      key={role.value}
                      onClick={() => setSelectedRole(role.value as SpaceUserRole)}
                      className={`list-item ${isSelected ? 'list-item--selected' : ''}`}
                      style={{ textAlign: 'left' }}
                    >
                      <Icon className="w-5 h-5" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div className="label">{role.label}</div>
                        <div className="caption caption--muted">{role.description}</div>
                      </div>
                      {isSelected && (
                        <div style={{ width: '1.5rem', height: '1.5rem', borderRadius: '9999px', background: '#7c3aed', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Check className="w-4 h-4" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="card__body">
                <div className="stack stack--row stack--gap-sm" style={{ alignItems: 'center' }}>
                  {getRoleIcon(user.role)}
                  <div>
                    <p className="label">{roles.find(r => r.value === user.role)?.label || user.role}</p>
                    <p className="caption caption--muted">{roles.find(r => r.value === user.role)?.description}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <h3 className="heading-4" style={{ marginBottom: '1rem' }}>Account Status</h3>
            <span className={`badge ${
              user.status === 'active' ? 'badge--success' :
              user.status === 'invited' ? 'badge--primary' :
              'badge--muted'
            }`}>
              {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="card__footer">
          <div className="stack stack--row stack--gap-sm">
            {isEditing ? (
              <>
                <button onClick={handleSaveRole} className="btn btn--primary">
                  <Check className="w-4 h-4" /> Save Changes
                </button>
                <button onClick={handleCancelEdit} className="btn btn--ghost">
                  <X className="w-4 h-4" /> Cancel
                </button>
              </>
            ) : (
              <>
                <button onClick={() => { setIsEditing(true); setSelectedRole(user.role) }} className="btn btn--primary">
                  <Shield className="w-4 h-4" /> Edit Role
                </button>
                <button onClick={() => setShowConfirm(true)} className="btn btn--destructive">
                  <Trash2 className="w-4 h-4" /> Remove
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {onRemoveUser && (
        <ConfirmDialog
          isOpen={showConfirm}
          userName={user.name}
          onConfirm={handleRemove}
          onClose={() => setShowConfirm(false)}
        />
      )}
    </>
  )
}
