import { Search, UserPlus, Clock, Mail } from 'lucide-react'
import { useUIState, useToggle } from '@lmthing/state'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Input } from '@lmthing/ui/elements/forms/input'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Sidebar } from '@lmthing/ui/elements/nav/sidebar'
import { PanelHeader } from '@lmthing/ui/elements/content/panel'
import { ListItem } from '@lmthing/ui/elements/content/list-item'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Avatar, AvatarImage, AvatarFallback } from '@lmthing/ui/elements/content/avatar'
import '@lmthing/css/components/space/index.css'

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
    case 'active': return 'space-list__status-dot--active'
    case 'invited': return 'space-list__status-dot--invited'
    case 'pending': return 'space-list__status-dot--pending'
    default: return 'space-list__status-dot--pending'
  }
}

function getRoleBadgeColor(role: SpaceUserRole) {
  switch (role) {
    case 'admin': return 'space-list__role-badge--admin'
    case 'editor': return 'space-list__role-badge--editor'
    case 'viewer': return 'space-list__role-badge--viewer'
    default: return 'space-list__role-badge--viewer'
  }
}

function InviteDialog({ isOpen, onClose, onInvite }: InviteDialogProps) {
  const [email, setEmail] = useUIState('space-list.invite-email', '')
  const [role, setRole] = useUIState<SpaceUserRole>('space-list.invite-role', 'viewer')

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
      <div className="dialog__content space-list__invite-dialog">
        <div className="dialog__header">
          <Heading level={3}>Invite User</Heading>
          <Caption muted>Add a new member to your space</Caption>
        </div>
        <form onSubmit={handleSubmit}>
          <Stack gap="md" className="space-list__invite-form-body">
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
                    <ListItem selected={role === r.value} className="space-list__invite-role-item">
                      <input
                        type="radio"
                        name="role"
                        value={r.value}
                        checked={role === r.value}
                        onChange={(e) => setRole(e.target.value as SpaceUserRole)}
                        className="space-list__invite-role-radio"
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
            <Stack row gap="sm" className="space-list__invite-actions">
              <Button type="button" onClick={onClose} variant="ghost" className="space-list__invite-action-btn">Cancel</Button>
              <Button type="submit" variant="primary" className="space-list__invite-action-btn">Send Invite</Button>
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
  const [showInvite, , setShowInvite] = useToggle('space-list.show-invite', false)

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
          <Stack row className="space-list__header">
            <div>
              <Heading level={3}>Members</Heading>
              <Caption muted>{users.length} {users.length === 1 ? 'member' : 'members'}</Caption>
            </div>
            <Button onClick={() => setShowInvite(true)} variant="primary" size="sm" aria-label="Add user">
              <UserPlus className="space-list__invite-icon" />
            </Button>
          </Stack>
          <div className="space-list__search-wrapper">
            <Search className="space-list__search-icon" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search by name or email..."
              className="input--sm space-list__search-input"
            />
          </div>
        </PanelHeader>

        <div className="space-list__body">
          {filteredUsers.length === 0 ? (
            <Stack className="space-list__empty">
              <Search className="space-list__empty-icon" />
              <Caption muted>No users found</Caption>
            </Stack>
          ) : (
            <Stack gap="sm" className="space-list__user-list">
              {filteredUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => onSelectUser?.(user.id)}
                  className="space-list__user-btn"
                >
                  <ListItem selected={selectedUserId === user.id}>
                    <div className="space-list__avatar-wrapper">
                      <Avatar>
                        {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                        <AvatarFallback className="space-list__avatar-fallback">
                          {user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`${getStatusColor(user.status)} space-list__status-dot`} />
                    </div>
                    <div className="space-list__user-info">
                      <Stack row gap="sm" className="space-list__user-name-row">
                        <span className="space-list__user-name">{user.name}</span>
                        <Badge className={`${getRoleBadgeColor(user.role)} space-list__role-badge`}>
                          {user.role.charAt(0).toUpperCase()}
                        </Badge>
                      </Stack>
                      <Stack row gap="sm" className="space-list__email-row">
                        <Mail className="space-list__email-icon" />
                        <Caption muted className="space-list__email">{user.email}</Caption>
                      </Stack>
                    </div>
                    <div className="space-list__status-col">
                      <Badge variant={user.status === 'active' ? 'success' : user.status === 'invited' ? 'primary' : 'muted'} className="space-list__status-badge">
                        {user.status}
                      </Badge>
                      {user.lastActive && (
                        <Caption muted className="space-list__last-active">
                          <Clock className="space-list__last-active-icon" />
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
