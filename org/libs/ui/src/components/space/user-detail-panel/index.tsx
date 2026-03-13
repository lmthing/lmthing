import { Mail, Calendar, Clock, Shield, Check, X, Trash2, User as UserIcon, Crown, Edit3, Eye } from 'lucide-react'
import { useUIState, useToggle } from '@lmthing/state'
import type { SpaceUser, SpaceUserRole, RoleDefinition } from '../space-list'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Panel, PanelHeader, PanelBody } from '@lmthing/ui/elements/content/panel'
import { CardBody, CardFooter } from '@lmthing/ui/elements/content/card'
import { ListItem } from '@lmthing/ui/elements/content/list-item'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Avatar, AvatarImage, AvatarFallback } from '@lmthing/ui/elements/content/avatar'
import '@lmthing/css/components/space/index.css'

interface UserDetailPanelProps {
  user?: SpaceUser | null
  roles: RoleDefinition[]
  onUpdateRole?: (userId: string, role: SpaceUserRole) => void
  onRemoveUser?: (userId: string) => void
  onCancel?: () => void
}

function ConfirmDialog({ isOpen, userName, onConfirm, onClose }: { isOpen: boolean; userName: string; onConfirm: () => void; onClose: () => void }) {
  if (!isOpen) return null
  return (
    <div className="dialog__backdrop">
      <div className="dialog__content space-list__invite-dialog">
        <Stack gap="md" className="confirm-dialog__content">
          <div className="confirm-dialog__icon-wrapper">
            <Trash2 className="confirm-dialog__icon" />
          </div>
          <Heading level={3}>Remove User</Heading>
          <Caption muted>Are you sure you want to remove <strong>{userName}</strong> from the space? This action cannot be undone.</Caption>
          <Stack row gap="sm">
            <Button onClick={onClose} variant="ghost" className="confirm-dialog__action-btn">Cancel</Button>
            <Button onClick={onConfirm} variant="destructive" className="confirm-dialog__action-btn">Remove</Button>
          </Stack>
        </Stack>
      </div>
    </div>
  )
}

function getRoleIcon(role: SpaceUserRole) {
  switch (role) {
    case 'admin': return <Crown className="user-detail__icon-sm" />
    case 'editor': return <Edit3 className="user-detail__icon-sm" />
    case 'viewer': return <Eye className="user-detail__icon-sm" />
  }
}

function getRoleBadgeClass(role: SpaceUserRole) {
  switch (role) {
    case 'admin': return 'user-detail__role-badge--admin'
    case 'editor': return 'user-detail__role-badge--editor'
    case 'viewer': return 'user-detail__role-badge--viewer'
  }
}

