import type { SchemaField, FormFieldValue } from '@/../product/sections/agent-builder/types'

interface FormFieldProps {
  field: SchemaField
  value: FormFieldValue
  error?: string
  isRuntimeEnabled: boolean
  domainName: string
  onChange: (value: FormFieldValue) => void
  onToggleRuntime: () => void
}

export function FormField({
  field,
  value,
  error,
  isRuntimeEnabled,
  onChange,
  onToggleRuntime,
}: FormFieldProps) {
  const hasValue =
    value !== '' && value !== null && value !== undefined && (!Array.isArray(value) || value.length > 0)

  const baseInputClass =
    'w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600'

  const errorClass = error ? 'border-red-300 dark:border-red-700 focus:ring-red-500/50 focus:border-red-500' : ''

  // Runtime-enabled placeholder display
  if (isRuntimeEnabled) {
    return (
      <div className="group">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
            {field.label}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Ask User in Chat
            </span>
          </label>
          <button
            onClick={onToggleRuntime}
            className="text-xs px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
            title="Configure this field now instead of at runtime"
          >
            Edit Now
          </button>
        </div>
        <div className="p-4 rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-50/50 to-amber-100/30 dark:from-amber-950/30 dark:to-amber-900/20">
          <div className="flex flex-col items-center justify-center gap-2 py-2">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-center">
              <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Configured by User
              </span>
              <p className="text-xs text-amber-500/70 dark:text-amber-400/70 mt-0.5">
                This field will be filled during agent execution
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="group">
      {/* Label row */}
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
          {field.label}
          {field.required && <span className="text-red-500">*</span>}
        </label>
        {field.runtimeOptional !== false && (
          <button
            onClick={onToggleRuntime}
            className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all flex items-center gap-1"
            title="Enable this field to be configured at runtime"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Ask User in Chat
          </button>
        )}
      </div>

      {/* Field input */}
      <div className="relative">
        {renderFieldInput(field, value, onChange, baseInputClass, errorClass)}

        {/* Value indicator */}
        {hasValue && field.fieldType !== 'toggle' && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-500 dark:text-red-400 mt-1.5 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      )}

      {/* Helper text for multi-select */}
      {field.fieldType === 'multiselect' && Array.isArray(value) && value.length > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
          {value.length} option{value.length > 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  )
}

function renderFieldInput(
  field: SchemaField,
  value: FormFieldValue,
  onChange: (value: FormFieldValue) => void,
  baseClass: string,
  errorClass: string
) {
  const inputClass = `${baseClass} ${errorClass}`

  switch (field.fieldType) {
    case 'text':
      return (
        <input
          type="text"
          value={(value as string) || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
          className={inputClass}
        />
      )

    case 'textarea':
      return (
        <textarea
          value={(value as string) || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
          rows={4}
          className={`${inputClass} resize-y min-h-[100px]`}
        />
      )

    case 'select':
      return (
        <div className="relative">
          <select
            value={(value as string) || ''}
            onChange={e => onChange(e.target.value)}
            className={`${inputClass} appearance-none pr-10`}
          >
            <option value="">Select...</option>
            {field.options?.map(opt => (
              <option key={opt.id} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      )

    case 'multiselect': {
      const selectedValues = Array.isArray(value) ? value : []
      return (
        <div className="space-y-2">
          {/* Selected values as tags */}
          {selectedValues.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedValues.map(val => {
                // Look up by opt.value first (new format), fall back to opt.id (legacy)
                const opt = field.options?.find(o => o.value === val || o.id === val)
                const label = opt?.label || val
                return (
                  <span
                    key={val}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 text-xs font-medium"
                  >
                    {label}
                    <button
                      onClick={() => {
                        onChange(selectedValues.filter(v => v !== val))
                      }}
                      className="hover:text-violet-900 dark:hover:text-violet-300"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )
              })}
            </div>
          )}

          {/* Dropdown for selecting options */}
          <div className="relative">
            <select
              value=""
              onChange={e => {
                if (e.target.value && !selectedValues.includes(e.target.value)) {
                  onChange([...selectedValues, e.target.value])
                }
              }}
              className={`${inputClass} appearance-none pr-10`}
            >
              <option value="">Add option...</option>
              {field.options?.filter(opt => !selectedValues.includes(opt.value)).map(opt => (
                <option key={opt.id} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
          </div>
        </div>
      )
    }

    case 'toggle':
      return (
        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700 hover:bg-violet-50/50 dark:hover:bg-violet-900/10 transition-all">
          <div className="relative">
            <input
              type="checkbox"
              checked={value as boolean || false}
              onChange={e => onChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-gradient-to-r peer-checked:from-violet-500 peer-checked:to-violet-600 transition-all duration-200" />
            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-md transition-transform peer-checked:translate-x-5" />
          </div>
          <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">
            {(value as boolean) ? `Enabled` : `Disabled`}
          </span>
          {value && (
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium">
              Active
            </span>
          )}
        </label>
      )

    default:
      return null
  }
}
