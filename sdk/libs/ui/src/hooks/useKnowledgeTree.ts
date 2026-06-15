/**
 * useKnowledgeTree — Builds a 3-level domain→field→option tree from SpaceFS glob results.
 * Used by FieldTree to render the new knowledge hierarchy.
 */
import { useMemo } from 'react'
import { useGlob } from '@lmthing/state'

export interface KnowledgeTreeNode {
  slug: string
  path: string
  type: 'domain' | 'field' | 'option'
  children?: KnowledgeTreeNode[]
}

export function useKnowledgeTree(): KnowledgeTreeNode[] {
  const indexPaths = useGlob('knowledge/*/*/index.md')
  const allPaths = useGlob('knowledge/**/*.md')

  return useMemo(() => {
    if (indexPaths.length === 0) return []

    // Build domain→field map from index paths
    const domainMap = new Map<string, Set<string>>()
    for (const p of indexPaths) {
      // p is knowledge/<domain>/<field>/index.md
      const parts = p.split('/')
      if (parts.length < 4) continue
      const domain = parts[1]
      const field = parts[2]
      if (!domainMap.has(domain)) {
        domainMap.set(domain, new Set())
      }
      domainMap.get(domain)!.add(field)
    }

    // Build a set of all option paths (any .md file that is NOT an index.md)
    const optionPaths = allPaths.filter(p => !p.endsWith('/index.md'))

    // Build tree
    const domains = Array.from(domainMap.keys()).sort()
    return domains.map(domain => {
      const fields = Array.from(domainMap.get(domain)!).sort()
      const fieldNodes: KnowledgeTreeNode[] = fields.map(field => {
        const fieldPath = `knowledge/${domain}/${field}`
        const fieldPrefix = `${fieldPath}/`

        // Find direct child option files (no subdirectories)
        const fieldOptions = optionPaths
          .filter(p => {
            if (!p.startsWith(fieldPrefix)) return false
            const relative = p.slice(fieldPrefix.length)
            // Must be a direct child (no extra slashes)
            return !relative.includes('/')
          })
          .map(p => {
            const relative = p.slice(fieldPrefix.length)
            const slug = relative.endsWith('.md') ? relative.slice(0, -3) : relative
            return { slug, path: p }
          })
          .sort((a, b) => a.slug.localeCompare(b.slug))

        return {
          slug: field,
          path: fieldPath,
          type: 'field' as const,
          children: fieldOptions.map(opt => ({
            slug: opt.slug,
            path: opt.path,
            type: 'option' as const,
          })),
        }
      })

      return {
        slug: domain,
        path: `knowledge/${domain}`,
        type: 'domain' as const,
        children: fieldNodes,
      }
    })
  }, [indexPaths, allPaths])
}
