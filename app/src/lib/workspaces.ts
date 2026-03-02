export const DEFAULT_WORKSPACE_SLUG = 'lmthing-agents'

export interface WorkspaceRepoRef {
  owner: string
  repo: string
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function fromWorkspaceRouteParam(value: string): string {
  return safeDecodeURIComponent(value)
}

export function toWorkspaceRouteParam(value: string): string {
  return encodeURIComponent(safeDecodeURIComponent(value))
}

export function toWorkspaceSlug(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '-').replace(/^-+|-+$/g, '')
}

export type WorkspaceName = string

export function toWorkspaceName(owner: string, repo: string): WorkspaceName {
  return `${owner}/${repo}`
}

export function parseWorkspaceRepoRef(
  workspaceName?: string,
  fallbackOwner?: string
): WorkspaceRepoRef | null {
  if (!workspaceName) return null

  const normalizedWorkspaceName = safeDecodeURIComponent(workspaceName)

  if (normalizedWorkspaceName.includes('%')) {
    const [owner, ...repoParts] = normalizedWorkspaceName.split('%')
    const repo = repoParts.join('%')
    if (owner && repo) {
      return { owner, repo }
    }
  }

  if (normalizedWorkspaceName.includes('/')) {
    const [owner, ...repoParts] = normalizedWorkspaceName.split('/')
    const repo = repoParts.join('/')
    if (owner && repo) {
      return { owner, repo }
    }
  }

  if (fallbackOwner) {
    return {
      owner: fallbackOwner,
      repo: normalizedWorkspaceName,
    }
  }

  return null
}

export function getNormalizedWorkspace(workspaceName?: string): string {
  if (!workspaceName) {
    return DEFAULT_WORKSPACE_SLUG
  }
  return fromWorkspaceRouteParam(workspaceName)
}
