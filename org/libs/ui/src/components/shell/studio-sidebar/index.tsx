/**
 * StudioSidebar - Navigation sidebar for studio sections.
 * Uses new composite hooks (useAssistantList, useKnowledgeFields)
 * and CSS element classes instead of raw Tailwind.
 */
import { useMemo } from 'react'
import { useToggle } from '@lmthing/state'
import { Link, useLocation, useParams } from '@tanstack/react-router'
import {
  Plus,
  Settings,
  Github,
  ChevronLeft,
  ChevronRight,
  Folder,
  Bot,
  ChevronDown,
  ChevronRight as ChevronRightSmall,
  FileCode,
} from 'lucide-react'
import '@lmthing/css/elements/nav/sidebar/index.css'
import '@lmthing/css/components/shell/index.css'
import { buildSpacePathFromParams } from '@/lib/space-url'
import { useAssistantList } from '@lmthing/ui/hooks/useAssistantList'
import type { AssistantListItem } from '@lmthing/ui/hooks/useAssistantList'
import { useKnowledgeFields } from '@lmthing/ui/hooks/useKnowledgeFields'
import type { DomainMeta } from '@lmthing/ui/hooks/useKnowledgeFields'
import { useAssistant } from '@lmthing/ui/hooks/useAssistant'
import { useGithub } from '@/lib/github/GithubContext'
import { CozyThingText } from '@lmthing/ui/elements/branding/cozy-text'

export interface StudioSidebarProps {
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  activeFieldId?: string
  activeAssistantId?: string
  onOpenSettings?: () => void
  onCreateField?: () => void
  onCreateAssistant?: () => void
  onExportZip?: () => void
  onExportGithub?: () => void
  isExporting?: boolean
  exportProgress?: { uploadedFiles?: number; totalFiles?: number }
  canExport?: boolean
}

function useSpacePath(): string {
  const { username, studioId, storageId, spaceId } = useParams({ strict: false }) as { username?: string; studioId?: string; storageId?: string; spaceId?: string }
  if (username && studioId && storageId && spaceId) {
    return buildSpacePathFromParams(username, studioId, storageId, spaceId)
  }
  return '/'
}

export function StudioSidebar({
  isCollapsed = false,
  onToggleCollapse,
  activeFieldId,
  activeAssistantId,
  onOpenSettings,
  onCreateField,
  onCreateAssistant,
}: StudioSidebarProps) {
  const { pathname } = useLocation()
  const { spaceId } = useParams({ strict: false }) as { spaceId?: string }
  const spacePath = useSpacePath()
  const [fieldsExpanded, toggleFieldsExpanded] = useToggle('sidebar.fields.expanded', true)
  const [assistantsExpanded, toggleAssistantsExpanded] = useToggle('sidebar.assistants.expanded', true)
  const [conversationsExpanded, toggleConversationsExpanded] = useToggle('sidebar.conversations.expanded', true)

  const { isAuthenticated: isGithubConnected, isLoadingAuth: isGithubLoading, login: connectGithub, logout: disconnectGithub, deviceCodePrompt } = useGithub()

  const assistantList = useAssistantList()
  const knowledgeFields = useKnowledgeFields()
  const activeAssistant = useAssistant(activeAssistantId || '')

  const assistants = useMemo(() => {
    return assistantList.map((item: AssistantListItem) => ({
      id: item.id,
      name: item.id,
      path: item.path,
    }))
  }, [assistantList])

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
              {spaceId || 'Studio'}
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
                onClick={toggleAssistantsExpanded}
                className="sidebar__item studio-sidebar__section-header"
              >
                {assistantsExpanded ? <ChevronDown className="studio-sidebar__section-chevron" /> : <ChevronRightSmall className="studio-sidebar__section-chevron" />}
                Assistants ({assistants.length})
              </button>
              {assistantsExpanded && (
                <div className="studio-sidebar__section-items">
                  {assistants.map(assistant => {
                    const href = `${spacePath}/assistant/${assistant.id}`
                    const isActive = pathname === href || activeAssistantId === assistant.id
                    return (
                      <Link key={assistant.id} to={href} className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}>
                        <Bot className="studio-sidebar__item-icon--assistant" />
                        <span className="studio-sidebar__item-label">{assistant.name}</span>
                      </Link>
                    )
                  })}
                  <button onClick={onCreateAssistant} className="sidebar__item studio-sidebar__create-btn">
                    <Plus className="studio-sidebar__create-icon" />
                    <span className="studio-sidebar__create-label">Create Assistant</span>
                  </button>
                </div>
              )}
            </section>

            {activeAssistantId && (
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
            <div className="sidebar__item studio-sidebar__collapsed-icon" title={`${assistants.length} assistants`}>
              <Bot className="studio-sidebar__collapsed-icon-inner" />
            </div>
          </div>
        )}
      </div>

      <div className="studio-sidebar__footer">
        <div className="studio-sidebar__footer-items">
          <Link to={`${spacePath}/raw`} className={`sidebar__item ${pathname.includes('/raw') ? 'sidebar__item--active' : ''}`}>
            <FileCode className="studio-sidebar__footer-icon" />
            {!isCollapsed && <span className="studio-sidebar__footer-label">Raw Files</span>}
          </Link>
          <button onClick={onOpenSettings} className="sidebar__item">
            <Settings className="studio-sidebar__footer-icon" />
            {!isCollapsed && <span className="studio-sidebar__footer-label">Settings</span>}
          </button>
          <button
            onClick={() => {
              if (isGithubLoading) return
              if (isGithubConnected) { disconnectGithub(); return }
              void connectGithub().catch(console.error)
            }}
            disabled={isGithubLoading}
            className="sidebar__item"
          >
            <Github className="studio-sidebar__footer-icon" />
            {!isCollapsed && (
              <span className="studio-sidebar__footer-label">
                {isGithubLoading ? 'Loading...' : isGithubConnected ? 'Disconnect GitHub' : 'Connect GitHub'}
              </span>
            )}
          </button>
          {!isCollapsed && deviceCodePrompt && (
            <div className="studio-sidebar__device-code">
              <p>Authorize GitHub: <a href={deviceCodePrompt.verificationUri} target="_blank" rel="noopener noreferrer">{deviceCodePrompt.verificationUri}</a></p>
              <p>Code: <code>{deviceCodePrompt.userCode}</code></p>
            </div>
          )}
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
