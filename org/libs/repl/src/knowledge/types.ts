/**
 * Represents a knowledge domain (top-level folder in knowledge/).
 */
export interface KnowledgeDomain {
  slug: string
  label: string
  description: string
  icon: string
  color: string
  fields: KnowledgeField[]
}

/**
 * Represents a field within a knowledge domain.
 */
export interface KnowledgeField {
  slug: string
  label: string
  description: string
  fieldType: 'select' | 'multiSelect' | 'text' | 'number'
  required: boolean
  default?: string
  variableName: string
  options: KnowledgeOption[]
}

/**
 * Represents a selectable option within a field (parsed from .md frontmatter).
 */
export interface KnowledgeOption {
  slug: string
  title: string
  description: string
  order: number
}

/**
 * The full knowledge tree for a space — used to show the agent what's available.
 */
export interface KnowledgeTree {
  domains: KnowledgeDomain[]
}

/**
 * Selector object the agent passes to loadKnowledge().
 * Mirrors the file tree: { domainSlug: { fieldSlug: { optionSlug: true } } }
 */
export type KnowledgeSelector = Record<string, Record<string, Record<string, true>>>

/**
 * Loaded knowledge content returned to the agent.
 * Same shape as the selector but with markdown content instead of `true`.
 */
export type KnowledgeContent = Record<string, Record<string, Record<string, string>>>
