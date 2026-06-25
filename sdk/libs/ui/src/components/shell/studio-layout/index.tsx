/**
 * StudioLayout - Main studio route layout with sidebar and content area.
 * Uses new composite hooks from Phase 3 and element components.
 */
import { useCallback, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from '@tanstack/react-router'
import { StudioShell } from '@lmthing/ui/components/shell/studio-shell'
import { useAgentList } from '@lmthing/ui/hooks/useAgentList'
import { useTasklistList } from '@lmthing/ui/hooks/useWorkflowList'
import { useUIState, useSpaceFS } from '@lmthing/state'
import { serializeAgentInstruct } from '@lmthing/state'
import { buildSpacePath } from '@lmthing/ui/lib/space-path'

type StudioState = {
  sidebarCollapsed: boolean
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `item-${Date.now()}`
}

function toCamelCase(slug: string): string {
  return slug.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}

function useSpacePath(): string {
  const { projectId, spaceId } = useParams({ strict: false }) as { projectId?: string; spaceId?: string }
  if (projectId && spaceId) {
    return buildSpacePath(projectId, spaceId)
  }
  return '/'
}

export function StudioLayout({ children }: { children?: React.ReactNode }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const spacePath = useSpacePath()
  const spaceFS = useSpaceFS()
  const [state, setState] = useUIState<StudioState>('studio-layout.state', { sidebarCollapsed: false })

  const agentList = useAgentList()
  const tasklistList = useTasklistList()

  useEffect(() => {
    if (pathname.endsWith('/settings')) {
      navigate({ to: `${spacePath}/settings/env`, replace: true })
    }
  }, [pathname, navigate, spacePath])

  const handleCreateAgent = useCallback(() => {
    if (!spaceFS) return
    const name = window.prompt('Agent name:')
    if (!name) return
    const slug = `agent-${toSlug(name)}`
    const content = serializeAgentInstruct({
      title: name,
      knowledge: [],
      functions: [],
      components: [],
      actions: [],
      canDelegateTo: [],
      body: '',
    })
    spaceFS.writeFile(`agents/${slug}/instruct.md`, content)
    navigate({ to: `${spacePath}/agent/${slug}` })
  }, [spaceFS, navigate, spacePath])

  const handleCreateField = useCallback(() => {
    if (!spaceFS) return
    const name = window.prompt('Knowledge domain name:')
    if (!name) return
    const slug = toSlug(name)
    const variable = toCamelCase(slug)
    // Creates a default domain+field at knowledge/<slug>/<slug>/index.md
    spaceFS.writeFile(
      `knowledge/${slug}/${slug}/index.md`,
      `---\ntype: string\nvariable: ${variable}\n---\n\n${name} field.`,
    )
    navigate({ to: `${spacePath}/knowledge/${slug}` })
  }, [spaceFS, navigate, spacePath])

  return (
    <StudioShell
      defaultSidebarCollapsed={state.sidebarCollapsed}
      onSidebarCollapsedChange={(collapsed) =>
        setState(prev =>
          prev.sidebarCollapsed === collapsed ? prev : { ...prev, sidebarCollapsed: collapsed }
        )
      }
      onOpenSettings={() => navigate({ to: `${spacePath}/settings/env` })}
      onCreateField={handleCreateField}
      onCreateAgent={handleCreateAgent}
    >
      {children}
    </StudioShell>
  )
}

export { StudioLayout as default }
