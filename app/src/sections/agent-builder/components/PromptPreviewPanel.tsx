import type { PromptPreview } from '@/../product/sections/agent-builder/types'

interface PromptPreviewPanelProps {
  promptPreview?: PromptPreview
  onGenerate: () => void
}

export function PromptPreviewPanel({ promptPreview, onGenerate }: PromptPreviewPanelProps) {
  const hasPreview = promptPreview?.generatedPrompt && promptPreview.generatedPrompt.length > 0

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">System Prompt</h3>
          <div className="flex items-center gap-2">
            {hasPreview && promptPreview?.tokenCount && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                ~{promptPreview.tokenCount} tokens
              </span>
            )}
            <button
              onClick={onGenerate}
              className="p-1.5 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
              title="Regenerate preview"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Preview content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!hasPreview ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
              <span className="text-2xl">📝</span>
            </div>
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              No preview available
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[200px] mx-auto">
              Select areas and fill forms to generate the system prompt
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Decorative corner accents */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-violet-300 dark:border-violet-700 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-violet-300 dark:border-violet-700 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-violet-300 dark:border-violet-700 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-violet-300 dark:border-violet-700 rounded-br-lg" />

            {/* Prompt content */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 dark:from-slate-950 dark:to-black rounded-xl p-4 shadow-inner border border-slate-800">
              <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-words leading-relaxed max-h-[400px] overflow-y-auto">
                {promptPreview?.generatedPrompt || ''}
              </pre>
            </div>

            {/* Domains badge */}
            {promptPreview?.domains && promptPreview.domains.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {promptPreview.domains.map((domain, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] px-2 py-1 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 font-medium"
                  >
                    {domain}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer hint */}
      {hasPreview && (
        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-400 dark:text-slate-600 text-center">
            Preview updates automatically as you configure your agent
          </p>
        </div>
      )}
    </div>
  )
}
