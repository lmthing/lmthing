import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import type { SessionStatus } from '@lmthing/repl'
import type { AgentAction } from '../rpc-client'

interface InputBarProps {
  onSend: (text: string) => void
  onPause: () => void
  onResume: () => void
  status: SessionStatus
  disabled: boolean
  actions?: AgentAction[]
}

const PLACEHOLDERS: Record<string, string> = {
  idle: 'Send a message...',
  executing: 'Send a message to the agent...',
  waiting_for_input: 'Or type a message instead...',
  paused: 'The agent is paused. Type your message...',
  complete: 'Send a follow-up...',
  error: 'Send a message to retry...',
}

export function InputBar({ onSend, onPause, onResume, status, disabled, actions = [] }: InputBarProps) {
  const [text, setText] = useState('')
  const [showActions, setShowActions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Filter actions based on what the user has typed after /
  const filteredActions = useMemo(() => {
    if (!showActions || actions.length === 0) return []
    const slashMatch = text.match(/^\/(\S*)$/)
    if (!slashMatch) return []
    const query = slashMatch[1].toLowerCase()
    return actions.filter(a => a.id.toLowerCase().startsWith(query))
  }, [text, showActions, actions])

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed) return
    setShowActions(false)
    onSend(trimmed)
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [text, onSend])

  const selectAction = useCallback((action: AgentAction) => {
    setText(`/${action.id} `)
    setShowActions(false)
    textareaRef.current?.focus()
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Handle dropdown navigation
    if (showActions && filteredActions.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => (i - 1 + filteredActions.length) % filteredActions.length)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => (i + 1) % filteredActions.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        selectAction(filteredActions[selectedIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowActions(false)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend, showActions, filteredActions, selectedIndex, selectAction])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setText(value)

    // Show actions dropdown when typing / at start
    if (actions.length > 0 && /^\/\S*$/.test(value)) {
      setShowActions(true)
      setSelectedIndex(0)
    } else {
      setShowActions(false)
    }

    // Auto-resize
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 200) + 'px'
    }
  }, [actions.length])

  // Keyboard shortcut: Ctrl+Shift+P to toggle pause
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault()
        if (status === 'executing') onPause()
        else if (status === 'paused') onResume()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [status, onPause, onResume])

  // Close dropdown on blur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current !== e.target
      ) {
        setShowActions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const showPause = status === 'executing'
  const showResume = status === 'paused'
  const placeholder = PLACEHOLDERS[status] ?? PLACEHOLDERS.idle

  return (
    <div className="input-bar" style={{ position: 'relative' }}>
      {showActions && filteredActions.length > 0 && (
        <div
          ref={dropdownRef}
          className="actions-dropdown"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 24,
            right: 24,
            marginBottom: 4,
            background: 'var(--surface-primary)',
            border: '1px solid var(--border-form)',
            borderRadius: 'var(--radius-input)',
            boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
            maxHeight: 200,
            overflowY: 'auto',
            zIndex: 10,
          }}
        >
          {filteredActions.map((action, i) => (
            <div
              key={action.id}
              onClick={() => selectAction(action)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                background: i === selectedIndex ? 'var(--surface-agent)' : 'transparent',
                display: 'flex',
                gap: 8,
                alignItems: 'baseline',
                fontSize: 14,
              }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span style={{ fontWeight: 600, color: 'var(--accent)' }}>/{action.id}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{action.label}</span>
            </div>
          ))}
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        aria-label="Message input"
      />
      {showPause && (
        <button className="btn-pause" onClick={onPause} aria-label="Pause agent execution">
          Pause
        </button>
      )}
      {showResume && (
        <button className="btn-pause" onClick={onResume} aria-label="Resume agent execution">
          Resume
        </button>
      )}
      <button
        className="btn-send"
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        aria-label="Send message"
      >
        Send
      </button>
    </div>
  )
}
