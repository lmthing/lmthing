import { useState } from 'react'
import type { UIBlock, SerializedJSX } from './types'
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
      return <CodeWithComments code={block.code} id={block.id} lineCount={block.lineCount} streaming={block.streaming} />
    case 'read':
      return <ReadBlockUI payload={block.payload} />
    case 'error':
      return <ErrorBlockUI error={block.error} />
    case 'hook':
      return <HookBlockUI hookId={block.hookId} action={block.action} detail={block.detail} />
    case 'display':
      return (
        <div className="twv-agent-block twv-display-block">
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
        <div className="twv-agent-block twv-tasklist">
          <h4>{block.plan.description} <span style={{ opacity: 0.5, fontSize: '0.85em' }}>({block.tasklistId})</span></h4>
          {block.plan.tasks.map(task => (
            <div key={task.id} className="twv-tasklist-task">
              <span style={{ opacity: 0.5 }}>&#x25CB;</span>
              <span>{task.instructions}</span>
            </div>
          ))}
        </div>
      )
    case 'task_complete':
      return (
        <div className="twv-agent-block twv-task-complete-block">
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
    <div className="twv-user-bubble">
      <div className="twv-user-bubble__inner">{text}</div>
    </div>
  )
}

function CodeBlockUI({ code, lineCount, streaming }: { code: string; lineCount: number; streaming: boolean }) {
  const [collapsed, setCollapsed] = useState(true)

  return (
    <div className="twv-agent-block twv-collapsible twv-code-block">
      <button className="twv-collapsible__header" onClick={() => setCollapsed(c => !c)}>
        <span className={`twv-collapsible__chevron ${collapsed ? '' : 'twv-collapsible__chevron--open'}`}>&#x25B6;</span>
        <span className="twv-collapsible__summary">Code</span>
        <span className="twv-collapsible__meta">
          {lineCount} line{lineCount !== 1 ? 's' : ''}
          {streaming && <span className="twv-streaming-icon"> &#x27F3;</span>}
        </span>
      </button>
      {!collapsed && (
        <div className="twv-collapsible__body">
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
    <div className="twv-agent-block twv-collapsible twv-read-block">
      <button className="twv-collapsible__header" onClick={() => setCollapsed(c => !c)}>
        <span className={`twv-collapsible__chevron ${collapsed ? '' : 'twv-collapsible__chevron--open'}`}>&#x25B6;</span>
        <span className="twv-collapsible__summary">Read &mdash; {summary}</span>
      </button>
      {!collapsed && (
        <div className="twv-collapsible__body">
          <pre>{JSON.stringify(payload, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

function ErrorBlockUI({ error }: { error: { type: string; message: string; line: number; source: string } }) {
  const [collapsed, setCollapsed] = useState(true)

  return (
    <div className="twv-agent-block twv-collapsible twv-error-block">
      <button className="twv-collapsible__header" onClick={() => setCollapsed(c => !c)}>
        <span className={`twv-collapsible__chevron ${collapsed ? '' : 'twv-collapsible__chevron--open'}`}>&#x25B6;</span>
        <span className="twv-collapsible__summary">Error &mdash; {error.type}: {error.message}</span>
      </button>
      {!collapsed && (
        <div className="twv-collapsible__body twv-error-block__body">
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{error.type}</div>
          <div style={{ marginBottom: 8 }}>{error.message}</div>
          <div className="twv-error-block__source">
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
    <div className={`twv-agent-block twv-collapsible twv-hook-block ${isInterruptive ? `twv-hook-block--${action}` : ''}`}>
      <button className="twv-collapsible__header" onClick={() => setCollapsed(c => !c)}>
        <span className={`twv-collapsible__chevron ${collapsed ? '' : 'twv-collapsible__chevron--open'}`}>&#x25B6;</span>
        <span className="twv-collapsible__summary">
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
        <div className="twv-collapsible__body" style={{ padding: '8px 12px', fontSize: 13 }}>
          {detail}
        </div>
      )}
    </div>
  )
}

// ── Comment / code splitting ──

interface Segment {
  type: 'comment' | 'code'
  content: string
}

function splitCodeAndComments(code: string, streaming: boolean): Segment[] {
  const rawLines = code.split('\n')
  const lastIncomplete = streaming ? rawLines.pop() ?? '' : null

  const segments: Segment[] = []
  let buf: string[] = []
  let bufType: 'comment' | 'code' | null = null

  for (const line of rawLines) {
    const trimmed = line.trim()
    if (trimmed === '') {
      buf.push(line)
      continue
    }

    const isCommentOnly = trimmed.startsWith('//') && !trimmed.startsWith('///')
    const lineType: 'comment' | 'code' = isCommentOnly ? 'comment' : 'code'

    if (lineType !== bufType) {
      if (bufType && buf.length > 0) flushSegment(segments, bufType, buf)
      bufType = lineType
      buf = [line]
    } else {
      buf.push(line)
    }
  }

  if (bufType && buf.length > 0) flushSegment(segments, bufType, buf)

  if (lastIncomplete !== null && lastIncomplete.trim()) {
    segments.push({ type: 'code', content: lastIncomplete })
  }

  return segments
}

function flushSegment(segments: Segment[], type: 'comment' | 'code', lines: string[]) {
  if (type === 'comment') {
    const text = lines
      .map(l => l.trim().replace(/^\/\/\s?/, ''))
      .join('\n')
      .trim()
    if (text) segments.push({ type: 'comment', content: text })
  } else {
    const content = lines.join('\n').trim()
    if (content) segments.push({ type: 'code', content })
  }
}

function CodeWithComments({ code, id, lineCount, streaming }: { code: string; id: string; lineCount: number; streaming: boolean }) {
  const segments = splitCodeAndComments(code, streaming)

  if (segments.length === 1 && segments[0].type === 'code') {
    return <CodeBlockUI code={segments[0].content} lineCount={lineCount} streaming={streaming} />
  }

  if (segments.length === 0) return null

  return (
    <>
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1
        if (seg.type === 'comment') {
          return <AgentComment key={`${id}_seg_${i}`} text={seg.content} />
        }
        const segLineCount = seg.content.split('\n').filter(l => l.trim().length > 0).length
        return (
          <CodeBlockUI
            key={`${id}_seg_${i}`}
            code={seg.content}
            lineCount={segLineCount}
            streaming={streaming && isLast}
          />
        )
      })}
    </>
  )
}

function AgentComment({ text }: { text: string }) {
  return (
    <div className="twv-agent-comment">
      <div className="twv-agent-comment__inner">{text}</div>
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
