/**
 * useKnowledgeTree — Builds KnowledgeNode[] tree from SpaceFS glob results.
 * Used by FieldTree to render the file tree for a knowledge field.
 */
import { useMemo } from 'react'
import { useGlob } from '../../../org/state/src'
import type { KnowledgeNode } from '@/types/space-data'

export function useKnowledgeTree(fieldId: string): KnowledgeNode[] {
  const allPaths = useGlob(`knowledge/${fieldId}/**`)

  return useMemo(() => {
    if (!fieldId || allPaths.length === 0) return []

    // Filter out config.json, keep only content files and infer directories
    const prefix = `knowledge/${fieldId}/`
    const relativePaths = allPaths
      .filter(p => p.startsWith(prefix) && !p.endsWith('/config.json'))
      .map(p => p.slice(prefix.length))
      .sort()

    // Collect all directory paths from file paths
    const dirs = new Set<string>()
    for (const rp of relativePaths) {
      const parts = rp.split('/')
      for (let i = 1; i < parts.length; i++) {
        dirs.add(parts.slice(0, i).join('/'))
      }
    }

    // Build flat list of all entries (dirs + files)
    const allEntries: { path: string; type: 'directory' | 'file' }[] = []
    for (const d of dirs) {
      allEntries.push({ path: d, type: 'directory' })
    }
    for (const rp of relativePaths) {
      allEntries.push({ path: rp, type: 'file' })
    }

    // Build tree from flat entries
    const nodeMap = new Map<string, KnowledgeNode>()

    // Create all nodes
    for (const entry of allEntries) {
      const fullPath = `${prefix}${entry.path}`
      nodeMap.set(entry.path, {
        path: fullPath,
        type: entry.type,
        children: entry.type === 'directory' ? [] : undefined,
      })
    }

    // Build parent-child relationships
    const roots: KnowledgeNode[] = []
    for (const entry of allEntries) {
      const node = nodeMap.get(entry.path)!
      const lastSlash = entry.path.lastIndexOf('/')
      if (lastSlash === -1) {
        roots.push(node)
      } else {
        const parentPath = entry.path.slice(0, lastSlash)
        const parent = nodeMap.get(parentPath)
        if (parent && parent.children) {
          parent.children.push(node)
        } else {
          roots.push(node)
        }
      }
    }

    return roots
  }, [fieldId, allPaths])
}
