// src/lib/fs/parsers/config.test.ts

import { describe, it, expect } from 'vitest'
import {
  parseKnowledgeFieldIndex,
  serializeKnowledgeFieldIndex,
  parseKnowledgeDomainIndex,
  serializeKnowledgeDomainIndex,
} from './config'

describe('config parser', () => {
  describe('knowledge field index', () => {
    describe('parseKnowledgeFieldIndex', () => {
      it('should parse basic fields', () => {
        const content = `---\ntype: string\nvariable: gradeLevel\n---\nDescription here`
        const result = parseKnowledgeFieldIndex(content)
        expect(result.type).toBe('string')
        expect(result.variable).toBe('gradeLevel')
        expect(result.description).toBe('Description here')
      })

      it('should parse all extended fields', () => {
        const content = [
          '---',
          'type: select',
          'variable: gradeLevel',
          'default: middle',
          'label: "Grade Level"',
          'fieldType: select',
          'required: true',
          'renderAs: section',
          '---',
          'Choose a grade level.',
        ].join('\n')
        const result = parseKnowledgeFieldIndex(content)
        expect(result.type).toBe('select')
        expect(result.variable).toBe('gradeLevel')
        expect(result.default).toBe('middle')
        expect(result.label).toBe('Grade Level')
        expect(result.fieldType).toBe('select')
        expect(result.required).toBe(true)
        expect(result.renderAs).toBe('section')
        expect(result.description).toBe('Choose a grade level.')
      })

      it('should handle missing optional fields', () => {
        const content = `---\ntype: string\nvariable: myVar\n---\n`
        const result = parseKnowledgeFieldIndex(content)
        expect(result.label).toBeUndefined()
        expect(result.fieldType).toBeUndefined()
        expect(result.required).toBeUndefined()
        expect(result.renderAs).toBeUndefined()
      })

      it('should round-trip correctly', () => {
        const original = {
          type: 'select',
          variable: 'topic',
          default: 'math',
          label: 'Topic',
          fieldType: 'select',
          required: true,
          renderAs: 'section',
        }
        const serialized = serializeKnowledgeFieldIndex(original, 'Pick a topic.')
        const parsed = parseKnowledgeFieldIndex(serialized)
        expect(parsed.type).toBe('select')
        expect(parsed.variable).toBe('topic')
        expect(parsed.default).toBe('math')
        expect(parsed.label).toBe('Topic')
        expect(parsed.fieldType).toBe('select')
        expect(parsed.required).toBe(true)
        expect(parsed.renderAs).toBe('section')
        expect(parsed.description).toBe('Pick a topic.')
      })
    })

    describe('serializeKnowledgeFieldIndex', () => {
      it('should serialize basic index', () => {
        const result = serializeKnowledgeFieldIndex({ type: 'string', variable: 'myVar' }, 'A description')
        expect(result).toContain('type: string')
        expect(result).toContain('variable: myVar')
        expect(result).toContain('A description')
      })

      it('should omit undefined optional fields', () => {
        const result = serializeKnowledgeFieldIndex({ type: 'string', variable: 'x' }, '')
        expect(result).not.toContain('label:')
        expect(result).not.toContain('fieldType:')
        expect(result).not.toContain('required:')
        expect(result).not.toContain('renderAs:')
      })

      it('should include present optional fields', () => {
        const result = serializeKnowledgeFieldIndex(
          { type: 'string', variable: 'x', label: 'My Label', required: false, renderAs: 'section' },
          '',
        )
        expect(result).toContain('label: "My Label"')
        expect(result).toContain('required: false')
        expect(result).toContain('renderAs: section')
      })
    })
  })

  describe('knowledge domain index', () => {
    describe('parseKnowledgeDomainIndex', () => {
      it('should parse all fields', () => {
        const content = [
          '---',
          'label: "Curriculum"',
          'icon: 📚',
          'color: "#4A90E2"',
          'renderAs: section',
          '---',
          'Core curriculum knowledge.',
        ].join('\n')
        const result = parseKnowledgeDomainIndex(content)
        expect(result.label).toBe('Curriculum')
        expect(result.icon).toBe('📚')
        expect(result.color).toBe('#4A90E2')
        expect(result.renderAs).toBe('section')
        expect(result.description).toBe('Core curriculum knowledge.')
      })

      it('should handle missing fields', () => {
        const content = `---\n---\n`
        const result = parseKnowledgeDomainIndex(content)
        expect(result.label).toBeUndefined()
        expect(result.icon).toBeUndefined()
        expect(result.color).toBeUndefined()
        expect(result.description).toBe('')
      })

      it('should round-trip correctly', () => {
        const original = { label: 'Science', icon: '🔬', color: '#00FF00', renderAs: 'section' }
        const serialized = serializeKnowledgeDomainIndex(original, 'Science domain.')
        const parsed = parseKnowledgeDomainIndex(serialized)
        expect(parsed.label).toBe('Science')
        expect(parsed.icon).toBe('🔬')
        expect(parsed.color).toBe('#00FF00')
        expect(parsed.renderAs).toBe('section')
        expect(parsed.description).toBe('Science domain.')
      })
    })

    describe('serializeKnowledgeDomainIndex', () => {
      it('should serialize all fields', () => {
        const result = serializeKnowledgeDomainIndex(
          { label: 'Math', icon: '🔢', color: '#FF0000' },
          'Math knowledge.',
        )
        expect(result).toContain('label: "Math"')
        expect(result).toContain('icon: 🔢')
        expect(result).toContain('color: "#FF0000"')
        expect(result).toContain('Math knowledge.')
      })

      it('should omit undefined optional fields', () => {
        const result = serializeKnowledgeDomainIndex({}, '')
        expect(result).not.toContain('label:')
        expect(result).not.toContain('icon:')
        expect(result).not.toContain('color:')
      })
    })
  })
})
