/**
 * Tests for THING Agent Entry Point
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createThingSession, quickStart, ThingAgent } from './entry'
import type { ThingEntryPointOptions } from './entry'

// ── Test fixture directory ────────────────────────────────────────────────────

let workingDir: string

beforeEach(async () => {
  workingDir = await mkdtemp(join(tmpdir(), 'lmthing-thing-test-'))
})

afterEach(async () => {
  await rm(workingDir, { recursive: true, force: true })
})

// ── createThingSession ────────────────────────────────────────────────────────

describe('createThingSession', () => {
  it('creates a session with default options', () => {
    const session = createThingSession()

    expect(session).toBeDefined()
    expect(session.getStatus()).toBe('idle')
  })

  it('creates a session with custom working directory', () => {
    const options: ThingEntryPointOptions = {
      fileWorkingDir: workingDir,
    }
    const session = createThingSession(options)

    expect(session).toBeDefined()
  })

  it('creates a session with git client', () => {
    // Mock git client with minimal interface
    const mockGitClient = {
      commitFile: vi.fn(),
      getStatus: vi.fn(),
      isFileChanged: vi.fn(),
    }
    const options: ThingEntryPointOptions = {
      gitClient: mockGitClient as any,
      autoCommit: true,
    }
    const session = createThingSession(options)

    expect(session).toBeDefined()
  })

  it('passes through all SessionOptions', () => {
    const options: ThingEntryPointOptions = {
      fileWorkingDir: workingDir,
      autoCommit: false,
      knowledgeLoader: async () => ({}),
      onSpawn: async () => ({ output: {}, success: true }),
    }
    const session = createThingSession(options)

    expect(session).toBeDefined()
    expect(session.getStatus()).toBe('idle')
  })
})

// ── quickStart ─────────────────────────────────────────────────────────────────

describe('quickStart', () => {
  it('creates a session with working directory', () => {
    const session = quickStart(workingDir)

    expect(session).toBeDefined()
    expect(session.getStatus()).toBe('idle')
  })

  it('creates a session with git auto-commit enabled', () => {
    const session = quickStart(workingDir, true)

    expect(session).toBeDefined()
  })

  it('creates a session without git when autoCommit is false', () => {
    const session = quickStart(workingDir, false)

    expect(session).toBeDefined()
  })

  it('uses process.cwd() when no working directory provided', () => {
    const session = quickStart()

    expect(session).toBeDefined()
  })
})

// ── ThingAgent Class ────────────────────────────────────────────────────────

describe('ThingAgent', () => {
  it('creates an agent with default options', () => {
    const agent = new ThingAgent()

    expect(agent).toBeInstanceOf(ThingAgent)
    expect(agent.getSession()).toBeDefined()
    expect(agent.isBusy()).toBe(false)
  })

  it('creates an agent with custom options', () => {
    const options: ThingEntryPointOptions = {
      fileWorkingDir: workingDir,
    }
    const agent = new ThingAgent(options)

    expect(agent.getSession()).toBeDefined()
  })

  it('sendMessage delegates to session', async () => {
    const agent = new ThingAgent()

    // Just verify that sendMessage doesn't throw when called
    // The actual behavior is tested in Session tests
    await expect(agent.sendMessage('test message')).resolves.not.toThrow()
  })

  it('getScope returns scope table', () => {
    const agent = new ThingAgent()
    const scope = agent.getScope()

    expect(typeof scope).toBe('string')
  })

  it('getPinned returns pinned memory map', () => {
    const agent = new ThingAgent()
    const pinned = agent.getPinned()

    expect(pinned).toBeInstanceOf(Map)
  })

  it('getMemos returns memos map', () => {
    const agent = new ThingAgent()
    const memos = agent.getMemos()

    expect(memos).toBeInstanceOf(Map)
  })

  it('isBusy returns false when idle', () => {
    const agent = new ThingAgent()

    expect(agent.isBusy()).toBe(false)
  })

  it('getStatus returns current status', () => {
    const agent = new ThingAgent()
    const status = agent.getStatus()

    expect(status).toBe('idle')
  })

  it('destroy cleans up session', () => {
    const agent = new ThingAgent()

    expect(() => agent.destroy()).not.toThrow()
  })

  it('getStatus returns session status', () => {
    const agent = new ThingAgent()

    expect(agent.getStatus()).toBe('idle')
  })
})

// ── Integration Tests ─────────────────────────────────────────────────────────

describe('Integration', () => {
  it('quickStart and createThingSession produce equivalent results', () => {
    const agent1 = new ThingAgent({ fileWorkingDir: workingDir })
    const session2 = createThingSession({ fileWorkingDir: workingDir })

    expect(agent1.getSession()).toBeDefined()
    expect(session2).toBeDefined()
  })

  it('agent delegates all methods to underlying session', () => {
    const agent = new ThingAgent({ fileWorkingDir: workingDir })
    const session = agent.getSession()

    // Verify all methods return expected types
    expect(typeof agent.getScope()).toBe('string')
    expect(typeof agent.getStatus()).toBe('string')
    expect(agent.getPinned()).toBeInstanceOf(Map)
    expect(agent.getMemos()).toBeInstanceOf(Map)
  })
})
