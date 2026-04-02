/**
 * Integration tests for new features using actual LLM models.
 *
 * These tests require model aliases to be set via environment variables:
 * - LM_MODEL_SMALL (e.g., "openai:gpt-4o-mini")
 * - LM_MODEL_LARGE (e.g., "openai:gpt-4o" or "anthropic:claude-3-5-sonnet-20241022")
 *
 * Run with:
 *   LM_MODEL_SMALL=openai:gpt-4o-mini pnpm test src/integration/
 *
 * Note: Most tests here don't require LLM access - they test the feature APIs directly.
 * Only tests in the "LLM Integration" describe block require LM_MODEL_SMALL.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { createGitClient } from '../git/client'
import { generateSpaceStructure, slugifySpaceName, generateSpaceFileBlocks } from '../spaces/creator'
import { VectorIndex } from '../sandbox/vector-index'
import { quickStart, createThingSession } from '../thing/entry'
import { webSearch, formatWebSearchResults, decodeHtml } from '../catalog/web-search'
import { SystemPromptBuilder, FocusController } from '../context/prompt'
import { buildGlobalsSection } from '../context/prompt/sections'

// ── Test environment setup ────────────────────────────────────────────────────

let workingDir: string
let gitRepoDir: string

beforeAll(async () => {
  workingDir = await mkdtemp(join(tmpdir(), 'lmthing-integration-'))
  gitRepoDir = await mkdtemp(join(tmpdir(), 'lmthing-git-integration-'))

  // Initialize git repo for auto-commit tests
  try {
    execSync('git init', { cwd: gitRepoDir, stdio: 'ignore' })
    execSync('git config user.email "test@example.com"', { cwd: gitRepoDir, stdio: 'ignore' })
    execSync('git config user.name "Test User"', { cwd: gitRepoDir, stdio: 'ignore' })
    // Create an initial commit
    await writeFile(join(gitRepoDir, '.gitkeep'), '')
    execSync('git add .gitkeep', { cwd: gitRepoDir, stdio: 'ignore' })
    execSync('git commit -m "Initial commit"', { cwd: gitRepoDir, stdio: 'ignore' })
  } catch {
    // Git not available - git tests will fail gracefully
  }
})

afterAll(async () => {
  await rm(workingDir, { recursive: true, force: true })
  await rm(gitRepoDir, { recursive: true, force: true })
})

// ── Git Client Integration ─────────────────────────────────────────────────────

describe('Integration: Git Client', () => {
  it('commits files and reads status', async () => {
    const gitClient = createGitClient({ workingDir: gitRepoDir })

    // Create a test file
    await writeFile(join(gitRepoDir, 'test.txt'), 'Hello, Git!')
    const commitResult = await gitClient.commitFile('test.txt', 'Add test file')

    expect(commitResult.ok).toBe(true)
    expect(commitResult.hash).toBeDefined()
    expect(commitResult.hash).toMatch(/^[a-f0-9]{7,8}$/)

    // Check status - should be clean after commit
    const status = await gitClient.getStatus()
    expect(status.isRepo).toBe(true)
    expect(status.hasChanges).toBe(false)
  })

  it('commits multiple files at once', async () => {
    const gitClient = createGitClient({ workingDir: gitRepoDir })

    await writeFile(join(gitRepoDir, 'file1.txt'), 'content 1')
    await writeFile(join(gitRepoDir, 'file2.txt'), 'content 2')

    const result = await gitClient.commitFiles(['file1.txt', 'file2.txt'], 'Add two files')

    expect(result.ok).toBe(true)
    expect(result.hash).toBeDefined()
  })

  it('checks if specific file has changed', async () => {
    const gitClient = createGitClient({ workingDir: gitRepoDir })

    // Modify existing file
    await writeFile(join(gitRepoDir, 'test.txt'), 'modified content')

    const hasChanged = await gitClient.isFileChanged('test.txt')
    expect(hasChanged).toBe(true)
  })
})

// ── Space Creation Integration ─────────────────────────────────────────────────

describe('Integration: Space Creation', () => {
  it('generates complete space structure', () => {
    const metadata = { name: 'test-cooking', version: '1.0.0' }
    const agents = {
      chef: {
        name: 'Chef',
        role: 'Culinary Expert',
        instruct: 'Help users with cooking questions',
      },
    }

    const files = generateSpaceStructure(metadata, agents)

    // Verify all expected files exist
    expect(files['test-cooking/package.json']).toBeDefined()
    expect(files['test-cooking/agents/agent-chef/config.json']).toBeDefined()
    expect(files['test-cooking/agents/agent-chef/instruct.md']).toBeDefined()

    // Verify content
    const pkgJson = JSON.parse(files['test-cooking/package.json'])
    expect(pkgJson.name).toBe('test-cooking')

    const agentConfig = JSON.parse(files['test-cooking/agents/agent-chef/config.json'])
    expect(agentConfig.title).toBe('Chef')
    expect(agentConfig.model).toBe('gpt-4')

    const instruct = files['test-cooking/agents/agent-chef/instruct.md']
    expect(instruct).toContain('Chef')
    expect(instruct).toContain('Culinary Expert')
    expect(instruct).toContain('Help users with cooking questions')
  })

  it('slugifies space names correctly', () => {
    expect(slugifySpaceName('My Awesome Cooking Space!')).toBe('my-awesome-cooking-space')
    expect(slugifySpaceName('Test@Space #123')).toBe('testspace-123')
    expect(slugifySpaceName('  Multiple   Spaces  ')).toBe('multiple-spaces')
    expect(slugifySpaceName('UPPERCASE')).toBe('uppercase')
  })

  it('generates file blocks for space creation', () => {
    const metadata = { name: 'test-space' }
    const agents = {
      helper: { name: 'Helper', role: 'Assistant', instruct: 'I help.' },
    }

    const blocks = generateSpaceFileBlocks(metadata, agents)

    expect(Array.isArray(blocks)).toBe(true)
    expect(blocks.length).toBeGreaterThan(0)

    // Each block should be a string with 4-backtick format
    for (const block of blocks) {
      expect(typeof block).toBe('string')
      expect(block).toMatch(/````/)
    }
  })
})

// ── Vector Index Integration ─────────────────────────────────────────────────

describe('Integration: Vector Index', () => {
  it('indexes and searches documents with TF-IDF', () => {
    const index = new VectorIndex()

    // Index some documents
    index.index('Calculate user statistics from database', 'const count = users.length', 1)
    index.index('Process payment with Stripe API', 'const payment = await stripe.charges.create()', 2)
    index.index('Handle user authentication with JWT', 'const token = jwt.verify(token)', 3)

    // Search for similar content
    const results = index.search('user authentication JWT', 3)

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].turn).toBe(3) // Should match the authentication turn
    expect(results[0].score).toBeGreaterThan(0)
    expect(results[0].text).toContain('authentication')
    expect(results[0].code).toContain('jwt.verify')
  })

  it('finds semantically similar content across documents', () => {
    const index = new VectorIndex()

    index.index('Function to sum array elements', 'const sum = arr.reduce((a, b) => a + b, 0)', 1)
    index.index('Database connection helper', 'const db = await connect()', 2)
    index.index('Calculate average of numbers', 'const avg = total / count', 3)

    // Search for "summation" - should match the sum function
    const results = index.search('array summation')

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].turn).toBe(1) // Should match the sum function
  })

  it('respects topK parameter in search', () => {
    const index = new VectorIndex()

    for (let i = 1; i <= 10; i++) {
      index.index(`Document ${i}`, `code ${i}`, i)
    }

    const results = index.search('document', 3)
    expect(results.length).toBeLessThanOrEqual(3)
  })

  it('handles custom options', () => {
    const index = new VectorIndex({
      maxDocuments: 5,
      minTermLength: 3,
    })

    for (let i = 1; i <= 10; i++) {
      index.index(`Doc ${i}`, `code`, i)
    }

    // Should only keep 5 documents (max)
    expect(index.size).toBe(5)
  })

  it('clears all documents', () => {
    const index = new VectorIndex()

    index.index('test', 'code', 1)
    index.index('test2', 'code2', 2)

    expect(index.size).toBe(2)

    index.clear()
    expect(index.size).toBe(0)
  })
})

// ── THING Entry Point Integration ─────────────────────────────────────────────

describe('Integration: THING Entry Point', () => {
  it('quickStart creates a working session', () => {
    const session = quickStart(workingDir, false)

    expect(session).toBeDefined()
    expect(session.getStatus()).toBe('idle')
    expect(session.getScope()).toBeDefined()
    expect(Array.isArray(session.getScope())).toBe(true)

    session.destroy()
  })

  it('createThingSession with custom options', () => {
    const session = createThingSession({
      fileWorkingDir: workingDir,
      autoCommit: false,
    })

    expect(session).toBeDefined()
    expect(session.getStatus()).toBe('idle')

    session.destroy()
  })

  it('session provides access to memory structures', () => {
    const session = quickStart(workingDir, false)

    expect(session.getPinnedMemory()).toBeInstanceOf(Map)
    expect(session.getMemoMemory()).toBeInstanceOf(Map)
    expect(session.getStatus()).toBe('idle') // isIdle status

    session.destroy()
  })
})

// ── Session API Integration ───────────────────────────────────────────────────

describe('Integration: Session API', () => {
  it('handles multiple independent sessions', () => {
    const session1 = quickStart(workingDir, false)
    const session2 = quickStart(workingDir, false)
    const session3 = createThingSession({ fileWorkingDir: workingDir })

    expect(session1.getStatus()).toBe('idle')
    expect(session2.getStatus()).toBe('idle')
    expect(session3.getStatus()).toBe('idle')

    // Each session should have its own scope
    const scope1 = session1.getScopeTable()
    const scope2 = session2.getScopeTable()
    expect(typeof scope1).toBe('string')
    expect(typeof scope2).toBe('string')

    session1.destroy()
    session2.destroy()
    session3.destroy()
  })

  it('session with git client integration', () => {
    const gitClient = createGitClient({ workingDir: gitRepoDir })

    const session = createThingSession({
      gitClient,
      autoCommit: true,
      fileWorkingDir: gitRepoDir,
    })

    expect(session).toBeDefined()
    expect(session.getStatus()).toBe('idle')

    session.destroy()
  })
})

// ── Web Search Module Integration ─────────────────────────────────────────────

describe('Integration: Web Search Module', () => {
  it('exports web search functions', () => {
    expect(typeof webSearch).toBe('function')
    expect(typeof formatWebSearchResults).toBe('function')
    expect(typeof decodeHtml).toBe('function')
  })

  it('decodes HTML entities correctly', () => {
    expect(decodeHtml('Test &amp; Co')).toBe('Test & Co')
    expect(decodeHtml('&lt;script&gt;')).toBe('<script>')
    expect(decodeHtml('&quot;quoted&quot;')).toBe('"quoted"')
    expect(decodeHtml('A &lt; B &gt; C')).toBe('A < B > C')
  })

  it('formats web search results', () => {
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

  it('handles empty search results', () => {
    const response = {
      query: 'no results',
      results: [],
      totalResults: 0,
    }

    const formatted = formatWebSearchResults(response)

    expect(formatted).toContain('No results found')
  })
})

// ── Prompt Builder Integration ─────────────────────────────────────────────────

describe('Integration: Prompt Builder', () => {
  it('builds all prompt sections', () => {
    const builder = new SystemPromptBuilder({
      scope: 'x = 1',
      functionSignatures: 'function test()',
    })

    const prompt = builder.build()

    expect(prompt).toContain('x = 1')
    expect(prompt).toContain('function test()')
    expect(prompt).toContain('TypeScript code')
    expect(prompt).toContain('sandbox')
  })

  it('uses FocusController for section collapse', () => {
    const focusExpanded = new FocusController(null)
    const focusCollapsed = new FocusController(new Set(['functions']))

    const expandedContent = buildGlobalsSection({}, focusExpanded)
    const collapsedContent = buildGlobalsSection({}, focusCollapsed)

    // Expanded should have full content
    expect(expandedContent.length).toBeGreaterThan(100)

    // Collapsed should be shorter
    expect(collapsedContent.length).toBeLessThan(expandedContent.length)
  })
})

// ── LLM Integration Tests (require LM_MODEL_SMALL) ─────────────────────────

describe.runIf(process.env.LM_MODEL_SMALL)('Integration: LLM Session', () => {
  it('creates session without errors', () => {
    const session = quickStart(workingDir, false)

    expect(session.getStatus()).toBe('idle')
    session.destroy()
  })

  it('session scope is valid string', () => {
    const session = quickStart(workingDir, false)

    const scope = session.getScope()
    expect(typeof scope).toBe('string')
    expect(scope.length).toBeGreaterThan(0)

    session.destroy()
  })

  it('session status returns valid values', () => {
    const session = quickStart(workingDir, false)

    const status = session.getStatus()
    expect(['idle', 'processing', 'waiting']).toContain(status)

    session.destroy()
  })
})
