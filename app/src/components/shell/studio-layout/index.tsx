/**
 * StudioLayout - Main studio route layout with sidebar and content area.
 * Uses new composite hooks from Phase 3 and element components.
 */
import { useEffect, useState } from 'react'
import { useParams, useLocation, useNavigate } from '@tanstack/react-router'
import { StudioShell } from '@/components/shell/studio-shell'
import { useAssistantList } from '@/hooks/useAssistantList'
import { useWorkflowList } from '@/hooks/useWorkflowList'
import { buildSpacePathFromParams } from '@/lib/space-url'

type StudioState = {
  sidebarCollapsed: boolean
}

const STORAGE_KEY = 'studio-layout-state'

const DEFAULT_STATE: StudioState = {
  sidebarCollapsed: false,
}

function loadState(): StudioState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...DEFAULT_STATE, ...JSON.parse(stored) }
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_STATE
}

function saveState(state: StudioState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage errors
  }
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
  const [state, setState] = useState<StudioState>(loadState)
  const [showCreateFieldForm, setShowCreateFieldForm] = useState(false)
  const [showCreateAssistantForm, setShowCreateAssistantForm] = useState(false)

  const assistantList = useAssistantList()
  const workflowList = useWorkflowList()

  useEffect(() => {
    if (pathname.endsWith('/settings')) {
      navigate({ to: `${spacePath}/settings/env`, replace: true })
    }
  }, [pathname, navigate, spacePath])

  useEffect(() => {
    saveState(state)
  }, [state])

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
