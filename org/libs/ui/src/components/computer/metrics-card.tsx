import '@lmthing/css/components/computer/metrics-card.css'
import { Card, CardHeader, CardBody } from '../../elements/content/card'
import { Caption } from '../../elements/typography/caption'
import { Heading } from '../../elements/typography/heading'

export interface MetricsCardProps {
  cpuPercent: number | null
  memoryUsedMB: number | null
  memoryTotalMB: number | null
}

function MetricsCard({ cpuPercent, memoryUsedMB, memoryTotalMB }: MetricsCardProps) {
  const memPercent = memoryUsedMB != null && memoryTotalMB != null && memoryTotalMB > 0
    ? Math.round((memoryUsedMB / memoryTotalMB) * 100)
    : null

  return (
    <Card>
      <CardHeader>
        <Heading level={4}>Metrics</Heading>
      </CardHeader>
      <CardBody>
        <div className="computer-metrics-card">
          <div className="computer-metrics-card__row">
            <Caption muted>CPU</Caption>
            <Caption>{cpuPercent != null ? `${cpuPercent}%` : 'N/A'}</Caption>
          </div>
          {cpuPercent != null && (
            <div className="computer-metrics-card__bar">
              <div className="computer-metrics-card__bar-fill" style={{ width: `${cpuPercent}%` }} />
            </div>
          )}
          <div className="computer-metrics-card__row">
            <Caption muted>Memory</Caption>
            <Caption>
              {memoryUsedMB != null
                ? `${memoryUsedMB} MB${memoryTotalMB != null ? ` / ${memoryTotalMB} MB` : ''}`
                : 'N/A'}
            </Caption>
          </div>
          {memPercent != null && (
            <div className="computer-metrics-card__bar">
              <div className="computer-metrics-card__bar-fill" style={{ width: `${memPercent}%` }} />
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

export { MetricsCard }