export function UserDetailPanel({ user, roles, onUpdateRole, onRemoveUser, onCancel }: UserDetailPanelProps) {
  const [isEditing, , setIsEditing] = useToggle('user-detail-panel.is-editing', false)
  const [selectedRole, setSelectedRole] = useUIState<SpaceUserRole | null>('user-detail-panel.selected-role', null)
  const [showConfirm, , setShowConfirm] = useToggle('user-detail-panel.show-confirm', false)

  if (!user) {
    return (
      <Panel className="user-detail__empty">
        <div className="user-detail__empty-inner">
          <Avatar size="lg" className="user-detail__empty-avatar">
            <AvatarFallback><UserIcon className="user-detail__empty-icon" /></AvatarFallback>
          </Avatar>
          <Heading level={3}>No User Selected</Heading>
          <Caption muted className="user-detail__empty-caption">Select a user from the sidebar to view and edit their profile and permissions</Caption>
        </div>
      </Panel>
    )
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not yet joined'
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
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
    if (selectedRole && selectedRole !== user.role && onUpdateRole) onUpdateRole(user.id, selectedRole)
    setIsEditing(false)
    setSelectedRole(null)
  }

  const handleCancelEdit = () => { setIsEditing(false); setSelectedRole(null); onCancel?.() }
  const handleRemove = () => { if (onRemoveUser) { onRemoveUser(user.id); setShowConfirm(false) } }

  return (
    <>
      <Panel className="user-detail__panel">
        <PanelHeader>
          <Stack row gap="md" className="user-detail__header-row">
            <div className="user-detail__avatar-col">
              <Avatar size="lg">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                <AvatarFallback className="user-detail__avatar-fallback">
                  {user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="user-detail__header-info">
              <Heading level={2} className="user-detail__name">{user.name}</Heading>
              {!isEditing && (
                <Badge className={`${getRoleBadgeClass(user.role)} user-detail__role-badge`}>
                  {getRoleIcon(user.role)}
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </Badge>
              )}
            </div>
          </Stack>
        </PanelHeader>

        <PanelBody className="user-detail__body">
          <div className="user-detail__info-grid">
            <CardBody>
              <Stack row gap="sm" className="user-detail__info-card-row">
                <Mail className="user-detail__info-icon" />
                <div><Caption muted>Email</Caption><Label>{user.email}</Label></div>
              </Stack>
            </CardBody>
            <CardBody>
              <Stack row gap="sm" className="user-detail__info-card-row">
                <Calendar className="user-detail__info-icon" />
                <div><Caption muted>Joined</Caption><Label>{formatDate(user.joinedAt)}</Label></div>
              </Stack>
            </CardBody>
            <CardBody>
              <Stack row gap="sm" className="user-detail__info-card-row">
                <Clock className="user-detail__info-icon" />
                <div><Caption muted>Last Active</Caption><Label>{formatLastActive(user.lastActive)}</Label></div>
              </Stack>
            </CardBody>
          </div>

          <div className="user-detail__section">
            <Heading level={4} className="user-detail__permissions-heading">
              <Shield className="user-detail__icon-sm" /> Permissions & Role
            </Heading>
            {isEditing ? (
              <Stack gap="sm">
                {roles.map((role) => {
                  const Icon = role.value === 'admin' ? Crown : role.value === 'editor' ? Edit3 : Eye
                  const isSelected = selectedRole === role.value
                  return (
                    <button key={role.value} onClick={() => setSelectedRole(role.value as SpaceUserRole)} className="user-detail__role-btn">
                      <ListItem selected={isSelected}>
                        <Icon className="user-detail__role-icon" />
                        <div className="user-detail__role-info"><Label>{role.label}</Label><Caption muted>{role.description}</Caption></div>
                        {isSelected && (
                          <div className="user-detail__role-check">
                            <Check className="user-detail__role-check-icon" />
                          </div>
                        )}
                      </ListItem>
                    </button>
                  )
                })}
              </Stack>
            ) : (
              <CardBody>
                <Stack row gap="sm" className="user-detail__info-card-row">
                  {getRoleIcon(user.role)}
                  <div>
                    <Label>{roles.find(r => r.value === user.role)?.label || user.role}</Label>
                    <Caption muted>{roles.find(r => r.value === user.role)?.description}</Caption>
                  </div>
                </Stack>
              </CardBody>
            )}
          </div>

          <div>
            <Heading level={4} className="user-detail__status-heading">Account Status</Heading>
            <Badge variant={user.status === 'active' ? 'success' : user.status === 'invited' ? 'primary' : 'muted'}>
              {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
            </Badge>
          </div>
        </PanelBody>

        <CardFooter>
          <Stack row gap="sm">
            {isEditing ? (
              <>
                <Button onClick={handleSaveRole} variant="primary"><Check className="user-detail__icon-sm" /> Save Changes</Button>
                <Button onClick={handleCancelEdit} variant="ghost"><X className="user-detail__icon-sm" /> Cancel</Button>
              </>
            ) : (
              <>
                <Button onClick={() => { setIsEditing(true); setSelectedRole(user.role) }} variant="primary"><Shield className="user-detail__icon-sm" /> Edit Role</Button>
                <Button onClick={() => setShowConfirm(true)} variant="destructive"><Trash2 className="user-detail__icon-sm" /> Remove</Button>
              </>
            )}
          </Stack>
        </CardFooter>
      </Panel>

      {onRemoveUser && <ConfirmDialog isOpen={showConfirm} userName={user.name} onConfirm={handleRemove} onClose={() => setShowConfirm(false)} />}
    </>
  )
}
