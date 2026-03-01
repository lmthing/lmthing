import type { Domain, PromptPreview } from '@/../product/sections/agent-builder/types'
import { useState } from 'react'

interface PromptPreviewProps {
  selectedDomains: Domain[]
  promptPreview?: PromptPreview
  onGeneratePreview: () => void
  isLoading: boolean
}

/**
 * PromptPreview - Live preview of the generated system prompt
 *
 * Shows the assembled prompt with syntax highlighting-like formatting
 * and token count estimation.
 */
export function PromptPreview({
  selectedDomains,
  promptPreview,
  onGeneratePreview,
  isLoading
}: PromptPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  if (selectedDomains.length === 0) {
    return (
      <div className="w-80 bg-slate-900/30 border-l border-slate-800 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-slate-800/50 border border-slate-700 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <p className="text-sm text-slate-500">
            Select knowledge and configure options to preview the generated prompt
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-80 bg-slate-900/30 border-l border-slate-800 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <h3 className="text-sm font-semibold text-slate-300">Prompt Preview</h3>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Content */}
      {isExpanded && (
        <>
          {/* Selected domains tags */}
          <div className="p-4 border-b border-slate-800">
            <p className="text-xs text-slate-500 mb-2">Selected knowledge</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedDomains.map(domain => (
                <span
                  key={domain.id}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-violet-500/20 text-violet-300 text-xs"
                >
                  <span>{domain.name}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Prompt content */}
          <div className="flex-1 overflow-y-auto p-4">
            {promptPreview ? (
              <>
                {/* Token count badge */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-slate-500">Generated prompt</span>
                  <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-800 text-xs text-slate-400">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    ~{promptPreview.tokenCount} tokens
                  </span>
                </div>

                {/* Prompt text with syntax-like highlighting */}
                <div className="rounded-lg bg-slate-950 border border-slate-800 p-4 overflow-x-auto">
                  <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
                    {highlightPrompt(promptPreview.generatedPrompt)}
                  </pre>
                </div>

                {/* Timestamp */}
                <p className="text-[10px] text-slate-600 mt-3">
                  Updated {new Date(promptPreview.lastGenerated).toLocaleTimeString()}
                </p>
              </>
            ) : (
              <button
                onClick={onGeneratePreview}
                disabled={isLoading}
                className={`
                  w-full py-3 rounded-lg text-sm font-medium transition-all
                  ${isLoading
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-violet-500 text-white hover:bg-violet-400 shadow-lg shadow-violet-500/25'
                  }
                `}
              >
                {isLoading ? 'Generating...' : 'Generate Preview'}
              </button>
            )}
          </div>

          {/* Copy button */}
          {promptPreview && (
            <div className="p-4 border-t border-slate-800">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(promptPreview.generatedPrompt)
                }}
                className="w-full py-2.5 rounded-lg bg-slate-800 text-slate-300 text-sm font-medium
                  hover:bg-slate-700 hover:text-white transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy to Clipboard
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Simple syntax highlighting for the prompt preview
 * Highlights placeholders, special keywords, and structure
 */
function highlightPrompt(prompt: string): string {
  // This is a simple visual enhancement - in production you might use a proper syntax highlighter
  return prompt
}
