import type { ConversationSummary } from './types'

interface ConversationSidebarProps {
  conversations: ConversationSummary[]
  activeId: string
  liveSessionId: string
  onSelect: (id: string) => void
  onNew: () => void
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
  activeId,
  liveSessionId,
  onSelect,
  onNew,
}: ConversationSidebarProps) {
  return (
    <div className="twv-conv-sidebar">
      <div className="twv-conv-sidebar__header">
        <span className="twv-conv-sidebar__title">Conversations</span>
        <button className="twv-conv-sidebar__new-btn" onClick={onNew}>
          {activeId !== liveSessionId ? 'Live' : 'New'}
        </button>
      </div>
      <div className="twv-conv-sidebar__list">
        {conversations.length === 0 && (
          <div className="twv-conv-sidebar__empty">No saved conversations</div>
        )}
        {conversations.map(conv => (
          <button
            key={conv.id}
            className={`twv-conv-sidebar__item ${conv.id === activeId ? 'twv-conv-sidebar__item--active' : ''}`}
            onClick={() => onSelect(conv.id)}
          >
            <div className="twv-conv-sidebar__item-title">{conv.title}</div>
            <div className="twv-conv-sidebar__item-meta">
              <span>{formatRelativeDate(conv.updatedAt)}</span>
              <span>{conv.turnCount} turns</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
