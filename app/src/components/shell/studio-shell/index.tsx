/**
 * StudioShell - Primary shell component managing workspace views and panels.
 * Uses new composite hooks and element CSS classes.
 * Orchestrates the sidebar, content area, and settings/knowledge views.
 */
import { useState, useCallback, useMemo } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
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
  onCreateDomain?: () => void
  onEditDomain?: (id: string) => void
  onDeleteDomain?: (id: string) => void
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
}

export function StudioShell({
  defaultSidebarCollapsed = false,
  onSidebarCollapsedChange,
  onOpenSettings,
  onCreateDomain,
  onCreateAgent,
  children,
}: StudioShellProps) {
  const { agentId, workspaceName } = useParams()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(defaultSidebarCollapsed)

  const assistantList = useAssistantList()
  const knowledgeFields = useKnowledgeFields()
  const workflowList = useWorkflowList()

  const handleToggleSidebar = useCallback(() => {
    const next = !sidebarCollapsed
    setSidebarCollapsed(next)
    onSidebarCollapsedChange?.(next)
  }, [sidebarCollapsed, onSidebarCollapsedChange])

  const activeDomainId = useMemo(() => {
    const match = pathname.match(/\/knowledge\/([^/]+)/)
    return match ? match[1] : undefined
  }, [pathname])

  const isSettingsOpen = pathname.includes('/settings')

  const studioPath = workspaceName
    ? `/studio/${encodeURIComponent(workspaceName as string)}`
    : '/studio'

  return (
    <div className="split-pane" style={{ height: '100vh' }}>
      <StudioSidebar
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        activeDomainId={activeDomainId}
        activeAgentId={agentId as string}
        onOpenSettings={onOpenSettings || (() => router.push(`${studioPath}/settings/env`))}
        onCreateDomain={onCreateDomain}
        onCreateAgent={onCreateAgent}
      />

      <div className="split-pane__primary">
        {isSettingsOpen ? (
          <SettingsView isOpen={true} />
        ) : (
          children || (
            <div className="page__body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', opacity: 0.5 }}>
                <p style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Select a knowledge area or assistant
                </p>
                <p style={{ fontSize: '0.875rem' }}>
                  {knowledgeFields.length} knowledge areas, {assistantList.length} assistants, {workflowList.length} workflows
                </p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}
