import {
  Plus,
  Settings,
  Github,
  ChevronLeft,
  ChevronRight,
  Folder,
  Bot,
  MessageSquare,
  ChevronDown,
  ChevronRight as ChevronRightSmall,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useKnowledgeSections, useAgents } from '@/lib/workspaceContext'
import { useWorkspaceData } from '@/lib/workspaceDataContext'
import { useGithub } from '@/lib/github/GithubContext'
import { toWorkspaceRouteParam } from '@/lib/workspaces'
import logo from '@/assets/logo.png'
import { WorkspaceSelector } from './WorkspaceSelector'
import type { Workspace } from './WorkspaceSelector'
import type { Agent } from '@/types/workspace-data'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

type Domain = {
  id: string
  name: string
  label: string
  description: string
  icon: string
  color: string
  path: string
  childCount: number
}

type AgentConfig = {
  id: string
  name: string
  description: string
  selectedDomains: string[]
  formValues: Record<string, string | string[] | boolean>
  enabledTools: Array<{ toolId: string; source: string }>
  attachedFlows: Array<{
    flowId: string
    flowName: string
    slashAction?: { name: string; actionId: string; enabled?: boolean }
  }>
}

type Message = {
  id: string
  role: string
  content: string
  timestamp: string
}

type Conversation = {
  id: string
  agentId: string
  agentName: string
  messages?: Message[]
  createdAt: string
  updatedAt: string
}

