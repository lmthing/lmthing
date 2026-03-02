import { useState } from 'react'
import { Save, X } from 'lucide-react'

interface SaveAgentInlineProps {
  onSave: (name: string, description: string) => void
  onCancel: () => void
}

export function SaveAgentInline({ onSave, onCancel }: SaveAgentInlineProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onSave(name.trim(), description.trim())
      setName('')
      setDescription('')
    }
  }

  return (
    <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 border-2 border-violet-200 dark:border-violet-800 rounded-xl p-5 mb-6 animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-500 rounded-lg">
            <Save className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Save Agent Configuration</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">Save for future reuse</p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 rounded-lg hover:bg-violet-200 dark:hover:bg-violet-900 text-slate-500 dark:text-slate-400 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Agent Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Security Auditor"
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-800 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:text-white transition-all text-sm"
            autoFocus
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Description (Optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this agent's purpose"
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-800 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:text-white transition-all resize-none h-20 text-sm"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-violet-500 rounded-lg hover:bg-violet-600 transition-colors shadow-lg shadow-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Agent
          </button>
        </div>
      </form>
    </div>
  )
}
