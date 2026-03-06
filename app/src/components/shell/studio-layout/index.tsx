/**
 * StudioLayout - Main studio route layout with sidebar and content area.
 * Uses new composite hooks from Phase 3 and element components.
 */
import { useEffect, useState } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
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

function useSpacePath(): string {
  const { username, studioId, spaceId } = useParams<{ username: string; studioId: string; spaceId: string }>()
  if (username && studioId && spaceId) {
    return `/${encodeURIComponent(username)}/${encodeURIComponent(studioId)}/${encodeURIComponent(spaceId)}`
  }
  return '/'
}

export function StudioLayout({ children }: { children?: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const spacePath = useSpacePath()
  const [state, setState] = useState<StudioState>(loadState)
  const [showCreateFieldForm, setShowCreateFieldForm] = useState(false)
  const [showCreateAssistantForm, setShowCreateAssistantForm] = useState(false)

  const assistantList = useAssistantList()
  const workflowList = useWorkflowList()

  useEffect(() => {
    if (pathname.endsWith('/settings')) {
      router.replace(`${spacePath}/settings/env`)
    }
  }, [pathname, router, spacePath])

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
      onOpenSettings={() => router.push(`${spacePath}/settings/env`)}
      onCreateField={() => setShowCreateFieldForm(true)}
      onCreateAssistant={() => setShowCreateAssistantForm(true)}
    >
      {children}
    </StudioShell>
  )
}

export { StudioLayout as default }