function toLocalWorkspaceId(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''

  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export interface StudioSidebarProps {
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  activeDomainId?: string
  activeAgentId?: string
  onOpenSettings?: () => void
  onCreateDomain?: () => void
  onCreateAgent?: () => void
  workspace?: Workspace
  // Export functionality
  onExportZip?: () => void
  onExportGithub?: () => void
  isExporting?: boolean
  exportProgress?: { uploadedFiles?: number; totalFiles?: number }
  canExport?: boolean
}

export function StudioSidebar({
  isCollapsed = false,
  onToggleCollapse,
  activeDomainId,
  activeAgentId,
  onOpenSettings,
  onCreateDomain,
  onCreateAgent,
  workspace,
  onExportZip,
  onExportGithub,
  isExporting = false,
  exportProgress,
  canExport = false,
}: StudioSidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { workspaceName } = useParams<{ workspaceName: string }>()
  const [domainsExpanded, setDomainsExpanded] = useState(true)
  const [agentsExpanded, setAgentsExpanded] = useState(true)
  const [conversationsExpanded, setConversationsExpanded] = useState(true)
  const [isCreateLocalWorkspaceOpen, setIsCreateLocalWorkspaceOpen] = useState(false)
  const [newLocalWorkspaceName, setNewLocalWorkspaceName] = useState('')

  // Use the new state hooks
  const knowledgeSections = useKnowledgeSections()
  const { agents: agentsMap } = useAgents()
  const { createWorkspace } = useWorkspaceData()
  const { login, logout, isAuthenticated, isLoadingAuth, deviceCodePrompt } = useGithub()

  // Build workspace-aware path helper
  const studioPath = workspaceName
    ? `/studio/${toWorkspaceRouteParam(workspaceName)}/`
    : '/studio'

  // Map knowledge sections to domain format
  const domains = useMemo(() => {
    return knowledgeSections.map(section => ({
      id: section.path.replace(/\//g, '-'),
      name: section.path,
      label: section.label || section.path,
      description: section.description || '',
      icon: section.icon || 'folder',
      color: section.color || '#6366f1',
      path: section.path,
      childCount: section.children?.filter(c => c.type === 'field').length || 0,
    })) as Domain[]
  }, [knowledgeSections])

  // Map agent list to agent config format
  const agents = useMemo(() => {
    return Object.values(agentsMap).map((agent: Agent) => ({
      id: agent.id,
      name: agent.frontmatter.name || agent.id,
      description: agent.frontmatter.description || '',
      selectedDomains: agent.frontmatter.selectedDomains || [],
      formValues: agent.formValues,
      enabledTools: [],
      attachedFlows: (agent.slashActions || []).map(sa => ({
        flowId: sa.flowId,
        flowName: sa.name,
      })),
    })) as AgentConfig[]
  }, [agentsMap])

  // Load conversations from agents map
  const conversations = useMemo(() => {
    const result: Conversation[] = []
    for (const agent of Object.values(agentsMap)) {
      for (const conv of agent.conversations || []) {
        result.push({
          id: conv.id,
          agentId: conv.agentId,
          agentName: conv.agentName,
          messages: conv.messages,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
        })
      }
    }

    return result.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }, [agentsMap])

  const activeAgentConversations = useMemo(() => {
    if (!activeAgentId) return []
    return conversations.filter((conv) => conv.agentId === activeAgentId)
  }, [activeAgentId, conversations])

  const toggleDomains = () => {
    setDomainsExpanded((prev) => !prev)
  }

  const toggleAgents = () => {
    setAgentsExpanded((prev) => !prev)
  }

  const toggleConversations = () => {
    setConversationsExpanded((prev) => !prev)
  }

  const handleCreateLocalWorkspace = () => {
    const localWorkspaceId = toLocalWorkspaceId(newLocalWorkspaceName)
    if (!localWorkspaceId) return

    createWorkspace(localWorkspaceId, { setAsCurrent: false })
    setIsCreateLocalWorkspaceOpen(false)
    setNewLocalWorkspaceName('')
    navigate(`/studio/${toWorkspaceRouteParam(`local/${localWorkspaceId}`)}`)
  }

  return (
    <aside
      className={`
        flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800
        transition-all duration-200 ease-in-out
        ${isCollapsed ? 'w-16' : 'w-[280px]'}
      `}
    >
      {/* Logo and App Name */}
      <div className="p-0 border-b border-slate-200 dark:border-slate-800">
        <div
          className={`
            flex items-center gap-2
            ${isCollapsed ? 'justify-center' : ''}
          `}
        >
          <Link
            to="/"
            className="flex h-12 w-12 shrink-0 items-center justify-center"
            title="lmthing"
          >
            {/* <img src={logo} alt="lmthing logo" className="h-12 w-12 rounded-md object-contain" /> */}
          </Link>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <WorkspaceSelector
                currentWorkspace={workspace}
                isCollapsed={false}
                onExportZip={onExportZip}
                onExportGithub={onExportGithub}
                isExporting={isExporting}
                exportProgress={exportProgress}
                canExport={canExport}
              />
            </div>
          )}
          {!isCollapsed && (
            <button
              type="button"
              onClick={() => setIsCreateLocalWorkspaceOpen(true)}
              className="h-8 w-8 shrink-0 rounded-md border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Create local workspace"
              aria-label="Create local workspace"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
        {isCollapsed && (
          <div className="flex flex-col items-center mt-2 gap-2">
            <WorkspaceSelector
              currentWorkspace={workspace}
              isCollapsed={true}
              onExportZip={onExportZip}
              onExportGithub={onExportGithub}
              isExporting={isExporting}
              exportProgress={exportProgress}
              canExport={canExport}
            />
            <button
              type="button"
              onClick={() => setIsCreateLocalWorkspaceOpen(true)}
              className="h-8 w-8 shrink-0 rounded-md border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Create local workspace"
              aria-label="Create local workspace"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <Dialog open={isCreateLocalWorkspaceOpen} onOpenChange={setIsCreateLocalWorkspaceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Local Workspace</DialogTitle>
            <DialogDescription>
              Create a new local workspace and open it in Studio.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              placeholder="Workspace name (e.g. customer-support)"
              value={newLocalWorkspaceName}
              onChange={(event) => setNewLocalWorkspaceName(event.target.value)}
            />
            <button
              type="button"
              onClick={handleCreateLocalWorkspace}
              disabled={!toLocalWorkspaceId(newLocalWorkspaceName)}
              className="w-full px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Create Local Workspace
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-8">
        {!isCollapsed ? (
          <div className="space-y-6">
            {/* Domains Section */}
            <section>
              <button
                onClick={toggleDomains}
                className="flex items-center gap-1 px-3 mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                {domainsExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRightSmall className="w-3 h-3" />
                )}
                Knowledge
                <span className="ml-1 text-slate-400 dark:text-slate-500">
                  ({domains.length})
                </span>
              </button>

              {domainsExpanded && (
                <div className="space-y-0.5">
                  {domains.map((domain) => {
                    const href = `${studioPath}/knowledge/${domain.id}`
                    const isActive = location.pathname === href || activeDomainId === domain.id

                    return (
                      <Link
                        key={domain.id}
                        to={href}
                        className={`
                          flex items-center gap-3 w-full px-3 py-2 text-sm rounded-lg transition-colors
                          ${isActive
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }
                        `}
                      >
                        <Folder
                          className="w-4 h-4 flex-shrink-0"
                          style={{ color: domain.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-medium">{domain.label}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-500 truncate">
                            {domain.childCount} categories
                          </div>
                        </div>
                      </Link>
                    )
                  })}

                  {/* Create Domain Link */}
                  <button
                    onClick={onCreateDomain}
                    className="flex items-center gap-3 w-full px-3 py-2 text-sm rounded-lg transition-colors text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Plus className="w-4 h-4 flex-shrink-0" />
                    <span className="font-medium">Create Knowledge</span>
                  </button>
                </div>
              )}
            </section>

            {/* Agents Section */}
            <section>
              <button
                onClick={toggleAgents}
                className="flex items-center gap-1 px-3 mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                {agentsExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRightSmall className="w-3 h-3" />
                )}
                Agents
                <span className="ml-1 text-slate-400 dark:text-slate-500">
                  ({agents.length})
                </span>
              </button>

              {agentsExpanded && (
                <div className="space-y-0.5">
                  {agents.map((agent) => {
                    const href = `${studioPath}/assistant/${agent.id}`
                    const isActive = location.pathname === href || activeAgentId === agent.id
                    const hasSlashAction = agent.attachedFlows?.some(
                      (f) => f.slashAction?.enabled
                    )

                    return (
                      <Link
                        key={agent.id}
                        to={href}
                        className={`
                          flex items-center gap-3 w-full px-3 py-2 text-sm rounded-lg transition-colors
                          ${isActive
                            ? 'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }
                        `}
                      >
                        <Bot className="w-4 h-4 flex-shrink-0 text-violet-500 dark:text-violet-400" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-medium flex items-center gap-2">
                            {agent.name}
                            {hasSlashAction && (
                              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-300 rounded">
                                /
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-500 truncate">
                            {agent.selectedDomains.length} knowledge areas
                          </div>
                        </div>
                      </Link>
                    )
                  })}

                  {/* Create Agent Link */}
                  <button
                    onClick={onCreateAgent}
                    className="flex items-center gap-3 w-full px-3 py-2 text-sm rounded-lg transition-colors text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Plus className="w-4 h-4 flex-shrink-0" />
                    <span className="font-medium">Create Agent</span>
                  </button>
                </div>
              )}
            </section>

            {/* Conversations Section (agent-scoped, like runtime preview) */}
            {(activeAgentId || conversations.length > 0) && (
              <section>
                <button
                  onClick={toggleConversations}
                  className="flex items-center gap-1 px-3 mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                  {conversationsExpanded ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRightSmall className="w-3 h-3" />
                  )}
                  Conversations
                  <span className="ml-1 text-slate-400 dark:text-slate-500">
                    ({activeAgentId ? activeAgentConversations.length : conversations.length})
                  </span>
                </button>

                {conversationsExpanded && (
                  <div className="space-y-1">
                    {!activeAgentId && (
                      <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-500">
                        Select an agent to view its conversations.
                      </div>
                    )}

                    {activeAgentId && activeAgentConversations.length === 0 && (
                      <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-500">
                        No conversations yet for this agent.
                      </div>
                    )}

                    {activeAgentConversations.map((conv) => {
                      const href = `${studioPath}/assistant/${activeAgentId}/conversation/${conv.id}`
                      const isActive = location.pathname === href
                      const lastMessage = conv.messages?.[conv.messages.length - 1]

                      return (
                        <Link
                          key={conv.id}
                          to={href}
                          className={`
                            flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg transition-colors text-left
                            ${isActive
                              ? 'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                            }
                          `}
                        >
                          <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                          <span className="truncate flex-1">
                            {(lastMessage?.content || 'New chat').slice(0, 36)}
                            {(lastMessage?.content || 'New chat').length > 36 ? '…' : ''}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </section>
            )}
          </div>
        ) : (
          /* Collapsed state - show quick icons */
          <div className="space-y-4">
            <div
              className="flex items-center justify-center px-2 py-2 rounded-lg text-slate-500 dark:text-slate-400"
              title={`${domains.length} knowledge areas`}
            >
              <Folder className="w-5 h-5" />
            </div>
            <div
              className="flex items-center justify-center px-2 py-2 rounded-lg text-slate-500 dark:text-slate-400"
              title={`${agents.length} agents`}
            >
              <Bot className="w-5 h-5" />
            </div>
            {(activeAgentId ? activeAgentConversations.length : conversations.length) > 0 && (
              <div
                className="flex items-center justify-center px-2 py-2 rounded-lg text-slate-500 dark:text-slate-400"
                title={`${activeAgentId ? activeAgentConversations.length : conversations.length} conversations`}
              >
                <MessageSquare className="w-5 h-5" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Section: Settings & Collapse */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800">
        <div className="flex flex-col gap-1">
          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className={`
              flex items-center gap-3
              text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200
              hover:bg-slate-100 dark:hover:bg-slate-800
              rounded-lg transition-colors
              ${isCollapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'}
            `}
            title={isCollapsed ? 'Settings' : ''}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && (
              <span className="text-sm font-medium">Settings</span>
            )}
          </button>

          <button
            onClick={() => {
              if (isLoadingAuth) return
              if (isAuthenticated) {
                logout()
                return
              }
              void login().catch(console.error)
            }}
            disabled={isLoadingAuth}
            className={`
              flex items-center gap-3
              text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200
              hover:bg-slate-100 dark:hover:bg-slate-800
              rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed
              ${isCollapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'}
            `}
            title={
              isCollapsed
                ? isLoadingAuth
                  ? 'GitHub auth loading'
                  : isAuthenticated
                    ? 'Logout GitHub'
                    : 'Login with GitHub'
                : ''
            }
          >
            <Github className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && (
              <span className="text-sm font-medium">
                {isLoadingAuth
                  ? 'GitHub Auth Loading...'
                  : isAuthenticated
                    ? 'Logout GitHub'
                    : 'Login with GitHub'}
              </span>
            )}
          </button>

          {!isCollapsed && deviceCodePrompt && (
            <div className="mx-3 mt-1 rounded-md border border-violet-200 bg-violet-50 p-2.5 dark:border-violet-900/50 dark:bg-violet-950/30">
              <p className="text-xs text-violet-800 dark:text-violet-200">Authorize GitHub:</p>
              <a
                href={deviceCodePrompt.verificationUri}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-violet-700 dark:text-violet-300 underline"
              >
                {deviceCodePrompt.verificationUri}
              </a>
              <p className="mt-1 text-xs text-violet-800 dark:text-violet-200">Code:</p>
              <div className="mt-1 rounded border border-violet-200 bg-white px-2 py-1 text-center font-mono text-sm tracking-widest dark:border-violet-800 dark:bg-slate-900 dark:text-violet-100">
                {deviceCodePrompt.userCode}
              </div>
            </div>
          )}

          {/* Collapse Toggle */}
          <button
            onClick={onToggleCollapse}
            className={`
              flex items-center gap-3
              text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200
              hover:bg-slate-100 dark:hover:bg-slate-800
              rounded-lg transition-colors
              ${isCollapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'}
            `}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5 flex-shrink-0" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">Collapse</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  )
}
