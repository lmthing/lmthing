import { useRef, useCallback } from 'react'
import type { SerializedJSX } from '@lmthing/repl'
import { JSXRenderer } from './JSXRenderer'

interface FormBlockProps {
  formId: string
  jsx: SerializedJSX
  status: 'active' | 'submitted' | 'timeout'
  isActive: boolean
  onSubmit: (formId: string, data: Record<string, unknown>) => void
  onCancel: (formId: string) => void
}

export function FormBlock({ formId, jsx, status, isActive, onSubmit, onCancel }: FormBlockProps) {
  const formRef = useRef<HTMLFormElement>(null)

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!formRef.current) return
    const formData = new FormData(formRef.current)
    const data: Record<string, unknown> = {}
    for (const [key, value] of formData.entries()) {
      data[key] = value
    }
    onSubmit(formId, data)
  }, [formId, onSubmit])

  const isSubmitted = status === 'submitted'
  const isTimedOut = status === 'timeout'

  return (
    <div className={`agent-block form-card ${isSubmitted ? 'submitted' : ''}`}>
      <form ref={formRef} onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <JSXRenderer jsx={jsx} />
        </div>
        {isActive && !isSubmitted && !isTimedOut && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => onCancel(formId)}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid var(--border-form)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-send"
              style={{
                padding: '8px 20px',
                borderRadius: 6,
                border: 'none',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Submit
            </button>
          </div>
        )}
        {isSubmitted && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            &#x2713; Submitted
          </div>
        )}
        {isTimedOut && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            No response — the agent continued with defaults.
          </div>
        )}
      </form>
    </div>
  )
}
