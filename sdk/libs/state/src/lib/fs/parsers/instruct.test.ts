// src/lib/fs/parsers/instruct.test.ts
// Updated for the NEW spec: AgentInstruct uses title/knowledge/functions/components/actions/canDelegateTo/body

import { describe, it, expect } from 'vitest'
import { parseAgentInstruct, serializeAgentInstruct, type AgentInstruct } from './instruct'

describe('instruct parser', () => {
  describe('parseAgentInstruct', () => {
    it('should parse a minimal instruct.md', () => {
      const content = `---
title: Chef
knowledge: []
functions: []
components: []
actions: []
canDelegateTo: []
---
You are an expert chef.`

      const result = parseAgentInstruct(content)

      expect(result.title).toBe('Chef')
      expect(result.knowledge).toEqual([])
      expect(result.functions).toEqual([])
      expect(result.components).toEqual([])
      expect(result.actions).toEqual([])
      expect(result.canDelegateTo).toEqual([])
      expect(result.body).toBe('You are an expert chef.')
    })

    it('should parse knowledge and function arrays (inline)', () => {
      const content = `---
title: Analyst
knowledge: [cuisine/style, cuisine/level]
functions: [queryData, formatOutput]
components: []
actions: []
canDelegateTo: []
---
Analyse data.`

      const result = parseAgentInstruct(content)
      expect(result.knowledge).toEqual(['cuisine/style', 'cuisine/level'])
      expect(result.functions).toEqual(['queryData', 'formatOutput'])
    })

    it('should parse block-list arrays (cooking fixture format)', () => {
      const content = `---
title: Chef
knowledge: []
functions:
  - addIngredient
  - putPotOnHeat
  - getPotTemperature
  - checkPot
components:
  - SaltinessSlider
  - ConfirmDish
  - PotStatus
actions:
  - id: cook_pasta
    label: "Cook Pasta"
    description: "Make a full pasta dish from scratch"
    tasklist: make_pasta
canDelegateTo:
  - sommelier-space/pairing
---

You are an expert chef.`

      const result = parseAgentInstruct(content)

      expect(result.title).toBe('Chef')
      expect(result.functions).toEqual(['addIngredient', 'putPotOnHeat', 'getPotTemperature', 'checkPot'])
      expect(result.components).toEqual(['SaltinessSlider', 'ConfirmDish', 'PotStatus'])
      expect(result.actions).toHaveLength(1)
      expect(result.actions[0].id).toBe('cook_pasta')
      expect(result.actions[0].label).toBe('Cook Pasta')
      expect(result.actions[0].description).toBe('Make a full pasta dish from scratch')
      expect(result.actions[0].tasklist).toBe('make_pasta')
      expect(result.canDelegateTo).toEqual(['sommelier-space/pairing'])
      expect(result.body).toContain('expert chef')
    })

    it('should parse defaultAction field', () => {
      const content = `---
title: Agent
knowledge: []
functions: []
components: []
defaultAction: cook_pasta
actions:
  - id: cook_pasta
    label: "Cook Pasta"
    description: "desc"
    tasklist: make_pasta
canDelegateTo: []
---
Body.`

      const result = parseAgentInstruct(content)
      expect(result.defaultAction).toBe('cook_pasta')
    })

    it('should return defaults for missing fields', () => {
      const content = `---
title: Bot
---
Instructions here`

      const result = parseAgentInstruct(content)
      expect(result.title).toBe('Bot')
      expect(result.knowledge).toEqual([])
      expect(result.functions).toEqual([])
      expect(result.components).toEqual([])
      expect(result.actions).toEqual([])
      expect(result.canDelegateTo).toEqual([])
      expect(result.defaultAction).toBeUndefined()
    })

    it('should fall back to legacy `dependencies` key when canDelegateTo is absent', () => {
      const content = `---
title: Legacy
knowledge: []
functions: []
components: []
actions: []
dependencies:
  - sommelier-space/pairing
---
Body.`

      const result = parseAgentInstruct(content)
      expect(result.canDelegateTo).toEqual(['sommelier-space/pairing'])
    })

    it('should handle content without frontmatter', () => {
      const result = parseAgentInstruct('Just a body, no frontmatter')
      expect(result.title).toBe('')
      expect(result.body).toBe('Just a body, no frontmatter')
    })

    it('should handle empty content', () => {
      const result = parseAgentInstruct('')
      expect(result.title).toBe('')
      expect(result.body).toBe('')
    })

    it('should preserve multi-line body', () => {
      const content = `---
title: Bot
---
Line 1
Line 2
Line 3`

      const result = parseAgentInstruct(content)
      expect(result.body).toBe('Line 1\nLine 2\nLine 3')
    })
  })

  describe('serializeAgentInstruct', () => {
    it('should serialize a minimal instruct', () => {
      const instruct: AgentInstruct = {
        title: 'Test Bot',
        knowledge: [],
        functions: [],
        components: [],
        actions: [],
        canDelegateTo: [],
        body: 'Be helpful',
      }

      const result = serializeAgentInstruct(instruct)

      expect(result).toContain('---')
      expect(result).toContain('title: Test Bot')
      expect(result).toContain('knowledge: []')
      expect(result).toContain('Be helpful')
    })

    it('should serialize arrays as block lists', () => {
      const instruct: AgentInstruct = {
        title: 'Chef',
        knowledge: ['cuisine/style'],
        functions: ['addIngredient', 'checkPot'],
        components: ['PotStatus'],
        actions: [
          { id: 'cook_pasta', label: 'Cook Pasta', description: 'Cook pasta', tasklist: 'make_pasta' },
        ],
        canDelegateTo: ['sommelier-space/pairing'],
        body: 'You are a chef.',
      }

      const result = serializeAgentInstruct(instruct)
      expect(result).toContain('knowledge:\n  - cuisine/style')
      expect(result).toContain('functions:\n  - addIngredient\n  - checkPot')
      expect(result).toContain('components:\n  - PotStatus')
      expect(result).toContain('  - id: cook_pasta')
      expect(result).toContain('    tasklist: make_pasta')
      expect(result).toContain('canDelegateTo:\n  - sommelier-space/pairing')
    })

    it('should include defaultAction when set', () => {
      const instruct: AgentInstruct = {
        title: 'Bot',
        knowledge: [],
        functions: [],
        components: [],
        defaultAction: 'cook_pasta',
        actions: [
          { id: 'cook_pasta', label: 'Cook', description: 'desc', tasklist: 'make_pasta' },
        ],
        canDelegateTo: [],
        body: 'Body',
      }

      const result = serializeAgentInstruct(instruct)
      expect(result).toContain('defaultAction: cook_pasta')
    })

    it('should not include defaultAction when undefined', () => {
      const instruct: AgentInstruct = {
        title: 'Bot',
        knowledge: [],
        functions: [],
        components: [],
        actions: [],
        canDelegateTo: [],
        body: 'Body',
      }

      const result = serializeAgentInstruct(instruct)
      expect(result).not.toContain('defaultAction')
    })

    it('should round-trip correctly', () => {
      const original: AgentInstruct = {
        title: 'Chef',
        knowledge: ['cuisine/style', 'cuisine/level'],
        functions: ['addIngredient'],
        components: ['PotStatus'],
        actions: [{ id: 'cook_pasta', label: 'Cook Pasta', description: 'desc', tasklist: 'make_pasta' }],
        defaultAction: 'cook_pasta',
        canDelegateTo: ['sommelier-space/pairing'],
        body: 'You are an expert chef.',
      }

      const serialized = serializeAgentInstruct(original)
      const reparsed = parseAgentInstruct(serialized)

      expect(reparsed.title).toBe(original.title)
      expect(reparsed.knowledge).toEqual(original.knowledge)
      expect(reparsed.functions).toEqual(original.functions)
      expect(reparsed.components).toEqual(original.components)
      expect(reparsed.actions[0].id).toBe('cook_pasta')
      expect(reparsed.actions[0].tasklist).toBe('make_pasta')
      expect(reparsed.defaultAction).toBe('cook_pasta')
      expect(reparsed.canDelegateTo).toEqual(original.canDelegateTo)
      expect(reparsed.body).toBe(original.body)
    })
  })
})
