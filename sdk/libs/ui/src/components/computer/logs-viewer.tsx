import '@lmthing/css/components/computer/logs-viewer.css'
import { useRef, useEffect, useState } from 'react'
import { Panel, PanelHeader } from '../../elements/content/panel'
import { Button } from '../../elements/forms/button'
import { Heading } from '../../elements/typography/heading'
import { cn } from '../../lib/utils'

export interface LogEntry {
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'debug'
  source: string
  message: string
}

export interface LogsViewerProps {
  logs: LogEntry[]
}

type LogFilter = 'all' | 'info' | 'warn' | 'error' | 'debug'

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function LogsViewer({ logs }: LogsViewerProps) {
  const [filter, setFilter] = useState<LogFilter>('all')
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = filter === 'all' ? logs : logs.filter((l) => l.level === filter)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [filtered.length])

  return (
    <Panel>
      <PanelHeader>
        <Heading level={4}>Logs</Heading>
      </PanelHeader>
      <div className="computer-logs-viewer">
        <div className="computer-logs-viewer__toolbar">
          {(['all', 'info', 'warn', 'error', 'debug'] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'primary' : 'ghost'}
              onClick={() => setFilter(f)}
            >
              {f}
            </Button>
          ))}
        </div>
        <div ref={listRef} className="computer-logs-viewer__list">
          {filtered.length === 0 ? (
            <div className="computer-logs-viewer__empty">No logs</div>
          ) : (
            filtered.map((entry, i) => (
              <div key={i} className="computer-logs-viewer__entry">
                <span className="computer-logs-viewer__timestamp">{formatTime(entry.timestamp)}</span>
                <span className="computer-logs-viewer__source">[{entry.source}]</span>
                <span className={cn(
                  'computer-logs-viewer__message',
                  entry.level === 'warn' && 'computer-logs-viewer__message--warn',
                  entry.level === 'error' && 'computer-logs-viewer__message--error',
                )}>
                  {entry.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </Panel>
  )
}

export { LogsViewer }
