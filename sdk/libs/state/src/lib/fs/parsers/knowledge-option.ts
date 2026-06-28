// src/lib/fs/parsers/knowledge-option.ts
//
// Parser/serializer for knowledge/<domain>/<field>/<slug>.md — Wave-1.
// Per SPACE-SPEC the ONLY allowed frontmatter keys are:
//   description (REQUIRED when frontmatter is present), icon, color, label.
// The body is plain markdown.

import { parseFrontmatter, serializeFrontmatter } from './frontmatter'

// ── types ────────────────────────────────────────────────────────────────────

export interface KnowledgeOption {
  description: string
  icon?: string
  color?: string
  label?: string
  body: string
}

// ── allowed keys ─────────────────────────────────────────────────────────────

export const KNOWLEDGE_OPTION_ALLOWED_KEYS: readonly string[] = [
  'description',
  'icon',
  'color',
  'label',
] as const

// ── parse ────────────────────────────────────────────────────────────────────

/**
 * Parse the raw content of a knowledge option file (`<slug>.md`) into a
 * `KnowledgeOption`. Throws if any frontmatter key is not in
 * `KNOWLEDGE_OPTION_ALLOWED_KEYS`.
 */
export function parseKnowledgeOption(content: string): KnowledgeOption {
  const { frontmatter, content: body } = parseFrontmatter<Record<string, unknown>>(content)

  const unknownKeys = Object.keys(frontmatter).filter(
    (k) => !(KNOWLEDGE_OPTION_ALLOWED_KEYS as readonly string[]).includes(k),
  )
  if (unknownKeys.length > 0) {
    throw new Error(
      `Knowledge option has invalid frontmatter keys: ${unknownKeys.join(', ')}. ` +
        `Allowed: ${KNOWLEDGE_OPTION_ALLOWED_KEYS.join(', ')}.`,
    )
  }

  return {
    description: typeof frontmatter.description === 'string' ? frontmatter.description : '',
    icon: typeof frontmatter.icon === 'string' ? frontmatter.icon : undefined,
    color: typeof frontmatter.color === 'string' ? frontmatter.color : undefined,
    label: typeof frontmatter.label === 'string' ? frontmatter.label : undefined,
    body: body.trim(),
  }
}

// ── serialize ────────────────────────────────────────────────────────────────

/**
 * Serialize a `KnowledgeOption` back to the on-disk format.
 * Only writes a frontmatter block when at least one frontmatter field is
 * non-empty (description, icon, color, or label).
 */
export function serializeKnowledgeOption(option: KnowledgeOption): string {
  const fm: Record<string, string> = {}
  if (option.description) fm.description = option.description
  if (option.icon) fm.icon = option.icon
  if (option.color) fm.color = option.color
  if (option.label) fm.label = option.label

  const body = (option.body ?? '').trim()

  if (Object.keys(fm).length === 0) return body
  return serializeFrontmatter(fm, body ? `\n${body}` : '')
}
