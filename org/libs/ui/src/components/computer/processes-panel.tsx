import '@lmthing/css/components/computer/processes-panel.css'
import { Panel, PanelHeader, PanelBody } from '../../elements/content/panel'
import { ListItem } from '../../elements/content/list-item'
import { Caption } from '../../elements/typography/caption'
import { Heading } from '../../elements/typography/heading'

export interface RuntimeProcess {
  pid: number
  command: string
  cpu: number | null
  memoryMB: number | null
}

export interface ProcessesPanelProps {
  processes: RuntimeProcess[]
}

function ProcessesPanel({ processes }: ProcessesPanelProps) {
  return (
    <Panel>
      <PanelHeader>
        <Heading level={4}>Processes</Heading>
        <Caption muted>{processes.length} running</Caption>
      </PanelHeader>
      <PanelBody>
        <div className="computer-processes-panel">
          {processes.length === 0 ? (
            <div className="computer-processes-panel__empty">No processes</div>
          ) : (
            processes.map((proc) => (
              <ListItem
                key={proc.pid}
                label={proc.command}
                meta={<Caption muted>PID {proc.pid}</Caption>}
              />
            ))
          )}
        </div>
      </PanelBody>
    </Panel>
  )
}

export { ProcessesPanel }
