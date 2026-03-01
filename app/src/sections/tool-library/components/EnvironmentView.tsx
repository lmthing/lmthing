import type { EnvironmentVariable } from '@/../product/sections/tool-library/types'
import { useState } from 'react'

interface EnvironmentViewProps {
  environmentVariables: EnvironmentVariable[]
  onAddEnvVariable?: (variable: Omit<EnvironmentVariable, 'usedBy'>) => void
  onUpdateEnvVariable?: (key: string, value: string) => void
  onDeleteEnvVariable?: (key: string) => void
}

export function EnvironmentView({
  environmentVariables,
  onAddEnvVariable,
  onUpdateEnvVariable,
  onDeleteEnvVariable
}: EnvironmentViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  // New variable form state
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newIsSecret, setNewIsSecret] = useState(false)

  const filteredVars = environmentVariables.filter(v =>
    v.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleAdd = () => {
    if (newKey.trim()) {
      onAddEnvVariable?.({
        key: newKey.trim(),
        value: newValue,
        description: newDescription || `Environment variable for ${newKey}`,
        isSecret: newIsSecret
      })
      setNewKey('')
      setNewValue('')
      setNewDescription('')
      setNewIsSecret(false)
      setShowAddForm(false)
    }
  }

  const handleStartEdit = (variable: EnvironmentVariable) => {
    setEditingKey(variable.key)
    setEditValue(variable.isSecret && variable.value.includes('***') ? '' : variable.value)
  }

  const handleSaveEdit = (key: string) => {
    onUpdateEnvVariable?.(key, editValue)
    setEditingKey(null)
    setEditValue('')
  }

  const handleCancelEdit = () => {
    setEditingKey(null)
    setEditValue('')
  }

  const secretsCount = environmentVariables.filter(v => v.isSecret).length

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-['Space_Grotesk']">
              Environment Variables
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Workspace-level configuration for tools (API keys, endpoints, secrets)
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              {secretsCount} secrets
            </div>
          </div>
        </div>

        {/* Search & Add */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search environment variables..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-0 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-violet-500 dark:focus:ring-violet-400 transition-all"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Variable
          </button>
        </div>
      </header>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900 px-8 py-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-amber-900 dark:text-amber-100 font-['Space_Grotesk']">
              Add Environment Variable
            </h3>
            <button
              onClick={() => {
                setShowAddForm(false)
                setNewKey('')
                setNewValue('')
                setNewDescription('')
                setNewIsSecret(false)
              }}
              className="p-1 hover:bg-amber-200 dark:hover:bg-amber-900 rounded transition-colors"
            >
              <svg className="w-5 h-5 text-amber-700 dark:text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
                Variable Name
              </label>
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/\s/g, '_'))}
                placeholder="API_KEY"
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 font-['JetBrains_Mono'] focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
                Value
              </label>
              <input
                type={newIsSecret ? 'password' : 'text'}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Enter value..."
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="What this variable is used for..."
              className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-3 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newIsSecret}
                onChange={(e) => setNewIsSecret(e.target.checked)}
                className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm text-amber-800 dark:text-amber-200">This is a secret (will be masked)</span>
            </label>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowAddForm(false)
                setNewKey('')
                setNewValue('')
                setNewDescription('')
                setNewIsSecret(false)
              }}
              className="px-4 py-2 text-sm text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!newKey.trim()}
              className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Variable
            </button>
          </div>
        </div>
      )}

      {/* Variables List */}
      <div className="flex-1 overflow-auto p-8">
        {filteredVars.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
            <span className="text-4xl mb-4">🔑</span>
            <p className="text-lg font-medium">No environment variables found</p>
            <p className="text-sm mt-1">Add your first variable to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 max-w-4xl">
            {filteredVars.map((variable) => (
              <VariableRow
                key={variable.key}
                variable={variable}
                isEditing={editingKey === variable.key}
                editValue={editValue}
                onEditChange={setEditValue}
                onStartEdit={() => handleStartEdit(variable)}
                onSave={() => handleSaveEdit(variable.key)}
                onCancelEdit={handleCancelEdit}
                onDelete={() => onDeleteEnvVariable?.(variable.key)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface VariableRowProps {
  variable: EnvironmentVariable
  isEditing: boolean
  editValue: string
  onEditChange: (value: string) => void
  onStartEdit: () => void
  onSave: () => void
  onCancelEdit: () => void
  onDelete: () => void
}

function VariableRow({
  variable,
  isEditing,
  editValue,
  onEditChange,
  onStartEdit,
  onSave,
  onCancelEdit,
  onDelete
}: VariableRowProps) {

  const displayValue = variable.isSecret && variable.value && !variable.value.includes('***')
    ? '•'.repeat(Math.min(variable.value.length, 24))
    : variable.value

  return (
    <div className={`
      bg-white dark:bg-slate-900 rounded-xl border-2 transition-all
      ${variable.isSecret
        ? 'border-amber-200 dark:border-amber-900'
        : 'border-slate-200 dark:border-slate-800'
      }
    `}>
      {isEditing ? (
        // Edit Mode
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <code className="text-sm font-['JetBrains_Mono'] text-slate-700 dark:text-slate-300">
              {variable.key}
            </code>
            <div className="flex items-center gap-2">
              <button
                onClick={onCancelEdit}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button
                onClick={onSave}
                className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/50 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          </div>
          <input
            type={variable.isSecret ? 'password' : 'text'}
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            placeholder="Enter new value..."
            autoFocus
            className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 border-0 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-violet-500 dark:focus:ring-violet-400 font-['JetBrains_Mono']"
          />
        </div>
      ) : (
        // View Mode
        <div className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              {/* Icon */}
              <div className={`
                w-11 h-11 rounded-lg flex items-center justify-center text-xl shrink-0
                ${variable.isSecret
                  ? 'bg-amber-100 dark:bg-amber-950/50'
                  : 'bg-slate-100 dark:bg-slate-800'
                }
              `}>
                {variable.isSecret ? '🔒' : '🔓'}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <code className="text-sm font-['JetBrains_Mono'] text-slate-900 dark:text-white">
                    {variable.key}
                  </code>
                  {variable.isSecret && (
                    <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 rounded-full font-medium">
                      Secret
                    </span>
                  )}
                  {!variable.value && (
                    <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full font-medium">
                      Empty
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                  {variable.description}
                </p>

                {/* Value Display */}
                <div className="flex items-center gap-2">
                  <code className={`
                    text-xs px-3 py-1.5 rounded-md font-['JetBrains_Mono']
                    ${variable.isSecret
                      ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }
                  `}>
                    {variable.value ? (
                      variable.isSecret && variable.value.includes('***')
                        ? variable.value
                        : variable.isSecret
                          ? '•'.repeat(24)
                          : variable.value.length > 40
                            ? variable.value.slice(0, 40) + '...'
                            : variable.value
                    ) : (
                      <span className="italic opacity-50">Not set</span>
                    )}
                  </code>
                </div>

                {/* Used By */}
                {variable.usedBy.length > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-slate-400">Used by:</span>
                    {variable.usedBy.map((toolId) => (
                      <span
                        key={toolId}
                        className="text-xs px-2 py-0.5 bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-300 rounded-md font-['JetBrains_Mono']"
                      >
                        {toolId}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={onStartEdit}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="Edit value"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                onClick={onDelete}
                className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                title="Delete variable"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
