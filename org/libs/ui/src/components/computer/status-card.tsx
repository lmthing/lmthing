import '@lmthing/css/components/computer/status-card.css'
import { Card, CardHeader, CardBody } from '../../elements/content/card'
import { Badge } from '../../elements/content/badge'
import { Caption } from '../../elements/typography/caption'
import { Heading } from '../../elements/typography/heading'
import { cn } from '../../lib/utils'

export type RuntimeStatus = 'booting' | 'running' | 'stopped' | 'error'
export type RuntimeTier = 'webcontainer' | 'flyio'

export interface StatusCardProps {
  status: RuntimeStatus
  tier: RuntimeTier
  uptime: number
}

function formatUptime(ms: number): string {
  if (ms <= 0) return '--'
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

function StatusCard({ status, tier, uptime }: StatusCardProps) {
  return (
    <Card>
      <CardHeader>
        <Heading level={4}>Status</Heading>
      </CardHeader>
      <CardBody>
        <div className="computer-status-card">
          <span className={cn(
            'computer-status-card__indicator',
            `computer-status-card__indicator--${status}`,
          )}>
            <span className={cn(
              'computer-status-card__dot',
              `computer-status-card__dot--${status}`,
            )} />
            {status}
          </span>
          <Badge variant={tier === 'flyio' ? 'primary' : 'muted'}>
            {tier === 'flyio' ? 'Computer' : 'Free'}
          </Badge>
          <Caption muted>Uptime: {formatUptime(uptime)}</Caption>
        </div>
      </CardBody>
    </Card>
  )
}

export { StatusCard }
