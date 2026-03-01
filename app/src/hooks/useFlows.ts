import { useMemo } from 'react'
import { useWorkspaceData } from '@/lib/workspaceDataContext'
import type { Flow, FlowListItem } from '@/types/workspace-data'

/**
 * Hook to access flows from the workspace state
 */
export function useFlows() {
  const { flows, flowList, isLoading, error, reload } = useWorkspaceData()

  return {
    flows,
    flowList,
    isLoading,
    error,
    reload,

    // Helper methods
    getFlow: (id: string) => flows[id],
    getFlowById: (id: string) => flows[id],
    getFlowsByAgent: (agentId: string) =>
      Object.values(flows).filter(flow =>
        flow.frontmatter.agentId === agentId || flow.frontmatter.scope === 'agent-specific'
      ),
    getFlowsByTag: (tag: string) =>
      Object.values(flows).filter(flow =>
        flow.frontmatter.tags?.includes(tag)
      ),
    getFlowsByStatus: (status: string) =>
      Object.values(flows).filter(flow =>
        flow.frontmatter.status === status
      ),
    hasFlow: (id: string) => id in flows,
    flowCount: Object.keys(flows).length,
  }
}

/**
 * Hook to access a single flow by ID
 */
export function useFlow(id: string): Flow | null {
  const { flows } = useWorkspaceData()

  return useMemo(() => flows[id] || null, [flows, id])
}

/**
 * Hook to get flow list item (simplified data for UI)
 */
export function useFlowList(): FlowListItem[] {
  const { flowList } = useWorkspaceData()
  return flowList
}

/**
 * Hook to get flows for a specific agent
 */
export function useAgentFlows(agentId: string) {
  const { flows } = useWorkspaceData()

  return useMemo(() => {
    return Object.values(flows).filter(flow =>
      flow.frontmatter.agentId === agentId
    )
  }, [flows, agentId])
}
