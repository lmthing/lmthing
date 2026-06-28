/**
 * StudioSidebar - Navigation sidebar for project/space sections.
 *
 * Uses composite hooks (useAgentList, useKnowledgeFields) and CSS element
 * classes. Renders knowledge fields, agents, raw files, settings, and a
 * collapse toggle.
 *
 * Removed under the pod-backed architecture: all GitHub connect/repo UI and
 * the `useGithub` dependency. Route params are now `$projectId`/`$spaceId`.
 */
import { useMemo } from 'react'
import { useToggle, useTasklistList } from '@lmthing/state'
import { Link, useLocation, useParams } from '@tanstack/react-router'
import {
  Plus,
  Settings,
  ChevronLeft,
  ChevronRight,
  Folder,
  Bot,
  ChevronDown,
  ChevronRight as ChevronRightSmall,
  FileCode,
  ListChecks,
} from 'lucide-react'
import '@lmthing/css/elements/nav/sidebar/index.css'
import '@lmthing/css/components/shell/index.css'
import { buildSpacePath } from '@lmthing/ui/lib/space-path'
import { useAgentList } from '@lmthing/ui/hooks/useAgentList'
import type { AgentListItem } from '@lmthing/ui/hooks/useAgentList'
import { useKnowledgeFields } from '@lmthing/ui/hooks/useKnowledgeFields'
import type { DomainMeta } from '@lmthing/ui/hooks/useKnowledgeFields'
import { useAgent } from '@lmthing/ui/hooks/useAgent'
import { CozyThingText } from '@lmthing/ui/elements/branding/cozy-text'

export interface StudioSidebarProps {
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  activeFieldId?: string
  activeAgentId?: string
  onOpenSettings?: () => void
  onCreateField?: () => void
  onCreateAgent?: () => void
  onExportZip?: () => void
  onExportGithub?: () => void
  isExporting?: boolean
  exportProgress?: { uploadedFiles?: number; totalFiles?: number }
  canExport?: boolean
}

function useSpacePath(): string {
  const { projectId, spaceId } = useParams({ strict: false }) as { projectId?: string; spaceId?: string }
  if (projectId && spaceId) {
    return buildSpacePath(projectId, spaceId)
  }
  return '/'
}

