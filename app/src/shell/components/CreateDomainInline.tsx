import { useState } from 'react'
import { FolderPlus, X } from 'lucide-react'

interface CreateDomainInlineProps {
    onSubmit: (name: string, description: string) => void
    onCancel: () => void
}

export function CreateDomainInline({ onSubmit, onCancel }: CreateDomainInlineProps) {
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (name.trim()) {
            onSubmit(name.trim(), description.trim())
            setName('')
            setDescription('')
        }
    }

    return (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-2 border-emerald-200 dark:border-emerald-800 rounded-xl p-5 mb-6 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500 rounded-lg">
                        <FolderPlus className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Create Knowledge Area</h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400">Define a new domain of knowledge</p>
                    </div>
                </div>
                <button
                    onClick={onCancel}
                    className="p-1.5 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900 text-slate-500 dark:text-slate-400 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Project Documentation"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:text-white transition-all text-sm"
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
                        placeholder="Brief description of this knowledge area"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:text-white transition-all resize-none h-20 text-sm"
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
                        className="flex-1 px-3 py-2 text-sm font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Create Area
                    </button>
                </div>
            </form>
        </div>
    )
}
