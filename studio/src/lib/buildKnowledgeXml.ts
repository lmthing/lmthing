import type { KnowledgeDomain } from '@/types/space-data'

/**
 * Build XML context for knowledge fields based on selected options.
 *
 * For each domain→field that has a selected option (or a default), produces:
 *   <knowledge domain="<domain>" field="<field>" variable="<variable>">
 *     ...option markdown content...
 *   </knowledge>
 *
 * All blocks are wrapped in <knowledge_context>...</knowledge_context>.
 *
 * @param knowledge - Map of domain slug → KnowledgeDomain (with fields + options)
 * @param selectedOptions - Map of "<domain>/<field>" → optionSlug. If omitted, uses field defaults.
 * @returns XML string with knowledge context
 */
export function buildKnowledgeXml(
  knowledge: Record<string, KnowledgeDomain>,
  selectedOptions?: Record<string, string>
): string {
  const xmlParts: string[] = []

  for (const [domainSlug, domain] of Object.entries(knowledge)) {
    for (const [fieldSlug, field] of Object.entries(domain.fields)) {
      const key = `${domainSlug}/${fieldSlug}`
      const selectedSlug = selectedOptions?.[key] ?? field.index.default

      if (!selectedSlug) continue

      const optionContent = field.options[selectedSlug]
      if (!optionContent) continue

      const trimmed = optionContent.trim()
      if (!trimmed) continue

      const variable = field.index.variable || fieldSlug
      const indented = trimmed
        .split('\n')
        .map(line => `  ${line}`)
        .join('\n')

      xmlParts.push(
        `<knowledge domain="${domainSlug}" field="${fieldSlug}" variable="${variable}">\n${indented}\n</knowledge>`
      )
    }
  }

  if (xmlParts.length === 0) {
    return ''
  }

  return `<knowledge_context>\n${xmlParts.join('\n')}\n</knowledge_context>`
}