export function StudioSidebar({
  isCollapsed = false,
  onToggleCollapse,
  activeFieldId,
  activeAgentId,
  onOpenSettings,
  onCreateField,
  onCreateAgent,
}: StudioSidebarProps) {
  const { pathname } = useLocation()
  const { spaceId } = useParams({ strict: false }) as { spaceId?: string }
  const spacePath = useSpacePath()
  const [fieldsExpanded, toggleFieldsExpanded] = useToggle('sidebar.fields.expanded', true)
  const [agentsExpanded, toggleAgentsExpanded] = useToggle('sidebar.agents.expanded', true)
  const [tasklistsExpanded, toggleTasklistsExpanded] = useToggle('sidebar.tasklists.expanded', true)
  const [conversationsExpanded, toggleConversationsExpanded] = useToggle('sidebar.conversations.expanded', true)

  const agentList = useAgentList()
  const knowledgeFields = useKnowledgeFields()
  const activeAgent = useAgent(activeAgentId || '')
  const tasklistItems = useTasklistList()

  const agents = useMemo(() => {
    return agentList.map((item: AgentListItem) => ({
      id: item.id,
      name: item.id,
      path: item.path,
    }))
  }, [agentList])

  const fields = useMemo(() => {
    return knowledgeFields.map((field: DomainMeta) => ({
      id: field.id,
      label: field.id,
      path: field.path,
    }))
  }, [knowledgeFields])

  return (
    <aside className={`sidebar ${isCollapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="studio-sidebar__header">
        <div className="studio-sidebar__header-inner">
          <Link
            to="/"
            className="studio-sidebar__home-link"
            title="lmthing"
          >
            <CozyThingText text="lmthing" />
          </Link>
          {!isCollapsed && (
            <span className="studio-sidebar__space-name">
              {spaceId || 'Space'}
            </span>
          )}
        </div>
      </div>

      <div className="studio-sidebar__body">
        {!isCollapsed ? (
          <div className="studio-sidebar__sections">
            <section>
              <button
                onClick={toggleFieldsExpanded}
                className="sidebar__item studio-sidebar__section-header"
              >
                {fieldsExpanded ? <ChevronDown className="studio-sidebar__section-chevron" /> : <ChevronRightSmall className="studio-sidebar__section-chevron" />}
                Knowledge ({fields.length})
              </button>
              {fieldsExpanded && (
                <div className="studio-sidebar__section-items">
                  {fields.map(field => {
                    const href = `${spacePath}/knowledge/${field.id}`
                    const isActive = pathname === href || activeFieldId === field.id
                    return (
                      <Link key={field.id} to={href} className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}>
                        <Folder className="studio-sidebar__item-icon--knowledge" />
                        <span className="studio-sidebar__item-label">{field.label}</span>
                      </Link>
                    )
                  })}
                  <button onClick={onCreateField} className="sidebar__item studio-sidebar__create-btn">
                    <Plus className="studio-sidebar__create-icon" />
                    <span className="studio-sidebar__create-label">Create Field</span>
                  </button>
                </div>
              )}
            </section>

            <section>
              <button
                onClick={toggleAgentsExpanded}
                className="sidebar__item studio-sidebar__section-header"
              >
                {agentsExpanded ? <ChevronDown className="studio-sidebar__section-chevron" /> : <ChevronRightSmall className="studio-sidebar__section-chevron" />}
                Agents ({agents.length})
              </button>
              {agentsExpanded && (
                <div className="studio-sidebar__section-items">
                  {agents.map(agent => {
                    const href = `${spacePath}/agent/${agent.id}`
                    const isActive = pathname === href || activeAgentId === agent.id
                    return (
                      <Link key={agent.id} to={href} className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}>
                        <Bot className="studio-sidebar__item-icon--agent" />
                        <span className="studio-sidebar__item-label">{agent.name}</span>
                      </Link>
                    )
                  })}
                  <button onClick={onCreateAgent} className="sidebar__item studio-sidebar__create-btn">
                    <Plus className="studio-sidebar__create-icon" />
                    <span className="studio-sidebar__create-label">Create Agent</span>
                  </button>
                </div>
              )}
            </section>

            <section>
              <button
                onClick={toggleTasklistsExpanded}
                className="sidebar__item studio-sidebar__section-header"
              >
                {tasklistsExpanded ? <ChevronDown className="studio-sidebar__section-chevron" /> : <ChevronRightSmall className="studio-sidebar__section-chevron" />}
                Tasklists ({tasklistItems.length})
              </button>
              {tasklistsExpanded && (
                <div className="studio-sidebar__section-items">
                  {tasklistItems.map(item => {
                    const href = `${spacePath}/workflow/${item.name}`
                    const isActive = pathname.startsWith(href)
                    return (
                      <Link key={item.name} to={href} className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}>
                        <ListChecks className="studio-sidebar__item-icon--tasklist" />
                        <span className="studio-sidebar__item-label">{item.name}</span>
                      </Link>
                    )
                  })}
                  <button onClick={onCreateAgent} className="sidebar__item studio-sidebar__create-btn">
                    <Plus className="studio-sidebar__create-icon" />
                    <span className="studio-sidebar__create-label">Create Tasklist</span>
                  </button>
                </div>
              )}
            </section>

            {activeAgentId && (
              <section>
                <button
                  onClick={toggleConversationsExpanded}
                  className="sidebar__item studio-sidebar__section-header"
                >
                  {conversationsExpanded ? <ChevronDown className="studio-sidebar__section-chevron" /> : <ChevronRightSmall className="studio-sidebar__section-chevron" />}
                  Conversations (0)
                </button>
                {conversationsExpanded && (
                  <div className="sidebar__item studio-sidebar__conversations-empty">
                    No conversations yet.
                  </div>
                )}
              </section>
            )}
          </div>
        ) : (
          <div className="studio-sidebar__collapsed-icons">
            <div className="sidebar__item studio-sidebar__collapsed-icon" title={`${fields.length} knowledge fields`}>
              <Folder className="studio-sidebar__collapsed-icon-inner" />
            </div>
            <div className="sidebar__item studio-sidebar__collapsed-icon" title={`${agents.length} agents`}>
              <Bot className="studio-sidebar__collapsed-icon-inner" />
            </div>
          </div>
        )}
      </div>

      <div className="studio-sidebar__footer">
        <div className="studio-sidebar__footer-items">
          <Link to="/thing" className={`sidebar__item ${pathname.startsWith('/thing') ? 'sidebar__item--active' : ''}`}>
            <span className="studio-sidebar__footer-icon" aria-hidden="true">🤖</span>
            {!isCollapsed && <span className="studio-sidebar__footer-label">THING</span>}
          </Link>
          <Link to={`${spacePath}/raw`} className={`sidebar__item ${pathname.includes('/raw') ? 'sidebar__item--active' : ''}`}>
            <FileCode className="studio-sidebar__footer-icon" />
            {!isCollapsed && <span className="studio-sidebar__footer-label">Raw Files</span>}
          </Link>
          <button onClick={onOpenSettings} className="sidebar__item">
            <Settings className="studio-sidebar__footer-icon" />
            {!isCollapsed && <span className="studio-sidebar__footer-label">Settings</span>}
          </button>
          <button onClick={onToggleCollapse} className="sidebar__item">
            {isCollapsed ? (
              <ChevronRight className="studio-sidebar__footer-icon" />
            ) : (
              <>
                <ChevronLeft className="studio-sidebar__footer-icon" />
                <span className="studio-sidebar__footer-label">Collapse</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  )
}
