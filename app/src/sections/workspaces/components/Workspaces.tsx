import type { WorkspacesProps, WorkspaceUser } from '@/../product/sections/workspaces/types'
import { WorkspaceList } from './WorkspaceList'
import { UserDetailPanel } from './UserDetailPanel'

/**
 * Workspaces component - User and permission management interface
 *
 * A two-panel layout for managing workspace members with role-based access control.
 * Left sidebar shows searchable user list; right panel displays user details and allows role editing.
 */
export function Workspaces({
  users,
  roles,
  selectedUserId,
  searchQuery = '',
  onSelectUser,
  onSearchChange,
  onUpdateRole,
  onInviteUser,
  onRemoveUser,
  onCancel
}: WorkspacesProps) {
  const selectedUser = users.find(u => u.id === selectedUserId) || null

  return (
    <div className="h-full flex overflow-hidden">
      {/* Sidebar - User List */}
      <div className="w-full sm:w-80 flex-shrink-0 h-full overflow-hidden">
        <WorkspaceList
          users={users}
          selectedUserId={selectedUserId}
          searchQuery={searchQuery}
          onSelectUser={onSelectUser}
          onSearchChange={onSearchChange}
          onInviteUser={onInviteUser}
        />
      </div>

      {/* Main Content - User Detail */}
      <div className="hidden sm:block flex-1 h-full overflow-hidden">
        <UserDetailPanel
          user={selectedUser}
          roles={roles}
          onUpdateRole={onUpdateRole}
          onRemoveUser={onRemoveUser}
          onCancel={onCancel}
        />
      </div>
    </div>
  )
}
