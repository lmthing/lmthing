'use client'

import { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from 'react'
import { useGithub } from '@/lib/github/GithubContext'
import {
  loadWorkspaceDataFromGithubRepo,
  type GithubWorkspaceLoadProgress,
} from '@/lib/github/workspaceLoader'
import { fromWorkspaceRouteParam, parseWorkspaceRepoRef } from '@/lib/workspaces'
import type {
  ExtractedDataStructure,
  WorkspaceData,
  Agent,
  Flow,
  KnowledgeNode,
  PackageJson,
  WorkspaceEnv,
  EncryptedEnvFile,
  AgentListItem,
  FlowListItem,
  KnowledgeItem,
} from '@/types/workspace-data'

/**
 * WorkspaceDataContext
 *
 * Loads workspace state from import.meta.glob at build time
 * instead of fetching from GitHub API
 */

interface WorkspaceDataContextValue {
  // Current workspace info
  currentWorkspace: string | null
  workspaceIds: string[]
  workspaceData: WorkspaceData | null
  isLoading: boolean
  error: string | null
  githubLoadProgress: GithubWorkspaceLoadProgress | null

  // Direct data access
  agents: Record<string, Agent>
  flows: Record<string, Flow>
  knowledge: KnowledgeNode[]
  packageJson: PackageJson | null
  env: WorkspaceEnv

  // Computed lists for UI
  agentList: AgentListItem[]
  flowList: FlowListItem[]
  knowledgeTree: KnowledgeItem[]

  // Actions
  createWorkspace: (workspaceId: string, options?: { setAsCurrent?: boolean; packageJson?: PackageJson }) => {
    workspaceId: string
    created: boolean
  }
  loadLocalDemoWorkspace: (workspaceId: string) => Promise<void>
  setCurrentWorkspace: (workspaceId: string) => void
  updatePackageJson: (packageJson: PackageJson) => void
  upsertAgent: (agent: Agent) => void
  deleteAgent: (agentId: string) => void
  upsertFlow: (flow: Flow) => void
  deleteFlow: (flowId: string) => void
  upsertEnvFile: (fileName: string, file: EncryptedEnvFile) => void
  deleteEnvFile: (fileName: string) => void
  updateKnowledgeFileContent: (filePath: string, content: string) => void
  updateKnowledgeFileFrontmatter: (filePath: string, frontmatter: Record<string, unknown>) => void
  updateKnowledgeDirectoryConfig: (directoryPath: string, config: Record<string, unknown>) => void
  addKnowledgeNode: (parentNodePath: string | null, node: KnowledgeNode) => void
  updateKnowledgeNodePath: (oldPath: string, newPath: string) => void
  deleteKnowledgeNode: (nodePath: string) => void
  duplicateKnowledgeNode: (nodePath: string) => void
  reload: () => Promise<void>
  clearAllData: () => void
}

// Add helper functions for node manipulation
function addNodeToChildren(
  nodes: KnowledgeNode[],
  parentPath: string | null,
  newNode: KnowledgeNode
): KnowledgeNode[] {
  if (!parentPath) {
    return [...nodes, newNode]
  }

  return nodes.map((node) => {
    if (node.path === parentPath && node.type === 'directory') {
      return {
        ...node,
        children: [...(node.children || []), newNode],
      }
    }
    if (node.children) {
      return {
        ...node,
        children: addNodeToChildren(node.children, parentPath, newNode),
      }
    }
    return node
  })
}

function updateNodePathRec(
  nodes: KnowledgeNode[],
  oldPath: string,
  newPath: string
): KnowledgeNode[] {
  return nodes.map((node) => {
    if (node.path === oldPath) {
      // Create a function that determines the new child path properly
      const updateChildPaths = (children: KnowledgeNode[], parentOld: string, parentNew: string): KnowledgeNode[] => {
        return children.map(child => {
          const childNewPath = child.path.replace(parentOld, parentNew)
          return {
            ...child,
            path: childNewPath,
            children: child.children ? updateChildPaths(child.children, child.path, childNewPath) : undefined
          }
        })
      }
      return {
        ...node,
        path: newPath,
        children: node.children ? updateChildPaths(node.children, oldPath, newPath) : undefined,
      }
    }
    if (node.children) {
      return {
        ...node,
        children: updateNodePathRec(node.children, oldPath, newPath),
      }
    }
    return node
  })
}

function deleteNodeFromChildren(nodes: KnowledgeNode[], targetPath: string): KnowledgeNode[] {
  return nodes
    .filter((node) => node.path !== targetPath)
    .map((node) => {
      if (node.children) {
        return {
          ...node,
          children: deleteNodeFromChildren(node.children, targetPath),
        }
      }
      return node
    })
}

function findNodeByPath(nodes: KnowledgeNode[], path: string): KnowledgeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node
    if (node.children) {
      const found = findNodeByPath(node.children, path)
      if (found) return found
    }
  }
  return null
}

