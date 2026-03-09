/**
 * ChatFAB - Floating action button for testing agent in chat.
 * US-208 / C9: Fixed bottom-right, violet accent, icon + label.
 */
import { MessageCircle } from 'lucide-react'

export interface ChatFABProps {
  onClick: () => void
}

export function ChatFAB({ onClick }: ChatFABProps) {
  return (
    <button
      onClick={onClick}
      title="Chat with this agent"
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        height: '3rem',
        paddingLeft: '1rem',
        paddingRight: '1.25rem',
        borderRadius: 'var(--radius-full)',
        backgroundColor: 'var(--color-agent)',
        color: 'var(--color-agent-foreground)',
        border: 'none',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.9375rem',
        fontWeight: 600,
        boxShadow: '0 4px 12px color-mix(in srgb, var(--color-agent) 35%, transparent)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        zIndex: 50,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'scale(1.05)'
        e.currentTarget.style.boxShadow = '0 6px 20px color-mix(in srgb, var(--color-agent) 45%, transparent)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'scale(1)'
        e.currentTarget.style.boxShadow = '0 4px 12px color-mix(in srgb, var(--color-agent) 35%, transparent)'
      }}
    >
      <MessageCircle style={{ width: '1.25rem', height: '1.25rem' }} />
      Chat
    </button>
  )
}
