import { Search, UserPlus, Clock, Mail } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/elements/forms/button'
import { Input } from '@/elements/forms/input'
import { Stack } from '@/elements/layouts/stack'
import { Sidebar } from '@/elements/nav/sidebar'
import { PanelHeader } from '@/elements/content/panel'
import { ListItem } from '@/elements/content/list-item'
import { Badge } from '@/elements/content/badge'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'
import { Label } from '@/elements/typography/label'
import { Avatar, AvatarImage, AvatarFallback } from '@/elements/content/avatar'

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
    case 'active': return 'bg-emerald-500'
    case 'invited': return 'bg-amber-500'
    case 'pending': return 'bg-slate-400'
    default: return 'bg-slate-400'
  }
}

function getRoleBadgeColor(role: SpaceUserRole) {
  switch (role) {
    case 'admin': return 'text-violet-700 bg-violet-50 dark:bg-violet-950/30 dark:text-violet-300 border-violet-200 dark:border-violet-800'
    case 'editor': return 'text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300 border-amber-200 dark:border-amber-800'
    case 'viewer': return 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
    default: return 'text-slate-600 bg-slate-100 border-slate-200'
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
          <Heading level={3}>Invite User</Heading>
          <Caption muted>Add a new member to your space</Caption>
        </div>
        <form onSubmit={handleSubmit}>
          <Stack gap="md" style={{ padding: '1.5rem' }}>
            <div>
              <Label compact>Email Address</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@organization.org"
                autoFocus
              />
            </div>
            <div>
              <Label compact>Role</Label>
              <Stack gap="sm">
                {[
                  { value: 'viewer' as const, label: 'Viewer', desc: 'Read-only access' },
                  { value: 'editor' as const, label: 'Editor', desc: 'Can create and modify' },
                  { value: 'admin' as const, label: 'Admin', desc: 'Full access including users' }
                ].map((r) => (
                  <label key={r.value}>
                    <ListItem selected={role === r.value} style={{ cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="role"
                        value={r.value}
                        checked={role === r.value}
                        onChange={(e) => setRole(e.target.value as SpaceUserRole)}
                        style={{ marginRight: '0.75rem' }}
                      />
                      <div>
                        <Label>{r.label}</Label>
                        <Caption muted>{r.desc}</Caption>
                      </div>
                    </ListItem>
                  </label>
                ))}
              </Stack>
            </div>
            <Stack row gap="sm" style={{ paddingTop: '0.5rem' }}>
              <Button type="button" onClick={onClose} variant="ghost" style={{ flex: 1 }}>Cancel</Button>
              <Button type="submit" variant="primary" style={{ flex: 1 }}>Send Invite</Button>
            </Stack>
          </Stack>
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
      <Sidebar>
        <PanelHeader>
          <Stack row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Heading level={3}>Members</Heading>
              <Caption muted>{users.length} {users.length === 1 ? 'member' : 'members'}</Caption>
            </div>
            <Button onClick={() => setShowInvite(true)} variant="primary" size="sm" aria-label="Add user">
              <UserPlus className="w-4 h-4" />
            </Button>
          </Stack>
          <div style={{ position: 'relative', marginTop: '1rem' }}>
            <Search className="w-4 h-4" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search by name or email..."
              className="input--sm"
              style={{ paddingLeft: '2.25rem' }}
            />
          </div>
        </PanelHeader>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredUsers.length === 0 ? (
            <Stack style={{ alignItems: 'center', justifyContent: 'center', height: '12rem' }}>
              <Search className="w-10 h-10" style={{ opacity: 0.5 }} />
              <Caption muted>No users found</Caption>
            </Stack>
          ) : (
            <Stack gap="sm" style={{ padding: '0.5rem' }}>
              {filteredUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => onSelectUser?.(user.id)}
                  style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}
                >
                  <ListItem selected={selectedUserId === user.id}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <Avatar>
                        {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                        <AvatarFallback style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', fontWeight: 600 }}>
                          {user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className={getStatusColor(user.status)} style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '0.875rem', height: '0.875rem', borderRadius: '9999px', border: '2px solid white' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <Stack row gap="sm" style={{ alignItems: 'center' }}>
                        <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</span>
                        <Badge className={getRoleBadgeColor(user.role)} style={{ fontSize: '0.625rem', padding: '0.125rem 0.375rem' }}>
                          {user.role.charAt(0).toUpperCase()}
                        </Badge>
                      </Stack>
                      <Stack row gap="sm" style={{ alignItems: 'center', marginTop: '0.125rem' }}>
                        <Mail className="w-3 h-3" style={{ flexShrink: 0, opacity: 0.5 }} />
                        <Caption muted style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</Caption>
                      </Stack>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                      <Badge variant={user.status === 'active' ? 'success' : user.status === 'invited' ? 'primary' : 'muted'} style={{ fontSize: '0.625rem' }}>
                        {user.status}
                      </Badge>
                      {user.lastActive && (
                        <Caption muted style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.6875rem' }}>
                          <Clock className="w-3 h-3" />
                          {formatDate(user.lastActive)}
                        </Caption>
                      )}
                    </div>
                  </ListItem>
                </button>
              ))}
            </Stack>
          )}
        </div>
      </Sidebar>

      {onInviteUser && (
        <InviteDialog isOpen={showInvite} onClose={() => setShowInvite(false)} onInvite={onInviteUser} />
      )}
    </>
  )
}
