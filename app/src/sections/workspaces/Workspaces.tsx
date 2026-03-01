'use client'

import { useWorkspaceData } from '@/hooks/useWorkspaceData'
import { Workspaces } from './components/Workspaces'

type WorkspacesData = {
  workspaceUsers: WorkspaceUser[]
  roles: RoleDefinition[]
}

export default function WorkspacesPreview() {
  const { data, loading, error } = useWorkspaceData<WorkspacesData>('workspaces')

  const handleSelectUser = (id: string) => {
    console.log('Selected user:', id)
  }

  const handleSearchChange = (query: string) => {
    console.log('Search:', query)
  }

  const handleUpdateRole = (userId: string, role: string) => {
    console.log('Update role:', userId, '->', role)
  }

  const handleInviteUser = (email: string, role: string) => {
    console.log('Invite user:', email, 'as', role)
  }

  const handleRemoveUser = (userId: string) => {
    console.log('Remove user:', userId)
  }

  const handleCancel = () => {
    console.log('Cancel edit')
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }
  if (error || !data?.workspaceUsers) {
    return <div className="flex items-center justify-center h-screen text-red-500">Error loading data</div>
  }

  return (
    <Workspaces
      users={data.workspaceUsers as WorkspaceUser[]}
      roles={data.roles as RoleDefinition[]}
      selectedUserId={(data.workspaceUsers as WorkspaceUser[])[0]?.id}
      searchQuery=""
      onSelectUser={handleSelectUser}
      onSearchChange={handleSearchChange}
      onUpdateRole={handleUpdateRole}
      onInviteUser={handleInviteUser}
      onRemoveUser={handleRemoveUser}
      onCancel={handleCancel}
    />
  )
}
