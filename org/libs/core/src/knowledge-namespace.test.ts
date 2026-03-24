import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createKnowledgeNamespace, formatKnowledgeNamespaceForPrompt } from './agent-namespaces'
import { buildKnowledgeTree, loadKnowledgeFiles, ensureMemoryDomain } from '@lmthing/repl'

const TEST_DIR = join(__dirname, '../.test-knowledge-ns')

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
  mkdirSync(TEST_DIR, { recursive: true })
})

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

describe('createKnowledgeNamespace', () => {
  it('returns an object with a writer function', () => {
    const ns = createKnowledgeNamespace({ knowledgeDir: TEST_DIR })
    expect(ns).toHaveProperty('writer')
    expect(typeof ns.writer).toBe('function')
  })

  it('writer returns save, remove, and addOptions methods', () => {
    const ns = createKnowledgeNamespace({ knowledgeDir: TEST_DIR })
    const w = (ns.writer as Function)({ field: 'memory/project' })

    expect(typeof w.save).toBe('function')
    expect(typeof w.remove).toBe('function')
    expect(typeof w.addOptions).toBe('function')
  })

  it('save writes a file to disk', async () => {
    const ns = createKnowledgeNamespace({ knowledgeDir: TEST_DIR })
    const w = (ns.writer as Function)({ field: 'memory/project' })

    await w.save('auth-flow', 'Auth uses SSO codes.')

    expect(existsSync(join(TEST_DIR, 'memory', 'project', 'auth-flow.md'))).toBe(true)
    const content = readFileSync(join(TEST_DIR, 'memory', 'project', 'auth-flow.md'), 'utf-8')
    expect(content).toContain('Auth uses SSO codes.')
  })

  it('remove deletes a file from disk', async () => {
    const ns = createKnowledgeNamespace({ knowledgeDir: TEST_DIR })
    const w = (ns.writer as Function)({ field: 'memory/feedback' })

    await w.save('old-approach', 'outdated guidance')
    expect(existsSync(join(TEST_DIR, 'memory', 'feedback', 'old-approach.md'))).toBe(true)

    const deleted = await w.remove('old-approach')
    expect(deleted).toBe(true)
    expect(existsSync(join(TEST_DIR, 'memory', 'feedback', 'old-approach.md'))).toBe(false)
  })

  it('remove returns false for non-existent file', async () => {
    const ns = createKnowledgeNamespace({ knowledgeDir: TEST_DIR })
    const w = (ns.writer as Function)({ field: 'memory/project' })

    const deleted = await w.remove('nonexistent')
    expect(deleted).toBe(false)
  })

  it('addOptions creates multiple files', async () => {
    const ns = createKnowledgeNamespace({ knowledgeDir: TEST_DIR })
    const w = (ns.writer as Function)({ field: 'cuisine/type' })

    await w.addOptions(
      'Store these recipes',
      { name: 'Italian Pasta', content: 'Classic pasta dishes' },
      { name: 'Japanese Sushi', content: 'Traditional sushi preparation' },
    )

    expect(existsSync(join(TEST_DIR, 'cuisine', 'type', 'italian-pasta.md'))).toBe(true)
    expect(existsSync(join(TEST_DIR, 'cuisine', 'type', 'japanese-sushi.md'))).toBe(true)
  })

  it('addOptions handles string data items', async () => {
    const ns = createKnowledgeNamespace({ knowledgeDir: TEST_DIR })
    const w = (ns.writer as Function)({ field: 'memory/reference' })

    await w.addOptions('Save these references', 'Linear project INGEST', 'Grafana dashboard')

    const files = readdirSync(join(TEST_DIR, 'memory', 'reference'))
      .filter((f: string) => f.endsWith('.md'))
    expect(files.length).toBe(2)
  })

  it('calls onKnowledgeSaved callback after save', async () => {
    const onSaved = vi.fn()
    const ns = createKnowledgeNamespace({
      knowledgeDir: TEST_DIR,
      onKnowledgeSaved: onSaved,
    })
    const w = (ns.writer as Function)({ field: 'memory/project' })

    await w.save('test', 'content')

    expect(onSaved).toHaveBeenCalledWith('memory', 'project', 'test')
  })

  it('calls onKnowledgeRemoved callback after remove', async () => {
    const onRemoved = vi.fn()
    const ns = createKnowledgeNamespace({
      knowledgeDir: TEST_DIR,
      onKnowledgeRemoved: onRemoved,
    })
    const w = (ns.writer as Function)({ field: 'memory/feedback' })

    await w.save('entry', 'content')
    await w.remove('entry')

    expect(onRemoved).toHaveBeenCalledWith('memory', 'feedback', 'entry')
  })

  it('does not call onKnowledgeRemoved for non-existent file', async () => {
    const onRemoved = vi.fn()
    const ns = createKnowledgeNamespace({
      knowledgeDir: TEST_DIR,
      onKnowledgeRemoved: onRemoved,
    })
    const w = (ns.writer as Function)({ field: 'memory/project' })

    await w.remove('nonexistent')

    expect(onRemoved).not.toHaveBeenCalled()
  })
})

