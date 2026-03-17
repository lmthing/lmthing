import { useReplSession } from './rpc-client'
import { ChatView } from './components/ChatView'
import { InputBar } from './components/InputBar'
import { Sidebar } from './components/Sidebar'
import './App.css'

const WS_URL = (import.meta as any).env?.VITE_WS_URL ?? 'ws://localhost:3100'

export function App() {
  const session = useReplSession(WS_URL)
  const { snapshot, blocks, connected } = session
  const isExecuting = snapshot.status === 'executing'
  const isPaused = snapshot.status === 'paused'
  const isWaiting = snapshot.status === 'waiting_for_input'
  const hasAsyncTasks = snapshot.asyncTasks.length > 0

  return (
    <div className="app-layout">
      <div className="main-column">
        {!connected && (
          <div className="connection-bar">
            Disconnected — waiting for server at {WS_URL}
          </div>
        )}
        <ChatView
          blocks={blocks}
          status={snapshot.status}
          activeFormId={snapshot.activeFormId}
          onSubmitForm={session.submitForm}
          onCancelAsk={session.cancelAsk}
        />
        <InputBar
          onSend={isExecuting || isPaused ? session.intervene : session.sendMessage}
          onPause={session.pause}
          onResume={session.resume}
          status={snapshot.status}
          disabled={!connected}
        />
      </div>
      <Sidebar
        tasks={snapshot.asyncTasks}
        onCancel={session.cancelTask}
        collapsed={!hasAsyncTasks}
      />
    </div>
  )
}
