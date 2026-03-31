import type { ThingWebViewSession, UIBlock } from './types'
import { ChatView } from './ChatView'
import { InputBar } from './InputBar'
import { Sidebar } from './Sidebar'
import { ConversationSidebar } from './ConversationSidebar'

import '@lmthing/css/components/thing/thing-web-view/index.css'

export interface ThingWebViewProps {
  session: ThingWebViewSession
  /** Current conversation ID for sidebar highlighting */
  conversationId?: string
  /** The live (current) session ID — used to distinguish live vs history view */
  liveSessionId?: string
  /** Called when user selects a conversation from sidebar */
  onSelectConversation?: (id: string) => void
  /** Called when user clicks "New" in sidebar */
  onNewConversation?: () => void
  /** Pre-built blocks for viewing historical conversations */
  historyBlocks?: UIBlock[]
  /** Whether the view is showing the live session (true) or a historical conversation (false) */
  isLiveView?: boolean
  /** CSS class for the root element */
  className?: string
  /** WebSocket URL shown in the disconnected banner */
  wsUrl?: string
}

export function ThingWebView({
  session,
  conversationId,
  liveSessionId,
  onSelectConversation,
  onNewConversation,
  historyBlocks,
  isLiveView = true,
  className,
  wsUrl,
}: ThingWebViewProps) {
  const { snapshot, connected } = session
  const isExecuting = snapshot.status === 'executing'
  const isPaused = snapshot.status === 'paused'
  const hasAsyncTasks = snapshot.asyncTasks.length > 0
  const displayBlocks = isLiveView ? session.blocks : (historyBlocks ?? [])

  return (
    <div className={`thing-web-view ${className ?? ''}`}>
      {conversationId != null && liveSessionId != null && onSelectConversation && onNewConversation && (
        <ConversationSidebar
          conversations={session.conversations}
          activeId={conversationId}
          liveSessionId={liveSessionId}
          onSelect={onSelectConversation}
          onNew={onNewConversation}
        />
      )}
      <div className="twv-main-column">
        {!connected && (
          <div className="twv-connection-bar">
            Disconnected — waiting for server{wsUrl ? ` at ${wsUrl}` : ''}
          </div>
        )}
        {!isLiveView && onNewConversation && (
          <div className="twv-history-banner">
            Viewing saved conversation
            <button className="twv-history-banner__back" onClick={onNewConversation}>
              Back to live session
            </button>
          </div>
        )}
        <ChatView
          blocks={displayBlocks}
          status={isLiveView ? snapshot.status : 'idle'}
          activeFormId={isLiveView ? snapshot.activeFormId : null}
          onSubmitForm={session.submitForm}
          onCancelAsk={session.cancelAsk}
        />
        {isLiveView && (
          <InputBar
            onSend={isExecuting || isPaused ? session.intervene : session.sendMessage}
            onPause={session.pause}
            onResume={session.resume}
            status={snapshot.status}
            disabled={!connected}
            actions={session.actions}
          />
        )}
      </div>
      <Sidebar
        tasks={snapshot.asyncTasks}
        onCancel={session.cancelTask}
        collapsed={!hasAsyncTasks}
      />
    </div>
  )
}

export type { ThingWebViewSession, UIBlock, BlockAction, AgentAction, ConversationSummary, SessionSnapshot } from './types'
export { blocksReducer } from './blocks'
