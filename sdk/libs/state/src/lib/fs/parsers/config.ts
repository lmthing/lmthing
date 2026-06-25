// src/lib/fs/parsers/config.ts
//
// Parsers for knowledge/<domain>/<field>/index.md and
// knowledge/<domain>/index.md — NEW SPEC.
// The old AgentConfig/AgentValues/KnowledgeConfig (JSON files) are removed.

import { parseFrontmatter } from './frontmatter'

// ---------------------------------------------------------------------------
// Knowledge field index: knowledge/<domain>/<field>/index.md
// ---------------------------------------------------------------------------

export interface KnowledgeFieldIndex {
  type: string // "string" | "number" | "boolean" | "object" | "array"
  variable: string
  default?: string
  label?: string
  /** UI hint: how to render/ask for this field (e.g. "select", "text", "toggle"). Inferred-rendering input — no separate renderAs. */
  fieldType?: string
  required?: boolean
}

export function parseKnowledgeFieldIndex(content: string): KnowledgeFieldIndex & { description: string } {
  const { frontmatter: raw, content: body } = parseFrontmatter<Record<string, unknown>>(content)
  return {
    type: typeof raw.type === 'string' ? raw.type : 'string',
    variable: typeof raw.variable === 'string' ? raw.variable : '',
    default: typeof raw.default === 'string' ? raw.default : undefined,
    label: typeof raw.label === 'string' ? raw.label : undefined,
    fieldType: typeof raw.fieldType === 'string' ? raw.fieldType : undefined,
    required: typeof raw.required === 'boolean' ? raw.required : undefined,
    description: body.trim(),
  }
}

export function serializeKnowledgeFieldIndex(index: KnowledgeFieldIndex, description: string): string {
  const lines = ['---', `type: ${index.type}`, `variable: ${index.variable}`]
  if (index.default !== undefined) lines.push(`default: ${index.default}`)
  if (index.label !== undefined) lines.push(`label: "${index.label.replace(/"/g, '\\"')}"`)
  if (index.fieldType !== undefined) lines.push(`fieldType: ${index.fieldType}`)
  if (index.required !== undefined) lines.push(`required: ${index.required}`)
  lines.push('---', '', description.trim())
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Knowledge domain index: knowledge/<domain>/index.md
// ---------------------------------------------------------------------------

export interface KnowledgeDomainIndex {
  label?: string
  description?: string
  icon?: string
  color?: string
  /** UI hint for how studio renders this domain's fields. Default: 'list'. */
  renderAs?: 'tabs' | 'list'
}

export function parseKnowledgeDomainIndex(content: string): KnowledgeDomainIndex & { description: string } {
  const { frontmatter: raw, content: body } = parseFrontmatter<Record<string, unknown>>(content)
  return {
    label: typeof raw.label === 'string' ? raw.label : undefined,
    icon: typeof raw.icon === 'string' ? raw.icon : undefined,
    color: typeof raw.color === 'string' ? raw.color : undefined,
    renderAs: raw.renderAs === 'tabs' || raw.renderAs === 'list' ? raw.renderAs : undefined,
    description: body.trim(),
  }
}

export function serializeKnowledgeDomainIndex(index: KnowledgeDomainIndex, description: string): string {
  const lines = ['---']
  if (index.label !== undefined) lines.push(`label: "${index.label.replace(/"/g, '\\"')}"`)
  if (index.icon !== undefined) lines.push(`icon: ${index.icon}`)
  if (index.color !== undefined) lines.push(`color: "${index.color.replace(/"/g, '\\"')}"`)
  if (index.renderAs !== undefined) lines.push(`renderAs: ${index.renderAs}`)
  lines.push('---', '', description.trim())
  return lines.join('\n')
}
