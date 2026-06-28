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
import { useToggle, useTasklistList, useGlob } from '@lmthing/state'
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
  FunctionSquare,
  Box,
  MessageSquare,
} from 'lucide-react'
import '@lmthing/css/elements/nav/sidebar/index.css'
import '@lmthing/css/components/shell/index.css'
import { buildSpacePath } from '@lmthing/ui/lib/space-path'
import { useAgentList } from '@lmthing/ui/hooks/useAgentList'
import type { AgentListItem } from '@lmthing/ui/hooks/useAgentList'
import { useKnowledgeFieldList } from '@lmthing/state'
import type { KnowledgeFieldMeta } from '@lmthing/state'
import { useAgent } from '@lmthing/ui/hooks/useAgent'
import { CozyThingText } from '@lmthing/ui/elements/branding/cozy-text'
import { otherAppLinks } from '@lmthing/ui/lib/app-urls'

export interface StudioSidebarProps {
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  activeFieldId?: string
  activeAgentId?: string
  onOpenSettings?: () => void
  onCreateField?: () => void
  onCreateAgent?: () => void
  /** When provided, the THING footer entry toggles the right-side chat dock
   *  (instead of navigating). `thingOpen` reflects the dock's current state. */
  thingOpen?: boolean
  onToggleThing?: () => void
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
  thingOpen,
  onToggleThing,
}: StudioSidebarProps) {
  const { pathname } = useLocation()
  const { spaceId } = useParams({ strict: false }) as { spaceId?: string }
  const spacePath = useSpacePath()
  const [fieldsExpanded, toggleFieldsExpanded] = useToggle('sidebar.fields.expanded', true)
  const [agentsExpanded, toggleAgentsExpanded] = useToggle('sidebar.agents.expanded', true)
  const [tasklistsExpanded, toggleTasklistsExpanded] = useToggle('sidebar.tasklists.expanded', true)
  const [functionsExpanded, toggleFunctionsExpanded] = useToggle('sidebar.functions.expanded', true)
  const [componentsExpanded, toggleComponentsExpanded] = useToggle('sidebar.components.expanded', true)
  const [conversationsExpanded, toggleConversationsExpanded] = useToggle('sidebar.conversations.expanded', true)

  const agentList = useAgentList()
  const knowledgeFields = useKnowledgeFieldList()
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
    return knowledgeFields.map((f: KnowledgeFieldMeta) => ({
      id: f.fieldId,
      label: `${f.domain} / ${f.field}`,
      path: f.path,
    }))
  }, [knowledgeFields])

  // Functions (functions/<name>.ts) and components (components/{view,form}/<Name>.tsx).
  const functionPaths = useGlob('functions/*.ts')
  const viewComponentPaths = useGlob('components/view/*.tsx')
  const formComponentPaths = useGlob('components/form/*.tsx')

  const functions = useMemo(
    () =>
      functionPaths
        .map((p) => p.split('/').pop()!.replace(/\.ts$/, ''))
        .sort((a, b) => a.localeCompare(b)),
    [functionPaths],
  )
  const components = useMemo(
    () =>
      [
        ...viewComponentPaths.map((p) => ({ name: p.split('/').pop()!.replace(/\.tsx$/, ''), kind: 'view' as const })),
        ...formComponentPaths.map((p) => ({ name: p.split('/').pop()!.replace(/\.tsx$/, ''), kind: 'form' as const })),
      ].sort((a, b) => a.name.localeCompare(b.name)),
    [viewComponentPaths, formComponentPaths],
  )

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
                    const href = `${spacePath}/knowledge/${encodeURIComponent(field.id)}`
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

            <section>
              <button
                onClick={toggleFunctionsExpanded}
                className="sidebar__item studio-sidebar__section-header"
              >
                {functionsExpanded ? <ChevronDown className="studio-sidebar__section-chevron" /> : <ChevronRightSmall className="studio-sidebar__section-chevron" />}
                Functions ({functions.length})
              </button>
              {functionsExpanded && (
                <div className="studio-sidebar__section-items">
                  {functions.map(name => {
                    const href = `${spacePath}/functions`
                    return (
                      <Link key={name} to={href} className="sidebar__item">
                        <FunctionSquare className="studio-sidebar__item-icon--knowledge" />
                        <span className="studio-sidebar__item-label">{name}</span>
                      </Link>
                    )
                  })}
                  <Link to={`${spacePath}/functions`} className="sidebar__item studio-sidebar__create-btn">
                    <Plus className="studio-sidebar__create-icon" />
                    <span className="studio-sidebar__create-label">Edit Functions</span>
                  </Link>
                </div>
              )}
            </section>

            <section>
              <button
                onClick={toggleComponentsExpanded}
                className="sidebar__item studio-sidebar__section-header"
              >
                {componentsExpanded ? <ChevronDown className="studio-sidebar__section-chevron" /> : <ChevronRightSmall className="studio-sidebar__section-chevron" />}
                Components ({components.length})
              </button>
              {componentsExpanded && (
                <div className="studio-sidebar__section-items">
                  {components.map(c => (
                    <Link key={`${c.kind}/${c.name}`} to={`${spacePath}/components`} className="sidebar__item">
                      <Box className="studio-sidebar__item-icon--knowledge" />
                      <span className="studio-sidebar__item-label">{c.name}</span>
                      <span className="studio-sidebar__item-badge" style={{ marginLeft: 'auto', opacity: 0.6, fontSize: 11 }}>{c.kind}</span>
                    </Link>
                  ))}
                  <Link to={`${spacePath}/components`} className="sidebar__item studio-sidebar__create-btn">
                    <Plus className="studio-sidebar__create-icon" />
                    <span className="studio-sidebar__create-label">Edit Components</span>
                  </Link>
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
          {onToggleThing ? (
            <button
              onClick={onToggleThing}
              className={`sidebar__item ${thingOpen ? 'sidebar__item--active' : ''}`}
              title={thingOpen ? 'Hide THING chat' : 'Show THING chat'}
            >
              <MessageSquare className="studio-sidebar__footer-icon" />
              {!isCollapsed && <span className="studio-sidebar__footer-label">THING</span>}
            </button>
          ) : (
            <Link to="/thing" className={`sidebar__item ${pathname.startsWith('/thing') ? 'sidebar__item--active' : ''}`}>
              <span className="studio-sidebar__footer-icon" aria-hidden="true">🤖</span>
              {!isCollapsed && <span className="studio-sidebar__footer-label">THING</span>}
            </Link>
          )}
          <Link to={`${spacePath}/raw`} className={`sidebar__item ${pathname.includes('/raw') ? 'sidebar__item--active' : ''}`}>
            <FileCode className="studio-sidebar__footer-icon" />
            {!isCollapsed && <span className="studio-sidebar__footer-label">Raw Files</span>}
          </Link>
          {otherAppLinks('studio').map((link) => (
            <a
              key={link.app}
              href={link.url}
              className="sidebar__item"
              title={`Open lmthing.${link.app}`}
            >
              <span className="studio-sidebar__footer-icon" aria-hidden="true">{link.emoji}</span>
              {!isCollapsed && <span className="studio-sidebar__footer-label">{link.label}</span>}
            </a>
          ))}
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
