import '@lmthing/css/components/agent/runtime/index.css'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Panel, PanelHeader, PanelBody } from '@lmthing/ui/elements/content/panel'
import { cn } from '../../../../lib/utils'
import type { ConversationSummary } from '@lmthing/state'

export interface ConversationSidebarProps {
  conversations: ConversationSummary[]
  activeConversationId: string
  onSelectConversation: (id: string) => void
  onNewConversation: () => void
}

function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ConversationSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
}: ConversationSidebarProps) {
  return (
    <aside className="conversation-sidebar">
      <Panel className="conversation-sidebar__panel">
        <PanelHeader>
          <Stack row gap="sm" className="conversation-sidebar__header-row">
            <Label compact className="conversation-sidebar__header-label">Conversations</Label>
            <Button onClick={onNewConversation} variant="ghost" size="sm">New</Button>
          </Stack>
        </PanelHeader>
        <PanelBody className="conversation-sidebar__body">
          {conversations.length === 0 ? (
            <div className="conversation-sidebar__empty">
              <Caption muted>No conversations yet.</Caption>
            </div>
          ) : (
            <ul className="conversation-sidebar__list">
              {conversations.map(conv => (
                <li key={conv.id}>
                  <button
                    type="button"
                    className={cn(
                      'conversation-sidebar__item',
                      conv.id === activeConversationId && 'conversation-sidebar__item--active'
                    )}
                    onClick={() => onSelectConversation(conv.id)}
                  >
                    <div className="conversation-sidebar__item-title">
                      {conv.title || 'Untitled conversation'}
                    </div>
                    <div className="conversation-sidebar__item-meta">
                      <Caption muted>{formatRelativeDate(conv.updatedAt)}</Caption>
                      <Badge variant="muted">{conv.messageCount}</Badge>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PanelBody>
      </Panel>
    </aside>
  )
}
