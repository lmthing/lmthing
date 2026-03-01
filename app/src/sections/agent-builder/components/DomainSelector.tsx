import type { Domain } from '@/../product/sections/agent-builder/types'

interface DomainSelectorProps {
  domains: Domain[]
  selectedDomainIds: string[]
  onDomainsChange: (domainIds: string[]) => void
}

export function DomainSelector({ domains, selectedDomainIds, onDomainsChange }: DomainSelectorProps) {
  const toggleDomain = (domainId: string) => {
    const isSelected = selectedDomainIds.includes(domainId)
    const newSelection = isSelected
      ? selectedDomainIds.filter(id => id !== domainId)
      : [...selectedDomainIds, domainId]
    onDomainsChange(newSelection)
  }

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Knowledge</h2>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {selectedDomainIds.length} selected
          </span>
        </div>
        <button
          onClick={() => onDomainsChange([])}
          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          Clear all
        </button>
      </div>

      {/* Knowledge Pills - Scrollable */}
      <div className="px-6 pb-3">
        <div className="flex flex-wrap gap-2">
          {domains.map(domain => {
            const isSelected = selectedDomainIds.includes(domain.id)

            return (
              <button
                key={domain.id}
                onClick={() => toggleDomain(domain.id)}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150
                  ${isSelected
                    ? 'bg-violet-600 text-white shadow-sm'
                    : `bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700`
                  }
                `}
                title={domain.description}
              >
                <span className="text-sm">{domain.icon}</span>
                <span>{domain.name}</span>
                {isSelected && (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
