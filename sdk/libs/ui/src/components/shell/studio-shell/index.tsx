/**
 * StudioShell - Primary shell component managing space views and panels.
 * Uses composite hooks and element CSS classes.
 * Orchestrates the sidebar, content area, and settings/knowledge views.
 */
import { useCallback, useMemo } from 'react'
import { useToggle } from '@lmthing/state'
import { useParams, useLocation, useNavigate } from '@tanstack/react-router'
import { buildSpacePath } from '@lmthing/ui/lib/space-path'
import '@lmthing/css/elements/layouts/split-pane/index.css'
import '@lmthing/css/elements/layouts/page/index.css'
import '@lmthing/css/components/shell/studio-shell/index.css'
import { StudioSidebar } from '@lmthing/ui/components/shell/studio-sidebar'
import { SettingsView } from '@lmthing/ui/components/shell/settings-view'
import { useAgentList } from '@lmthing/ui/hooks/useAgentList'
import { useKnowledgeFields } from '@lmthing/ui/hooks/useKnowledgeFields'
import { useWorkflowList } from '@lmthing/ui/hooks/useWorkflowList'

export interface StudioShellProps {
  defaultSidebarCollapsed?: boolean
  onSidebarCollapsedChange?: (collapsed: boolean) => void
  onOpenSettings?: () => void
  onCreateField?: () => void
  onEditField?: (id: string) => void
  onDeleteField?: (id: string) => void
  onCreateAgent?: () => void
  onEditAgent?: (id: string) => void
  onDeleteAgent?: (id: string) => void
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
  /** Optional THING chat panel, docked on the right when toggled on. Built by
   *  the app (it needs auth + compute origin); the shell only shows/hides it. */
  rightPanel?: React.ReactNode
}

function useSpacePath(): string {
  const { projectId, spaceId } = useParams({ strict: false }) as { projectId?: string; spaceId?: string }
  if (projectId && spaceId) {
    return buildSpacePath(projectId, spaceId)
  }
  return '/'
}

export function StudioShell({
  defaultSidebarCollapsed = false,
  onSidebarCollapsedChange,
  onOpenSettings,
  onCreateField,
  onCreateAgent,
  children,
  rightPanel,
}: StudioShellProps) {
  const { agentId } = useParams({ strict: false }) as { agentId?: string }
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const spacePath = useSpacePath()
  const [sidebarCollapsed, , setSidebarCollapsed] = useToggle('studio-shell.sidebar.collapsed', defaultSidebarCollapsed)
  // THING chat dock — persisted, always-on while enabled (does not navigate).
  const [thingOpen, toggleThingOpen] = useToggle('studio-shell.thing.open', false)

  const agentList = useAgentList()
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
    <div className="split-pane studio-shell">
      <StudioSidebar
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        activeFieldId={activeFieldId}
        activeAgentId={agentId as string}
        onOpenSettings={onOpenSettings || (() => navigate({ to: `${spacePath}/settings/env` }))}
        onCreateField={onCreateField}
        onCreateAgent={onCreateAgent}
        thingOpen={thingOpen}
        onToggleThing={rightPanel ? toggleThingOpen : undefined}
      />

      <div className="split-pane__primary">
        {isSettingsOpen ? (
          <SettingsView isOpen={true} />
        ) : (
          children || (
            <div className="page__body studio-shell__empty">
              <div className="studio-shell__empty-content">
                <p className="studio-shell__empty-title">
                  Select a knowledge field or agent
                </p>
                <p className="studio-shell__empty-subtitle">
                  {knowledgeFields.length} knowledge fields, {agentList.length} agents, {workflowList.length} tasklists
                </p>
              </div>
            </div>
          )
        )}
      </div>

      {rightPanel && thingOpen && (
        <div
          className="studio-shell__thing-dock"
          style={{
            width: 400,
            flex: '0 0 400px',
            height: '100%',
            borderLeft: '1px solid var(--border, #e5e7eb)',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          {rightPanel}
        </div>
      )}
    </div>
  )
}
