import { useMemo } from 'react'
import { useWorkspaceData } from '@/lib/workspaceDataContext'
import { flattenEmptyFieldsForRuntime } from '@/lib/utils'
import type { Agent as DataAgent, AgentListItem } from '@/types/workspace-data'
import type { Agent as RuntimeAgent } from '@/../product/sections/agent-runtime/types'

/**
 * Maps a JSON data Agent to the runtime Agent shape expected by
 * RuntimePanel, ChatPanel, AgentList, etc.
 *
 * The JSON has: frontmatter, mainInstruction, slashActions, config, formValues, conversations
 * The runtime type needs: name, description, domains, runtimeFields, enabledTools, systemPrompt, etc.
 */
function toRuntimeAgent(agent: DataAgent): RuntimeAgent {
  return {
    id: agent.id,
    name: agent.frontmatter.name || agent.id,
    description: agent.frontmatter.description || '',
    domains: agent.frontmatter.selectedDomains || [],
    formValues: agent.formValues as Record<string, string | string[] | boolean>,
    // Fields listed in config.emptyFieldsForRuntime become runtime fields.
    // Supports both legacy flat array ["category/field"] and nested object { category: ["field"] }.
    runtimeFields: flattenEmptyFieldsForRuntime(agent.config?.emptyFieldsForRuntime).map((field: any) => {
      const fieldId = typeof field === 'string' ? field : field.id
      const label = typeof field === 'string' ? field : (field.label || field.id)
      const domain = typeof field === 'string' ? '' : (field.domain || '')

      // Try to find the value in formValues using the ID, or by stripping 'field-' prefix
      let value = agent.formValues?.[fieldId]
      if (value === undefined && fieldId.startsWith('field-')) {
        const strippedId = fieldId.replace('field-', '')
        value = agent.formValues?.[strippedId]
      }

      return {
        id: fieldId,
        label: label,
        type: 'text' as const, // Default to text, maybe should be more?
        value: (value as string | string[] | boolean) || '',
        domain: domain,
      }
    }),
    // No tool resolution from JSON for now — empty array avoids the crash
    enabledTools: [],
    systemPrompt: agent.mainInstruction || '',
    slashActions: (agent.slashActions || []).map((sa) => ({
      id: sa.actionId,
      actionId: sa.actionId,
      name: sa.name,
      description: sa.description,
      flowId: sa.flowId,
      agentId: agent.id,
      enabled: true,
    })),
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    status: 'ready' as const,
  }
}

/**
 * Hook to access agents from the workspace state (raw JSON shape)
 */
export function useAgents() {
  const { agents, agentList, isLoading, error, reload } = useWorkspaceData()

  return {
    agents,
    agentList,
    isLoading,
    error,
    reload,

    // Helper methods
    getAgent: (id: string) => agents[id],
    getAgentById: (id: string) => agents[id],
    getAgentsByDomain: (domainId: string) =>
      Object.values(agents).filter(agent =>
        agent.frontmatter.selectedDomains?.includes(domainId)
      ),
    hasAgent: (id: string) => id in agents,
    agentCount: Object.keys(agents).length,
  }
}

/**
 * Hook to access a single agent by ID (raw JSON shape)
 */
export function useAgent(id: string): DataAgent | null {
  const { agents } = useWorkspaceData()

  return useMemo(() => agents[id] || null, [agents, id])
}

/**
 * Hook to access agent with conversations (raw JSON shape)
 */
export function useAgentWithConversations(id: string) {
  const agent = useAgent(id)

  return useMemo(() => {
    if (!agent) return null

    return {
      ...agent,
      conversations: agent.conversations || [],
      hasConversations: (agent.conversations?.length || 0) > 0,
      conversationCount: agent.conversations?.length || 0,
    }
  }, [agent])
}

/**
 * Hook to get agent list item (simplified data for dashboard)
 */
export function useAgentList(): AgentListItem[] {
  const { agentList } = useWorkspaceData()
  return agentList
}

/**
 * Hook to get all agents mapped to the runtime Agent shape.
 * Use this anywhere RuntimePanel, ChatPanel, or AgentList is rendered.
 */
export function useRuntimeAgents(): RuntimeAgent[] {
  const { agents } = useWorkspaceData()

  return useMemo(
    () => Object.values(agents).map(toRuntimeAgent),
    [agents]
  )
}

/**
 * Hook to get a single agent mapped to the runtime Agent shape.
 */
export function useRuntimeAgent(id: string): RuntimeAgent | null {
  const { agents } = useWorkspaceData()

  return useMemo(() => {
    const agent = agents[id]
    return agent ? toRuntimeAgent(agent) : null
  }, [agents, id])
}
