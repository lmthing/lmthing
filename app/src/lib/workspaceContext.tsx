'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import {
  DEFAULT_WORKSPACE_SLUG,
  getNormalizedWorkspace,
} from '@/lib/workspaces'

// Re-export the new data provider and hooks
export {
  WorkspaceDataProvider as WorkspaceDataProvider,
  useWorkspaceData as useWorkspaceDataContext,
} from '@/lib/workspaceDataContext'

// Re-export convenience hooks
export {
  useAgents,
  useAgent,
  useAgentWithConversations,
  useAgentList,
  useRuntimeAgents,
  useRuntimeAgent,
} from '@/hooks/useAgents'

export {
  useFlows,
  useFlow,
  useFlowList,
  useAgentFlows,
} from '@/hooks/useFlows'

export {
  useKnowledge,
  useKnowledgeSection,
  useKnowledgeFlatList,
  useKnowledgeFields,
  useKnowledgeSections,
} from '@/hooks/useKnowledge'

export {
  usePackageJson,
} from '@/hooks/usePackageJson'

// ============================================================================
// LEGACY: Old glob-based data loading (deprecated - kept for backward compat)
// ============================================================================

type JsonModule<T = unknown> = { default: T }

const workspaceDataModules = import.meta.glob('/mock_data/workspaces/*/sections/*/data.json')

function getWorkspaceDataModulePath(workspaceName: string, sectionPath: string) {
  const normalizedWorkspace = getNormalizedWorkspace(workspaceName)
  return `/mock_data/workspaces/${normalizedWorkspace}/sections/${sectionPath}/data.json`
}

/**
 * @deprecated Use useWorkspaceDataContext or specific hooks (useAgents, useFlows, etc.) instead
 */
export async function loadWorkspaceData<T>(
  workspaceName: string,
  sectionPath: string
): Promise<T> {
  const modulePath = getWorkspaceDataModulePath(workspaceName, sectionPath)
  const loader = workspaceDataModules[modulePath]

  if (!loader) {
    throw new Error(`Workspace data not found: ${modulePath}`)
  }

  const module = (await loader()) as JsonModule<T>
  return module.default
}

/**
 * @deprecated Use useWorkspaceDataContext or specific hooks instead
 */
export function importWorkspaceData(sectionPath: string, workspaceName: string = DEFAULT_WORKSPACE_SLUG) {
  const modulePath = getWorkspaceDataModulePath(workspaceName, sectionPath)
  const loader = workspaceDataModules[modulePath]

  if (!loader) {
    return Promise.reject(new Error(`Workspace data not found: ${modulePath}`))
  }

  return loader()
}

// ============================================================================
// Workspace URL Context (for workspace routing)
// ============================================================================

interface WorkspaceContextValue {
  workspaceName: string
  normalizedWorkspace: string
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined)

interface WorkspaceProviderProps {
  children: ReactNode
}

/**
 * Legacy WorkspaceProvider - handles workspace URL routing
 * For data access, use WorkspaceDataProvider (new) or useWorkspaceDataContext
 *
 * @deprecated Use WorkspaceDataProvider for data access. Keep for URL routing only.
 */
export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const { workspaceName = DEFAULT_WORKSPACE_SLUG } = useParams<{ workspaceName?: string }>()
  const normalizedWorkspace = getNormalizedWorkspace(workspaceName)

  return (
    <WorkspaceContext.Provider value={{ workspaceName, normalizedWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

/**
 * Get workspace URL params
 * For data access, use useWorkspaceDataContext or specific hooks (useAgents, etc.)
 */
export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  const { workspaceName = DEFAULT_WORKSPACE_SLUG } = useParams<{ workspaceName?: string }>()

  if (!context) {
    // Fallback when used outside provider
    return {
      workspaceName,
      normalizedWorkspace: getNormalizedWorkspace(workspaceName),
    }
  }
  return context
}
