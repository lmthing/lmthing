import type { WorkspaceUser, WorkspaceUserRole } from '@/../product/sections/workspaces/types'
import { Search, UserPlus, Clock, Mail } from 'lucide-react'
import { useState } from 'react'

interface WorkspaceListProps {
  users: WorkspaceUser[]
  selectedUserId?: string | null
  searchQuery?: string
  onSelectUser?: (userId: string) => void
  onSearchChange?: (query: string) => void
  onInviteUser?: (email: string, role: WorkspaceUserRole) => void
}

interface InviteDialogProps {
  isOpen: boolean
  onClose: () => void
  onInvite: (email: string, role: WorkspaceUserRole) => void
}

function getStatusColor(status: WorkspaceUser['status']) {
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

function getRoleBadgeColor(role: WorkspaceUserRole) {
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
  const [role, setRole] = useState<WorkspaceUserRole>('viewer')

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 to-violet-700 px-6 py-4">
          <h3 className="text-lg font-semibold text-white">Invite User</h3>
          <p className="text-violet-200 text-sm mt-1">Add a new member to your workspace</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@organization.org"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition-all"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Role
            </label>
            <div className="space-y-2">
              {[
                { value: 'viewer', label: 'Viewer', desc: 'Read-only access' },
                { value: 'editor', label: 'Editor', desc: 'Can create and modify' },
                { value: 'admin', label: 'Admin', desc: 'Full access including users' }
              ].map((r) => (
                <label
                  key={r.value}
                  className={`
                    flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all
                    ${role === r.value
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={role === r.value}
                    onChange={(e) => setRole(e.target.value as WorkspaceUserRole)}
                    className="mt-0.5 w-4 h-4 text-violet-600 focus:ring-violet-500"
                  />
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">{r.label}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">{r.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors font-medium"
            >
              Send Invite
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function WorkspaceList({
  users,
  selectedUserId,
  searchQuery = '',
  onSelectUser,
  onSearchChange,
  onInviteUser
}: WorkspaceListProps) {
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
      <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Members
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {users.length} {users.length === 1 ? 'member' : 'members'}
              </p>
            </div>
            <button
              onClick={() => setShowInvite(true)}
              className="p-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors shadow-sm"
              aria-label="Add user"
            >
              <UserPlus className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition-all"
            />
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto">
          {filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 dark:text-slate-500">
              <Search className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">No users found</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredUsers.map((user, index) => (
                <button
                  key={user.id}
                  onClick={() => onSelectUser?.(user.id)}
                  className={`
                    w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200
                    ${selectedUserId === user.id
                      ? 'bg-white dark:bg-slate-800 shadow-md ring-1 ring-slate-200 dark:ring-slate-700'
                      : 'hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm'
                    }
                  `}
                  style={{
                    animation: `fadeInUp 0.2s ease-out ${index * 0.03}s both`
                  }}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.name}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-white dark:ring-slate-800"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-white font-semibold text-sm ring-2 ring-white dark:ring-slate-800">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className={`
                      absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-800
                      ${getStatusColor(user.status)}
                    }`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {user.name}
                      </p>
                      <span className={`
                        text-[10px] px-1.5 py-0.5 rounded-md font-medium uppercase tracking-wide border
                        ${getRoleBadgeColor(user.role)}
                      `}>
                        {user.role.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>

                  {/* Status & Time */}
                  <div className="flex flex-col items-end gap-1">
                    <span className={`
                      text-[10px] px-2 py-0.5 rounded-full font-medium
                      ${user.status === 'active' ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400' :
                        user.status === 'invited' ? 'text-amber-700 bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400' :
                        'text-slate-600 bg-slate-200 dark:bg-slate-700 dark:text-slate-400'}
                    `}>
                      {user.status}
                    </span>
                    {user.lastActive && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
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

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

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