function updateKnowledgeNodeContent(
  node: KnowledgeNode,
  targetPath: string,
  content: string
): KnowledgeNode {
  if (node.type === 'file' && node.path === targetPath) {
    return {
      ...node,
      content,
    }
  }

  if (!node.children || node.children.length === 0) {
    return node
  }

  const nextChildren = node.children.map((child) =>
    updateKnowledgeNodeContent(child, targetPath, content)
  )

  return {
    ...node,
    children: nextChildren,
  }
}

function updateKnowledgeNodeFrontmatter(
  node: KnowledgeNode,
  targetPath: string,
  frontmatter: Record<string, unknown>
): KnowledgeNode {
  if (node.type === 'file' && node.path === targetPath) {
    return {
      ...node,
      frontmatter: {
        ...(node.frontmatter || {}),
        ...frontmatter,
      },
    }
  }

  if (!node.children || node.children.length === 0) {
    return node
  }

  const nextChildren = node.children.map((child) =>
    updateKnowledgeNodeFrontmatter(child, targetPath, frontmatter)
  )

  return {
    ...node,
    children: nextChildren,
  }
}

function updateKnowledgeNodeDirectoryConfig(
  node: KnowledgeNode,
  targetPath: string,
  config: Record<string, unknown>
): KnowledgeNode {
  if (node.type === 'directory' && node.path === targetPath) {
    return {
      ...node,
      config: {
        ...(node.config || {}),
        ...config,
      },
    }
  }

  if (!node.children || node.children.length === 0) {
    return node
  }

  const nextChildren = node.children.map((child) =>
    updateKnowledgeNodeDirectoryConfig(child, targetPath, config)
  )

  return {
    ...node,
    children: nextChildren,
  }
}

const WorkspaceDataContext = createContext<WorkspaceDataContextValue | undefined>(undefined)

interface WorkspaceDataProviderProps {
  children: ReactNode
}

/**
 * Convert internal Agent to AgentListItem
 */
function toAgentListItem(agent: Agent): AgentListItem {
  return {
    id: agent.id,
    name: agent.frontmatter.name || agent.id,
    description: agent.frontmatter.description || '',
  }
}

/**
 * Convert internal Flow to FlowListItem
 */
function toFlowListItem(flow: Flow): FlowListItem {
  return {
    id: flow.id,
    name: flow.frontmatter.name || flow.id,
    description: flow.description,
    taskCount: parseInt(flow.frontmatter.taskCount || '0', 10),
    status: flow.frontmatter.status || 'unknown',
    tags: flow.frontmatter.tags || [],
  }
}

/**
 * Convert internal KnowledgeNode to KnowledgeItem
 */
