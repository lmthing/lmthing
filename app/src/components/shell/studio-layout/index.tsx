/**
 * StudioLayout - Main studio route layout with sidebar and content area.
 * Uses new composite hooks from Phase 3 and element components.
 */
import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { StudioShell } from '@/components/shell/studio-shell'
import { useAssistantList } from '@/hooks/useAssistantList'
import { useWorkflowList } from '@/hooks/useWorkflowList'

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

export function StudioLayout() {
  const { workspaceName } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [state, setState] = useState<StudioState>(loadState)
  const [showCreateDomainForm, setShowCreateDomainForm] = useState(false)
  const [showCreateAgentForm, setShowCreateAgentForm] = useState(false)

  // New composite hooks from Phase 3
  const assistantList = useAssistantList()
  const workflowList = useWorkflowList()

  const studioPath = workspaceName
    ? `/studio/${encodeURIComponent(workspaceName)}`
    : '/studio'

  // Redirect /settings to /settings/env by default
  useEffect(() => {
    if (location.pathname.endsWith('/settings')) {
      navigate(`${studioPath}/settings/env`, { replace: true })
    }
  }, [location.pathname, navigate, studioPath])

  // Persist state changes
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
      onOpenSettings={() => navigate(`${studioPath}/settings/env`)}
      onCreateDomain={() => setShowCreateDomainForm(true)}
      onCreateAgent={() => setShowCreateAgentForm(true)}
    />
  )
}

export { StudioLayout as default }
