import type { WorkspaceUser, WorkspaceUserRole, RoleDefinition } from '@/../product/sections/workspaces/types'
import { Mail, Calendar, Clock, Shield, Check, X, Trash2, User as UserIcon, Crown, Edit3, Eye } from 'lucide-react'
import { useState } from 'react'

interface UserDetailPanelProps {
  user?: WorkspaceUser | null
  roles: RoleDefinition[]
  onUpdateRole?: (userId: string, role: WorkspaceUserRole) => void
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 text-center">
            Remove User
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-center text-sm mt-2">
            Are you sure you want to remove <span className="font-medium text-slate-700 dark:text-slate-300">{userName}</span> from the workspace? This action cannot be undone.
          </p>
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors font-medium"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function getRoleIcon(role: WorkspaceUserRole) {
  switch (role) {
    case 'admin':
      return <Crown className="w-4 h-4" />
    case 'editor':
      return <Edit3 className="w-4 h-4" />
    case 'viewer':
      return <Eye className="w-4 h-4" />
  }
}

function getRoleBadgeClass(role: WorkspaceUserRole) {
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
  const [selectedRole, setSelectedRole] = useState<WorkspaceUserRole | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  if (!user) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <UserIcon className="w-7 h-7 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
            No User Selected
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
            Select a user from the sidebar to view and edit their profile and permissions
          </p>
        </div>
      </div>
    )
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not yet joined'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
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
      <div className="h-full flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
        {/* Header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-amber-500/10" />
          <div className="relative px-8 pt-8 pb-6">
            <div className="flex items-start gap-6">
              {/* Avatar */}
              <div className="flex-shrink-0">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-20 h-20 rounded-2xl object-cover ring-4 ring-white dark:ring-slate-800 shadow-lg"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-white font-bold text-2xl ring-4 ring-white dark:ring-slate-800 shadow-lg">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Name & Role */}
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 truncate">
                  {user.name}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Change role:</span>
                    </div>
                  ) : (
                    <span className={`
                      inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold
                      ${getRoleBadgeClass(user.role)}
                    `}>
                      {getRoleIcon(user.role)}
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-8 py-6 overflow-y-auto">
          {/* Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">Email</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{user.email}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">Joined</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{formatDate(user.joinedAt)}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">Last Active</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{formatLastActive(user.lastActive)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Role Section */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wide mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Permissions & Role
            </h3>

            {isEditing ? (
              <div className="space-y-3">
                {roles.map((role) => {
                  const Icon = role.value === 'admin' ? Crown : role.value === 'editor' ? Edit3 : Eye
                  const isSelected = selectedRole === role.value
                  return (
                    <button
                      key={role.value}
                      onClick={() => setSelectedRole(role.value as WorkspaceUserRole)}
                      className={`
                        w-full flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left
                        ${isSelected
                          ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/20 ring-2 ring-violet-500/20'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }
                      `}
                    >
                      <div className={`
                        w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                        ${role.value === 'admin' ? 'bg-violet-100 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400' :
                          role.value === 'editor' ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400' :
                          'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}
                      `}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{role.label}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{role.description}</div>
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center flex-shrink-0">
                          <Check className="w-4 h-4" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    user.role === 'admin' ? 'bg-violet-100 dark:bg-violet-950/30' :
                    user.role === 'editor' ? 'bg-amber-100 dark:bg-amber-950/30' :
                    'bg-slate-200 dark:bg-slate-700'
                  }`}>
                    {getRoleIcon(user.role)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {roles.find(r => r.value === user.role)?.label || user.role}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {roles.find(r => r.value === user.role)?.description}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Status Badge */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wide mb-4">
              Account Status
            </h3>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
              ${user.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' :
                user.status === 'invited' ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400' :
                'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}
            `}>
              <span className={`w-2 h-2 rounded-full ${
                user.status === 'active' ? 'bg-emerald-500' :
                user.status === 'invited' ? 'bg-amber-500' :
                'bg-slate-400'
              }`} />
              {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-8 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSaveRole}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors font-medium shadow-sm"
                  >
                    <Check className="w-4 h-4" />
                    Save Changes
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setIsEditing(true)
                      setSelectedRole(user.role)
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors font-medium shadow-sm"
                  >
                    <Shield className="w-4 h-4" />
                    Edit Role
                  </button>
                  <button
                    onClick={() => setShowConfirm(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </button>
                </>
              )}
            </div>
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
