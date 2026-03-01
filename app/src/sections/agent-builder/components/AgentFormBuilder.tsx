import type {
  AgentBuilderScreenProps,
  Domain,
  SchemaField,
  SchemaNode,
  FormFieldValue,
  EnabledToolMapping,
} from '@/../product/sections/agent-builder/types'
import type { ToolConfigStatus } from '@/../product/sections/agent-builder/types'
import { useState, useCallback, useMemo } from 'react'
import { DomainSelector } from './DomainSelector'
import { FormField } from './FormField'
import { ToolsPanel } from './ToolsPanel'
import { ActionsPanel } from './ActionsPanel'
import { AgentRuntimePreviewModal } from './AgentRuntimePreviewModal'
import { SaveAgentModal } from './SaveAgentModal'

/**
 * Recursively extract all SchemaFields from a SchemaNode tree
 */
function extractFields(node: SchemaNode): SchemaField[] {
  if (node.type === 'field') {
    return [node]
  }
  // node.type === 'section' - recursively extract from children
  return node.children.flatMap(extractFields)
}

/**
 * Get all fields from a domain's schema
 */
function getDomainFields(domain: Domain): SchemaField[] {
  return extractFields(domain.schema.root)
}

function getFormFieldValue(values: any, id: string, variableName: string): any {
  if (!values) return undefined

  // Prefer direct key lookup first (supports flat keys like "section/field")
  if (Object.prototype.hasOwnProperty.call(values, id)) {
    return values[id]
  }

  // Fallback to direct variableName key (legacy/current mixed storage)
  if (Object.prototype.hasOwnProperty.call(values, variableName)) {
    return values[variableName]
  }

  // Try path-based resolution (e.g., classroom/class-size)
  const parts = id.split('/')
  let current = values
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part]
    } else {
      current = undefined
      break
    }
  }

  if (current !== undefined) return current

  return undefined
}

function resolveFieldOptionFilePaths(field: SchemaField, values: any): string[] {
  const value = getFormFieldValue(values, field.id, field.variableName)
  if (typeof value === 'boolean' || value === undefined || value === '') {
    return []
  }

  const selectedValues = Array.isArray(value) ? value : [value]

  return selectedValues
    .flatMap((selectedValue) =>
      field.options
        .filter(
          (option) =>
            option.id === selectedValue ||
            option.value === selectedValue ||
            option.label === selectedValue
        )
        .map((option) => option.filePath)
    )
    .filter(Boolean)
}

/**
 * Props for rendering a schema node (section or field)
 */
interface SchemaNodeRendererProps {
  node: SchemaNode
  formValues: Record<string, FormFieldValue>
  validationErrors: Record<string, string>
  emptyFieldsForRuntime: string[]
  domainName: string
  onFieldValueChange: (fieldId: string, value: FormFieldValue) => void
  onToggleRuntime: (fieldId: string) => void
}

/**
 * Recursively render a schema node (section or field)
 */
function SchemaNodeRenderer({ node, ...props }: SchemaNodeRendererProps) {
  if (node.type === 'field') {
    const fieldId = node.id
    const variableName = node.variableName
    const isRuntimeEnabled =
      props.emptyFieldsForRuntime.includes(fieldId) ||
      (!!variableName && props.emptyFieldsForRuntime.includes(variableName)) ||
      (!!variableName && props.emptyFieldsForRuntime.includes(`field-${variableName}`))

    return (
      <FormField
        key={fieldId}
        field={node}
        value={getFormFieldValue(props.formValues, fieldId, variableName)}
        error={props.validationErrors[variableName] || props.validationErrors[fieldId]}
        isRuntimeEnabled={isRuntimeEnabled}
        domainName={props.domainName}
        onChange={(val) => props.onFieldValueChange(fieldId, val)}
        onToggleRuntime={() => props.onToggleRuntime(fieldId)}
      />
    )
  }

  // node.type === 'section' - render section with nested children
  return (
    <div key={node.id} className="space-y-5">
      <div className="flex items-center gap-2">

        <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{node.label}</h5>
      </div>
      {node.description && (
        <p className="text-sm text-slate-500 dark:text-slate-400">{node.description}</p>
      )}
      {node.children.map((child) => (
        <SchemaNodeRenderer key={child.id} node={child} {...props} />
      ))}
    </div>
  )
}

