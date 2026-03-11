import { Mail, Calendar, Clock, Shield, Check, X, Trash2, User as UserIcon, Crown, Edit3, Eye } from 'lucide-react'
import { useUIState, useToggle } from '@lmthing/state'
import type { SpaceUser, SpaceUserRole, RoleDefinition } from '../space-list'
import { Button } from '@/elements/forms/button'
import { Stack } from '@/elements/layouts/stack'
import { Panel, PanelHeader, PanelBody } from '@/elements/content/panel'
import { CardBody, CardFooter } from '@/elements/content/card'
import { ListItem } from '@/elements/content/list-item'
import { Badge } from '@/elements/content/badge'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'
import { Label } from '@/elements/typography/label'
import { Avatar, AvatarImage, AvatarFallback } from '@/elements/content/avatar'

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
      <div className="dialog__content" style={{ maxWidth: '24rem' }}>
        <Stack gap="md" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ width: '3rem', height: '3rem', borderRadius: '9999px', background: 'var(--color-destructive-bg, #fef2f2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
            <Trash2 className="w-6 h-6" style={{ color: 'var(--color-destructive, #dc2626)' }} />
          </div>
          <Heading level={3}>Remove User</Heading>
          <Caption muted>Are you sure you want to remove <strong>{userName}</strong> from the space? This action cannot be undone.</Caption>
          <Stack row gap="sm">
            <Button onClick={onClose} variant="ghost" style={{ flex: 1 }}>Cancel</Button>
            <Button onClick={onConfirm} variant="destructive" style={{ flex: 1 }}>Remove</Button>
          </Stack>
        </Stack>
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
    case 'admin': return 'bg-gradient-to-r from-brand-3 to-brand-3 text-primary-foreground shadow-lg shadow-brand-3/25'
    case 'editor': return 'bg-gradient-to-r from-brand-2 to-brand-2 text-primary-foreground shadow-lg shadow-brand-2/25'
    case 'viewer': return 'bg-muted text-muted-foreground border border-border'
  }
}

export function UserDetailPanel({ user, roles, onUpdateRole, onRemoveUser, onCancel }: UserDetailPanelProps) {
  const [isEditing, , setIsEditing] = useToggle('user-detail-panel.is-editing', false)
  const [selectedRole, setSelectedRole] = useUIState<SpaceUserRole | null>('user-detail-panel.selected-role', null)
  const [showConfirm, , setShowConfirm] = useToggle('user-detail-panel.show-confirm', false)

  if (!user) {
    return (
      <Panel style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <Avatar size="lg" style={{ margin: '0 auto 1rem', background: 'var(--color-muted-bg)' }}>
            <AvatarFallback><UserIcon className="w-7 h-7" style={{ opacity: 0.5 }} /></AvatarFallback>
          </Avatar>
          <Heading level={3}>No User Selected</Heading>
          <Caption muted style={{ maxWidth: '20rem' }}>Select a user from the sidebar to view and edit their profile and permissions</Caption>
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
      <Panel style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <PanelHeader>
          <Stack row gap="md" style={{ alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0 }}>
              <Avatar size="lg">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                <AvatarFallback style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', fontWeight: 700, fontSize: '1.5rem' }}>
                  {user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Heading level={2} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</Heading>
              {!isEditing && (
                <Badge className={getRoleBadgeClass(user.role)} style={{ marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.75rem' }}>
                  {getRoleIcon(user.role)}
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </Badge>
              )}
            </div>
          </Stack>
        </PanelHeader>

        <PanelBody style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <CardBody>
              <Stack row gap="sm" style={{ alignItems: 'center' }}>
                <Mail className="w-4 h-4" style={{ opacity: 0.6 }} />
                <div><Caption muted>Email</Caption><Label>{user.email}</Label></div>
              </Stack>
            </CardBody>
            <CardBody>
              <Stack row gap="sm" style={{ alignItems: 'center' }}>
                <Calendar className="w-4 h-4" style={{ opacity: 0.6 }} />
                <div><Caption muted>Joined</Caption><Label>{formatDate(user.joinedAt)}</Label></div>
              </Stack>
            </CardBody>
            <CardBody>
              <Stack row gap="sm" style={{ alignItems: 'center' }}>
                <Clock className="w-4 h-4" style={{ opacity: 0.6 }} />
                <div><Caption muted>Last Active</Caption><Label>{formatLastActive(user.lastActive)}</Label></div>
              </Stack>
            </CardBody>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <Heading level={4} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Shield className="w-4 h-4" /> Permissions & Role
            </Heading>
            {isEditing ? (
              <Stack gap="sm">
                {roles.map((role) => {
                  const Icon = role.value === 'admin' ? Crown : role.value === 'editor' ? Edit3 : Eye
                  const isSelected = selectedRole === role.value
                  return (
                    <button key={role.value} onClick={() => setSelectedRole(role.value as SpaceUserRole)} style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}>
                      <ListItem selected={isSelected}>
                        <Icon className="w-5 h-5" style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1 }}><Label>{role.label}</Label><Caption muted>{role.description}</Caption></div>
                        {isSelected && (
                          <div style={{ width: '1.5rem', height: '1.5rem', borderRadius: '9999px', background: '#7c3aed', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Check className="w-4 h-4" />
                          </div>
                        )}
                      </ListItem>
                    </button>
                  )
                })}
              </Stack>
            ) : (
              <CardBody>
                <Stack row gap="sm" style={{ alignItems: 'center' }}>
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
            <Heading level={4} style={{ marginBottom: '1rem' }}>Account Status</Heading>
            <Badge variant={user.status === 'active' ? 'success' : user.status === 'invited' ? 'primary' : 'muted'}>
              {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
            </Badge>
          </div>
        </PanelBody>

        <CardFooter>
          <Stack row gap="sm">
            {isEditing ? (
              <>
                <Button onClick={handleSaveRole} variant="primary"><Check className="w-4 h-4" /> Save Changes</Button>
                <Button onClick={handleCancelEdit} variant="ghost"><X className="w-4 h-4" /> Cancel</Button>
              </>
            ) : (
              <>
                <Button onClick={() => { setIsEditing(true); setSelectedRole(user.role) }} variant="primary"><Shield className="w-4 h-4" /> Edit Role</Button>
                <Button onClick={() => setShowConfirm(true)} variant="destructive"><Trash2 className="w-4 h-4" /> Remove</Button>
              </>
            )}
          </Stack>
        </CardFooter>
      </Panel>

      {onRemoveUser && <ConfirmDialog isOpen={showConfirm} userName={user.name} onConfirm={handleRemove} onClose={() => setShowConfirm(false)} />}
    </>
  )
}
