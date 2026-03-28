import '@lmthing/css/components/computer/ide-preview.css'
import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'

export interface IdePreviewProps {
  url: string | null
}

function IdePreview({ url }: IdePreviewProps) {
  const [iframeKey, setIframeKey] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [iframeSrc, setIframeSrc] = useState<string | null>(null)

  // When server-ready URL arrives, populate address bar and iframe
  useEffect(() => {
    if (url && !iframeSrc) {
      setIframeSrc(url)
      setInputValue(url)
    }
  }, [url, iframeSrc])

  const navigate = () => {
    if (inputValue) {
      setIframeSrc(inputValue)
      setIframeKey((k) => k + 1)
    }
  }

  return (
    <div className="ide-preview">
      <div className="ide-preview__header">
        <button
          className="ide-preview__refresh"
          title="Refresh"
          onClick={() => setIframeKey((k) => k + 1)}
          disabled={!iframeSrc}
        >
          <RefreshCw size={13} />
        </button>
        <input
          className="ide-preview__url"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') navigate() }}
          placeholder="Starting dev server..."
        />
      </div>
      {iframeSrc ? (
        <iframe
          key={iframeKey}
          src={iframeSrc}
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
