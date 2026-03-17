import { useState, useRef, useCallback, useEffect } from 'react'
import type { SessionStatus } from '../../session/types'

interface InputBarProps {
  onSend: (text: string) => void
  onPause: () => void
  onResume: () => void
  status: SessionStatus
  disabled: boolean
}

const PLACEHOLDERS: Record<string, string> = {
  idle: 'Send a message...',
  executing: 'Send a message to the agent...',
  waiting_for_input: 'Or type a message instead...',
  paused: 'The agent is paused. Type your message...',
  complete: 'Send a follow-up...',
  error: 'Send a message to retry...',
}

export function InputBar({ onSend, onPause, onResume, status, disabled }: InputBarProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [text, onSend])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  // Auto-resize textarea
  const handleInput = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [])

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

  const showPause = status === 'executing'
  const showResume = status === 'paused'
  const placeholder = PLACEHOLDERS[status] ?? PLACEHOLDERS.idle

  return (
    <div className="input-bar">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={e => { setText(e.target.value); handleInput() }}
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
