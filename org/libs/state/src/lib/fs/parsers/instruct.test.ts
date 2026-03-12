// src/lib/fs/parsers/instruct.test.ts

import { describe, it, expect } from 'vitest'
import { parseAgentInstruct, serializeAgentInstruct, type AgentInstruct } from './instruct'

describe('instruct parser', () => {
  describe('parseAgentInstruct', () => {
    it('should parse basic instruct with frontmatter', () => {
      const content = `---
name: Test Bot
description: A test agent
---
You are a helpful assistant.`

      const result = parseAgentInstruct(content)

      expect(result.name).toBe('Test Bot')
      expect(result.description).toBe('A test agent')
      expect(result.instructions).toBe('You are a helpful assistant.')
    })

    it('should parse all fields', () => {
      const content = `---
name: Advanced Bot
description: An advanced agent
model: gpt-4
temperature: 0.7
max-tokens: 2000
system-prompt: You are advanced.
---
Follow these instructions carefully.`

      const result = parseAgentInstruct(content)

      expect(result.name).toBe('Advanced Bot')
      expect(result.model).toBe('gpt-4')
      expect(result.temperature).toBe(0.7)
      expect(result.maxTokens).toBe(2000)
      expect(result.systemPrompt).toBe('You are advanced.')
      expect(result.instructions).toBe('Follow these instructions carefully.')
    })

    it('should handle content without frontmatter', () => {
      const content = 'Just instructions, no frontmatter'

      const result = parseAgentInstruct(content)

      expect(result.name).toBe('')
      expect(result.instructions).toBe('Just instructions, no frontmatter')
    })

    it('should handle empty content', () => {
      const result = parseAgentInstruct('')

      expect(result.name).toBe('')
      expect(result.instructions).toBe('')
    })

    it('should parse numeric values correctly', () => {
      const content = `---
name: Bot
temperature: 0.5
max-tokens: 1000
---
Instructions`

      const result = parseAgentInstruct(content)

      expect(result.temperature).toBe(0.5)
      expect(result.maxTokens).toBe(1000)
    })

    it('should handle missing optional fields', () => {
      const content = `---
name: Minimal Bot
---
Instructions here`

      const result = parseAgentInstruct(content)

      expect(result.name).toBe('Minimal Bot')
      expect(result.description).toBeUndefined()
      expect(result.model).toBeUndefined()
      expect(result.temperature).toBeUndefined()
    })

    it('should preserve multi-line instructions', () => {
      const content = `---
name: Bot
---
Line 1
Line 2
Line 3`

      const result = parseAgentInstruct(content)

      expect(result.instructions).toBe('Line 1\nLine 2\nLine 3')
    })
  })

  describe('serializeAgentInstruct', () => {
    it('should serialize basic instruct', () => {
      const instruct: AgentInstruct = {
        name: 'Test Bot',
        instructions: 'Be helpful'
      }

      const result = serializeAgentInstruct(instruct)

      expect(result).toContain('---')
      expect(result).toContain('name: "Test Bot"')
      expect(result).toContain('---')
      expect(result).toContain('Be helpful')
    })

    it('should serialize all fields', () => {
      const instruct: AgentInstruct = {
        name: 'Bot',
        description: 'A bot',
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2000,
        systemPrompt: 'System prompt here',
        instructions: 'Instructions'
      }

      const result = serializeAgentInstruct(instruct)

      expect(result).toContain('name: Bot')
      expect(result).toContain('description: "A bot"')
      expect(result).toContain('model: "gpt-4"')
      expect(result).toContain('temperature: 0.7')
      expect(result).toContain('max-tokens: 2000')
      expect(result).toContain('system-prompt: "System prompt here"')
    })

    it('should not include undefined fields', () => {
      const instruct: AgentInstruct = {
        name: 'Bot',
        instructions: 'Instructions'
      }

      const result = serializeAgentInstruct(instruct)

      expect(result).not.toContain('description:')
      expect(result).not.toContain('model:')
    })

    it('should round-trip correctly', () => {
      const original = `---
name: Test Bot
description: Test agent
---
Original instructions`

      const parsed = parseAgentInstruct(original)
      const serialized = serializeAgentInstruct(parsed)
      const reparsed = parseAgentInstruct(serialized)

      expect(reparsed.name).toBe(parsed.name)
      expect(reparsed.description).toBe(parsed.description)
      expect(reparsed.instructions).toBe(parsed.instructions)
    })
  })
})
