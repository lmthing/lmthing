import type { ToolLibraryProps, ToolLibraryView, Tool, ToolPackage, EnvironmentVariable } from '@/../product/sections/tool-library/types'
import { ToolsView } from './ToolsView'
import { PackagesView } from './PackagesView'
import { EnvironmentView } from './EnvironmentView'

export function ToolLibrary({
  tools,
  packages,
  environmentVariables,
  currentView = 'tools',
  onInstallPackage,
  onUninstallPackage,
  onUpdatePackage,
  onSearchPackages,
  onAddEnvVariable,
  onUpdateEnvVariable,
  onDeleteEnvVariable,
  onToggleTool,
  onChangeView,
  onSearchTools
}: ToolLibraryProps) {

  const handleViewChange = (view: ToolLibraryView) => {
    onChangeView?.(view)
  }

  const navItems: { id: ToolLibraryView; label: string; icon: string; count?: number }[] = [
    { id: 'tools', label: 'Tools', icon: 'wrench', count: tools.length },
    { id: 'packages', label: 'Packages', icon: 'cube', count: packages.filter(p => p.installed).length },
    { id: 'environment', label: 'Environment', icon: 'key' }
  ]

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-950">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white font-['Space_Grotesk']">
            Tool Library
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage function-calling tools
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = currentView === item.id
              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleViewChange(item.id)}
                    className={`
                      w-full flex items-center justify-between px-4 py-3 rounded-lg
                      font-medium text-sm transition-all duration-200
                      ${isActive
                        ? 'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 ring-1 ring-violet-200 dark:ring-violet-800'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }
                    `}
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-lg">{item.icon === 'wrench' ? '🔧' : item.icon === 'cube' ? '📦' : '🔑'}</span>
                      {item.label}
                    </span>
                    {item.count !== undefined && (
                      <span className={`
                        text-xs px-2 py-0.5 rounded-full
                        ${isActive
                          ? 'bg-violet-200 dark:bg-violet-800 text-violet-800 dark:text-violet-200'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }
                      `}>
                        {item.count}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer Info */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
            <span className="w-2 h-2 rounded-full bg-green-400"></span>
            <span>{tools.filter(t => t.status === 'enabled').length} tools enabled</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {currentView === 'tools' && (
          <ToolsView
            tools={tools}
            onToggleTool={onToggleTool}
            onSearchTools={onSearchTools}
          />
        )}
        {currentView === 'packages' && (
          <PackagesView
            packages={packages}
            onInstallPackage={onInstallPackage}
            onUninstallPackage={onUninstallPackage}
            onUpdatePackage={onUpdatePackage}
            onSearchPackages={onSearchPackages}
          />
        )}
        {currentView === 'environment' && (
          <EnvironmentView
            environmentVariables={environmentVariables}
            onAddEnvVariable={onAddEnvVariable}
            onUpdateEnvVariable={onUpdateEnvVariable}
            onDeleteEnvVariable={onDeleteEnvVariable}
          />
        )}
      </main>
    </div>
  )
}
