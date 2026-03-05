// src/lib/fs/parsers/config.test.ts

import { describe, it, expect } from 'vitest'
import {
  parseAgentConfig,
  serializeAgentConfig,
  parseAgentValues,
  serializeAgentValues,
  parseKnowledgeConfig,
  serializeKnowledgeConfig
} from './config'

describe('config parser', () => {
  describe('agent config', () => {
    describe('parseAgentConfig', () => {
      it('should parse basic config', () => {
        const content = JSON.stringify({
          enabled: true,
          model: 'gpt-4'
        })

        const result = parseAgentConfig(content)

        expect(result.enabled).toBe(true)
        expect(result.model).toBe('gpt-4')
      })

      it('should parse all config fields', () => {
        const content = JSON.stringify({
          enabled: true,
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 2000,
          frequencyPenalty: 0.5,
          presencePenalty: 0.5,
          stopSequences: ['STOP', 'END'],
          timeout: 30000,
          retries: 3,
          customField: 'custom value'
        })

        const result = parseAgentConfig(content)

        expect(result.enabled).toBe(true)
        expect(result.temperature).toBe(0.7)
        expect(result.maxTokens).toBe(2000)
        expect(result.frequencyPenalty).toBe(0.5)
        expect(result.presencePenalty).toBe(0.5)
        expect(result.stopSequences).toEqual(['STOP', 'END'])
        expect(result.timeout).toBe(30000)
        expect(result.retries).toBe(3)
        expect(result.customField).toBe('custom value')
      })

      it('should handle empty object', () => {
        const result = parseAgentConfig('{}')

        expect(result).toEqual({})
      })

      it('should handle invalid JSON gracefully', () => {
        const result = parseAgentConfig('invalid json')

        expect(result).toEqual({})
      })

      it('should handle null values', () => {
        const content = JSON.stringify({
          enabled: null,
          model: 'gpt-4'
        })

        const result = parseAgentConfig(content)

        expect(result.enabled).toBe(null)
        expect(result.model).toBe('gpt-4')
      })
    })

    describe('serializeAgentConfig', () => {
      it('should serialize config to JSON', () => {
        const config = {
          enabled: true,
          model: 'gpt-4'
        }

        const result = serializeAgentConfig(config)

        const parsed = JSON.parse(result)
        expect(parsed.enabled).toBe(true)
        expect(parsed.model).toBe('gpt-4')
      })

      it('should format with indentation', () => {
        const config = { enabled: true }

        const result = serializeAgentConfig(config)

        expect(result).toContain('{\n  ')
        expect(result).toContain('  "enabled": true')
      })

      it('should round-trip correctly', () => {
        const original = {
          enabled: true,
          model: 'gpt-4',
          temperature: 0.7,
          custom: { nested: 'value' }
        }

        const serialized = serializeAgentConfig(original)
        const parsed = parseAgentConfig(serialized)

        expect(parsed).toEqual(original)
      })
    })
  })

  describe('agent values', () => {
    describe('parseAgentValues', () => {
      it('should parse string values', () => {
        const content = JSON.stringify({
          apiKey: 'sk-1234',
          endpoint: 'https://api.example.com'
        })

        const result = parseAgentValues(content)

        expect(result.apiKey).toBe('sk-1234')
        expect(result.endpoint).toBe('https://api.example.com')
      })

      it('should parse number values', () => {
        const content = JSON.stringify({
          count: 42,
          ratio: 3.14
        })

        const result = parseAgentValues(content)

        expect(result.count).toBe(42)
        expect(result.ratio).toBe(3.14)
      })

      it('should parse boolean values', () => {
        const content = JSON.stringify({
          active: true,
          deleted: false
        })

        const result = parseAgentValues(content)

        expect(result.active).toBe(true)
        expect(result.deleted).toBe(false)
      })

      it('should parse null values', () => {
        const content = JSON.stringify({
          field: null
        })

        const result = parseAgentValues(content)

        expect(result.field).toBe(null)
      })

      it('should handle invalid JSON', () => {
        const result = parseAgentValues('not json')

        expect(result).toEqual({})
      })
    })

    describe('serializeAgentValues', () => {
      it('should serialize values to JSON', () => {
        const values = {
          apiKey: 'sk-1234',
          count: 42,
          active: true
        }

        const result = serializeAgentValues(values)

        const parsed = JSON.parse(result)
        expect(parsed.apiKey).toBe('sk-1234')
        expect(parsed.count).toBe(42)
        expect(parsed.active).toBe(true)
      })

      it('should round-trip correctly', () => {
        const original = {
          string: 'value',
          number: 123,
          bool: true,
          nullValue: null
        }

        const serialized = serializeAgentValues(original)
        const parsed = parseAgentValues(serialized)

        expect(parsed).toEqual(original)
      })
    })
  })

  describe('knowledge config', () => {
    describe('parseKnowledgeConfig', () => {
      it('should parse basic config', () => {
        const content = JSON.stringify({
          title: 'Engineering',
          description: 'Engineering knowledge base'
        })

        const result = parseKnowledgeConfig(content)

        expect(result.title).toBe('Engineering')
        expect(result.description).toBe('Engineering knowledge base')
      })

      it('should parse all fields', () => {
        const content = JSON.stringify({
          title: 'Engineering',
          description: 'Knowledge base',
          tags: ['python', 'javascript'],
          embeddingModel: 'text-embedding-ada-002',
          chunkSize: 1000,
          chunkOverlap: 200,
          customSetting: 'value'
        })

        const result = parseKnowledgeConfig(content)

        expect(result.title).toBe('Engineering')
        expect(result.tags).toEqual(['python', 'javascript'])
        expect(result.embeddingModel).toBe('text-embedding-ada-002')
        expect(result.chunkSize).toBe(1000)
        expect(result.chunkOverlap).toBe(200)
        expect(result.customSetting).toBe('value')
      })

      it('should handle invalid JSON', () => {
        const result = parseKnowledgeConfig('invalid')

        expect(result).toEqual({})
      })
    })

    describe('serializeKnowledgeConfig', () => {
      it('should serialize config to JSON', () => {
        const config = {
          title: 'Engineering',
          tags: ['python', 'js']
        }

        const result = serializeKnowledgeConfig(config)

        const parsed = JSON.parse(result)
        expect(parsed.title).toBe('Engineering')
        expect(parsed.tags).toEqual(['python', 'js'])
      })

      it('should round-trip correctly', () => {
        const original = {
          title: 'Test',
          description: 'Test domain',
          tags: ['tag1', 'tag2'],
          chunkSize: 500
        }

        const serialized = serializeKnowledgeConfig(original)
        const parsed = parseKnowledgeConfig(serialized)

        expect(parsed).toEqual(original)
      })
    })
  })
})
