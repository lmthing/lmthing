import { Caption } from '@lmthing/ui/elements/typography/caption'
import '@lmthing/css/elements/content/card/index.css'

interface ThingMessageProps {
  role: 'user' | 'assistant'
  content: string
}

export function ThingMessage({ role, content }: ThingMessageProps) {
  const isUser = role === 'user'

  return (
    <div
      className="card"
      style={{
        maxWidth: '80%',
        marginLeft: isUser ? 'auto' : undefined,
        marginRight: isUser ? undefined : 'auto',
        background: isUser ? 'var(--color-primary, #8b5cf6)' : undefined,
        color: isUser ? 'white' : undefined,
      }}
    >
      <div className="card__body">
        <Caption
          muted={!isUser}
          style={{
            fontSize: '0.75rem',
            marginBottom: '0.25rem',
            color: isUser ? 'rgba(255,255,255,0.7)' : undefined,
          }}
        >
          {isUser ? 'You' : 'Assistant'}
        </Caption>
        <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem', lineHeight: '1.5' }}>
          {content}
        </div>
      </div>
    </div>
  )
}
