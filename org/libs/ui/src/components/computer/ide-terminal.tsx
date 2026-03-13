import '@lmthing/css/components/computer/ide-terminal.css'
import { Terminal } from '../../elements/content/terminal'
import type { TerminalSession } from '../../elements/content/terminal'

export interface IdeTerminalProps {
  session: TerminalSession | null
}

function IdeTerminal({ session }: IdeTerminalProps) {
  return (
    <div className="ide-terminal">
      <div className="ide-terminal__header">
        <span className="ide-terminal__title">Terminal</span>
      </div>
      <div className="ide-terminal__body">
        <Terminal session={session} />
      </div>
    </div>
  )
}

export { IdeTerminal }
