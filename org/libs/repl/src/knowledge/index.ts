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
  FlatKnowledgeSelector,
  FlatKnowledgeContent,
} from './types'

/**
 * Merge multiple KnowledgeTrees into one. Domains with the same slug are
 * combined (fields are merged); distinct domains are concatenated.
 */
export function mergeKnowledgeTrees(trees: KnowledgeTree[]): KnowledgeTree {
  const domainMap = new Map<string, KnowledgeDomain>()

  for (const tree of trees) {
    for (const domain of tree.domains) {
      const existing = domainMap.get(domain.slug)
      if (!existing) {
        domainMap.set(domain.slug, { ...domain, fields: [...domain.fields] })
      } else {
        // Merge fields — same-slug fields are replaced, new ones appended
        const fieldSlugs = new Set(existing.fields.map(f => f.slug))
        for (const field of domain.fields) {
          if (!fieldSlugs.has(field.slug)) {
            existing.fields.push(field)
          }
        }
      }
    }
  }

  return { domains: [...domainMap.values()] }
}

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
  selector: FlatKnowledgeSelector,
): FlatKnowledgeContent {
  const result: FlatKnowledgeContent = {}

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
 * Format knowledge trees as a compact text representation for the system prompt.
 *
 * Accepts a single tree or an array of named trees. When multiple trees are
 * provided, they are grouped under their space name:
 *
 * ```
 * knowledge/
 * ├── cooking/
 * │   ├── cuisine/          🌍 Cuisine — World cuisine traditions
 * │   │   └── type          [select] cuisineType — Which cuisine
 * │   │       ├── italian   Italian — Mediterranean cooking
 * │   │       └── japanese  Japanese — East Asian cuisine
 * │   └── technique/        🔥 Technique — Cooking methods
 * │       └── method        [select] cookMethod — Which method
 * └── nutrition/
 *     ├── macronutrients/   💪 Macronutrients — Protein, carbs, fats
 *     │   └── type          [select] macroType — Which macro
 *     └── vitamins/         🧬 Vitamins & Minerals
 *         └── nutrient      [select] nutrient — Which nutrient
 * ```
 */
export function formatKnowledgeTreeForPrompt(treeOrTrees: KnowledgeTree | KnowledgeTree[]): string {
  const trees = Array.isArray(treeOrTrees) ? treeOrTrees : [treeOrTrees]
  const allDomains = trees.flatMap(t => t.domains)
  if (allDomains.length === 0) return '(no knowledge loaded)'

  // If any tree has a name, group domains by space
  const hasNames = trees.some(t => t.name)
  if (!hasNames || trees.length === 1 && !trees[0].name) {
    return formatFlatTree(allDomains)
  }

  return formatGroupedTree(trees)
}

function formatFlatTree(domains: KnowledgeDomain[]): string {
  const lines: string[] = ['knowledge/']
  const domainCount = domains.length

  for (let di = 0; di < domainCount; di++) {
    const domain = domains[di]
    const isLast = di === domainCount - 1
    formatDomain(lines, domain, isLast ? '└── ' : '├── ', isLast ? '    ' : '│   ')
  }

  return lines.join('\n')
}

function formatGroupedTree(trees: KnowledgeTree[]): string {
  const lines: string[] = ['knowledge/']
  // Filter out empty trees
  const nonEmpty = trees.filter(t => t.domains.length > 0)

  for (let ti = 0; ti < nonEmpty.length; ti++) {
    const tree = nonEmpty[ti]
    const isLastTree = ti === nonEmpty.length - 1
    const treePrefix = isLastTree ? '└── ' : '├── '
    const treeChildPrefix = isLastTree ? '    ' : '│   '

    lines.push(`${treePrefix}${tree.name ?? 'unknown'}/`)

    const domainCount = tree.domains.length
    for (let di = 0; di < domainCount; di++) {
      const domain = tree.domains[di]
      const isLastDomain = di === domainCount - 1
      formatDomain(
        lines,
        domain,
        treeChildPrefix + (isLastDomain ? '└── ' : '├── '),
        treeChildPrefix + (isLastDomain ? '    ' : '│   '),
      )
    }
  }

  return lines.join('\n')
}

function formatDomain(lines: string[], domain: KnowledgeDomain, prefix: string, childPrefix: string): void {
  lines.push(`${prefix}${domain.slug}/          ${domain.icon} ${domain.label} — ${domain.description}`)

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
