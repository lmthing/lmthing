/**
 * User roles within a workspace with escalating permissions
 */
export type WorkspaceUserRole = 'admin' | 'editor' | 'viewer'

/**
 * Current status of a user in the workspace
 */
export type WorkspaceUserStatus = 'active' | 'invited' | 'pending'

/**
 * A user who is a member of the workspace
 */
export interface WorkspaceUser {
  /** Unique identifier for the user */
  id: string
  /** Full display name */
  name: string
  /** Email address for login and notifications */
  email: string
  /** URL to user's profile avatar image */
  avatarUrl?: string
  /** Assigned role determining permissions */
  role: WorkspaceUserRole
  /** Current status in the workspace */
  status: WorkspaceUserStatus
  /** ISO timestamp when user joined (null if not yet joined) */
  joinedAt: string | null
  /** ISO timestamp of last activity (null if never active) */
  lastActive: string | null
}

/**
 * Role definition for display and selection
 */
export interface RoleDefinition {
  /** Value to store as the user's role */
  value: WorkspaceUserRole
  /** Human-readable label for UI display */
  label: string
  /** Description of what this role can do */
  description: string
}

/**
 * Props for the Workspaces section
 */
export interface WorkspacesProps {
  /** All users in the current workspace */
  users: WorkspaceUser[]
  /** Available role definitions */
  roles: RoleDefinition[]
  /** Currently selected user ID for detail view */
  selectedUserId?: string | null
  /** Current search/filter query */
  searchQuery?: string

  /** Callback when a user is selected from the sidebar */
  onSelectUser?: (userId: string) => void
  /** Callback when search query changes */
  onSearchChange?: (query: string) => void
  /** Callback when a user's role is changed */
  onUpdateRole?: (userId: string, role: WorkspaceUserRole) => void
  /** Callback when inviting a new user */
  onInviteUser?: (email: string, role: WorkspaceUserRole) => void
  /** Callback when removing a user from workspace */
  onRemoveUser?: (userId: string) => void
  /** Callback when canceling edits */
  onCancel?: () => void
}
