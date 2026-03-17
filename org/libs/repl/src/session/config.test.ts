import { describe, it, expect } from 'vitest'
import { createDefaultConfig, validateConfig, mergeConfig } from './config'
import type { SessionConfig } from './config'

describe('session/config', () => {
  describe('createDefaultConfig', () => {
    it('returns a complete config with default values', () => {
      const config = createDefaultConfig()
      expect(config.functionTimeout).toBe(30_000)
      expect(config.askTimeout).toBe(300_000)
      expect(config.sessionTimeout).toBe(600_000)
      expect(config.maxStopCalls).toBe(50)
      expect(config.maxAsyncTasks).toBe(10)
      expect(config.maxCheckpointReminders).toBe(3)
      expect(config.maxContextTokens).toBe(100_000)
    })

    it('returns default serialization limits', () => {
      const config = createDefaultConfig()
      expect(config.serializationLimits.maxStringLength).toBe(2_000)
      expect(config.serializationLimits.maxArrayElements).toBe(50)
      expect(config.serializationLimits.maxObjectKeys).toBe(20)
      expect(config.serializationLimits.maxDepth).toBe(5)
    })

    it('returns default workspace limits', () => {
      const config = createDefaultConfig()
      expect(config.workspace.maxScopeVariables).toBe(50)
      expect(config.workspace.maxScopeValueWidth).toBe(50)
      expect(config.workspace.maxScopeTokens).toBe(3_000)
    })

    it('returns default context window settings', () => {
      const config = createDefaultConfig()
      expect(config.contextWindow.codeWindowLines).toBe(200)
      expect(config.contextWindow.stopDecayTiers.full).toBe(2)
      expect(config.contextWindow.stopDecayTiers.keysOnly).toBe(5)
      expect(config.contextWindow.stopDecayTiers.summary).toBe(10)
      expect(config.contextWindow.neverTruncateInterventions).toBe(true)
    })

    it('returns independent copies', () => {
      const a = createDefaultConfig()
      const b = createDefaultConfig()
      a.functionTimeout = 999
      expect(b.functionTimeout).toBe(30_000)
    })
  })

  describe('validateConfig', () => {
    it('accepts valid partial config', () => {
      const result = validateConfig({ functionTimeout: 5000 })
      expect(result.valid).toBe(true)
    })

    it('accepts empty object', () => {
      const result = validateConfig({})
      expect(result.valid).toBe(true)
    })

    it('accepts nested partial overrides', () => {
      const result = validateConfig({
        serializationLimits: { maxStringLength: 1000 },
        contextWindow: { codeWindowLines: 100 },
      })
      expect(result.valid).toBe(true)
    })

    it('rejects negative timeout', () => {
      const result = validateConfig({ functionTimeout: -1 })
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThan(0)
      }
    })

    it('rejects non-integer maxStopCalls', () => {
      const result = validateConfig({ maxStopCalls: 1.5 })
      expect(result.valid).toBe(false)
    })

    it('rejects wrong types', () => {
      const result = validateConfig({ functionTimeout: 'fast' })
      expect(result.valid).toBe(false)
    })
  })

  describe('mergeConfig', () => {
    it('overrides top-level fields', () => {
      const config = mergeConfig({ functionTimeout: 5000 })
      expect(config.functionTimeout).toBe(5000)
      expect(config.askTimeout).toBe(300_000) // default preserved
    })

    it('overrides nested fields without clobbering siblings', () => {
      const config = mergeConfig({
        serializationLimits: { maxStringLength: 500 },
      })
      expect(config.serializationLimits.maxStringLength).toBe(500)
      expect(config.serializationLimits.maxArrayElements).toBe(50) // default preserved
    })

    it('returns full config when given empty overrides', () => {
      const config = mergeConfig({})
      const def = createDefaultConfig()
      expect(config).toEqual(def)
    })

    it('deeply overrides contextWindow.stopDecayTiers', () => {
      const config = mergeConfig({
        contextWindow: { stopDecayTiers: { full: 1 } },
      })
      expect(config.contextWindow.stopDecayTiers.full).toBe(1)
      expect(config.contextWindow.stopDecayTiers.keysOnly).toBe(5)
    })
  })
})
