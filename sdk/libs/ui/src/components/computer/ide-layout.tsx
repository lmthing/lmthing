import '@lmthing/css/components/computer/ide-layout.css'
import { CozyThingText } from '@lmthing/ui/elements/branding/cozy-text'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Badge } from '../../elements/content/badge'
import { Loader2 } from 'lucide-react'
import { IdeFileTree, type FileTreeNode } from './ide-file-tree'
import { IdeEditor } from './ide-editor'
import { IdeTerminal, type TerminalTab } from './ide-terminal'

export type { TerminalTab }

export interface IdeLayoutProps {
  // Status
  status: string
  isBooting: boolean
  isInstalling: boolean

  // File tree
  fileTree: FileTreeNode[]
  activeFile: string | null
  onFileSelect: (path: string) => void
  onCreateFile: (parentPath: string, name: string) => void
  onCreateDirectory: (parentPath: string, name: string) => void
  onDelete: (path: string) => void

  // Editor
  openFiles: string[]
  fileContents: Record<string, string>
  onEditorFileSelect: (path: string) => void
  onFileClose: (path: string) => void
  onContentChange: (path: string, content: string) => void

  // Terminal tabs
  terminalTabs: TerminalTab[]
  activeTerminalTabId: string | null
  onTerminalTabSelect: (id: string) => void
  onTerminalTabClose: (id: string) => void
  onAddTerminalTab: () => void

  // Restart
  onRestart?: () => void
  restarting?: boolean
}

function IdeLayout(props: IdeLayoutProps) {
  const { status, isBooting, isInstalling, onRestart, restarting } = props

  return (
    <div className="ide-layout">
      <div className="ide-layout__header">
        <span className="ide-layout__title"><CozyThingText text="lmthing.computer" /></span>
        <div className="ide-layout__status">
          {(isBooting || isInstalling) && <Loader2 size={14} className="animate-spin" />}
          {isBooting && 'Booting...'}
          {isInstalling && 'Installing dependencies...'}
          {!isBooting && !isInstalling && (
            <Badge variant={status === 'running' ? 'success' : 'muted'}>{status}</Badge>
          )}
          {onRestart && (
            <button
              onClick={restarting ? undefined : onRestart}
              disabled={restarting}
              className="ide-layout__restart-btn"
              title="Restart CLI process (reloads .env)"
            >
              {restarting ? '↻' : '⏻'}
            </button>
          )}
        </div>
      </div>
      <div className="ide-layout__body">
        <PanelGroup direction="horizontal">
          <Panel defaultSize={15} minSize={10} maxSize={30}>
            <IdeFileTree
              fileTree={props.fileTree}
              activeFile={props.activeFile}
              onFileSelect={props.onFileSelect}
              onCreateFile={props.onCreateFile}
              onCreateDirectory={props.onCreateDirectory}
              onDelete={props.onDelete}
            />
          </Panel>

          <PanelResizeHandle className="ide-layout__resize-handle--horizontal" />

          <Panel defaultSize={85} minSize={50}>
            <PanelGroup direction="vertical">
              <Panel defaultSize={70} minSize={30}>
                <IdeEditor
                  openFiles={props.openFiles}
                  activeFile={props.activeFile}
                  fileContents={props.fileContents}
                  onFileSelect={props.onEditorFileSelect}
                  onFileClose={props.onFileClose}
                  onContentChange={props.onContentChange}
                />
              </Panel>

              <PanelResizeHandle className="ide-layout__resize-handle--vertical" />

              <Panel defaultSize={30} minSize={15}>
                <IdeTerminal
                  tabs={props.terminalTabs}
                  activeTabId={props.activeTerminalTabId}
                  onTabSelect={props.onTerminalTabSelect}
                  onTabClose={props.onTerminalTabClose}
                  onAddTab={props.onAddTerminalTab}
                />
              </Panel>
            </PanelGroup>
          </Panel>

        </PanelGroup>
      </div>
    </div>
  )
}

export { IdeLayout }
