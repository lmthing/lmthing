/**
 * Integration tests for @lmthing/repl features.
 *
 * These tests require API keys in .env:
 * - AZURE_API_KEY or ZAI_API_KEY
 *
 * Run with:
 *   pnpm test src/integration/spaces-llm-integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'

// Check if API keys are available
const hasKeys = !!process.env.AZURE_API_KEY || !!process.env.ZAI_API_KEY

// ── Test Environment Setup ─────────────────────────────────────────────────────

let gitRepoDir: string
let workingDir: string

beforeAll(async () => {
  gitRepoDir = await mkdtemp(join(tmpdir(), 'lmthing-git-'))
  workingDir = await mkdtemp(join(tmpdir(), 'lmthing-work-'))

  // Initialize git repo for auto-commit tests
  try {
    execSync('git init', { cwd: gitRepoDir, stdio: 'ignore' })
    execSync('git config user.email "test@example.com"', { cwd: gitRepoDir, stdio: 'ignore' })
    execSync('git config user.name "THING Agent"', { cwd: gitRepoDir, stdio: 'ignore' })
    await writeFile(join(gitRepoDir, '.gitkeep'), '')
    execSync('git add .gitkeep', { cwd: gitRepoDir, stdio: 'ignore' })
    execSync('git commit -m "Initial"', { cwd: gitRepoDir, stdio: 'ignore' })
  } catch {
    // Git not available
  }
})

afterAll(async () => {
  await rm(gitRepoDir, { recursive: true, force: true })
  await rm(workingDir, { recursive: true, force: true })
})

// ── Tests: Git Auto-Commit ─────────────────────────────────────────────────────

describe('Integration: Git Auto-Commit', () => {
  it('GitClient commits files', async () => {
    const { createGitClient } = await import('../git/client')

    const gitClient = createGitClient({ workingDir: gitRepoDir })

    // Create a test file
    await writeFile(join(gitRepoDir, 'test.txt'), 'Hello, Git!')
    const result = await gitClient.commitFile('test.txt', 'Add test file')

    expect(result.ok).toBe(true)
    expect(result.hash).toBeDefined()
    expect(result.hash).toMatch(/^[a-f0-9]{7,8}$/)
  })

  it('GitClient checks status', async () => {
    const { createGitClient } = await import('../git/client')

    const gitClient = createGitClient({ workingDir: gitRepoDir })
    const status = await gitClient.getStatus()

    expect(status.isRepo).toBe(true)
    expect(status.hasChanges).toBe(false) // Should be clean after commit
  })
})

// ── Tests: Vector Search ───────────────────────────────────────────────────────

describe('Integration: Vector Search', () => {
  it('VectorIndex indexes and searches knowledge', async () => {
    const { VectorIndex } = await import('@lmthing/repl')

    const index = new VectorIndex()

    // Index some knowledge
    index.index(
      'For creating agents, define their role, instructions, and available tools.',
      'const agent = new Agent()',
      1
    )
    index.index(
      'For workspace management, use the Session class to manage state.',
      'const session = new Session()',
      2
    )
    index.index(
      'For deploying spaces, use the deployment API to publish your agents.',
      'const deployment = new Deployment()',
      3
    )

    // Search for agent creation
    const results = index.search('how to create agents')

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].turn).toBe(1) // Should match the agent creation turn
    expect(results[0].score).toBeGreaterThan(0)
    expect(results[0].text).toContain('creating agents')
  })

  it('VectorIndex limits results with topK', () => {
    const { VectorIndex } = await import('@lmthing/repl')

    const index = new VectorIndex()

    // Add multiple documents
    for (let i = 1; i <= 10; i++) {
      index.index(`Document ${i} content`, `code ${i}`, i)
    }

    const results = index.search('document', 3)
    expect(results.length).toBeLessThanOrEqual(3)
  })

  it('VectorIndex clears all documents', () => {
    const { VectorIndex } = await import('@lmthing/repl')

    const index = new VectorIndex()

    index.index('test', 'code', 1)
    index.index('test2', 'code2', 2)

    expect(index.size).toBe(2)

    index.clear()
    expect(index.size).toBe(0)
  })
})

// ── Tests: Session Creation ────────────────────────────────────────────────────

describe('Integration: Session Creation', () => {
  it('creates session with default options', async () => {
    const { Session } = await import('@lmthing/repl')

    const session = new Session()

    expect(session).toBeDefined()
    expect(session.getStatus()).toBe('idle')
    expect(session.getScope()).toBeDefined()
    expect(Array.isArray(session.getScope())).toBe(true)

    session.destroy()
  })

  it('creates session with git client', async () => {
    const { Session } = await import('@lmthing/repl')
    const { createGitClient } = await import('../git/client')

    const gitClient = createGitClient({ workingDir: gitRepoDir })

    const session = new Session({
      gitClient,
      autoCommit: true,
      fileWorkingDir: gitRepoDir,
    })

    expect(session).toBeDefined()
    expect(session.getStatus()).toBe('idle')

    session.destroy()
  })

  it('session provides memory access', async () => {
    const { Session } = await import('@lmthing/repl')

    const session = new Session()

    expect(session.getPinnedMemory()).toBeInstanceOf(Map)
    expect(session.getMemoMemory()).toBeInstanceOf(Map)

    session.destroy()
  })

  it('session scope table returns string', async () => {
    const { Session } = await import('@lmthing/repl')

    const session = new Session()

    const scopeTable = session.getScopeTable()
    expect(typeof scopeTable).toBe('string')
    expect(scopeTable.length).toBeGreaterThan(0)

    session.destroy()
  })
})

// ── Tests: Knowledge Tree (with mock data) ──────────────────────────────────────

describe('Integration: Knowledge Tree', () => {
  it('builds knowledge tree from mock structure', async () => {
    const { buildKnowledgeTree } = await import('@lmthing/repl')

    // buildKnowledgeTree returns { domains: [] } if directory doesn't exist
    const tree = buildKnowledgeTree('/nonexistent/path')

    expect(tree).toBeDefined()
    expect(tree.domains).toBeDefined()
    expect(Array.isArray(tree.domains)).toBe(true)
  })

  it('formats knowledge tree for prompt', async () => {
    const { formatKnowledgeTreeForPrompt } = await import('@lmthing/repl')

    const mockTrees = [
      {
        name: 'test-space',
        domains: [
          {
            name: 'test-domain',
            sections: [
              {
                name: 'test-section',
                fields: [],
              },
            ],
          },
        ],
      },
    ]

    const formatted = formatKnowledgeTreeForPrompt(mockTrees)

    expect(formatted).toBeDefined()
    expect(typeof formatted).toBe('string')
    expect(formatted).toContain('test-space')
  })
})

// ── Tests: Prompt Builder Sections ─────────────────────────────────────────────

describe('Integration: Prompt Builder', () => {
  it('builds system prompt with all sections', async () => {
    const { SystemPromptBuilder, buildScopeSection } = await import('@lmthing/repl/context/prompt')

    const scope = 'x = 1\ny = 2'
    const scopeSection = buildScopeSection(scope)

    const builder = new SystemPromptBuilder({
      scope: scopeSection,
      functionSignatures: 'function test()',
    })

    const prompt = builder.build()

    expect(prompt).toContain('x = 1')
    expect(prompt).toContain('function test()')
    expect(prompt).toContain('TypeScript code')
  })
})

// ── Tests: Agent Registry ───────────────────────────────────────────────────────

describe('Integration: Agent Registry', () => {
  it('creates agent registry', async () => {
    const { AgentRegistry } = await import('@lmthing/repl')

    const registry = new AgentRegistry()

    expect(registry).toBeDefined()
  })

  it('manages agent entries', async () => {
    const { AgentRegistry } = await import('@lmthing/repl')

    const registry = new AgentRegistry()

    // Register a mock agent
    const mockPromise = Promise.resolve({ result: 'test' })
    registry.register('testAgent', mockPromise, 'Test Agent', null)

    expect(registry).toBeDefined()
  })
})

// ── Tests: Web Search (without actual API calls) ───────────────────────────────

describe('Integration: Web Search Module', () => {
  it('exports web search functions', async () => {
    const { webSearch, formatWebSearchResults, decodeHtml } = await import('@lmthing/repl/catalog/web-search')

    expect(typeof webSearch).toBe('function')
    expect(typeof formatWebSearchResults).toBe('function')
    expect(typeof decodeHtml).toBe('function')
  })

  it('decodes HTML entities correctly', async () => {
    const { decodeHtml } = await import('@lmthing/repl/catalog/web-search')

    expect(decodeHtml('Test &amp; Co')).toBe('Test & Co')
    expect(decodeHtml('&lt;script&gt;')).toBe('<script>')
    expect(decodeHtml('&quot;quoted&quot;')).toBe('"quoted"')
  })

  it('formats web search results', async () => {
    const { formatWebSearchResults } = await import('@lmthing/repl/catalog/web-search')

    const response = {
      query: 'test query',
      results: [
        { title: 'Test', url: 'https://example.com', snippet: 'A test result' },
      ],
      totalResults: 1,
    }

    const formatted = formatWebSearchResults(response)

    expect(formatted).toContain('test query')
    expect(formatted).toContain('Test')
    expect(formatted).toContain('https://example.com')
    expect(formatted).toContain('A test result')
  })

  it('handles empty search results', async () => {
    const { formatWebSearchResults } = await import('@lmthing/repl/catalog/web-search')

    const response = {
      query: 'no results',
      results: [],
      totalResults: 0,
    }

    const formatted = formatWebSearchResults(response)

    expect(formatted).toContain('No results found')
  })
})
