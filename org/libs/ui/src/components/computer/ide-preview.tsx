import '@lmthing/css/components/computer/ide-preview.css'
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'

export interface IdePreviewProps {
  url: string | null
}

function IdePreview({ url }: IdePreviewProps) {
  const [key, setKey] = useState(0)

  return (
    <div className="ide-preview">
      <div className="ide-preview__header">
        <span className="ide-preview__title">Preview</span>
        {url && (
          <button className="ide-preview__refresh" title="Refresh" onClick={() => setKey((k) => k + 1)}>
            <RefreshCw size={16} />
          </button>
        )}
      </div>
      {url ? (
        <iframe
          key={key}
          src={url}
          className="ide-preview__iframe"
          title="Preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
        />
      ) : (
        <div className="ide-preview__loading">Starting dev server...</div>
      )}
    </div>
  )
}

export { IdePreview }
