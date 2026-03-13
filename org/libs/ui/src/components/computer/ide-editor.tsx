import '@lmthing/css/components/computer/ide-editor.css'
import MonacoEditor from '@monaco-editor/react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface IdeEditorProps {
  openFiles: string[]
  activeFile: string | null
  fileContents: Record<string, string>
  onFileSelect: (path: string) => void
  onFileClose: (path: string) => void
  onContentChange: (path: string, content: string) => void
}

const LANG_MAP: Record<string, string> = {
  js: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  json: 'json', html: 'html', css: 'css',
  md: 'markdown', svg: 'xml',
}

function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return LANG_MAP[ext] || 'plaintext'
}

function IdeEditor({ openFiles, activeFile, fileContents, onFileSelect, onFileClose, onContentChange }: IdeEditorProps) {
  return (
    <div className="ide-editor">
      <div className="ide-editor__tabs">
        {openFiles.length === 0 ? (
          <div className="ide-editor__empty" style={{ padding: '0.5rem 1rem' }}>
            Select a file to edit
          </div>
        ) : (
          openFiles.map((file) => (
            <div
              key={file}
              className={cn('ide-editor__tab', activeFile === file && 'ide-editor__tab--active')}
              onClick={() => onFileSelect(file)}
            >
              <span>{file.split('/').pop()}</span>
              <button
                className="ide-editor__tab-close"
                onClick={(e) => { e.stopPropagation(); onFileClose(file) }}
              >
                <X size={14} />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="ide-editor__content">
        {activeFile ? (
          <MonacoEditor
            height="100%"
            language={getLanguage(activeFile)}
            value={fileContents[activeFile] || ''}
            onChange={(value) => {
              if (value !== undefined) onContentChange(activeFile, value)
            }}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              automaticLayout: true,
              tabSize: 2,
              scrollBeyondLastLine: false,
            }}
          />
        ) : (
          <div className="ide-editor__empty">No file open</div>
        )}
      </div>
    </div>
  )
}

export { IdeEditor }
