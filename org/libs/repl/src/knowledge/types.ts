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
  /** Space name (directory basename), used for grouping in the prompt */
  name?: string
  domains: KnowledgeDomain[]
}

/**
 * Flat selector (no space names): { domainSlug: { fieldSlug: { optionSlug: true } } }
 */
export type FlatKnowledgeSelector = Record<string, Record<string, Record<string, true>>>

/**
 * Selector object the agent passes to loadKnowledge().
 *
 * With named spaces: { spaceName: { domainSlug: { fieldSlug: { optionSlug: true } } } }
 * Without spaces:    { domainSlug: { fieldSlug: { optionSlug: true } } }
 *
 * The loader auto-detects the format based on whether space names are configured.
 */
export type KnowledgeSelector = Record<string, any>

/**
 * Flat content (no space names): { domainSlug: { fieldSlug: { optionSlug: markdownString } } }
 */
export type FlatKnowledgeContent = Record<string, Record<string, Record<string, string>>>

/**
 * Loaded knowledge content returned to the agent.
 * Same shape as the selector but with markdown content instead of `true`.
 */
export type KnowledgeContent = Record<string, any>
