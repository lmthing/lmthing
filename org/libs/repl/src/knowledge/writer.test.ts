import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  saveKnowledgeFile,
  deleteKnowledgeFile,
  ensureMemoryDomain,
  listKnowledgeOptions,
  parseFieldPath,
} from './writer'

const TEST_DIR = join(__dirname, '../../.test-knowledge-writer')

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
  mkdirSync(TEST_DIR, { recursive: true })
})

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

describe('parseFieldPath', () => {
  it('parses domain/field notation', () => {
    expect(parseFieldPath('memory/project')).toEqual({ domain: 'memory', field: 'project' })
  })

  it('parses nested paths', () => {
    expect(parseFieldPath('cuisine/type')).toEqual({ domain: 'cuisine', field: 'type' })
  })

  it('defaults single segment to memory domain', () => {
    expect(parseFieldPath('project')).toEqual({ domain: 'memory', field: 'project' })
  })
})

describe('saveKnowledgeFile', () => {
  it('creates domain dir, field dir, and config files', () => {
    saveKnowledgeFile(TEST_DIR, 'cuisine', 'type', 'italian', 'Italian cooking traditions')

    expect(existsSync(join(TEST_DIR, 'cuisine', 'config.json'))).toBe(true)
    expect(existsSync(join(TEST_DIR, 'cuisine', 'type', 'config.json'))).toBe(true)
    expect(existsSync(join(TEST_DIR, 'cuisine', 'type', 'italian.md'))).toBe(true)
  })

  it('writes markdown with frontmatter when content has none', () => {
    saveKnowledgeFile(TEST_DIR, 'memory', 'project', 'auth-flow', 'Auth uses SSO codes with 60s TTL.')

    const content = readFileSync(join(TEST_DIR, 'memory', 'project', 'auth-flow.md'), 'utf-8')
    expect(content).toContain('---')
    expect(content).toContain('title: Auth Flow')
    expect(content).toContain('Auth uses SSO codes with 60s TTL.')
  })

  it('preserves existing frontmatter', () => {
    const withFm = `---
title: Custom Title
order: 1
---

Custom content here.
`
    saveKnowledgeFile(TEST_DIR, 'memory', 'user', 'role', withFm)

    const content = readFileSync(join(TEST_DIR, 'memory', 'user', 'role.md'), 'utf-8')
    expect(content).toContain('title: Custom Title')
    expect(content).toContain('order: 1')
    expect(content).toContain('Custom content here.')
  })

  it('creates memory domain config with correct metadata', () => {
    saveKnowledgeFile(TEST_DIR, 'memory', 'project', 'test', 'test content')

    const config = JSON.parse(readFileSync(join(TEST_DIR, 'memory', 'config.json'), 'utf-8'))
    expect(config.label).toBe('Memory')
    expect(config.icon).toBe('🧠')
  })

  it('creates memory field config with correct metadata', () => {
    saveKnowledgeFile(TEST_DIR, 'memory', 'feedback', 'test', 'test content')

    const config = JSON.parse(readFileSync(join(TEST_DIR, 'memory', 'feedback', 'config.json'), 'utf-8'))
    expect(config.label).toBe('Feedback')
    expect(config.variableName).toBe('feedbackMemory')
  })

  it('creates generic config for non-memory domains', () => {
    saveKnowledgeFile(TEST_DIR, 'recipes', 'main', 'pasta', 'Pasta recipe')

    const config = JSON.parse(readFileSync(join(TEST_DIR, 'recipes', 'config.json'), 'utf-8'))
    expect(config.label).toBe('Recipes')
    expect(config.icon).toBe('📁')
  })

  it('overwrites existing option file', () => {
    saveKnowledgeFile(TEST_DIR, 'memory', 'project', 'auth', 'v1')
    saveKnowledgeFile(TEST_DIR, 'memory', 'project', 'auth', 'v2 updated')

    const content = readFileSync(join(TEST_DIR, 'memory', 'project', 'auth.md'), 'utf-8')
    expect(content).toContain('v2 updated')
    expect(content).not.toContain('v1')
  })

  it('does not overwrite existing config files', () => {
    saveKnowledgeFile(TEST_DIR, 'memory', 'project', 'first', 'first entry')
    const configBefore = readFileSync(join(TEST_DIR, 'memory', 'config.json'), 'utf-8')

    saveKnowledgeFile(TEST_DIR, 'memory', 'project', 'second', 'second entry')
    const configAfter = readFileSync(join(TEST_DIR, 'memory', 'config.json'), 'utf-8')

    expect(configBefore).toBe(configAfter)
  })
})

