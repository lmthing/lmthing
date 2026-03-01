import type { ToolPackage } from '@/../product/sections/tool-library/types'
import { useState } from 'react'

interface PackagesViewProps {
  packages: ToolPackage[]
  onInstallPackage?: (packageName: string) => void
  onUninstallPackage?: (packageName: string) => void
  onUpdatePackage?: (packageName: string) => void
  onSearchPackages?: (query: string) => void
}

export function PackagesView({
  packages,
  onInstallPackage,
  onUninstallPackage,
  onUpdatePackage,
  onSearchPackages
}: PackagesViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [installInput, setInstallInput] = useState('')
  const [showPreview, setShowPreview] = useState<ToolPackage | null>(null)
  const [filterInstalled, setFilterInstalled] = useState<'all' | 'installed' | 'available'>('all')

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    onSearchPackages?.(value)
  }

  const handleInstall = () => {
    if (installInput.trim()) {
      onInstallPackage?.(installInput.trim())
      setInstallInput('')
    }
  }

  const filteredPackages = packages.filter(pkg => {
    const matchesSearch = pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pkg.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesInstall = filterInstalled === 'all' ||
      (filterInstalled === 'installed' && pkg.installed) ||
      (filterInstalled === 'available' && !pkg.installed)
    return matchesSearch && matchesInstall
  })

  const installedCount = packages.filter(p => p.installed).length
  const availableUpdates = packages.filter(p => p.updateAvailable).length

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-['Space_Grotesk']">
              Packages
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Browse and install npm packages that provide tools
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500 dark:text-slate-400">{installedCount} installed</span>
              {availableUpdates > 0 && (
                <span className="px-2 py-1 bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 rounded-full text-xs font-medium">
                  {availableUpdates} update{availableUpdates > 1 ? 's' : ''} available
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Install by Name */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={installInput}
              onChange={(e) => setInstallInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInstall()}
              placeholder="Enter npm package name to install..."
              className="w-full pl-4 pr-32 py-3 bg-slate-100 dark:bg-slate-800 border-0 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-violet-500 dark:focus:ring-violet-400 transition-all font-['JetBrains_Mono'] text-sm"
            />
            <button
              onClick={handleInstall}
              disabled={!installInput.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-violet-600 hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Install
            </button>
          </div>
        </div>
      </header>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterInstalled('all')}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${filterInstalled === 'all'
                  ? 'bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }
              `}
            >
              All ({packages.length})
            </button>
            <button
              onClick={() => setFilterInstalled('installed')}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${filterInstalled === 'installed'
                  ? 'bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }
              `}
            >
              Installed ({installedCount})
            </button>
            <button
              onClick={() => setFilterInstalled('available')}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${filterInstalled === 'available'
                  ? 'bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }
              `}
            >
              Available ({packages.length - installedCount})
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search packages..."
              className="pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-0 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-violet-500 dark:focus:ring-violet-400 w-64"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          </div>
        </div>
      </div>

      {/* Package List */}
      <div className="flex-1 overflow-auto p-8">
        {filteredPackages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
            <span className="text-4xl mb-4">📦</span>
            <p className="text-lg font-medium">No packages found</p>
            <p className="text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 max-w-4xl">
            {filteredPackages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                package={pkg}
                onPreview={() => setShowPreview(pkg)}
                onInstall={() => onInstallPackage?.(pkg.name)}
                onUninstall={() => onUninstallPackage?.(pkg.name)}
                onUpdate={() => onUpdatePackage?.(pkg.name)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Package Preview Modal */}
      {showPreview && (
        <PackagePreviewModal
          package={showPreview}
          onClose={() => setShowPreview(null)}
          onInstall={() => {
            onInstallPackage?.(showPreview.name)
            setShowPreview(null)
          }}
        />
      )}
    </div>
  )
}

interface PackageCardProps {
  package: ToolPackage
  onPreview: () => void
  onInstall: () => void
  onUninstall: () => void
  onUpdate: () => void
}

function PackageCard({ package: pkg, onPreview, onInstall, onUninstall, onUpdate }: PackageCardProps) {
  return (
    <div className={`
      bg-white dark:bg-slate-900 rounded-xl p-5 border-2 transition-all
      ${pkg.installed
        ? 'border-slate-200 dark:border-slate-800'
        : 'border-dashed border-slate-300 dark:border-slate-700'
      }
    `}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4 flex-1">
          {/* Package Icon */}
          <div className={`
            w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0
            ${pkg.installed
              ? 'bg-violet-100 dark:bg-violet-950/50'
              : 'bg-slate-100 dark:bg-slate-800'
            }
          `}>
            {pkg.isBuiltin ? '⚙️' : '📦'}
          </div>

          {/* Package Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-slate-900 dark:text-white font-['Space_Grotesk'] font-['JetBrains_Mono'] text-sm">
                {pkg.name}
              </h3>
              {pkg.isBuiltin && (
                <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 rounded-full font-medium">
                  Built-in
                </span>
              )}
              {pkg.updateAvailable && (
                <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-300 rounded-full font-medium">
                  Update available
                </span>
              )}
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
              {pkg.description}
            </p>

            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-500">
              <span>v{pkg.version}</span>
              <span>by {pkg.author}</span>
              <span>{pkg.toolCount} tool{pkg.toolCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={onPreview}
            className="px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Preview
          </button>
          {pkg.installed ? (
            <>
              {pkg.updateAvailable && !pkg.isBuiltin && (
                <button
                  onClick={onUpdate}
                  className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                >
                  Update
                </button>
              )}
              {!pkg.isBuiltin && (
                <button
                  onClick={onUninstall}
                  className="px-4 py-2 text-sm bg-red-100 hover:bg-red-200 dark:bg-red-950/50 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg font-medium transition-colors"
                >
                  Uninstall
                </button>
              )}
            </>
          ) : (
            <button
              onClick={onInstall}
              className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600 text-white rounded-lg font-medium transition-colors"
            >
              Install
            </button>
          )}
        </div>
      </div>

      {/* Tools Preview */}
      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="flex flex-wrap gap-2">
          {pkg.tools.map((toolId) => (
            <span
              key={toolId}
              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs rounded-md font-['JetBrains_Mono']"
            >
              {toolId}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

interface PackagePreviewModalProps {
  package: ToolPackage
  onClose: () => void
  onInstall: () => void
}

function PackagePreviewModal({ package: pkg, onClose, onInstall }: PackagePreviewModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white font-['Space_Grotesk']">
            Package Preview
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Package Header */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center text-3xl">
              📦
            </div>
            <div>
              <h4 className="text-xl font-bold text-slate-900 dark:text-white font-['Space_Grotesk'] font-['JetBrains_Mono']">
                {pkg.name}
              </h4>
              <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                <span>by {pkg.author}</span>
                <span>•</span>
                <span>v{pkg.version}</span>
                {pkg.updateAvailable && (
                  <>
                    <span>•</span>
                    <span className="text-green-600 dark:text-green-400">v{pkg.latestVersion} available</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Description
            </h5>
            <p className="text-sm text-slate-700 dark:text-slate-300">{pkg.description}</p>
          </div>

          {/* Included Tools */}
          <div>
            <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Included Tools ({pkg.toolCount})
            </h5>
            <div className="space-y-2">
              {pkg.tools.map((toolId) => (
                <div
                  key={toolId}
                  className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                >
                  <span className="text-xl">{getToolIcon(toolId)}</span>
                  <code className="text-sm font-['JetBrains_Mono'] text-slate-700 dark:text-slate-300">
                    {toolId}
                  </code>
                </div>
              ))}
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <span className="text-xs text-slate-500 dark:text-slate-400 block">Current Version</span>
              <span className="text-sm font-medium text-slate-900 dark:text-white font-['JetBrains_Mono']">
                {pkg.version}
              </span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <span className="text-xs text-slate-500 dark:text-slate-400 block">Latest Version</span>
              <span className="text-sm font-medium text-slate-900 dark:text-white font-['JetBrains_Mono']">
                {pkg.latestVersion}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          {!pkg.installed && !pkg.isBuiltin && (
            <button
              onClick={onInstall}
              className="px-5 py-2.5 text-sm bg-violet-600 hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600 text-white rounded-lg font-medium transition-colors"
            >
              Install Package
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function getToolIcon(toolId: string): string {
  const icons: Record<string, string> = {
    'web-search': '🌐',
    'file-read': '📄',
    'http-request': '🌍',
    'database-query': '🗃️',
    'date-calculator': '📅',
    'code-execution': '⚡',
    'email-send': '✉️',
    'json-validator': '✓',
    'openai-chat': '🤖',
    'anthropic-chat': '🧠',
    'huggingface-inference': '🎨',
    'vector-search': '🔎',
    'google-sheets-read': '📊',
    'google-sheets-write': '📊',
    'excel-parse': '📈'
  }
  return icons[toolId] || '🔧'
}
