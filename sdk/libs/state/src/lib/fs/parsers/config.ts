// src/lib/fs/parsers/config.ts
//
// Parsers for knowledge/<domain>/<field>/index.md — NEW SPEC.
// The old AgentConfig/AgentValues/KnowledgeConfig (JSON files) are retired.
// Those types are kept as deprecated aliases so existing call sites compile.

import { parseFrontmatter } from './frontmatter'

// ---------------------------------------------------------------------------
// Knowledge field index: knowledge/<domain>/<field>/index.md
// ---------------------------------------------------------------------------

export interface KnowledgeFieldIndex {
  type: string // "string" | "number" | "boolean" | "object" | "array"
  variable: string
  default?: string
}

export function parseKnowledgeFieldIndex(content: string): KnowledgeFieldIndex & { description: string } {
  const { frontmatter: raw, content: body } = parseFrontmatter<Record<string, unknown>>(content)
  return {
    type: typeof raw.type === 'string' ? raw.type : 'string',
    variable: typeof raw.variable === 'string' ? raw.variable : '',
    default: typeof raw.default === 'string' ? raw.default : undefined,
    description: body.trim(),
  }
}

export function serializeKnowledgeFieldIndex(index: KnowledgeFieldIndex, description: string): string {
  const lines = ['---', `type: ${index.type}`, `variable: ${index.variable}`]
  if (index.default !== undefined) lines.push(`default: ${index.default}`)
  lines.push('---', '', description.trim())
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Deprecated — kept for backward compatibility only.
// These types were used by the OLD spec (config.json / values.json files).
// ---------------------------------------------------------------------------

/** @deprecated The new spec has no per-agent config.json. */
export interface AgentConfig {
  enabled?: boolean
  model?: string
  temperature?: number
  maxTokens?: number
  frequencyPenalty?: number
  presencePenalty?: number
  stopSequences?: string[]
  timeout?: number
  retries?: number
  [key: string]: unknown
}

/** @deprecated */
export function parseAgentConfig(content: string): AgentConfig {
  try {
    return JSON.parse(content) as AgentConfig
  } catch {
    return {}
  }
}

/** @deprecated */
export function serializeAgentConfig(config: AgentConfig): string {
  return JSON.stringify(config, null, 2)
}

/** @deprecated The new spec has no per-agent values.json. */
export interface AgentValues {
  [key: string]: string | number | boolean | null
}

/** @deprecated */
export function parseAgentValues(content: string): AgentValues {
  try {
    return JSON.parse(content) as AgentValues
  } catch {
    return {}
  }
}

/** @deprecated */
export function serializeAgentValues(values: AgentValues): string {
  return JSON.stringify(values, null, 2)
}

/** @deprecated The new spec has no knowledge/domain/config.json. */
export interface KnowledgeConfig {
  title?: string
  description?: string
  tags?: string[]
  embeddingModel?: string
  chunkSize?: number
  chunkOverlap?: number
  [key: string]: unknown
}

/** @deprecated */
export function parseKnowledgeConfig(content: string): KnowledgeConfig {
  try {
    return JSON.parse(content) as KnowledgeConfig
  } catch {
    return {}
  }
}

/** @deprecated */
export function serializeKnowledgeConfig(config: KnowledgeConfig): string {
  return JSON.stringify(config, null, 2)
}