describe('deleteKnowledgeFile', () => {
  it('deletes an existing option file', () => {
    saveKnowledgeFile(TEST_DIR, 'memory', 'project', 'to-delete', 'content')
    expect(existsSync(join(TEST_DIR, 'memory', 'project', 'to-delete.md'))).toBe(true)

    const result = deleteKnowledgeFile(TEST_DIR, 'memory', 'project', 'to-delete')
    expect(result).toBe(true)
    expect(existsSync(join(TEST_DIR, 'memory', 'project', 'to-delete.md'))).toBe(false)
  })

  it('returns false for non-existent file', () => {
    const result = deleteKnowledgeFile(TEST_DIR, 'memory', 'project', 'nonexistent')
    expect(result).toBe(false)
  })

  it('leaves config files intact', () => {
    saveKnowledgeFile(TEST_DIR, 'memory', 'project', 'entry', 'content')
    deleteKnowledgeFile(TEST_DIR, 'memory', 'project', 'entry')

    expect(existsSync(join(TEST_DIR, 'memory', 'config.json'))).toBe(true)
    expect(existsSync(join(TEST_DIR, 'memory', 'project', 'config.json'))).toBe(true)
  })
})

describe('ensureMemoryDomain', () => {
  it('creates memory domain with all four fields', () => {
    ensureMemoryDomain(TEST_DIR)

    expect(existsSync(join(TEST_DIR, 'memory', 'config.json'))).toBe(true)
    expect(existsSync(join(TEST_DIR, 'memory', 'user', 'config.json'))).toBe(true)
    expect(existsSync(join(TEST_DIR, 'memory', 'project', 'config.json'))).toBe(true)
    expect(existsSync(join(TEST_DIR, 'memory', 'feedback', 'config.json'))).toBe(true)
    expect(existsSync(join(TEST_DIR, 'memory', 'reference', 'config.json'))).toBe(true)
  })

  it('is idempotent — does not overwrite existing configs', () => {
    ensureMemoryDomain(TEST_DIR)
    const configBefore = readFileSync(join(TEST_DIR, 'memory', 'config.json'), 'utf-8')

    ensureMemoryDomain(TEST_DIR)
    const configAfter = readFileSync(join(TEST_DIR, 'memory', 'config.json'), 'utf-8')

    expect(configBefore).toBe(configAfter)
  })

  it('creates knowledge dir if it does not exist', () => {
    const newDir = join(TEST_DIR, 'nonexistent', 'knowledge')
    ensureMemoryDomain(newDir)

    expect(existsSync(join(newDir, 'memory', 'config.json'))).toBe(true)
  })

  it('memory domain config has correct icon and label', () => {
    ensureMemoryDomain(TEST_DIR)

    const config = JSON.parse(readFileSync(join(TEST_DIR, 'memory', 'config.json'), 'utf-8'))
    expect(config.label).toBe('Memory')
    expect(config.icon).toBe('🧠')
    expect(config.color).toBe('#9b59b6')
  })
})

describe('listKnowledgeOptions', () => {
  it('lists markdown files in a field directory', () => {
    saveKnowledgeFile(TEST_DIR, 'memory', 'project', 'auth', 'auth content')
    saveKnowledgeFile(TEST_DIR, 'memory', 'project', 'deploy', 'deploy content')

    const options = listKnowledgeOptions(TEST_DIR, 'memory', 'project')
    expect(options.sort()).toEqual(['auth', 'deploy'])
  })

  it('returns empty array for non-existent field', () => {
    const options = listKnowledgeOptions(TEST_DIR, 'memory', 'nonexistent')
    expect(options).toEqual([])
  })

  it('does not include config.json', () => {
    saveKnowledgeFile(TEST_DIR, 'memory', 'project', 'entry', 'content')

    const options = listKnowledgeOptions(TEST_DIR, 'memory', 'project')
    expect(options).not.toContain('config')
    expect(options).toContain('entry')
  })
})
