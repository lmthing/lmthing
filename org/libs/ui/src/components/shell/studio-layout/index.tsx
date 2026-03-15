/**
 * StudioLayout - Main studio route layout with sidebar and content area.
 * Uses new composite hooks from Phase 3 and element components.
 */
import { useCallback, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from '@tanstack/react-router'
import { StudioShell } from '@lmthing/ui/components/shell/studio-shell'
import { useAgentList } from '@lmthing/ui/hooks/useAgentList'
import { useWorkflowList } from '@lmthing/ui/hooks/useWorkflowList'
import { useUIState, useSpaceFS } from '@lmthing/state'
import { buildSpacePathFromParams } from '@/lib/space-url'

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

function useSpacePath(): string {
  const { username, studioId, storageId, spaceId } = useParams({ strict: false }) as { username?: string; studioId?: string; storageId?: string; spaceId?: string }
  if (username && studioId && storageId && spaceId) {
    return buildSpacePathFromParams(username, studioId, storageId, spaceId)
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
  const workflowList = useWorkflowList()

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
    spaceFS.writeFile(`agents/${slug}/instruct.md`, `---\nname: ${name}\ndescription: ""\ntools: []\nenabledKnowledgeFields: []\n---\n`)
    spaceFS.writeFile(`agents/${slug}/config.json`, JSON.stringify({ runtimeFields: {} }, null, 2))
    spaceFS.writeFile(`agents/${slug}/values.json`, '{}')
    navigate({ to: `${spacePath}/agent/${slug}` })
  }, [spaceFS, navigate, spacePath])

  const handleCreateField = useCallback(() => {
    if (!spaceFS) return
    const name = window.prompt('Knowledge domain name:')
    if (!name) return
    const slug = toSlug(name)
    spaceFS.writeFile(`knowledge/${slug}/config.json`, JSON.stringify({
      title: name,
      description: '',
      renderAs: 'section',
      icon: '',
      color: '#6366f1',
    }, null, 2))
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
