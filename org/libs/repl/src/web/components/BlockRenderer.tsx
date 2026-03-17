import { useState } from 'react'
import type { UIBlock } from '../rpc-client'
import type { SerializedJSX } from '../../session/types'
import { JSXRenderer } from './JSXRenderer'
import { FormBlock } from './FormBlock'

interface BlockRendererProps {
  block: UIBlock
  activeFormId: string | null
  onSubmitForm: (formId: string, data: Record<string, unknown>) => void
  onCancelAsk: (formId: string) => void
}

export function BlockRenderer({ block, activeFormId, onSubmitForm, onCancelAsk }: BlockRendererProps) {
  switch (block.type) {
    case 'user':
      return <UserBubble text={block.text} />
    case 'code':
      return <CodeBlockUI code={block.code} lineCount={block.lineCount} streaming={block.streaming} />
    case 'read':
      return <ReadBlockUI payload={block.payload} />
    case 'error':
      return <ErrorBlockUI error={block.error} />
    case 'hook':
      return <HookBlockUI hookId={block.hookId} action={block.action} detail={block.detail} />
    case 'display':
      return (
        <div className="agent-block display-block">
          <JSXRenderer jsx={block.jsx} />
        </div>
      )
    case 'form':
      return (
        <FormBlock
          formId={block.id}
          jsx={block.jsx}
          status={block.status}
          isActive={activeFormId === block.id}
          onSubmit={onSubmitForm}
          onCancel={onCancelAsk}
        />
      )
    case 'tasklist_declared':
      return (
        <div className="agent-block tasklist">
          <h4>{block.plan.description} <span style={{ opacity: 0.5, fontSize: '0.85em' }}>({block.tasklistId})</span></h4>
          {block.plan.tasks.map(task => (
            <div key={task.id} className="tasklist-task">
              <span style={{ opacity: 0.5 }}>&#x25CB;</span>
              <span>{task.instructions}</span>
            </div>
          ))}
        </div>
      )
    case 'task_complete':
      return (
        <div className="agent-block task-complete-block">
          <span>&#x2713;</span>
          <span>Task <strong>{block.tasklistId}/{block.taskId}</strong> complete</span>
        </div>
      )
    default:
      return null
  }
}

// ── Inline sub-components ──

function UserBubble({ text }: { text: string }) {
  return (
    <div className="user-bubble">
      <div className="user-bubble-inner">{text}</div>
    </div>
  )
}

function CodeBlockUI({ code, lineCount, streaming }: { code: string; lineCount: number; streaming: boolean }) {
  const [collapsed, setCollapsed] = useState(true)

  return (
    <div className="agent-block collapsible code-block">
      <button className="collapsible-header" onClick={() => setCollapsed(c => !c)}>
        <span className={`chevron ${collapsed ? '' : 'open'}`}>&#x25B6;</span>
        <span className="summary">Code</span>
        <span className="meta">
          {lineCount} line{lineCount !== 1 ? 's' : ''}
          {streaming && <span className="streaming-icon"> &#x27F3;</span>}
        </span>
      </button>
      {!collapsed && (
        <div className="collapsible-body">
          <pre><code>{code}</code></pre>
        </div>
      )}
    </div>
  )
}

function ReadBlockUI({ payload }: { payload: Record<string, unknown> }) {
  const [collapsed, setCollapsed] = useState(true)
  const keys = Object.keys(payload)
  const summary = keys.length <= 3
    ? keys.map(k => `${k}: ${summarizeValue(payload[k])}`).join(', ')
    : `${keys.length} values`

  return (
    <div className="agent-block collapsible read-block">
      <button className="collapsible-header" onClick={() => setCollapsed(c => !c)}>
        <span className={`chevron ${collapsed ? '' : 'open'}`}>&#x25B6;</span>
        <span className="summary">Read &mdash; {summary}</span>
      </button>
      {!collapsed && (
        <div className="collapsible-body">
          <pre>{JSON.stringify(payload, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

function ErrorBlockUI({ error }: { error: { type: string; message: string; line: number; source: string } }) {
  const [collapsed, setCollapsed] = useState(true)

  return (
    <div className="agent-block collapsible error-block">
      <button className="collapsible-header" onClick={() => setCollapsed(c => !c)}>
        <span className={`chevron ${collapsed ? '' : 'open'}`}>&#x25B6;</span>
        <span className="summary">Error &mdash; {error.type}: {error.message}</span>
      </button>
      {!collapsed && (
        <div className="collapsible-body error-body">
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{error.type}</div>
          <div style={{ marginBottom: 8 }}>{error.message}</div>
          <div className="error-source">
            <span style={{ marginRight: 8 }}>Line {error.line}:</span>
            {error.source}
          </div>
        </div>
      )}
    </div>
  )
}

function HookBlockUI({ hookId, action, detail }: { hookId: string; action: string; detail: string }) {
  const [collapsed, setCollapsed] = useState(true)
  const isInterruptive = action === 'interrupt' || action === 'skip'

  return (
    <div className={`agent-block collapsible hook-block ${isInterruptive ? action : ''}`}>
      <button className="collapsible-header" onClick={() => setCollapsed(c => !c)}>
        <span className={`chevron ${collapsed ? '' : 'open'}`}>&#x25B6;</span>
        <span className="summary">
          Hook &mdash; {hookId}
          <span style={{
            marginLeft: 8,
            padding: '1px 6px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 500,
            background: isInterruptive ? 'rgba(217, 119, 6, 0.15)' : 'rgba(107, 70, 193, 0.1)',
            color: isInterruptive ? '#d97706' : '#6b46c1',
          }}>
            {action}
          </span>
        </span>
      </button>
      {!collapsed && (
        <div className="collapsible-body" style={{ padding: '8px 12px', fontSize: 13 }}>
          {detail}
        </div>
      )}
    </div>
  )
}

function summarizeValue(v: unknown): string {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  if (typeof v === 'string') return v.length > 30 ? `"${v.slice(0, 27)}..."` : `"${v}"`
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return `[${v.length}]`
  if (typeof v === 'object') return `{${Object.keys(v).length}}`
  return String(v)
}