function toKnowledgeItem(node: KnowledgeNode): KnowledgeItem {
  // For file nodes, the human-readable label lives in frontmatter.title (not config.label)
  // Fall back to stripping the .md extension from the filename
  const filenameStem = node.path.split('/').pop()?.replace(/\.md$/, '') ?? node.path

  const item: KnowledgeItem = {
    path: node.path,
    type: node.config?.renderAs === 'field' ? 'field' :
      node.config?.renderAs === 'section' ? 'section' : 'file',
    label: node.config?.label
      ?? (node.frontmatter?.title as string | undefined)
      ?? (node.type === 'file' ? filenameStem : undefined),
    description: node.config?.description,
    icon: node.config?.icon,
    color: node.config?.color,
    variableName: node.config?.variableName,
    fieldType: node.config?.fieldType,
    required: node.config?.required,
    default: node.config?.default,
  }

  if (node.children) {
    item.children = node.children.map(toKnowledgeItem)
  }

  return item
}

/**
 * Fetch one demo workspace JSON from public/demos
 */
async function fetchDemoWorkspace(workspaceName: string): Promise<WorkspaceData> {
  const response = await fetch(`/demos/${workspaceName}.json`)
  if (!response.ok) {
    throw new Error(`Failed to fetch demo workspace ${workspaceName}: ${response.status}`)
  }

  const workspace = (await response.json()) as WorkspaceData

  return {
    ...workspace,
    id: workspace.id || workspaceName,
    agents: workspace.agents || {},
    flows: workspace.flows || {},
    knowledge: workspace.knowledge || [],
    env: workspace.env || {},
  }
}

const WORKSPACE_DATA_STORAGE_KEY = 'lmthing-workspace-data'
const WORKSPACE_DATA_STORAGE_KEY_PREFIX = `${WORKSPACE_DATA_STORAGE_KEY}:`

function getWorkspaceStorageKey(workspaceId: string): string {
  return `${WORKSPACE_DATA_STORAGE_KEY_PREFIX}${encodeURIComponent(workspaceId)}`
}

function getPersistedWorkspaceStorageKeys(storage: Storage): string[] {
  const keys: string[] = []

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key && key.startsWith(WORKSPACE_DATA_STORAGE_KEY_PREFIX)) {
      keys.push(key)
    }
  }

  return keys
}

function loadLegacyPersistedWorkspaceData(): ExtractedDataStructure | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(WORKSPACE_DATA_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ExtractedDataStructure
  } catch {
    return null
  }
}

function loadPersistedWorkspaceData(): ExtractedDataStructure | null {
  if (typeof window === 'undefined') return null

  try {
    const persistedKeys = getPersistedWorkspaceStorageKeys(window.localStorage)

    if (persistedKeys.length > 0) {
      const workspaces: Record<string, WorkspaceData> = {}

      for (const key of persistedKeys) {
        const raw = window.localStorage.getItem(key)
        if (!raw) continue

        try {
          const workspace = JSON.parse(raw) as WorkspaceData
          const workspaceId = workspace?.id || decodeURIComponent(key.slice(WORKSPACE_DATA_STORAGE_KEY_PREFIX.length))
          if (!workspaceId) continue
          workspaces[workspaceId] = workspace
        } catch {
          // Ignore invalid workspace payloads
        }
      }

      if (Object.keys(workspaces).length > 0) {
        return { workspaces }
      }
    }

    const legacyData = loadLegacyPersistedWorkspaceData()
    if (!legacyData) return null

    persistWorkspaceData(legacyData)

    try {
      window.localStorage.removeItem(WORKSPACE_DATA_STORAGE_KEY)
    } catch {
      // Ignore storage errors
    }

    return legacyData
  } catch {
    return null
  }
}

function persistWorkspaceData(data: ExtractedDataStructure) {
  if (typeof window === 'undefined') return

  try {
    const storage = window.localStorage
    const workspaces = data.workspaces || {}
    const expectedKeys = new Set<string>()

    for (const [workspaceId, workspaceData] of Object.entries(workspaces)) {
      const key = getWorkspaceStorageKey(workspaceId)
      expectedKeys.add(key)
      storage.setItem(key, JSON.stringify(workspaceData))
    }

    const existingKeys = getPersistedWorkspaceStorageKeys(storage)
    for (const key of existingKeys) {
      if (!expectedKeys.has(key)) {
        storage.removeItem(key)
      }
    }

    storage.removeItem(WORKSPACE_DATA_STORAGE_KEY)
  } catch {
    // Ignore storage errors
  }
}