/**
 * AgentFormBuilder - A multi-view control panel for configuring specialized agents
 *
 * Features:
 * - Main instruction textarea for custom agent instructions (markdown)
 * - Domain selection sidebar with expertise areas
 * - Auto-generated form fields grouped by domain
 * - Runtime field configuration mode
 * - Tool management with configuration status
 * - Slash action attachment for flows
 * - Live system prompt preview
 *
 * @props AgentBuilderScreenProps - All data and callbacks passed as props
 */
export function AgentFormBuilder(props: AgentBuilderScreenProps) {
  const {
    domains,
    toolLibrary,
    selectedDomainIds = [],
    formValues = {},
    enabledTools = [],
    emptyFieldsForRuntime = [],
    attachedFlows = [],
    availableFlows = [],
    mainInstruction = '',
    promptPreview,
    validationErrors = {},
    toolLibraryOpen = false,
    loadedAgentId = null,
    onSaveRuntimeConversation,
    onDomainsChange,
    onFieldValueChange,
    onEnableFieldForRuntime,
    onDisableFieldForRuntime,
    onMainInstructionChange,
    onOpenToolLibrary,
    onCloseToolLibrary,
    onAddTool,
    onRemoveTool,
    onConfigureTool,
    onGeneratePreview,
    onSaveAgent,
    onOpenFlowBuilder,
    onAttachFlow,
    onDetachFlow,
    onToggleSlashAction,
    onEditSlashAction,
  } = props

  // UI State
  const [activeTab, setActiveTab] = useState<'tools' | 'actions'>('actions')
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [runtimePreviewOpen, setRuntimePreviewOpen] = useState(false)
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set(selectedDomainIds))

  // Expand newly selected domains
  useState(() => {
    selectedDomainIds.forEach(id => {
      setExpandedDomains(prev => new Set([...prev, id]))
    })
  })

  // Toggle domain expansion
  const toggleDomainExpanded = useCallback((domainId: string) => {
    setExpandedDomains(prev => {
      const next = new Set(prev)
      if (next.has(domainId)) {
        next.delete(domainId)
      } else {
        next.add(domainId)
      }
      return next
    })
  }, [])

  // Get selected domain objects
  const selectedDomains = useMemo(
    () => domains.filter(d => selectedDomainIds.includes(d.id)),
    [domains, selectedDomainIds]
  )

  // Group domains by category
  const groupedDomains = useMemo(() => {
    return selectedDomains.reduce((acc, domain) => {
      const area = domain.category || 'General'
      if (!acc[area]) acc[area] = []
      acc[area].push(domain)
      return acc
    }, {} as Record<string, Domain[]>)
  }, [selectedDomains])

  const selectedDomainFields = useMemo(
    () =>
      selectedDomains.flatMap((domain) =>
        getDomainFields(domain).map((field) => ({ field, domainName: domain.name }))
      ),
    [selectedDomains]
  )

  const runtimeFieldEntries = useMemo(() => {
    const runtimeFieldIds = new Set(emptyFieldsForRuntime)
    return selectedDomainFields.filter(
      ({ field }) => runtimeFieldIds.has(field.variableName) || runtimeFieldIds.has(field.id)
    )
  }, [emptyFieldsForRuntime, selectedDomainFields])

  const enabledFilePaths = useMemo(() => {
    const paths = selectedDomainFields.flatMap(({ field }) =>
      resolveFieldOptionFilePaths(field, formValues)
    )
    return [...new Set(paths)].sort((a, b) => a.localeCompare(b))
  }, [selectedDomainFields, formValues])

  // Build enabled tool mappings with status
  const enabledToolMappings = useMemo(() => {
    return enabledTools
      .map(et => {
        const tool = toolLibrary.find(t => t.id === et.toolId)
        if (!tool) return null

        let status: ToolConfigStatus = 'installed'
        if (!tool.installed) {
          status = 'needs-config'
        } else if (tool.configRequired && !et.config) {
          status = 'needs-config'
        } else if (tool.installed) {
          status = 'ready'
        }

        return { tool, source: et.source, status }
      })
      .filter(Boolean) as EnabledToolMapping[]
  }, [enabledTools, toolLibrary])

  // Check if field is runtime-enabled (checks by variableName)
  const isRuntimeEnabled = useCallback(
    (variableName: string) => emptyFieldsForRuntime.includes(variableName),
    [emptyFieldsForRuntime]
  )

  // Handle field value change (receives variableName)
  const handleFieldValueChange = useCallback(
    (variableName: string, value: FormFieldValue) => {
      onFieldValueChange(variableName, value)
      // Trigger preview regeneration with debounce (handled by parent)
    },
    [onFieldValueChange]
  )

  // Handle runtime toggle (receives fieldId/path)
  const handleToggleRuntime = useCallback(
    (fieldId: string) => {
      // Find the field to get its variableName as fallback for check
      const fieldObj = selectedDomainFields.find(f => f.field.id === fieldId)?.field
      const variableName = fieldObj?.variableName

      const legacyFieldId = variableName ? `field-${variableName}` : undefined
      const isEnabled =
        emptyFieldsForRuntime.includes(fieldId) ||
        (variableName && emptyFieldsForRuntime.includes(variableName)) ||
        (legacyFieldId && emptyFieldsForRuntime.includes(legacyFieldId))

      if (isEnabled) {
        onDisableFieldForRuntime?.(fieldId)
        if (variableName) onDisableFieldForRuntime?.(variableName)
        if (legacyFieldId) onDisableFieldForRuntime?.(legacyFieldId)
      } else {
        onEnableFieldForRuntime?.(fieldId)
        onFieldValueChange(fieldId, '')
      }
    },
    [emptyFieldsForRuntime, selectedDomainFields, onEnableFieldForRuntime, onDisableFieldForRuntime, onFieldValueChange]
  )

  // Enable all fields in a domain for runtime (uses variableName)
  const handleEnableAllForRuntime = useCallback(
    (domain: Domain) => {
      getDomainFields(domain).forEach(field => {
        if (!isRuntimeEnabled(field.variableName) && field.runtimeOptional !== false) {
          onEnableFieldForRuntime?.(field.variableName)
          onFieldValueChange(field.variableName, '')
        }
      })
    },
    [isRuntimeEnabled, onEnableFieldForRuntime, onFieldValueChange]
  )

  // Handle save agent
  const handleSaveAgent = useCallback(
    (name: string, description: string) => {
      onSaveAgent(name, description)
      setSaveModalOpen(false)
    },
    [onSaveAgent]
  )

  const handleOpenRuntimePreview = useCallback(() => {
    onGeneratePreview?.()
    setRuntimePreviewOpen(true)
  }, [onGeneratePreview])

  const hasSelection = selectedDomains.length > 0

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Domain Selector - Top Bar */}
      <DomainSelector
        domains={domains}
        selectedDomainIds={selectedDomainIds}
        onDomainsChange={onDomainsChange}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center Panel - Agent Builder */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8">
            {/* Main Instruction Section */}
            <div className="mb-8">
              <label className="block mb-3">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Main Instructions</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">(optional)</span>
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
                  Write custom instructions for your agent in markdown. These will be prepended to the knowledge-specific prompts.
                </span>
              </label>
              <textarea
                value={mainInstruction}
                onChange={(e) => onMainInstructionChange?.(e.target.value)}
                placeholder={`# Your Agent Instructions

You are a specialized assistant. Write your custom instructions here in markdown format.

## Guidelines
- Be specific about the agent's role
- Define any special behaviors
- Include examples if helpful

These instructions will appear at the top of your agent's system prompt.`}
                rows={6}
                className="w-full px-4 py-3 text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent placeholder:text-slate-400 dark:placeholder:text-slate-500 font-mono leading-relaxed"
              />
            </div>

            {/* Empty State */}
            {!hasSelection && (
              <div className="text-center py-20">
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-100 to-violet-200 dark:from-violet-900/30 dark:to-violet-800/30 animate-pulse" />
                  <div className="absolute inset-2 rounded-xl bg-gradient-to-br from-violet-200 to-violet-300 dark:from-violet-800/50 dark:to-violet-900/50 flex items-center justify-center">
                    <svg className="w-8 h-8 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  No knowledge selected
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Choose expertise areas from the sidebar to configure your agent's capabilities
                </p>
              </div>
            )}

            {/* Form Sections by Area */}
            {hasSelection &&
              Object.entries(groupedDomains).map(([category, domains], categoryIdx) => (
                <div key={category} className="mb-10" style={{ animationDelay: `${categoryIdx * 50}ms` }}>
                  {/* Area Header */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent flex-1" />
                    <h3 className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-widest">
                      Area · {category}
                    </h3>
                    <div className="h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent flex-1" />
                  </div>

                  {/* Knowledge Cards */}
                  <div className="space-y-4">
                    {domains.map(domain => (
                      <div
                        key={domain.id}
                        className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-all duration-200 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-lg hover:shadow-violet-100/20 dark:hover:shadow-violet-900/10"
                      >
                        {/* Knowledge Header */}
                        <button
                          onClick={() => toggleDomainExpanded(domain.id)}
                          className="w-full px-6 py-4 flex items-center gap-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-900/20 dark:to-violet-800/20 flex items-center justify-center text-xl flex-shrink-0">
                            {domain.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-0.5">Knowledge</p>
                            <h4 className="font-semibold text-slate-800 dark:text-slate-200">
                              {domain.name}
                            </h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                              {domain.description}
                            </p>
                          </div>
                          {expandedDomains.has(domain.id) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEnableAllForRuntime(domain)
                              }}
                              className="mr-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors flex items-center gap-1.5"
                              title="Enable all fields in this knowledge area for runtime configuration"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              All By User
                            </button>
                          )}
                          <svg
                            className={`w-5 h-5 text-slate-400 transition-transform duration-200 flex-shrink-0 ${expandedDomains.has(domain.id) ? 'rotate-180' : ''
                              }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* Blocks */}
                        {expandedDomains.has(domain.id) && (
                          <div className="px-6 pb-6 border-t border-slate-100 dark:border-slate-800">
                            <div className="pt-5">
                              <SchemaNodeRenderer
                                node={domain.schema.root}
                                formValues={formValues}
                                validationErrors={validationErrors}
                                emptyFieldsForRuntime={emptyFieldsForRuntime}
                                domainName={domain.name}
                                onFieldValueChange={handleFieldValueChange}
                                onToggleRuntime={handleToggleRuntime}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </main>

        {/* Right Panel - Actions, Tools & Preview */}
        <aside className="w-80 flex-shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            {[
              { id: 'actions' as const, label: 'Actions', count: attachedFlows?.filter(f => f.slashAction.enabled).length || 0 },
              { id: 'tools' as const, label: 'Tools', count: enabledToolMappings.length },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-all relative ${activeTab === tab.id
                  ? 'text-violet-600 dark:text-violet-400 border-violet-600'
                  : 'text-slate-500 dark:text-slate-500 border-transparent hover:text-slate-700 dark:hover:text-slate-400'
                  }`}
              >
                <span className="flex items-center justify-center gap-2">
                  {tab.label}
                  {tab.count !== null && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id
                        ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </span>
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600 dark:bg-violet-400 rounded-t-full" />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'tools' && (
              <ToolsPanel
                toolLibrary={toolLibrary}
                enabledTools={enabledToolMappings}
                isOpen={toolLibraryOpen}
                onOpen={() => onOpenToolLibrary?.()}
                onClose={() => onCloseToolLibrary?.()}
                onAddTool={onAddTool}
                onRemoveTool={onRemoveTool}
                onConfigureTool={onConfigureTool}
              />
            )}

            {activeTab === 'actions' && (
              <ActionsPanel
                attachedFlows={attachedFlows || []}
                availableFlows={availableFlows || []}
                onToggleEnabled={onToggleSlashAction || (() => { })}
                onEditAction={(id) => onEditSlashAction?.(id)}
                onDetachFlow={onDetachFlow || (() => { })}
                onAttachFlow={onAttachFlow || (() => { })}
                onOpenFlowBuilder={onOpenFlowBuilder || (() => { })}
              />
            )}
          </div>

          <div className="p-4 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={handleOpenRuntimePreview}
              className="w-full px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Chat
            </button>
          </div>
        </aside>

        {/* Save Agent Modal */}
        <SaveAgentModal
          isOpen={saveModalOpen}
          onClose={() => setSaveModalOpen(false)}
          onSave={handleSaveAgent}
        />

        <AgentRuntimePreviewModal
          isOpen={runtimePreviewOpen}
          onClose={() => setRuntimePreviewOpen(false)}
          enabledFilePaths={enabledFilePaths}
          generatedPrompt={promptPreview?.generatedPrompt || ''}
          onSaveConversation={onSaveRuntimeConversation}
          canSaveConversation={Boolean(loadedAgentId && onSaveRuntimeConversation)}
          runtimeFields={runtimeFieldEntries.map(({ field, domainName }) => ({
            id: field.id,
            label: field.label,
            domain: domainName,
            fieldType: field.fieldType,
            placeholder: field.placeholder,
            options: field.options?.map((option) => option.label),
          }))}
        />
      </div>
    </div>
  )
}
