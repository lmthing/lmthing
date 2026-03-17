/**
 * Knowledge tree builder and file loader for spaces.
 *
 * Reads a space's knowledge/ directory, builds a tree of domains/fields/options,
 * and provides a loader function that reads selected markdown files on demand.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type {
  KnowledgeTree,
  KnowledgeDomain,
  KnowledgeField,
  KnowledgeOption,
  KnowledgeSelector,
  KnowledgeContent,
} from './types'

/**
 * Build a KnowledgeTree from a space's knowledge/ directory.
 */
export function buildKnowledgeTree(knowledgeDir: string): KnowledgeTree {
  if (!existsSync(knowledgeDir)) {
    return { domains: [] }
  }

  const domains: KnowledgeDomain[] = []
  const entries = readdirSync(knowledgeDir, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const domainPath = join(knowledgeDir, entry.name)
    const domain = readDomain(domainPath, entry.name)
    if (domain) domains.push(domain)
  }

  return { domains }
}

function readDomain(domainPath: string, slug: string): KnowledgeDomain | null {
  const configPath = join(domainPath, 'config.json')
  if (!existsSync(configPath)) return null

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'))
    const fields: KnowledgeField[] = []

    const entries = readdirSync(domainPath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const field = readField(join(domainPath, entry.name), entry.name)
      if (field) fields.push(field)
    }

    return {
      slug,
      label: config.label ?? slug,
      description: config.description ?? '',
      icon: config.icon ?? '',
      color: config.color ?? '#888888',
      fields,
    }
  } catch {
    return null
  }
}

function readField(fieldPath: string, slug: string): KnowledgeField | null {
  const configPath = join(fieldPath, 'config.json')
  if (!existsSync(configPath)) return null

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'))
    const options: KnowledgeOption[] = []

    // Read option .md files
    const entries = readdirSync(fieldPath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue
      const optionSlug = entry.name.replace(/\.md$/, '')
      const option = readOptionMeta(join(fieldPath, entry.name), optionSlug)
      if (option) options.push(option)
    }

    options.sort((a, b) => a.order - b.order)

    return {
      slug,
      label: config.label ?? slug,
      description: config.description ?? '',
      fieldType: config.fieldType ?? 'select',
      required: config.required ?? false,
      default: config.default,
      variableName: config.variableName ?? slug,
      options,
    }
  } catch {
    return null
  }
}

function readOptionMeta(filePath: string, slug: string): KnowledgeOption | null {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const fm = parseFrontmatter(content)
    return {
      slug,
      title: fm.title ?? slug,
      description: fm.description ?? '',
      order: fm.order ?? 99,
    }
  } catch {
    return null
  }
}

/**
 * Minimal YAML frontmatter parser — extracts key: value pairs from --- blocks.
 */
function parseFrontmatter(content: string): Record<string, any> {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}

  const result: Record<string, any> = {}
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w[\w-]*)\s*:\s*(.+)$/)
    if (!m) continue
    const [, key, raw] = m
    let value: any = raw.trim()
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    // Parse numbers
    if (/^\d+$/.test(value)) value = parseInt(value, 10)
    result[key] = value
  }
  return result
}

/**
 * Load knowledge file contents based on a selector object.
 *
 * The selector mirrors the knowledge tree structure:
 * { domainSlug: { fieldSlug: { optionSlug: true } } }
 *
 * Returns the same structure with markdown content:
 * { domainSlug: { fieldSlug: { optionSlug: "# Title\n..." } } }
 */
export function loadKnowledgeFiles(
  knowledgeDir: string,
  selector: KnowledgeSelector,
): KnowledgeContent {
  const result: KnowledgeContent = {}

  for (const [domainSlug, fields] of Object.entries(selector)) {
    if (typeof fields !== 'object' || fields === null) continue
    result[domainSlug] = {}

    for (const [fieldSlug, options] of Object.entries(fields)) {
      if (typeof options !== 'object' || options === null) continue
      result[domainSlug][fieldSlug] = {}

      for (const [optionSlug, selected] of Object.entries(options)) {
        if (selected !== true) continue
        const filePath = join(knowledgeDir, domainSlug, fieldSlug, `${optionSlug}.md`)
        if (!existsSync(filePath)) continue

        try {
          const content = readFileSync(filePath, 'utf-8')
          // Strip frontmatter, return body only
          const body = content.replace(/^---\n[\s\S]*?\n---\n*/, '').trim()
          result[domainSlug][fieldSlug][optionSlug] = body
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  return result
}

/**
 * Format the knowledge tree as a compact text representation for the system prompt.
 *
 * Output example:
 * ```
 * knowledge/
 * ├── chat-modes/          💬 Chat Modes — Different conversation styles
 * │   └── mode             [select] chatMode — Which conversation style
 * │       ├── casual       Casual — Relaxed, conversational interaction
 * │       ├── creative     Creative — Imaginative, free-form exploration
 * │       └── focused      Focused — Structured, goal-oriented dialogue
 * └── model-guide/         🤖 Model Guide — Model selection guidance
 *     └── model-tier       [select] modelTier — Which model tier to use
 *         ├── free-models   Free Models — Open-source and free-tier models
 *         └── premium-models Premium Models — Commercial high-capability models
 * ```
 */
export function formatKnowledgeTreeForPrompt(tree: KnowledgeTree): string {
  if (tree.domains.length === 0) return '(no knowledge loaded)'

  const lines: string[] = ['knowledge/']
  const domainCount = tree.domains.length

  for (let di = 0; di < domainCount; di++) {
    const domain = tree.domains[di]
    const isLastDomain = di === domainCount - 1
    const domainPrefix = isLastDomain ? '└── ' : '├── '
    const childPrefix = isLastDomain ? '    ' : '│   '

    lines.push(`${domainPrefix}${domain.slug}/          ${domain.icon} ${domain.label} — ${domain.description}`)

    const fieldCount = domain.fields.length
    for (let fi = 0; fi < fieldCount; fi++) {
      const field = domain.fields[fi]
      const isLastField = fi === fieldCount - 1
      const fieldPrefix = isLastField ? '└── ' : '├── '
      const optionChildPrefix = isLastField ? '    ' : '│   '

      lines.push(`${childPrefix}${fieldPrefix}${field.slug}             [${field.fieldType}] ${field.variableName} — ${field.description}`)

      const optionCount = field.options.length
      for (let oi = 0; oi < optionCount; oi++) {
        const option = field.options[oi]
        const isLastOption = oi === optionCount - 1
        const optionPrefix = isLastOption ? '└── ' : '├── '

        lines.push(`${childPrefix}${optionChildPrefix}${optionPrefix}${option.slug}       ${option.title} — ${option.description}`)
      }
    }
  }

  return lines.join('\n')
}
