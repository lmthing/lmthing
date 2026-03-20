/**
 * Knowledge writer — creates, updates, and deletes knowledge files on disk.
 *
 * Used by the built-in `knowledge` agent namespace to persist memories
 * and manage knowledge entries. Files follow the same domain/field/option
 * structure as regular knowledge.
 */

import { mkdirSync, writeFileSync, unlinkSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** Default memory domain configuration. */
const MEMORY_DOMAIN_CONFIG = {
  label: 'Memory',
  description: 'Persistent agent memory',
  icon: '🧠',
  color: '#9b59b6',
  renderAs: 'section',
}

/** Default field configs for each memory type. */
const MEMORY_FIELDS: Record<string, { label: string; description: string; fieldType: string; variableName: string }> = {
  user: {
    label: 'User',
    description: 'User preferences and context',
    fieldType: 'text',
    variableName: 'userMemory',
  },
  project: {
    label: 'Project',
    description: 'Project-specific knowledge',
    fieldType: 'text',
    variableName: 'projectMemory',
  },
  feedback: {
    label: 'Feedback',
    description: 'Behavioral guidance',
    fieldType: 'text',
    variableName: 'feedbackMemory',
  },
  reference: {
    label: 'Reference',
    description: 'External resource pointers',
    fieldType: 'text',
    variableName: 'referenceMemory',
  },
}

/**
 * Save a knowledge file to disk.
 *
 * Creates domain/field directories and config.json files if they don't exist.
 * Writes the option as a markdown file with frontmatter.
 */
export function saveKnowledgeFile(
  knowledgeDir: string,
  domain: string,
  field: string,
  option: string,
  content: string,
): void {
  const domainDir = join(knowledgeDir, domain)
  const fieldDir = join(domainDir, field)
  const filePath = join(fieldDir, `${option}.md`)

  // Ensure directories exist
  mkdirSync(fieldDir, { recursive: true })

  // Create domain config.json if missing
  const domainConfigPath = join(domainDir, 'config.json')
  if (!existsSync(domainConfigPath)) {
    if (domain === 'memory') {
      writeFileSync(domainConfigPath, JSON.stringify(MEMORY_DOMAIN_CONFIG, null, 2), 'utf-8')
    } else {
      writeFileSync(domainConfigPath, JSON.stringify({
        label: domain.charAt(0).toUpperCase() + domain.slice(1),
        description: '',
        icon: '📁',
        color: '#888888',
        renderAs: 'section',
      }, null, 2), 'utf-8')
    }
  }

  // Create field config.json if missing
  const fieldConfigPath = join(fieldDir, 'config.json')
  if (!existsSync(fieldConfigPath)) {
    const memoryFieldConfig = MEMORY_FIELDS[field]
    if (domain === 'memory' && memoryFieldConfig) {
      writeFileSync(fieldConfigPath, JSON.stringify({
        ...memoryFieldConfig,
        required: false,
        renderAs: 'field',
      }, null, 2), 'utf-8')
    } else {
      writeFileSync(fieldConfigPath, JSON.stringify({
        label: field.charAt(0).toUpperCase() + field.slice(1),
        description: '',
        fieldType: 'text',
        required: false,
        variableName: field,
        renderAs: 'field',
      }, null, 2), 'utf-8')
    }
  }

  // Build markdown content with frontmatter
  const title = option
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  const hasFrontmatter = content.trimStart().startsWith('---')
  let fileContent: string
  if (hasFrontmatter) {
    fileContent = content
  } else {
    fileContent = `---
title: ${title}
description: ${content.slice(0, 80).replace(/\n/g, ' ')}
order: 99
---

${content}
`
  }

  writeFileSync(filePath, fileContent, 'utf-8')
}

/**
 * Delete a knowledge option file.
 */
export function deleteKnowledgeFile(
  knowledgeDir: string,
  domain: string,
  field: string,
  option: string,
): boolean {
  const filePath = join(knowledgeDir, domain, field, `${option}.md`)
  if (!existsSync(filePath)) return false

  unlinkSync(filePath)
  return true
}

/**
 * Ensure the memory domain exists in a knowledge directory.
 *
 * Creates the `memory/` domain with `user`, `project`, `feedback`,
 * and `reference` field directories plus their config.json files.
 * Idempotent — skips already-existing entries.
 */
export function ensureMemoryDomain(knowledgeDir: string): void {
  if (!existsSync(knowledgeDir)) {
    mkdirSync(knowledgeDir, { recursive: true })
  }

  const memoryDir = join(knowledgeDir, 'memory')
  mkdirSync(memoryDir, { recursive: true })

  // Domain config
  const domainConfigPath = join(memoryDir, 'config.json')
  if (!existsSync(domainConfigPath)) {
    writeFileSync(domainConfigPath, JSON.stringify(MEMORY_DOMAIN_CONFIG, null, 2), 'utf-8')
  }

  // Field directories + configs
  for (const [fieldSlug, fieldConfig] of Object.entries(MEMORY_FIELDS)) {
    const fieldDir = join(memoryDir, fieldSlug)
    mkdirSync(fieldDir, { recursive: true })

    const fieldConfigPath = join(fieldDir, 'config.json')
    if (!existsSync(fieldConfigPath)) {
      writeFileSync(fieldConfigPath, JSON.stringify({
        ...fieldConfig,
        required: false,
        renderAs: 'field',
      }, null, 2), 'utf-8')
    }
  }
}

/**
 * List all options (markdown files) in a knowledge field.
 */
export function listKnowledgeOptions(
  knowledgeDir: string,
  domain: string,
  field: string,
): string[] {
  const fieldDir = join(knowledgeDir, domain, field)
  if (!existsSync(fieldDir)) return []

  return readdirSync(fieldDir, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith('.md'))
    .map(e => e.name.replace(/\.md$/, ''))
}

/**
 * Parse a "domain/field" path from the writer's `field` param.
 * Supports both "domain/field" and plain "field" (defaults to memory domain).
 */
export function parseFieldPath(fieldParam: string): { domain: string; field: string } {
  const parts = fieldParam.split('/')
  if (parts.length >= 2) {
    return { domain: parts[0], field: parts.slice(1).join('/') }
  }
  // Plain name defaults to memory domain
  return { domain: 'memory', field: parts[0] }
}
