import type {
  AgentBuilderProps,
  AgentBuilderCallbacks,
} from '@/../product/sections/agent-builder/types'
import { DomainCatalog } from './DomainCatalog'
import { ConfigurationForm } from './ConfigurationForm'
import { PromptPreview } from './PromptPreview'
import { SavedAgentsList } from './SavedAgentsList'
import { AgentHeader } from './AgentHeader'

interface AgentBuilderFullProps extends AgentBuilderProps, AgentBuilderCallbacks {}

/**
 * AgentBuilder - Split-view interface for configuring specialized agents
 *
 * Features a domain catalog sidebar with multi-selection, dynamic form generation,
 * live prompt preview, and saved agents management.
 */
export function AgentBuilder({
  domains,
  savedAgentConfigs,
  selectedDomainIds = [],
  formValues = {},
  loadedAgentId = null,
  promptPreview,
  isLoading = false,
  validationErrors = {},
  onDomainsChange,
  onFieldValueChange,
  onGeneratePreview,
  onSaveAgent,
  onLoadAgent,
  onDeleteAgent,
  onNewAgent
}: AgentBuilderFullProps) {
  // Get selected domain objects
  const selectedDomains = domains.filter(d => selectedDomainIds.includes(d.id))

  // Collect all form fields from selected domains
  const allFields = selectedDomains.flatMap(domain =>
    domain.schema.fields.map(field => ({
      ...field,
      domainId: domain.id,
      domainName: domain.name
    }))
  )

  // Check if form is valid
  const isFormValid = allFields.every(field => {
    if (!field.required) return true
    const value = formValues[field.id]
    if (field.type === 'multiselect') return Array.isArray(value) && value.length > 0
    return value !== undefined && value !== '' && value !== false
  })

  // Get categories for domain grouping
  const categories = Array.from(new Set(domains.map(d => d.category)))

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <AgentHeader
        loadedAgentId={loadedAgentId}
        savedAgentConfigs={savedAgentConfigs}
        isFormValid={isFormValid}
        hasSelectedDomains={selectedDomainIds.length > 0}
        isLoading={isLoading}
        onSave={onSaveAgent}
        onNewAgent={onNewAgent}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Domain Catalog Sidebar */}
        <DomainCatalog
          domains={domains}
          categories={categories}
          selectedDomainIds={selectedDomainIds}
          onDomainsChange={onDomainsChange}
        />

        {/* Configuration Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Form Section */}
          <ConfigurationForm
            selectedDomains={selectedDomains}
            fields={allFields}
            formValues={formValues}
            validationErrors={validationErrors}
            onFieldValueChange={onFieldValueChange}
          />

          {/* Preview Section */}
          <PromptPreview
            selectedDomains={selectedDomains}
            promptPreview={promptPreview}
            onGeneratePreview={onGeneratePreview}
            isLoading={isLoading}
          />
        </div>

        {/* Saved Agents Drawer */}
        <SavedAgentsList
          agents={savedAgentConfigs}
          loadedAgentId={loadedAgentId}
          onLoadAgent={onLoadAgent}
          onDeleteAgent={onDeleteAgent}
        />
      </div>
    </div>
  )
}
