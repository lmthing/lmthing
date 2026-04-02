/**
 * Tests for Space Creation utilities
 */

import { describe, it, expect } from 'vitest'
import {
  generatePackageJson,
  generateAgentConfig,
  generateSpaceStructure,
  generateSpaceFileBlocks,
  validateSpaceName,
  slugifySpaceName,
} from './creator'
import type { SpaceMetadata, AgentDefinition } from './creator'

// ── generatePackageJson ──────────────────────────────────────────────────────

describe('generatePackageJson', () => {
  it('generates minimal package.json with name', () => {
    const result = generatePackageJson({ name: 'test-space' })
    const parsed = JSON.parse(result)

    expect(parsed.name).toBe('test-space')
    expect(parsed.version).toBe('1.0.0')
    expect(parsed.private).toBe(true)
  })

  it('includes custom version when provided', () => {
    const result = generatePackageJson({
      name: 'test-space',
      version: '2.0.0',
    })
    const parsed = JSON.parse(result)

    expect(parsed.version).toBe('2.0.0')
  })

  it('generates valid JSON', () => {
    const result = generatePackageJson({ name: 'test-space' })

    expect(() => JSON.parse(result)).not.toThrow()
    expect(typeof result).toBe('string')
  })
})

// ── generateAgentConfig ──────────────────────────────────────────────────────

describe('generateAgentConfig', () => {
  it('generates agent config with required fields', () => {
    const agent: AgentDefinition = {
      name: 'TestAgent',
      role: 'Tester',
      instruct: 'You are a helpful tester.',
    }
    const result = generateAgentConfig(agent)
    const parsed = JSON.parse(result)

    expect(parsed.title).toBe('TestAgent')
    expect(parsed.model).toBe('gpt-4')
    expect(parsed.knowledge).toEqual([])
    expect(parsed.components).toEqual([])
    expect(parsed.functions).toEqual([])
  })

  it('generates valid JSON', () => {
    const agent: AgentDefinition = {
      name: 'TestAgent',
      role: 'Tester',
      instruct: 'Test instructions.',
    }
    const result = generateAgentConfig(agent)

    expect(() => JSON.parse(result)).not.toThrow()
  })
})

// ── generateSpaceStructure ───────────────────────────────────────────────────

describe('generateSpaceStructure', () => {
  it('generates package.json for a space', () => {
    const metadata: SpaceMetadata = { name: 'test-space' }
    const files = generateSpaceStructure(metadata)

    expect(files['test-space/package.json']).toBeDefined()
    const pkg = JSON.parse(files['test-space/package.json'])
    expect(pkg.name).toBe('test-space')
  })

  it('generates agent configs and instruct files', () => {
    const metadata: SpaceMetadata = { name: 'test-space' }
    const agents: Record<string, AgentDefinition> = {
      tester: {
        name: 'Tester',
        role: 'QA Specialist',
        instruct: 'Test everything.',
      },
    }
    const files = generateSpaceStructure(metadata, agents)

    expect(files['test-space/agents/agent-tester/config.json']).toBeDefined()
    expect(files['test-space/agents/agent-tester/instruct.md']).toContain('Tester')
    expect(files['test-space/agents/agent-tester/instruct.md']).toContain('QA Specialist')
  })

  it('generates multiple agents correctly', () => {
    const metadata: SpaceMetadata = { name: 'multi-agent-space' }
    const agents: Record<string, AgentDefinition> = {
      alpha: { name: 'Alpha', role: 'A', instruct: 'First' },
      beta: { name: 'Beta', role: 'B', instruct: 'Second' },
    }
    const files = generateSpaceStructure(metadata, agents)

    expect(files['multi-agent-space/agents/agent-alpha/config.json']).toBeDefined()
    expect(files['multi-agent-space/agents/agent-beta/config.json']).toBeDefined()
  })
})

// ── generateSpaceFileBlocks ─────────────────────────────────────────────────

describe('generateSpaceFileBlocks', () => {
  it('generates file block strings for each file', () => {
    const metadata: SpaceMetadata = { name: 'block-test' }
    const blocks = generateSpaceFileBlocks(metadata)

    expect(blocks.length).toBe(1) // Only package.json
    expect(blocks[0]).toContain('```block-test/package.json')
    expect(blocks[0]).toContain('```')
  })

  it('generates blocks for agents when provided', () => {
    const metadata: SpaceMetadata = { name: 'agent-test' }
    const agents: Record<string, AgentDefinition> = {
      helper: { name: 'Helper', role: 'Helps', instruct: 'I help.' },
    }
    const blocks = generateSpaceFileBlocks(metadata, agents)

    expect(blocks.length).toBe(3) // package.json + config + instruct
    const allStrings = blocks.every((b) => typeof b === 'string')
    expect(allStrings).toBe(true)
  })
})

// ── validateSpaceName ────────────────────────────────────────────────────────

describe('validateSpaceName', () => {
  it('accepts valid kebab-case names', () => {
    expect(validateSpaceName('valid-space')).toBe(true)
    expect(validateSpaceName('my-space-123')).toBe(true)
    expect(validateSpaceName('test')).toBe(true)
  })

  it('rejects invalid names', () => {
    expect(validateSpaceName('InvalidSpace')).toBe(false)
    expect(validateSpaceName('space_underscore')).toBe(false)
    expect(validateSpaceName('space.dot')).toBe(false)
    expect(validateSpaceName('space-dash-')).toBe(false) // trailing dash
    expect(validateSpaceName('-space')).toBe(false) // leading dash
  })

  it('rejects empty strings', () => {
    expect(validateSpaceName('')).toBe(false)
  })
})

// ── slugifySpaceName ─────────────────────────────────────────────────────────

describe('slugifySpaceName', () => {
  it('converts spaces to hyphens', () => {
    expect(slugifySpaceName('My Space')).toBe('my-space')
    expect(slugifySpaceName('Hello World Test')).toBe('hello-world-test')
  })

  it('removes special characters', () => {
    expect(slugifySpaceName('Test@Space!')).toBe('testspace')
    expect(slugifySpaceName('My$Cool#Space')).toBe('mycoolspace')
  })

  it('handles multiple hyphens correctly', () => {
    expect(slugifySpaceName('Test--Space')).toBe('test-space')
    expect(slugifySpaceName('Test   Space')).toBe('test-space')
  })

  it('handles leading/trailing hyphens', () => {
    expect(slugifySpaceName('--test--')).toBe('test')
  })

  it('converts to lowercase', () => {
    expect(slugifySpaceName('TESTSPACE')).toBe('testspace')
    expect(slugifySpaceName('MyTest')).toBe('mytest')
  })

  it('produces valid space names', () => {
    const result = slugifySpaceName('My Complex Space Name!')
    expect(validateSpaceName(result)).toBe(true)
  })
})
