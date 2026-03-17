import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, updateScopeInPrompt } from './system-prompt'

describe('context/system-prompt', () => {
  describe('buildSystemPrompt', () => {
    it('replaces single slot', () => {
      const result = buildSystemPrompt('Hello {{NAME}}!', { NAME: 'World' })
      expect(result).toBe('Hello World!')
    })

    it('replaces multiple slots', () => {
      const template = '{{SCOPE}}\n---\n{{FUNCTIONS}}\n---\n{{COMPONENTS}}'
      const result = buildSystemPrompt(template, {
        SCOPE: 'x: number',
        FUNCTIONS: 'readFile()',
        COMPONENTS: '<Card />',
      })
      expect(result).toContain('x: number')
      expect(result).toContain('readFile()')
      expect(result).toContain('<Card />')
    })

    it('replaces multiple occurrences of same slot', () => {
      const result = buildSystemPrompt('{{X}} and {{X}}', { X: 'hello' })
      expect(result).toBe('hello and hello')
    })

    it('leaves unknown markers untouched', () => {
      const result = buildSystemPrompt('{{UNKNOWN}}', {})
      expect(result).toBe('{{UNKNOWN}}')
    })
  })

  describe('updateScopeInPrompt', () => {
    it('replaces scope content', () => {
      const prompt = 'Workspace:\n{{SCOPE}}\n\n{{FUNCTIONS}}'
      const result = updateScopeInPrompt(prompt, 'x: number = 42')
      expect(result).toContain('x: number = 42')
      expect(result).toContain('{{FUNCTIONS}}')
    })

    it('returns unchanged if no SCOPE marker', () => {
      const prompt = 'No scope here'
      expect(updateScopeInPrompt(prompt, 'table')).toBe(prompt)
    })
  })
})
