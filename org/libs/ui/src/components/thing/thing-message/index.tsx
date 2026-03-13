import { cn } from '@lmthing/ui/lib/utils'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import '@lmthing/css/components/thing/thing-message/index.css'
import '@lmthing/css/elements/content/card/index.css'

interface ThingMessageProps {
  role: 'user' | 'assistant'
  content: string
}

export function ThingMessage({ role, content }: ThingMessageProps) {
  const isUser = role === 'user'

  return (
    <div
      className={cn(
        'card',
        'thing-message',
        isUser ? 'thing-message--user' : 'thing-message--assistant',
      )}
    >
      <div className="card__body">
        <Caption
          muted={!isUser}
          className={cn('thing-message__role', isUser && 'thing-message__role--user')}
        >
          {isUser ? 'You' : 'Assistant'}
        </Caption>
        <div className="thing-message__content">
          {content}
        </div>
      </div>
    </div>
  )
}
