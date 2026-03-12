/**
 * StudioLayout - Main studio route layout with sidebar and content area.
 * Uses new composite hooks from Phase 3 and element components.
 */
import { useEffect } from 'react'
import { useParams, useLocation, useNavigate } from '@tanstack/react-router'
import { StudioShell } from '@/components/shell/studio-shell'
import { useAssistantList } from '@/hooks/useAssistantList'
import { useWorkflowList } from '@/hooks/useWorkflowList'
import { useToggle, useUIState } from '@lmthing/state'
import { buildSpacePathFromParams } from '@/lib/space-url'

type StudioState = {
  sidebarCollapsed: boolean
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
  const [state, setState] = useUIState<StudioState>('studio-layout.state', { sidebarCollapsed: false })
  const [showCreateFieldForm, , setShowCreateFieldForm] = useToggle('studio-layout.show-create-field-form', false)
  const [showCreateAssistantForm, , setShowCreateAssistantForm] = useToggle('studio-layout.show-create-assistant-form', false)

  const assistantList = useAssistantList()
  const workflowList = useWorkflowList()

  useEffect(() => {
    if (pathname.endsWith('/settings')) {
      navigate({ to: `${spacePath}/settings/env`, replace: true })
    }
  }, [pathname, navigate, spacePath])

  return (
    <StudioShell
      defaultSidebarCollapsed={state.sidebarCollapsed}
      onSidebarCollapsedChange={(collapsed) =>
        setState(prev =>
          prev.sidebarCollapsed === collapsed ? prev : { ...prev, sidebarCollapsed: collapsed }
        )
      }
      onOpenSettings={() => navigate({ to: `${spacePath}/settings/env` })}
      onCreateField={() => setShowCreateFieldForm(true)}
      onCreateAssistant={() => setShowCreateAssistantForm(true)}
    >
      {children}
    </StudioShell>
  )
}

export { StudioLayout as default }
