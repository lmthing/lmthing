/**
 * Tests for Git client - auto-commit functionality
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { GitClient, createGitClient } from './client'

// ── Test fixture directory ────────────────────────────────────────────────────

let repoDir: string

beforeAll(async () => {
  repoDir = await mkdtemp(join(tmpdir(), 'lmthing-git-test-'))
  // Initialize git repo
  execSync('git init', { cwd: repoDir })
  execSync('git config user.email "test@example.com"', { cwd: repoDir })
  execSync('git config user.name "Test User"', { cwd: repoDir })
  // Create an initial commit to establish the branch
  const { writeFile } = await import('node:fs/promises')
  await writeFile(join(repoDir, '.gitkeep'), '')
  execSync('git add .gitkeep', { cwd: repoDir })
  execSync('git commit -m "Initial commit"', { cwd: repoDir })
})

afterAll(async () => {
  await rm(repoDir, { recursive: true, force: true })
})

// ── GitClient ─────────────────────────────────────────────────────────────────

describe('GitClient', () => {
  describe('getStatus', () => {
    it('returns correct status for an empty repo', async () => {
      const client = createGitClient({ workingDir: repoDir })
      const status = await client.getStatus()
      expect(status.exists).toBe(true)
      expect(status.isRepo).toBe(true)
      expect(status.hasChanges).toBe(false)
      expect(status.branch).toBe('main')
    })

    it('detects uncommitted changes', async () => {
      const { writeFile } = await import('node:fs/promises')
      await writeFile(join(repoDir, 'test.txt'), 'content')

      const client = createGitClient({ workingDir: repoDir })
      const status = await client.getStatus()
      expect(status.hasChanges).toBe(true)
    })
  })

  describe('commitFile', () => {
    it('commits a single file with descriptive message', async () => {
      const { writeFile } = await import('node:fs/promises')
      await writeFile(join(repoDir, 'test.txt'), 'test content')

      const client = createGitClient({ workingDir: repoDir })
      const result = await client.commitFile('test.txt', 'Create test.txt')

      expect(result.ok).toBe(true)
      expect(result.hash).toBeDefined()
      expect(result.hash).toMatch(/^[a-f0-9]{7,8}$/)
    })

    it('uses custom author name and email', async () => {
      const { writeFile } = await import('node:fs/promises')
      await writeFile(join(repoDir, 'authored.txt'), 'content')

      const client = createGitClient({
        workingDir: repoDir,
        authorName: 'THING Agent',
        authorEmail: 'agent@lmthing.local',
      })
      await client.commitFile('authored.txt', 'Add file')

      const log = execSync('git log -1 --format="%an <%ae>"', {
        cwd: repoDir,
        encoding: 'utf-8',
      })
      expect(log).toContain('THING Agent <agent@lmthing.local>')
    })

    it('returns error when git fails', async () => {
      const client = createGitClient({
        workingDir: '/nonexistent/path'
      })
      const result = await client.commitFile('test.txt', 'message')

      expect(result.ok).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('commitFiles', () => {
    it('commits multiple files at once', async () => {
      const { writeFile } = await import('node:fs/promises')
      await writeFile(join(repoDir, 'file1.txt'), 'content1')
      await writeFile(join(repoDir, 'file2.txt'), 'content2')

      const client = createGitClient({ workingDir: repoDir })
      const result = await client.commitFiles(
        ['file1.txt', 'file2.txt'],
        'Add multiple files'
      )

      expect(result.ok).toBe(true)
      expect(result.hash).toBeDefined()
    })
  })

  describe('isFileChanged', () => {
    it('returns true for modified files', async () => {
      const { writeFile } = await import('node:fs/promises')
      await writeFile(join(repoDir, 'changed.txt'), 'initial')
      await writeFile(join(repoDir, 'changed.txt'), 'modified')

      const client = createGitClient({ workingDir: repoDir })
      const changed = await client.isFileChanged('changed.txt')

      expect(changed).toBe(true)
    })

    it('returns false for unmodified files', async () => {
      const { writeFile } = await import('node:fs/promises')
      await writeFile(join(repoDir, 'committed.txt'), 'content')
      const client = createGitClient({ workingDir: repoDir })
      await client.commitFile('committed.txt', 'Initial commit')

      const changed = await client.isFileChanged('committed.txt')

      expect(changed).toBe(false)
    })
  })

  describe('getStatusString', () => {
    it('returns empty string when no changes', async () => {
      const client = createGitClient({ workingDir: repoDir })
      const status = await client.getStatusString()
      expect(status).toBe('')
    })

    it('returns status for changed files', async () => {
      const { writeFile } = await import('node:fs/promises')
      await writeFile(join(repoDir, 'modified.txt'), 'content')
      execSync('git add modified.txt', { cwd: repoDir })
      await writeFile(join(repoDir, 'modified.txt'), 'modified')

      const client = createGitClient({ workingDir: repoDir })
      const status = await client.getStatusString()
      // Should show the modified file in git status
      expect(status.length).toBeGreaterThan(0)
    })
  })
})

// ── createGitClient ───────────────────────────────────────────────────────────

describe('createGitClient', () => {
  it('creates a GitClient with default options', () => {
    const client = createGitClient({ workingDir: repoDir })
    expect(client).toBeInstanceOf(GitClient)
  })

  it('creates a GitClient with custom options', () => {
    const client = createGitClient({
      workingDir: repoDir,
      authorName: 'Custom Agent',
      authorEmail: 'custom@example.com',
    })
    expect(client).toBeInstanceOf(GitClient)
  })
})
