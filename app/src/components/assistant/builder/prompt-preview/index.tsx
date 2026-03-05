interface PromptPreview {
  generatedPrompt: string
  tokenCount?: number
  domains?: string[]
}

interface PromptPreviewPanelProps {
  promptPreview?: PromptPreview
  onGenerate: () => void
}

export function PromptPreviewPanel({ promptPreview, onGenerate }: PromptPreviewPanelProps) {
  const hasPreview = promptPreview?.generatedPrompt && promptPreview.generatedPrompt.length > 0

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="panel__header">
        <div className="stack stack--row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="label label--sm">System Prompt</h3>
          <div className="stack stack--row stack--gap-sm" style={{ alignItems: 'center' }}>
            {hasPreview && promptPreview?.tokenCount && (
              <span className="caption caption--muted">~{promptPreview.tokenCount} tokens</span>
            )}
            <button onClick={onGenerate} className="btn btn--ghost btn--sm" title="Regenerate preview">↻</button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {!hasPreview ? (
          <div className="stack" style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📝</div>
            <h4 className="label">No preview available</h4>
            <p className="caption caption--muted" style={{ maxWidth: '200px', margin: '0 auto' }}>
              Select areas and fill forms to generate the system prompt
            </p>
          </div>
        ) : (
          <div>
            <div className="code-block" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {promptPreview?.generatedPrompt || ''}
              </pre>
            </div>

            {promptPreview?.domains && promptPreview.domains.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.75rem' }}>
                {promptPreview.domains.map((domain, idx) => (
                  <span key={idx} className="badge badge--muted" style={{ fontSize: '0.625rem' }}>
                    {domain}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {hasPreview && (
        <div className="card__footer">
          <p className="caption caption--muted" style={{ textAlign: 'center' }}>
            Preview updates automatically as you configure your assistant
          </p>
        </div>
      )}
    </div>
  )
}
