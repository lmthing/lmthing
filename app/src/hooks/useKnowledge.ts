import { useMemo } from 'react'
import { useWorkspaceData } from '@/lib/workspaceDataContext'
import type { KnowledgeNode, KnowledgeItem } from '@/types/workspace-data'

/**
 * Hook to access knowledge tree from the workspace state
 */
export function useKnowledge() {
  const { knowledge, knowledgeTree, isLoading, error, reload } = useWorkspaceData()

  return {
    knowledge,
    knowledgeTree,
    isLoading,
    error,
    reload,

    // Helper methods
    getKnowledgeByPath: (path: string) =>
      knowledge.find(node => node.path === path),
    getKnowledgeItemByPath: (path: string) =>
      knowledgeTree.find(item => item.path === path),
    hasKnowledge: (path: string) =>
      knowledge.some(node => node.path === path),
    knowledgeSectionCount: knowledge.filter(node =>
      node.config?.renderAs === 'section'
    ).length,
    knowledgeFieldCount: countFields(knowledge),
  }
}

/**
 * Recursively count field nodes in knowledge tree
 */
function countFields(nodes: KnowledgeNode[]): number {
  let count = 0
  for (const node of nodes) {
    if (node.config?.renderAs === 'field') {
      count++
    }
    if (node.children) {
      count += countFields(node.children)
    }
  }
  return count
}

/**
 * Hook to access a specific knowledge section by path
 */
export function useKnowledgeSection(path: string): KnowledgeNode | null {
  const { knowledge } = useWorkspaceData()

  return useMemo(() => {
    return knowledge.find(node => node.path === path) || null
  }, [knowledge, path])
}

/**
 * Hook to get knowledge items as a flat list for rendering
 */
export function useKnowledgeFlatList(): KnowledgeItem[] {
  const { knowledgeTree } = useWorkspaceData()

  return useMemo(() => {
    const flatten = (items: KnowledgeItem[]): KnowledgeItem[] => {
      const result: KnowledgeItem[] = []
      for (const item of items) {
        result.push(item)
        if (item.children) {
          result.push(...flatten(item.children))
        }
      }
      return result
    }
    return flatten(knowledgeTree)
  }, [knowledgeTree])
}

/**
 * Hook to get field-type knowledge items
 */
export function useKnowledgeFields(): KnowledgeItem[] {
  const flatList = useKnowledgeFlatList()

  return useMemo(() => {
    return flatList.filter(item => item.type === 'field')
  }, [flatList])
}

/**
 * Hook to get section-type knowledge items
 */
export function useKnowledgeSections(): KnowledgeItem[] {
  const { knowledgeTree } = useWorkspaceData()

  return useMemo(() => {
    return knowledgeTree.filter(item => item.type === 'section')
  }, [knowledgeTree])
}