describe('knowledge namespace integration with knowledge tree', () => {
  it('saved entries appear in rebuilt knowledge tree', async () => {
    ensureMemoryDomain(TEST_DIR)

    const ns = createKnowledgeNamespace({ knowledgeDir: TEST_DIR })
    const w = (ns.writer as Function)({ field: 'memory/project' })
    await w.save('auth-flow', 'Auth uses SSO codes.')

    const tree = buildKnowledgeTree(TEST_DIR)
    const memoryDomain = tree.domains.find(d => d.slug === 'memory')
    expect(memoryDomain).toBeDefined()

    const projectField = memoryDomain!.fields.find(f => f.slug === 'project')
    expect(projectField).toBeDefined()

    const authOption = projectField!.options.find(o => o.slug === 'auth-flow')
    expect(authOption).toBeDefined()
    expect(authOption!.title).toBe('Auth Flow')
  })

  it('saved entries can be loaded via loadKnowledgeFiles', async () => {
    ensureMemoryDomain(TEST_DIR)

    const ns = createKnowledgeNamespace({ knowledgeDir: TEST_DIR })
    const w = (ns.writer as Function)({ field: 'memory/project' })
    await w.save('auth-flow', 'Auth uses SSO codes with 60s TTL.')

    const content = loadKnowledgeFiles(TEST_DIR, {
      memory: { project: { 'auth-flow': true } },
    })

    expect(content.memory.project['auth-flow']).toContain('Auth uses SSO codes with 60s TTL.')
  })

  it('deleted entries disappear from rebuilt knowledge tree', async () => {
    ensureMemoryDomain(TEST_DIR)

    const ns = createKnowledgeNamespace({ knowledgeDir: TEST_DIR })
    const w = (ns.writer as Function)({ field: 'memory/project' })
    await w.save('temp-entry', 'temporary')
    await w.remove('temp-entry')

    const tree = buildKnowledgeTree(TEST_DIR)
    const memoryDomain = tree.domains.find(d => d.slug === 'memory')
    const projectField = memoryDomain!.fields.find(f => f.slug === 'project')
    const tempOption = projectField!.options.find(o => o.slug === 'temp-entry')
    expect(tempOption).toBeUndefined()
  })
})

describe('formatKnowledgeNamespaceForPrompt', () => {
  it('returns knowledge namespace declaration', () => {
    const prompt = formatKnowledgeNamespaceForPrompt()
    expect(prompt).toContain('knowledge {')
    expect(prompt).toContain('writer(')
    expect(prompt).toContain('save(')
    expect(prompt).toContain('remove(')
    expect(prompt).toContain('addOptions(')
  })
})
