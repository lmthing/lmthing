import '@lmthing/css/components/computer/connection-banner.css'
import { Button } from '../../elements/forms/button'
import { cn } from '../../lib/utils'

export type ConnectionState = 'connected' | 'error' | 'booting'

export interface ConnectionBannerProps {
  state: ConnectionState
  error?: string | null
  onRetry?: () => void
}

function ConnectionBanner({ state, error, onRetry }: ConnectionBannerProps) {
  if (state === 'connected') return null

  const isError = state === 'error'

  return (
    <div className={cn(
      'computer-connection-banner',
      isError && 'computer-connection-banner--error',
      state === 'booting' && 'computer-connection-banner--booting',
    )}>
      <span className="computer-connection-banner__message">
        <span className={cn(
          'computer-connection-banner__dot',
          isError && 'computer-connection-banner__dot--error',
          state === 'booting' && 'computer-connection-banner__dot--booting',
        )} />
        {isError
          ? (error ?? 'Connection lost. The runtime is not responding.')
          : 'Starting runtime...'}
      </span>
      {isError && onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}

export { ConnectionBanner }
