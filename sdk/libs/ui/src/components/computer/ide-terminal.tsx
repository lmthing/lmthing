import '@lmthing/css/components/computer/ide-terminal.css'
import { Terminal } from '../../elements/content/terminal'
import type { TerminalSession } from '../../elements/content/terminal'
import { X, Plus } from 'lucide-react'

export interface TerminalTab {
  id: string
  label: string
  session: TerminalSession | null
}

export interface IdeTerminalProps {
  tabs: TerminalTab[]
  activeTabId: string | null
  onTabSelect: (id: string) => void
  onTabClose?: (id: string) => void
  onAddTab?: () => void
}

function IdeTerminal({ tabs, activeTabId, onTabSelect, onTabClose, onAddTab }: IdeTerminalProps) {
  const resolvedActiveId = activeTabId ?? tabs[0]?.id ?? null

  return (
    <div className="ide-terminal">
      <div className="ide-terminal__tabs">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`ide-terminal__tab${tab.id === resolvedActiveId ? ' ide-terminal__tab--active' : ''}`}
            onClick={() => onTabSelect(tab.id)}
          >
            {tab.label}
            {onTabClose && tabs.length > 1 && (
              <button
                className="ide-terminal__tab-close"
                onClick={(e) => { e.stopPropagation(); onTabClose(tab.id) }}
                aria-label="Close tab"
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}
        {onAddTab && (
          <div className="ide-terminal__add" onClick={onAddTab} title="New terminal">
            <Plus size={13} />
          </div>
        )}
      </div>
      <div className="ide-terminal__body">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`ide-terminal__pane${tab.id !== resolvedActiveId ? ' ide-terminal__pane--hidden' : ''}`}
          >
            <Terminal session={tab.session} />
          </div>
        ))}
      </div>
    </div>
  )
}

export { IdeTerminal }
