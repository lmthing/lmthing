/**
 * Progressive decay for knowledge content in stop payloads.
 *
 * When the agent loads knowledge via loadKnowledge() and reads it via stop(),
 * the markdown content can be very large. As turns progress, older knowledge
 * stop messages are progressively truncated to conserve context window space.
 *
 * Decay tiers (by distance in turns from current):
 *   0     → full content (as serialized)
 *   1     → truncated: first ~300 chars per file + "...(truncated)"
 *   2     → headers: just markdown headings from each file
 *   3+    → names: just the loaded file paths
 */

import type { KnowledgeContent } from '../knowledge/types'

/** Symbol used to tag objects returned by loadKnowledge(). */
export const KNOWLEDGE_TAG = Symbol.for('lmthing:knowledge')

export interface KnowledgeDecayTiers {
  /** Distance 0..full: show full content */
  full: number
  /** Distance full+1..truncated: show truncated content */
  truncated: number
  /** Distance truncated+1..headers: show headers only */
  headers: number
  /** Beyond headers: show just file names */
}

const DEFAULT_TIERS: KnowledgeDecayTiers = {
  full: 0,
  truncated: 2,
  headers: 4,
}

export type KnowledgeDecayLevel = 'full' | 'truncated' | 'headers' | 'names'

export function getKnowledgeDecayLevel(
  distance: number,
  tiers: KnowledgeDecayTiers = DEFAULT_TIERS,
): KnowledgeDecayLevel {
  if (distance <= tiers.full) return 'full'
  if (distance <= tiers.truncated) return 'truncated'
  if (distance <= tiers.headers) return 'headers'
  return 'names'
}

/**
 * Check if a value was returned by loadKnowledge() (has the knowledge tag).
 */
export function isKnowledgeContent(value: unknown): value is KnowledgeContent {
  return (
    value !== null &&
    typeof value === 'object' &&
    (value as any)[KNOWLEDGE_TAG] === true
  )
}

/**
 * Tag an object as knowledge content (called by the loadKnowledge global).
 */
export function tagAsKnowledge<T extends object>(obj: T): T {
  Object.defineProperty(obj, KNOWLEDGE_TAG, {
    value: true,
    enumerable: false,
    configurable: false,
  })
  return obj
}

/**
 * Produce a decayed serialization of knowledge content for a stop message.
 */
export function decayKnowledgeValue(
  content: KnowledgeContent,
  distance: number,
  tiers: KnowledgeDecayTiers = DEFAULT_TIERS,
): string {
  const level = getKnowledgeDecayLevel(distance, tiers)

  switch (level) {
    case 'full':
      return formatFull(content)
    case 'truncated':
      return formatTruncated(content)
    case 'headers':
      return formatHeaders(content)
    case 'names':
      return formatNames(content)
  }
}

// ── Full: serialize nested structure with complete markdown ──

function formatFull(content: KnowledgeContent): string {
  return serializeNested(content, (md) => JSON.stringify(md))
}

// ── Truncated: first ~300 chars per file ──

function formatTruncated(content: KnowledgeContent): string {
  return serializeNested(content, (md) => {
    if (md.length <= 300) return JSON.stringify(md)
    return JSON.stringify(md.slice(0, 300) + `...(truncated, ${md.length} chars)`)
  })
}

// ── Headers: just # headings from each file ──

function formatHeaders(content: KnowledgeContent): string {
  return serializeNested(content, (md) => {
    const headers = md
      .split('\n')
      .filter((line) => /^#{1,4}\s/.test(line))
      .join(' | ')
    return JSON.stringify(headers || '(no headings)')
  })
}

// ── Names: just the loaded file paths ──

function formatNames(content: KnowledgeContent): string {
  const paths: string[] = []
  collectPaths(content, [], paths)
  return `[knowledge: ${paths.join(', ')}]`
}

function collectPaths(obj: Record<string, any>, prefix: string[], out: string[]): void {
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      out.push([...prefix, key].join('/'))
    } else if (typeof value === 'object' && value !== null) {
      collectPaths(value, [...prefix, key], out)
    }
  }
}

// ── Helper: recursively serialize nested structure, applying formatter to string leaves ──

function serializeNested(
  content: KnowledgeContent,
  formatLeaf: (md: string) => string,
): string {
  return serializeLevel(content, formatLeaf)
}

function serializeLevel(obj: Record<string, any>, formatLeaf: (md: string) => string): string {
  const entries: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      entries.push(`${JSON.stringify(key)}: ${formatLeaf(value)}`)
    } else if (typeof value === 'object' && value !== null) {
      entries.push(`${JSON.stringify(key)}: ${serializeLevel(value, formatLeaf)}`)
    }
  }
  return `{ ${entries.join(', ')} }`
}