function toWorkspacePackageName(workspaceId: string): string {
  const repoRef = parseWorkspaceRepoRef(workspaceId)
  const base = repoRef?.repo || workspaceId
  return base
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'workspace'
}

function createEmptyWorkspaceData(workspaceId: string, packageJson?: PackageJson): WorkspaceData {
  return {
    id: workspaceId,
    agents: {},
    flows: {},
    knowledge: [],
    packageJson: {
      name: toWorkspacePackageName(workspaceId),
      version: '1.0.0',
      description: `${workspaceId} workspace`,
      ...(packageJson || {}),
    },
    env: {},
  }
}

export function WorkspaceDataProvider({
  children,
}: WorkspaceDataProviderProps) {
  const { octokit, isAuthenticated, user } = useGithub()
  const [data, setData] = useState<ExtractedDataStructure | null>(null)
  // Start with null — layouts will call setCurrentWorkspace once they know the workspace from the URL
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [githubLoadProgress, setGithubLoadProgress] = useState<GithubWorkspaceLoadProgress | null>(null)

  const setCurrentWorkspaceSafe = useCallback((workspaceId: string) => {
    setCurrentWorkspace(fromWorkspaceRouteParam(workspaceId))
  }, [])

  const createWorkspace = useCallback((workspaceId: string, options?: {
    setAsCurrent?: boolean
    packageJson?: PackageJson
  }) => {
    const decodedWorkspaceId = fromWorkspaceRouteParam(workspaceId).trim()
    const repoRef = parseWorkspaceRepoRef(decodedWorkspaceId)
    const normalizedWorkspaceId = repoRef?.owner === 'local'
      ? repoRef.repo.trim()
      : decodedWorkspaceId

    if (!normalizedWorkspaceId) {
      throw new Error('Workspace id is required')
    }

    const alreadyExists = Boolean(data?.workspaces?.[normalizedWorkspaceId])

    if (!alreadyExists) {
      setData((prev) => {
        const base: ExtractedDataStructure = prev || { workspaces: {} }

        if (base.workspaces[normalizedWorkspaceId]) {
          return base
        }

        return {
          ...base,
          workspaces: {
            ...base.workspaces,
            [normalizedWorkspaceId]: createEmptyWorkspaceData(normalizedWorkspaceId, options?.packageJson),
          },
        }
      })
    }

    if (options?.setAsCurrent ?? true) {
      setCurrentWorkspace(normalizedWorkspaceId)
    }

    return {
      workspaceId: normalizedWorkspaceId,
      created: !alreadyExists,
    }
  }, [data])

  const loadLocalDemoWorkspace = useCallback(async (workspaceId: string) => {
    const normalizedWorkspaceId = fromWorkspaceRouteParam(workspaceId).trim()
    if (!normalizedWorkspaceId) return

    const repoRef = parseWorkspaceRepoRef(normalizedWorkspaceId, user?.login)
    const localWorkspaceId = repoRef?.owner === 'local' ? repoRef.repo : normalizedWorkspaceId

    setIsLoading(true)
    setError(null)

    try {
      const localWorkspace = await fetchDemoWorkspace(localWorkspaceId)

      setData((prev) => {
        const base: ExtractedDataStructure = prev || { workspaces: {} }
        return {
          ...base,
          workspaces: {
            ...base.workspaces,
            [localWorkspaceId]: localWorkspace,
          },
        }
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('Failed to load local workspace data:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user?.login])

  // Load data from public/demos directory via fetch
  const loadData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const persistedData = loadPersistedWorkspaceData()
      if (persistedData) {
        setData(persistedData)
      } else {
        setData({ workspaces: {} })
      }
      // Do NOT pick a default workspace here — let the consumer (layout) decide
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('Failed to load workspace data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Load data on mount
  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!data) return
    persistWorkspaceData(data)
  }, [data])

  useEffect(() => {
    const loadSelectedWorkspace = async () => {
      if (!currentWorkspace) return

      const repoRef = parseWorkspaceRepoRef(currentWorkspace, user?.login)
      if (!repoRef) return

      const workspaceKey = repoRef.owner === 'local' ? repoRef.repo : currentWorkspace
      if (data?.workspaces?.[workspaceKey]) return

      if (repoRef.owner === 'local') {
        try {
          setIsLoading(true)
          setError(null)

          const localWorkspace = await fetchDemoWorkspace(repoRef.repo)

          setData((prev) => {
            const base: ExtractedDataStructure = prev || { workspaces: {} }
            return {
              ...base,
              workspaces: {
                ...base.workspaces,
                [repoRef.repo]: localWorkspace,
              },
            }
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          setError(message)
          console.error('Failed to load local workspace data:', err)
        } finally {
          setIsLoading(false)
        }

        return
      }

      if (!octokit || !isAuthenticated) return

      try {
        setIsLoading(true)
        setError(null)
        setGithubLoadProgress({
          loadedFiles: 0,
          totalFiles: 0,
          currentPath: 'Initializing GitHub workspace load…',
        })

        const workspace = await loadWorkspaceDataFromGithubRepo({
          octokit,
          owner: repoRef.owner,
          repo: repoRef.repo,
          workspaceId: currentWorkspace,
          onProgress: (progress) => {
            setGithubLoadProgress(progress)
          },
        })

        setData((prev) => {
          const base: ExtractedDataStructure = prev || { workspaces: {} }
          return {
            ...base,
            workspaces: {
              ...base.workspaces,
              [currentWorkspace]: workspace,
            },
          }
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
        console.error('Failed to load GitHub workspace data:', err)
      } finally {
        setGithubLoadProgress(null)
        setIsLoading(false)
      }
    }

    void loadSelectedWorkspace()
  }, [currentWorkspace, data, octokit, isAuthenticated, user?.login])

  const updateCurrentWorkspace = useCallback(
    (updater: (workspace: WorkspaceData) => WorkspaceData) => {
      setData((prev) => {
        if (!prev || !currentWorkspace) return prev

        const repoRef = parseWorkspaceRepoRef(currentWorkspace)
        const workspaceKey = repoRef?.owner === 'local' ? repoRef.repo : currentWorkspace

        const existingWorkspace = prev.workspaces[workspaceKey]
        if (!existingWorkspace) return prev

        const updatedWorkspace = updater(existingWorkspace)

        return {
          ...prev,
          workspaces: {
            ...prev.workspaces,
            [workspaceKey]: updatedWorkspace,
          },
        }
      })
    },
    [currentWorkspace]
  )

  const upsertAgent = useCallback(
    (agent: Agent) => {
      updateCurrentWorkspace((workspace) => ({
        ...workspace,
        agents: {
          ...workspace.agents,
          [agent.id]: agent,
        },
      }))
    },
    [updateCurrentWorkspace]
  )

  const updatePackageJson = useCallback(
    (packageJson: PackageJson) => {
      updateCurrentWorkspace((workspace) => ({
        ...workspace,
        packageJson,
      }))
    },
    [updateCurrentWorkspace]
  )

  const deleteAgent = useCallback(
    (agentId: string) => {
      updateCurrentWorkspace((workspace) => {
        const remainingAgents = { ...workspace.agents }
        delete remainingAgents[agentId]
        return {
          ...workspace,
          agents: remainingAgents,
        }
      })
    },
    [updateCurrentWorkspace]
  )

  const upsertFlow = useCallback(
    (flow: Flow) => {
      updateCurrentWorkspace((workspace) => ({
        ...workspace,
        flows: {
          ...workspace.flows,
          [flow.id]: flow,
        },
      }))
    },
    [updateCurrentWorkspace]
  )

  const deleteFlow = useCallback(
    (flowId: string) => {
      updateCurrentWorkspace((workspace) => {
        const remainingFlows = { ...workspace.flows }
        delete remainingFlows[flowId]
        return {
          ...workspace,
          flows: remainingFlows,
        }
      })
    },
    [updateCurrentWorkspace]
  )

  const upsertEnvFile = useCallback(
    (fileName: string, file: EncryptedEnvFile) => {
      updateCurrentWorkspace((workspace) => ({
        ...workspace,
        env: {
          ...(workspace.env || {}),
          [fileName]: file,
        },
      }))
    },
    [updateCurrentWorkspace]
  )

  const deleteEnvFile = useCallback(
    (fileName: string) => {
      updateCurrentWorkspace((workspace) => {
        const nextEnv = { ...(workspace.env || {}) }
        delete nextEnv[fileName]
        return {
          ...workspace,
          env: nextEnv,
        }
      })
    },
    [updateCurrentWorkspace]
  )

  const updateKnowledgeFileContent = useCallback(
    (filePath: string, content: string) => {
      updateCurrentWorkspace((workspace) => ({
        ...workspace,
        knowledge: workspace.knowledge.map((node) =>
          updateKnowledgeNodeContent(node, filePath, content)
        ),
      }))
    },
    [updateCurrentWorkspace]
  )

  const updateKnowledgeFileFrontmatter = useCallback(
    (filePath: string, frontmatter: Record<string, unknown>) => {
      updateCurrentWorkspace((workspace) => ({
        ...workspace,
        knowledge: workspace.knowledge.map((node) =>
          updateKnowledgeNodeFrontmatter(node, filePath, frontmatter)
        ),
      }))
    },
    [updateCurrentWorkspace]
  )

  const updateKnowledgeDirectoryConfig = useCallback(
    (directoryPath: string, config: Record<string, unknown>) => {
      updateCurrentWorkspace((workspace) => ({
        ...workspace,
        knowledge: workspace.knowledge.map((node) =>
          updateKnowledgeNodeDirectoryConfig(node, directoryPath, config)
        ),
      }))
    },
    [updateCurrentWorkspace]
  )

  const addKnowledgeNode = useCallback(
    (parentNodePath: string | null, node: KnowledgeNode) => {
      updateCurrentWorkspace((workspace) => ({
        ...workspace,
        knowledge: addNodeToChildren(workspace.knowledge, parentNodePath, node),
      }))
    },
    [updateCurrentWorkspace]
  )

  const updateKnowledgeNodePath = useCallback(
    (oldPath: string, newPath: string) => {
      updateCurrentWorkspace((workspace) => ({
        ...workspace,
        knowledge: updateNodePathRec(workspace.knowledge, oldPath, newPath),
      }))
    },
    [updateCurrentWorkspace]
  )

  const deleteKnowledgeNode = useCallback(
    (nodePath: string) => {
      updateCurrentWorkspace((workspace) => ({
        ...workspace,
        knowledge: deleteNodeFromChildren(workspace.knowledge, nodePath),
      }))
    },
    [updateCurrentWorkspace]
  )

  const duplicateKnowledgeNode = useCallback(
    (nodePath: string) => {
      updateCurrentWorkspace((workspace) => {
        const nodeToDuplicate = findNodeByPath(workspace.knowledge, nodePath)
        if (!nodeToDuplicate) return workspace

        const parts = nodePath.split('/')
        const oldName = parts.pop() || ''
        const parentPath = parts.length > 0 ? parts.join('/') : null
        const extMatch = oldName.match(/(\.[^.]+)$/)
        const ext = extMatch ? extMatch[1] : ''
        const base = extMatch ? oldName.slice(0, -ext.length) : oldName
        const newName = `${base} (copy)${ext}`
        const newPath = parentPath ? `${parentPath}/${newName}` : newName

        const deepCloneAndUpdatePaths = (node: KnowledgeNode, oldP: string, newP: string): KnowledgeNode => {
          const newChildPath = node.path.replace(oldP, newP)
          return {
            ...node,
            path: newChildPath,
            children: node.children ? node.children.map(c => deepCloneAndUpdatePaths(c, oldP, newP)) : undefined
          }
        }

        const newNode = deepCloneAndUpdatePaths(nodeToDuplicate, nodePath, newPath)

        return {
          ...workspace,
          knowledge: addNodeToChildren(workspace.knowledge, parentPath, newNode)
        }
      })
    },
    [updateCurrentWorkspace]
  )

  const clearAllData = useCallback(() => {
    if (typeof window === 'undefined') return
    
    // Clear localStorage
    try {
      window.localStorage.clear()
    } catch {
      // Ignore errors
    }
    
    // Clear sessionStorage
    try {
      window.sessionStorage.clear()
    } catch {
      // Ignore errors
    }
    
    // Reload page
    window.location.reload()
  }, [])

  // Computed values
  const workspaceData: WorkspaceData | null = useMemo(
    () => {
      if (!currentWorkspace || !data) return null

      const repoRef = parseWorkspaceRepoRef(currentWorkspace)
      const workspaceKey = repoRef?.owner === 'local' ? repoRef.repo : currentWorkspace

      return data.workspaces[workspaceKey] || null
    },
    [currentWorkspace, data]
  )

  const workspaceIds = useMemo<string[]>(() => {
    if (!data?.workspaces) return []
    return Object.keys(data.workspaces)
  }, [data])

  const agents = useMemo<Record<string, Agent>>(() => workspaceData?.agents || {}, [workspaceData])
  const flows = useMemo<Record<string, Flow>>(() => workspaceData?.flows || {}, [workspaceData])
  const knowledge = useMemo<KnowledgeNode[]>(() => workspaceData?.knowledge || [], [workspaceData])
  const packageJson = useMemo<PackageJson | null>(() => workspaceData?.packageJson || null, [workspaceData])
  const env = useMemo<WorkspaceEnv>(() => workspaceData?.env || {}, [workspaceData])

  const agentList = useMemo<AgentListItem[]>(() => Object.values(agents).map(toAgentListItem), [agents])
  const flowList = useMemo<FlowListItem[]>(() => Object.values(flows).map(toFlowListItem), [flows])
  const knowledgeTree = useMemo<KnowledgeItem[]>(() => knowledge.map(toKnowledgeItem), [knowledge])

  const value: WorkspaceDataContextValue = {
    currentWorkspace,
    workspaceIds,
    workspaceData,
    isLoading,
    error,
    githubLoadProgress,
    agents,
    flows,
    knowledge,
    packageJson,
    env,
    agentList,
    flowList,
    knowledgeTree,
    createWorkspace,
    loadLocalDemoWorkspace,
    setCurrentWorkspace: setCurrentWorkspaceSafe,
    updatePackageJson,
    upsertAgent,
    deleteAgent,
    upsertFlow,
    deleteFlow,
    upsertEnvFile,
    deleteEnvFile,
    updateKnowledgeFileContent,
    updateKnowledgeFileFrontmatter,
    updateKnowledgeDirectoryConfig,
    addKnowledgeNode,
    updateKnowledgeNodePath,
    deleteKnowledgeNode,
    duplicateKnowledgeNode,
    reload: loadData,
    clearAllData,
  }

  return (
    <WorkspaceDataContext.Provider value={value}>
      {children}
    </WorkspaceDataContext.Provider>
  )
}

export function useWorkspaceData(): WorkspaceDataContextValue {
  const context = useContext(WorkspaceDataContext)

  if (!context) {
    throw new Error('useWorkspaceData must be used within a WorkspaceDataProvider')
  }

  return context
}
