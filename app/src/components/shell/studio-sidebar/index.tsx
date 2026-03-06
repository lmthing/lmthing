/**
 * StudioSidebar - Navigation sidebar for studio sections.
 * Uses new composite hooks (useAssistantList, useKnowledgeFields)
 * and CSS element classes instead of raw Tailwind.
 */
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useParams } from 'next/navigation'
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
} from 'lucide-react'
import '@/css/elements/nav/sidebar/index.css'
import { useAssistantList } from '@/hooks/useAssistantList'
import type { AssistantListItem } from '@/hooks/useAssistantList'
import { useKnowledgeFields } from '@/hooks/useKnowledgeFields'
import type { DomainMeta } from '@/hooks/useKnowledgeFields'
import { useAssistant } from '@/hooks/useAssistant'
import { useGithub } from '@/lib/github/GithubContext'
import { CozyThingText } from '@/CozyText'

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
  const { username, studioId, spaceId } = useParams<{ username: string; studioId: string; spaceId: string }>()
  if (username && studioId && spaceId) {
    return `/${encodeURIComponent(username)}/${encodeURIComponent(studioId)}/${encodeURIComponent(spaceId)}`
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
  const pathname = usePathname()
  const { spaceId } = useParams<{ spaceId: string }>()
  const spacePath = useSpacePath()
  const [fieldsExpanded, setFieldsExpanded] = useState(true)
  const [assistantsExpanded, setAssistantsExpanded] = useState(true)
  const [conversationsExpanded, setConversationsExpanded] = useState(true)

  const { login, logout, isAuthenticated, isLoadingAuth, deviceCodePrompt } = useGithub()

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
      <div style={{ padding: 0, borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Link
            href="/"
            style={{ display: 'flex', width: '3rem', height: '3rem', flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}
            title="lmthing"
          >
            <CozyThingText text="lmthing" />
          </Link>
          {!isCollapsed && (
            <span style={{ fontSize: '0.875rem', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {spaceId || 'Studio'}
            </span>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0.75rem', paddingTop: '2rem' }}>
        {!isCollapsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <section>
              <button
                onClick={() => setFieldsExpanded(p => !p)}
                className="sidebar__item"
                style={{ fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.7 }}
              >
                {fieldsExpanded ? <ChevronDown style={{ width: 12, height: 12 }} /> : <ChevronRightSmall style={{ width: 12, height: 12 }} />}
                Knowledge ({fields.length})
              </button>
              {fieldsExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {fields.map(field => {
                    const href = `${spacePath}/knowledge/${field.id}`
                    const isActive = pathname === href || activeFieldId === field.id
                    return (
                      <Link key={field.id} href={href} className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}>
                        <Folder style={{ width: 16, height: 16, flexShrink: 0, color: '#10b981' }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{field.label}</span>
                      </Link>
                    )
                  })}
                  <button onClick={onCreateField} className="sidebar__item" style={{ opacity: 0.6 }}>
                    <Plus style={{ width: 16, height: 16, flexShrink: 0 }} />
                    <span style={{ fontWeight: 500 }}>Create Field</span>
                  </button>
                </div>
              )}
            </section>

            <section>
              <button
                onClick={() => setAssistantsExpanded(p => !p)}
                className="sidebar__item"
                style={{ fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.7 }}
              >
                {assistantsExpanded ? <ChevronDown style={{ width: 12, height: 12 }} /> : <ChevronRightSmall style={{ width: 12, height: 12 }} />}
                Assistants ({assistants.length})
              </button>
              {assistantsExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {assistants.map(assistant => {
                    const href = `${spacePath}/assistant/${assistant.id}`
                    const isActive = pathname === href || activeAssistantId === assistant.id
                    return (
                      <Link key={assistant.id} href={href} className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}>
                        <Bot style={{ width: 16, height: 16, flexShrink: 0, color: '#8b5cf6' }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{assistant.name}</span>
                      </Link>
                    )
                  })}
                  <button onClick={onCreateAssistant} className="sidebar__item" style={{ opacity: 0.6 }}>
                    <Plus style={{ width: 16, height: 16, flexShrink: 0 }} />
                    <span style={{ fontWeight: 500 }}>Create Assistant</span>
                  </button>
                </div>
              )}
            </section>

            {activeAssistantId && (
              <section>
                <button
                  onClick={() => setConversationsExpanded(p => !p)}
                  className="sidebar__item"
                  style={{ fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.7 }}
                >
                  {conversationsExpanded ? <ChevronDown style={{ width: 12, height: 12 }} /> : <ChevronRightSmall style={{ width: 12, height: 12 }} />}
                  Conversations (0)
                </button>
                {conversationsExpanded && (
                  <div className="sidebar__item" style={{ opacity: 0.5, fontSize: '0.75rem', cursor: 'default' }}>
                    No conversations yet.
                  </div>
                )}
              </section>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            <div className="sidebar__item" style={{ justifyContent: 'center' }} title={`${fields.length} knowledge fields`}>
              <Folder style={{ width: 20, height: 20 }} />
            </div>
            <div className="sidebar__item" style={{ justifyContent: 'center' }} title={`${assistants.length} assistants`}>
              <Bot style={{ width: 20, height: 20 }} />
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <button onClick={onOpenSettings} className="sidebar__item">
            <Settings style={{ width: 20, height: 20, flexShrink: 0 }} />
            {!isCollapsed && <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Settings</span>}
          </button>
          <button
            onClick={() => {
              if (isLoadingAuth) return
              if (isAuthenticated) { logout(); return }
              void login().catch(console.error)
            }}
            disabled={isLoadingAuth}
            className="sidebar__item"
          >
            <Github style={{ width: 20, height: 20, flexShrink: 0 }} />
            {!isCollapsed && (
              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                {isLoadingAuth ? 'Loading...' : isAuthenticated ? 'Logout GitHub' : 'Login with GitHub'}
              </span>
            )}
          </button>
          {!isCollapsed && deviceCodePrompt && (
            <div style={{ margin: '0.25rem 0.75rem', padding: '0.625rem', borderRadius: '0.375rem', border: '1px solid var(--color-border)', fontSize: '0.75rem' }}>
              <p>Authorize GitHub: <a href={deviceCodePrompt.verificationUri} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, textDecoration: 'underline' }}>{deviceCodePrompt.verificationUri}</a></p>
              <p style={{ marginTop: '0.25rem' }}>Code: <code style={{ letterSpacing: '0.1em' }}>{deviceCodePrompt.userCode}</code></p>
            </div>
          )}
          <button onClick={onToggleCollapse} className="sidebar__item">
            {isCollapsed ? (
              <ChevronRight style={{ width: 20, height: 20, flexShrink: 0 }} />
            ) : (
              <>
                <ChevronLeft style={{ width: 20, height: 20, flexShrink: 0 }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Collapse</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  )
}
