import '@lmthing/css/components/computer/network-panel.css'
import { Panel, PanelHeader, PanelBody } from '../../elements/content/panel'
import { Badge } from '../../elements/content/badge'
import { Caption } from '../../elements/typography/caption'
import { Heading } from '../../elements/typography/heading'
import { cn } from '../../lib/utils'

export interface NetworkEntry {
  id: string
  timestamp: number
  method: string
  url: string
  status: number | null
  durationMs: number | null
  sizeBytes: number | null
}

export interface NetworkPanelProps {
  network: NetworkEntry[]
  unavailable?: boolean
}

function NetworkPanel({ network, unavailable }: NetworkPanelProps) {
  return (
    <Panel>
      <PanelHeader>
        <Heading level={4}>Network</Heading>
        <Caption muted>{network.length} requests</Caption>
      </PanelHeader>
      <PanelBody>
        <div className="computer-network-panel">
          {unavailable ? (
            <div className="computer-network-panel__empty">Not available on free tier</div>
          ) : network.length === 0 ? (
            <div className="computer-network-panel__empty">No requests</div>
          ) : (
            network.map((entry) => (
              <div key={entry.id} className="computer-network-panel__entry">
                <span className="computer-network-panel__method">{entry.method}</span>
                <span className="computer-network-panel__url">{entry.url}</span>
                {entry.status != null && (
                  <Badge variant={entry.status < 400 ? 'success' : 'default'}>
                    <span className={cn(
                      entry.status < 400 && 'computer-network-panel__status--ok',
                      entry.status >= 400 && 'computer-network-panel__status--error',
                    )}>
                      {entry.status}
                    </span>
                  </Badge>
                )}
                {entry.durationMs != null && (
                  <Caption muted>{entry.durationMs}ms</Caption>
                )}
              </div>
            ))
          )}
        </div>
      </PanelBody>
    </Panel>
  )
}

export { NetworkPanel }
