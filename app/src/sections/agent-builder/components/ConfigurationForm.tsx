import type { Domain, SchemaField, FormValues } from '@/../product/sections/agent-builder/types'

interface ConfigurationFormProps {
  selectedDomains: Domain[]
  fields: Array<SchemaField & { domainId: string; domainName: string }>
  formValues: FormValues
  validationErrors: Record<string, string>
  onFieldValueChange: (fieldId: string, value: string | string[] | boolean) => void
}

/**
 * ConfigurationForm - Dynamic form that generates fields based on selected domains
 *
 * Each selected domain contributes its schema fields to the form.
 * Fields are grouped by domain for clarity.
 */
export function ConfigurationForm({
  selectedDomains,
  fields,
  formValues,
  validationErrors,
  onFieldValueChange
}: ConfigurationFormProps) {

  const handleTextChange = (fieldId: string, value: string) => {
    onFieldValueChange(fieldId, value)
  }

  const handleSelectChange = (fieldId: string, value: string) => {
    onFieldValueChange(fieldId, value)
  }

  const handleMultiSelectToggle = (fieldId: string, option: string) => {
    const current = Array.isArray(formValues[fieldId]) ? formValues[fieldId] as string[] : []
    if (current.includes(option)) {
      onFieldValueChange(fieldId, current.filter(v => v !== option))
    } else {
      onFieldValueChange(fieldId, [...current, option])
    }
  }

  const handleToggleChange = (fieldId: string, checked: boolean) => {
    onFieldValueChange(fieldId, checked)
  }

  // Group fields by domain
  const fieldsByDomain = selectedDomains.map(domain => ({
    domain,
    fields: fields.filter(f => f.domainId === domain.id)
  }))

  // Empty state
  if (selectedDomains.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-900/30">
        <div className="text-center max-w-sm px-8">
          {/* Empty state illustration */}
          <div className="mx-auto mb-6 w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-500/20 to-amber-500/20 border border-slate-700 flex items-center justify-center">
            <svg className="w-12 h-12 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <h3 className="text-lg font-semibold text-slate-300 mb-2">
            No Knowledge Areas Selected
          </h3>
          <p className="text-sm text-slate-500">
            Select one or more knowledge areas from the catalog to begin configuring your agent.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-900/30">
      <div className="p-6 border-b border-slate-800">
        <h2 className="text-lg font-semibold text-slate-200">
          Configuration
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Fill out the form to customize your agent's behavior
        </p>
      </div>

      <div className="p-6 space-y-8">
        {fieldsByDomain.map(({ domain, fields: domainFields }) => (
          <div
            key={domain.id}
            className="bg-slate-800/40 rounded-xl border border-slate-700/50 overflow-hidden"
          >
            {/* Domain header */}
            <div className="px-5 py-3 bg-slate-800/60 border-b border-slate-700/50 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-violet-500" />
              <h3 className="font-medium text-slate-200">{domain.name}</h3>
              <span className="text-xs text-slate-500 ml-auto">
                {domainFields.length} field{domainFields.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Fields */}
            <div className="p-5 space-y-5">
              {domainFields.map(field => (
                <FormField
                  key={field.id}
                  field={field}
                  value={formValues[field.id] ?? field.default}
                  error={validationErrors[field.id]}
                  onTextChange={handleTextChange}
                  onSelectChange={handleSelectChange}
                  onMultiSelectToggle={handleMultiSelectToggle}
                  onToggleChange={handleToggleChange}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Form footer spacing */}
      <div className="h-8" />
    </div>
  )
}

interface FormFieldProps {
  field: SchemaField & { domainId: string; domainName: string }
  value: string | string[] | boolean
  error?: string
  onTextChange: (fieldId: string, value: string) => void
  onSelectChange: (fieldId: string, value: string) => void
  onMultiSelectToggle: (fieldId: string, option: string) => void
  onToggleChange: (fieldId: string, checked: boolean) => void
}

function FormField({
  field,
  value,
  error,
  onTextChange,
  onSelectChange,
  onMultiSelectToggle,
  onToggleChange
}: FormFieldProps) {
  const fieldId = field.id

  return (
    <div className={`
      ${error ? 'animate-pulse' : ''}
    `}>
      <label className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium text-slate-300">
          {field.label}
        </span>
        {field.required && (
          <span className="text-amber-500 text-xs">*</span>
        )}
      </label>

      {/* Text input */}
      {field.type === 'text' && (
        <input
          type="text"
          value={value as string}
          onChange={(e) => onTextChange(fieldId, e.target.value)}
          placeholder={field.placeholder}
          className={`
            w-full px-4 py-2.5 rounded-lg bg-slate-900/50 border text-sm text-slate-200
            placeholder-slate-600 transition-colors
            focus:outline-none focus:ring-2 focus:ring-violet-500/50
            ${error
              ? 'border-red-500/50 focus:border-red-500'
              : 'border-slate-700 focus:border-violet-500'
            }
          `}
        />
      )}

      {/* Textarea */}
      {field.type === 'textarea' && (
        <textarea
          value={value as string}
          onChange={(e) => onTextChange(fieldId, e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className={`
            w-full px-4 py-2.5 rounded-lg bg-slate-900/50 border text-sm text-slate-200
            placeholder-slate-600 transition-colors resize-none
            focus:outline-none focus:ring-2 focus:ring-violet-500/50
            ${error
              ? 'border-red-500/50 focus:border-red-500'
              : 'border-slate-700 focus:border-violet-500'
            }
          `}
        />
      )}

      {/* Select dropdown */}
      {field.type === 'select' && (
        <select
          value={value as string}
          onChange={(e) => onSelectChange(fieldId, e.target.value)}
          className={`
            w-full px-4 py-2.5 rounded-lg bg-slate-900/50 border text-sm text-slate-200
            transition-colors appearance-none cursor-pointer
            focus:outline-none focus:ring-2 focus:ring-violet-500/50
            ${error
              ? 'border-red-500/50 focus:border-red-500'
              : 'border-slate-700 focus:border-violet-500'
            }
          `}
        >
          {field.options?.map(option => (
            <option key={option} value={option} className="bg-slate-900">
              {option}
            </option>
          ))}
        </select>
      )}

      {/* Multi-select pills */}
      {field.type === 'multiselect' && (
        <div className="flex flex-wrap gap-2">
          {field.options?.map(option => {
            const isSelected = Array.isArray(value) && value.includes(option)
            return (
              <button
                key={option}
                type="button"
                onClick={() => onMultiSelectToggle(fieldId, option)}
                className={`
                  px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${isSelected
                    ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/25'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                  }
                `}
              >
                {option}
              </button>
            )
          })}
        </div>
      )}

      {/* Toggle switch */}
      {field.type === 'toggle' && (
        <button
          type="button"
          onClick={() => onToggleChange(fieldId, !value)}
          className={`
            relative w-12 h-6 rounded-full transition-colors duration-200
            ${value ? 'bg-violet-500' : 'bg-slate-700'}
          `}
        >
          <span
            className={`
              absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200
              ${value ? 'translate-x-6' : 'translate-x-0'}
            `}
          />
        </button>
      )}

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}
