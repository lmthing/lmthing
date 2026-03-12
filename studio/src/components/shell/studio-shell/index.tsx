/**
 * StudioShell - Primary shell component managing space views and panels.
 * Uses new composite hooks and element CSS classes.
 * Orchestrates the sidebar, content area, and settings/knowledge views.
 */
import { useCallback, useMemo } from 'react'
import { useToggle } from '../../../../../org/state/src'
import { useParams, useLocation, useNavigate } from '@tanstack/react-router'
import { buildSpacePathFromParams } from '@/lib/space-url'
import '@/css/elements/layouts/split-pane/index.css'
import '@/css/elements/layouts/page/index.css'
import { StudioSidebar } from '@/components/shell/studio-sidebar'
import { SettingsView } from '@/components/shell/settings-view'
import { useAssistantList } from '@/hooks/useAssistantList'
import { useKnowledgeFields } from '@/hooks/useKnowledgeFields'
import { useWorkflowList } from '@/hooks/useWorkflowList'

export interface StudioShellProps {
  defaultSidebarCollapsed?: boolean
  onSidebarCollapsedChange?: (collapsed: boolean) => void
  onOpenSettings?: () => void
  onCreateField?: () => void
  onEditField?: (id: string) => void
  onDeleteField?: (id: string) => void
  onCreateAssistant?: () => void
  onEditAssistant?: (id: string) => void
  onDeleteAssistant?: (id: string) => void
  onSelectFile?: (file: unknown) => void
  onToggleFolder?: (path: string) => void
  onExpandAll?: () => void
  onCollapseAll?: () => void
  onEditContent?: (content: string) => void
  onSave?: () => void
  onCreateFile?: (form: unknown) => void
  onCreateFolder?: (form: unknown) => void
  onRename?: (nodeId: string, newName: string) => void
  onMove?: (nodeId: string, newParentPath: string) => void
  onDelete?: (nodeId: string) => void
  onDuplicate?: (nodeId: string) => void
  user?: { name: string }
  children?: React.ReactNode
}

function useSpacePath(): string {
  const { username, studioId, storageId, spaceId } = useParams({ strict: false }) as { username?: string; studioId?: string; storageId?: string; spaceId?: string }
  if (username && studioId && storageId && spaceId) {
    return buildSpacePathFromParams(username, studioId, storageId, spaceId)
  }
  return '/'
}

export function StudioShell({
  defaultSidebarCollapsed = false,
  onSidebarCollapsedChange,
  onOpenSettings,
  onCreateField,
  onCreateAssistant,
  children,
}: StudioShellProps) {
  const { assistantId } = useParams({ strict: false }) as { assistantId?: string }
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const spacePath = useSpacePath()
  const [sidebarCollapsed, , setSidebarCollapsed] = useToggle('studio-shell.sidebar.collapsed', defaultSidebarCollapsed)

  const assistantList = useAssistantList()
  const knowledgeFields = useKnowledgeFields()
  const workflowList = useWorkflowList()

  const handleToggleSidebar = useCallback(() => {
    const next = !sidebarCollapsed
    setSidebarCollapsed(next)
    onSidebarCollapsedChange?.(next)
  }, [sidebarCollapsed, onSidebarCollapsedChange])

  const activeFieldId = useMemo(() => {
    const match = pathname.match(/\/knowledge\/([^/]+)/)
    return match ? match[1] : undefined
  }, [pathname])

  const isSettingsOpen = pathname.includes('/settings')

  return (
    <div className="split-pane" style={{ height: '100vh' }}>
      <StudioSidebar
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        activeFieldId={activeFieldId}
        activeAssistantId={assistantId as string}
        onOpenSettings={onOpenSettings || (() => navigate({ to: `${spacePath}/settings/env` }))}
        onCreateField={onCreateField}
        onCreateAssistant={onCreateAssistant}
      />

      <div className="split-pane__primary">
        {isSettingsOpen ? (
          <SettingsView isOpen={true} />
        ) : (
          children || (
            <div className="page__body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', opacity: 0.5 }}>
                <p style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Select a knowledge field or assistant
                </p>
                <p style={{ fontSize: '0.875rem' }}>
                  {knowledgeFields.length} knowledge fields, {assistantList.length} assistants, {workflowList.length} workflows
                </p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}
