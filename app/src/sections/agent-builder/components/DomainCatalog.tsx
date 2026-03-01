import type { Domain } from '@/../product/sections/agent-builder/types'
import { clsx } from 'clsx'
import type { ReactElement } from 'react'

interface DomainCatalogProps {
  domains: Domain[]
  categories: string[]
  selectedDomainIds: string[]
  onDomainsChange: (domainIds: string[]) => void
}

/**
 * Icon components for domain categories
 */
function ShieldIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function CloudIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}

function NetworkIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM10 8v4M8 10h4M8 18l-2 2M16 18l2 2" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
}

function CodeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

const iconMap: Record<string, () => ReactElement> = {
  shield: ShieldIcon,
  cloud: CloudIcon,
  lock: LockIcon,
  network: NetworkIcon,
  alert: AlertIcon,
  code: CodeIcon
}

/**
 * DomainCatalog - Sidebar for browsing and selecting domains
 *
 * Domains are grouped by category with multi-selection support.
 * Visual feedback indicates selected state.
 */
export function DomainCatalog({
  domains,
  categories,
  selectedDomainIds,
  onDomainsChange
}: DomainCatalogProps) {
  const toggleDomain = (domainId: string) => {
    if (selectedDomainIds.includes(domainId)) {
      onDomainsChange(selectedDomainIds.filter(id => id !== domainId))
    } else {
      onDomainsChange([...selectedDomainIds, domainId])
    }
  }

  const groupedDomains = categories.map(category => ({
    category,
    domains: domains.filter(d => d.category === category)
  }))

  return (
    <aside className="w-72 bg-slate-900/50 border-r border-slate-800 overflow-y-auto">
      <div className="p-4 border-b border-slate-800">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Knowledge
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {selectedDomainIds.length} selected
        </p>
      </div>

      <div className="p-2 space-y-4">
        {groupedDomains.map(({ category, domains: categoryDomains }) => (
          <div key={category}>
            <h3 className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {category}
            </h3>
            <div className="space-y-1">
              {categoryDomains.map(domain => {
                const Icon = iconMap[domain.icon ?? ''] || ShieldIcon
                const isSelected = selectedDomainIds.includes(domain.id)

                const buttonClasses = clsx(
                  'w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200',
                  'flex items-start gap-3 group relative',
                  isSelected && 'bg-violet-500/20 text-violet-300 border border-violet-500/40',
                  !isSelected && 'bg-slate-800/40 text-slate-400 border border-transparent hover:border-slate-700 hover:bg-slate-800 hover:text-slate-300'
                )

                const indicatorClasses = clsx(
                  'absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full transition-all duration-200',
                  isSelected ? 'bg-violet-500' : 'bg-transparent'
                )

                const iconWrapperClasses = clsx(
                  'flex-shrink-0 p-1.5 rounded-md transition-colors',
                  isSelected ? 'bg-violet-500/30 text-violet-300' : 'bg-slate-700/50 text-slate-500 group-hover:text-slate-400'
                )

                const tagClasses = (tagSelected: boolean) => clsx(
                  'text-[10px] px-1.5 py-0.5 rounded-full',
                  tagSelected ? 'bg-violet-500/20 text-violet-300' : 'bg-slate-700/50 text-slate-500'
                )

                return (
                  <button
                    key={domain.id}
                    onClick={() => toggleDomain(domain.id)}
                    className={buttonClasses}
                  >
                    {/* Selection indicator */}
                    <div className={indicatorClasses} />

                    {/* Icon */}
                    <div className={iconWrapperClasses}>
                      <Icon />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {domain.name}
                        </span>
                        {isSelected && (
                          <span className="flex-shrink-0 text-violet-400">
                            <CheckIcon />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                        {domain.description}
                      </p>
                      {/* Tags */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(domain.tags ?? []).slice(0, 3).map(tag => (
                          <span
                            key={tag}
                            className={tagClasses(isSelected)}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer info */}
      <div className="p-4 border-t border-slate-800">
        <p className="text-xs text-slate-600">
          Select knowledge to generate areas and blocks
        </p>
      </div>
    </aside>
  )
}
