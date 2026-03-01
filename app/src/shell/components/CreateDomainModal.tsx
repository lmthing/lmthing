import { useState, useEffect } from 'react'
import { FolderPlus } from 'lucide-react'

interface CreateDomainModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (name: string, description: string) => void
}

export function CreateDomainModal({ isOpen, onClose, onSubmit }: CreateDomainModalProps) {
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')

    useEffect(() => {
        if (isOpen) {
            setName('')
            setDescription('')
        }
    }, [isOpen])

    if (!isOpen) return null

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (name.trim()) {
            onSubmit(name.trim(), description.trim())
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-full">
                            <FolderPlus className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Create Knowledge Area</h3>
                            <p className="text-emerald-100 text-sm mt-0.5">Define a new domain of knowledge</p>
                        </div>
                    </div>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Project Documentation"
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:text-white transition-all border-slate-300 dark:border-slate-600"
                            autoFocus
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Description (Optional)
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description of this knowledge area"
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:text-white transition-all border-slate-300 dark:border-slate-600 resize-none h-24"
                        />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!name.trim()}
                            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Create
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
