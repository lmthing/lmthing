import type { KnowledgeNode } from '@/types/space-data'

/**
 * Build XML structure for knowledge nodes based on enabled file paths
 * 
 * This function takes the knowledge tree and a list of enabled file paths
 * and builds an XML structure that can be used in the agent's system prompt.
 * 
 * Structure:
 * - Directories become XML tags
 * - Files become nested content
 * - Hierarchical structure mirrors the knowledge tree
 * 
 * @param knowledge - The full knowledge tree
 * @param enabledFilePaths - Array of file paths that are enabled
 * @returns XML string with knowledge content
 */
export function buildKnowledgeXml(
  knowledge: KnowledgeNode[],
  enabledFilePaths: string[]
): string {
  if (enabledFilePaths.length === 0) {
    return ''
  }

  const enabledSet = new Set(enabledFilePaths)
  const xmlParts: string[] = []

  function isPathEnabled(path: string): boolean {
    return enabledSet.has(path)
  }

  function hasEnabledDescendants(node: KnowledgeNode): boolean {
    if (node.type === 'file') {
      return isPathEnabled(node.path)
    }
    
    if (node.children) {
      return node.children.some(child => hasEnabledDescendants(child))
    }
    
    return false
  }

  function nodeToXml(node: KnowledgeNode, depth: number = 0): string | null {
    // Skip if this node and its descendants are not enabled
    if (!hasEnabledDescendants(node)) {
      return null
    }

    const indent = '  '.repeat(depth)
    
    if (node.type === 'file') {
      if (!isPathEnabled(node.path)) {
        return null
      }

      const content = node.content?.trim() || ''
      if (!content) {
        return null
      }

      // For .md files, use 'selection' tag instead of filename-based tag
      const isMdFile = node.path.endsWith('.md')

      if (isMdFile) {
        // If content is an array, wrap each item in selection tags
        try {
          const parsed = JSON.parse(content)
          if (Array.isArray(parsed)) {
            return parsed
              .map(item => `${indent}<selection>\n${escapeXmlContent(String(item).trim(), depth + 1)}\n${indent}</selection>`)
              .join('\n')
          }
        } catch {
          // Not valid JSON, treat as single value
        }
        // Single value - wrap in selection tag
        return `${indent}<selection>\n${escapeXmlContent(content, depth + 1)}\n${indent}</selection>`
      }

      // Non-md files: use config.label or frontmatter.title or path as tag name
      const tagName = sanitizeTagName(
        node.config?.label ||
        (node.frontmatter?.title as string | undefined) ||
        node.path.split('/').pop()?.replace(/\.md$/, '') ||
        'content'
      )

      return `${indent}<${tagName}>\n${escapeXmlContent(content, depth + 1)}\n${indent}</${tagName}>`
    }

    // Directory node
    if (!node.children || node.children.length === 0) {
      return null
    }

    const childXml = node.children
      .map(child => nodeToXml(child, depth + 1))
      .filter(Boolean)
      .join('\n')

    if (!childXml) {
      return null
    }

    // Use config.label or path as tag name
    const tagName = sanitizeTagName(
      node.config?.label ||
      node.path.split('/').pop() ||
      'section'
    )

    return `${indent}<${tagName}>\n${childXml}\n${indent}</${tagName}>`
  }

  // Process root level knowledge nodes
  for (const node of knowledge) {
    const xml = nodeToXml(node, 1)
    if (xml) {
      xmlParts.push(xml)
    }
  }

  if (xmlParts.length === 0) {
    return ''
  }

  return `<knowledge>\n${xmlParts.join('\n')}\n</knowledge>`
}

/**
 * Sanitize a string to be used as an XML tag name
 */
function sanitizeTagName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/^[^a-z]+/, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'item'
}

/**
 * Escape XML content and preserve indentation
 */
function escapeXmlContent(content: string, depth: number): string {
  const indent = '  '.repeat(depth)
  return content
    .split('\n')
    .map(line => `${indent}${line}`)
    .join('\n')
}
